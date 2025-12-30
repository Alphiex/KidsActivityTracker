import { ActivityShare, ActivityShareProfile, Child, ChildActivity } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { emailService } from '../utils/emailService';
import { v4 as uuidv4 } from 'uuid';

interface ShareConfiguration {
  sharedWithUserId: string;
  permissionLevel: 'view_all' | 'view_registered' | 'view_future';
  expiresAt?: Date;
  childPermissions: {
    childId: string;
    canViewInterested: boolean;
    canViewRegistered: boolean;
    canViewCompleted: boolean;
    canViewNotes: boolean;
  }[];
}

interface UpdateShareData {
  permissionLevel?: 'view_all' | 'view_registered' | 'view_future';
  expiresAt?: Date | null;
  isActive?: boolean;
}

interface UpdateChildPermissionData {
  canViewInterested?: boolean;
  canViewRegistered?: boolean;
  canViewCompleted?: boolean;
  canViewNotes?: boolean;
}

interface SharedChildWithActivities extends Child {
  activities: ChildActivity[];
  shareProfile: ActivityShareProfile;
}

export class SharingService {
  /**
   * Configure sharing with another user
   */
  async configureSharing(userId: string, config: ShareConfiguration): Promise<ActivityShare> {
    const { sharedWithUserId, permissionLevel, expiresAt, childPermissions } = config;

    // Validate users
    const [sharingUser, sharedWithUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findUnique({ where: { id: sharedWithUserId } })
    ]);

    if (!sharingUser || !sharedWithUser) {
      throw new Error('Invalid user');
    }

    if (userId === sharedWithUserId) {
      throw new Error('Cannot share with yourself');
    }

    // Validate children belong to sharing user
    const childIds = childPermissions.map(cp => cp.childId);
    const children = await prisma.child.findMany({
      where: {
        id: { in: childIds },
        userId,
        isActive: true
      }
    });

    if (children.length !== childIds.length) {
      throw new Error('One or more children not found or inactive');
    }

    // Create or update the share in a transaction
    const share = await prisma.$transaction(async (tx) => {
      // Check for existing share
      let activityShare = await tx.activityShare.findUnique({
        where: {
          sharingUserId_sharedWithUserId: {
            sharingUserId: userId,
            sharedWithUserId
          }
        }
      });

      if (activityShare) {
        // Update existing share
        activityShare = await tx.activityShare.update({
          where: { id: activityShare.id },
          data: {
            permissionLevel,
            expiresAt,
            isActive: true
          }
        });

        // Remove old child permissions
        await tx.activityShareProfile.deleteMany({
          where: { activityShareId: activityShare.id }
        });
      } else {
        // Create new share
        activityShare = await tx.activityShare.create({
          data: {
            sharingUserId: userId,
            sharedWithUserId,
            permissionLevel,
            expiresAt,
            isActive: true
          }
        });
      }

      // Create child permissions
      await tx.activityShareProfile.createMany({
        data: childPermissions.map(cp => ({
          activityShareId: activityShare!.id,
          childId: cp.childId,
          canViewInterested: cp.canViewInterested,
          canViewRegistered: cp.canViewRegistered,
          canViewCompleted: cp.canViewCompleted,
          canViewNotes: cp.canViewNotes
        }))
      });

      return activityShare;
    });

    // Send notification email
    await emailService.sendShareConfiguredNotification(
      sharedWithUser.email,
      sharedWithUser.name,
      sharingUser.name,
      children.map(c => c.name)
    );

    // Log the share configuration
    console.log({
      action: 'share_configured',
      sharingUserId: userId,
      sharedWithUserId,
      shareId: share.id,
      childrenCount: children.length,
      timestamp: new Date().toISOString()
    });

    return share;
  }

  /**
   * Get all shares for a user (both sharing and shared with)
   */
  async getUserShares(userId: string) {
    const [myShares, sharedWithMe] = await Promise.all([
      // Shares I've created
      prisma.activityShare.findMany({
        where: {
          sharingUserId: userId,
          isActive: true
        },
        include: {
          sharedWithUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          profiles: {
            include: {
              child: {
                select: {
                  id: true,
                  name: true,
                  dateOfBirth: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      }),
      // Shares others have created for me
      prisma.activityShare.findMany({
        where: {
          sharedWithUserId: userId,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          sharingUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          profiles: {
            include: {
              child: {
                select: {
                  id: true,
                  name: true,
                  dateOfBirth: true,
                  avatarUrl: true,
                  interests: true
                }
              }
            }
          }
        }
      })
    ]);

    return { myShares, sharedWithMe };
  }

  /**
   * Get shared children and their activities
   */
  async getSharedChildren(userId: string, sharingUserId?: string): Promise<SharedChildWithActivities[]> {
    // Build query conditions
    const whereConditions: any = {
      sharedWithUserId: userId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };

    if (sharingUserId) {
      whereConditions.sharingUserId = sharingUserId;
    }

    // Get all active shares for this user
    const shares = await prisma.activityShare.findMany({
      where: whereConditions,
      include: {
        profiles: {
          include: {
            child: {
              include: {
                childActivities: {
                  include: {
                    activity: {
                      include: {
                        location: true,
                        provider: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Process and filter children based on permissions
    const sharedChildren: SharedChildWithActivities[] = [];

    for (const share of shares) {
      for (const profile of share.profiles) {
        const { child } = profile;
        
        // Filter activities based on permissions
        const filteredActivities = child.childActivities.filter(ca => {
          switch (ca.status) {
            case 'interested':
              return profile.canViewInterested;
            case 'registered':
              return profile.canViewRegistered;
            case 'completed':
              return profile.canViewCompleted;
            default:
              return false;
          }
        });

        // Remove notes if not permitted
        if (!profile.canViewNotes) {
          filteredActivities.forEach(activity => {
            activity.notes = null;
          });
        }

        // Apply share-level permission filters
        const now = new Date();
        const finalActivities = filteredActivities.filter(ca => {
          if (share.permissionLevel === 'view_future') {
            // Only show future activities
            return ca.activity.dateStart && ca.activity.dateStart > now;
          }
          return true;
        });

        sharedChildren.push({
          ...child,
          activities: finalActivities as any,
          shareProfile: profile
        });
      }
    }

    return sharedChildren;
  }

  /**
   * Update share settings
   */
  async updateShare(shareId: string, userId: string, data: UpdateShareData): Promise<ActivityShare> {
    // Verify ownership
    const share = await prisma.activityShare.findUnique({
      where: { id: shareId }
    });

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.sharingUserId !== userId) {
      throw new Error('You can only update shares you created');
    }

    // Update the share
    const updatedShare = await prisma.activityShare.update({
      where: { id: shareId },
      data: {
        ...data,
      },
      include: {
        sharedWithUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // If deactivated, send notification
    if (data.isActive === false) {
      const sharingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (sharingUser) {
        await emailService.sendShareRevokedNotification(
          updatedShare.sharedWithUser.email,
          updatedShare.sharedWithUser.name,
          sharingUser.name
        );
      }
    }

    console.log({
      action: 'share_updated',
      shareId,
      userId,
      updates: Object.keys(data),
      timestamp: new Date().toISOString()
    });

    return updatedShare;
  }

  /**
   * Update child-specific permissions
   */
  async updateChildPermissions(
    shareId: string,
    childId: string,
    userId: string,
    data: UpdateChildPermissionData
  ): Promise<ActivityShareProfile> {
    // Verify ownership
    const share = await prisma.activityShare.findUnique({
      where: { id: shareId },
      include: {
        profiles: {
          where: { childId }
        }
      }
    });

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.sharingUserId !== userId) {
      throw new Error('You can only update shares you created');
    }

    if (share.profiles.length === 0) {
      throw new Error('Child not found in this share');
    }

    // Update permissions
    const updatedProfile = await prisma.activityShareProfile.update({
      where: {
        activityShareId_childId: {
          activityShareId: shareId,
          childId
        }
      },
      data
    });

    console.log({
      action: 'child_permissions_updated',
      shareId,
      childId,
      userId,
      updates: Object.keys(data),
      timestamp: new Date().toISOString()
    });

    return updatedProfile;
  }

  /**
   * Remove a child from sharing
   */
  async removeChildFromShare(shareId: string, childId: string, userId: string): Promise<void> {
    // Verify ownership
    const share = await prisma.activityShare.findUnique({
      where: { id: shareId }
    });

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.sharingUserId !== userId) {
      throw new Error('You can only update shares you created');
    }

    // Delete the child profile
    await prisma.activityShareProfile.delete({
      where: {
        activityShareId_childId: {
          activityShareId: shareId,
          childId
        }
      }
    });

    // Check if there are any children left in the share
    const remainingProfiles = await prisma.activityShareProfile.count({
      where: { activityShareId: shareId }
    });

    // If no children left, deactivate the share
    if (remainingProfiles === 0) {
      await prisma.activityShare.update({
        where: { id: shareId },
        data: { isActive: false }
      });
    }

    console.log({
      action: 'child_removed_from_share',
      shareId,
      childId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add a child to an existing share
   */
  async addChildToShare(
    shareId: string,
    childId: string,
    userId: string,
    permissions: UpdateChildPermissionData
  ): Promise<ActivityShareProfile> {
    // Verify ownership and child
    const [share, child] = await Promise.all([
      prisma.activityShare.findUnique({ where: { id: shareId } }),
      prisma.child.findUnique({ where: { id: childId, userId, isActive: true } })
    ]);

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.sharingUserId !== userId) {
      throw new Error('You can only update shares you created');
    }

    if (!child) {
      throw new Error('Child not found or inactive');
    }

    // Check if child already in share
    const existingProfile = await prisma.activityShareProfile.findUnique({
      where: {
        activityShareId_childId: {
          activityShareId: shareId,
          childId
        }
      }
    });

    if (existingProfile) {
      throw new Error('Child already included in this share');
    }

    // Add child to share
    const profile = await prisma.activityShareProfile.create({
      data: {
        activityShareId: shareId,
        childId,
        canViewInterested: permissions.canViewInterested ?? true,
        canViewRegistered: permissions.canViewRegistered ?? true,
        canViewCompleted: permissions.canViewCompleted ?? false,
        canViewNotes: permissions.canViewNotes ?? false
      }
    });

    console.log({
      action: 'child_added_to_share',
      shareId,
      childId,
      userId,
      timestamp: new Date().toISOString()
    });

    return profile;
  }

  /**
   * Get sharing statistics for a user
   */
  async getSharingStats(userId: string) {
    const [sharingStats, sharedWithStats, childrenShared] = await Promise.all([
      // How many people I'm sharing with
      prisma.activityShare.count({
        where: {
          sharingUserId: userId,
          isActive: true
        }
      }),
      // How many people are sharing with me
      prisma.activityShare.count({
        where: {
          sharedWithUserId: userId,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }),
      // How many of my children are being shared
      prisma.activityShareProfile.count({
        where: {
          child: {
            userId,
            isActive: true
          },
          activityShare: {
            isActive: true
          }
        }
      })
    ]);

    return {
      sharingWith: sharingStats,
      sharedWithMe: sharedWithStats,
      childrenShared
    };
  }

  /**
   * Clean up expired shares
   */
  async cleanupExpiredShares(): Promise<number> {
    const result = await prisma.activityShare.updateMany({
      where: {
        isActive: true,
        expiresAt: {
          not: null,
          lt: new Date()
        }
      },
      data: { isActive: false }
    });

    console.log({
      action: 'expired_shares_cleanup',
      count: result.count,
      timestamp: new Date().toISOString()
    });

    return result.count;
  }

  /**
   * Check if a user has access to view a specific child's activities
   */
  async hasAccessToChild(viewerId: string, childId: string): Promise<boolean> {
    // Check if viewer owns the child
    const child = await prisma.child.findUnique({
      where: { id: childId }
    });

    if (!child) {
      return false;
    }

    if (child.userId === viewerId) {
      return true;
    }

    // Check if child is shared with viewer
    const share = await prisma.activityShareProfile.findFirst({
      where: {
        childId,
        activityShare: {
          sharedWithUserId: viewerId,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }
    });

    return !!share;
  }
}

export const sharingService = new SharingService();