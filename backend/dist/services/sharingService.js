"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharingService = exports.SharingService = void 0;
const prisma_1 = require("../../generated/prisma");
const emailService_1 = require("../utils/emailService");
const prisma = new prisma_1.PrismaClient();
class SharingService {
    async configureSharing(userId, config) {
        const { sharedWithUserId, permissionLevel, expiresAt, childPermissions } = config;
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
        const share = await prisma.$transaction(async (tx) => {
            let activityShare = await tx.activityShare.findUnique({
                where: {
                    sharingUserId_sharedWithUserId: {
                        sharingUserId: userId,
                        sharedWithUserId
                    }
                }
            });
            if (activityShare) {
                activityShare = await tx.activityShare.update({
                    where: { id: activityShare.id },
                    data: {
                        permissionLevel,
                        expiresAt,
                        isActive: true
                    }
                });
                await tx.activityShareProfile.deleteMany({
                    where: { activityShareId: activityShare.id }
                });
            }
            else {
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
            await tx.activityShareProfile.createMany({
                data: childPermissions.map(cp => ({
                    activityShareId: activityShare.id,
                    childId: cp.childId,
                    canViewInterested: cp.canViewInterested,
                    canViewRegistered: cp.canViewRegistered,
                    canViewCompleted: cp.canViewCompleted,
                    canViewNotes: cp.canViewNotes
                }))
            });
            return activityShare;
        });
        await emailService_1.emailService.sendShareConfiguredNotification(sharedWithUser.email, sharedWithUser.name, sharingUser.name, children.map(c => c.name));
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
    async getUserShares(userId) {
        const [myShares, sharedWithMe] = await Promise.all([
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
    async getSharedChildren(userId, sharingUserId) {
        const whereConditions = {
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
        const sharedChildren = [];
        for (const share of shares) {
            for (const profile of share.profiles) {
                const { child } = profile;
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
                if (!profile.canViewNotes) {
                    filteredActivities.forEach(activity => {
                        activity.notes = null;
                    });
                }
                const now = new Date();
                const finalActivities = filteredActivities.filter(ca => {
                    if (share.permissionLevel === 'view_future') {
                        return ca.activity.dateStart && ca.activity.dateStart > now;
                    }
                    return true;
                });
                sharedChildren.push({
                    ...child,
                    activities: finalActivities,
                    shareProfile: profile
                });
            }
        }
        return sharedChildren;
    }
    async updateShare(shareId, userId, data) {
        const share = await prisma.activityShare.findUnique({
            where: { id: shareId }
        });
        if (!share) {
            throw new Error('Share not found');
        }
        if (share.sharingUserId !== userId) {
            throw new Error('You can only update shares you created');
        }
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
        if (data.isActive === false) {
            const sharingUser = await prisma.user.findUnique({
                where: { id: userId }
            });
            if (sharingUser) {
                await emailService_1.emailService.sendShareRevokedNotification(updatedShare.sharedWithUser.email, updatedShare.sharedWithUser.name, sharingUser.name);
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
    async updateChildPermissions(shareId, childId, userId, data) {
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
    async removeChildFromShare(shareId, childId, userId) {
        const share = await prisma.activityShare.findUnique({
            where: { id: shareId }
        });
        if (!share) {
            throw new Error('Share not found');
        }
        if (share.sharingUserId !== userId) {
            throw new Error('You can only update shares you created');
        }
        await prisma.activityShareProfile.delete({
            where: {
                activityShareId_childId: {
                    activityShareId: shareId,
                    childId
                }
            }
        });
        const remainingProfiles = await prisma.activityShareProfile.count({
            where: { activityShareId: shareId }
        });
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
    async addChildToShare(shareId, childId, userId, permissions) {
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
    async getSharingStats(userId) {
        const [sharingStats, sharedWithStats, childrenShared] = await Promise.all([
            prisma.activityShare.count({
                where: {
                    sharingUserId: userId,
                    isActive: true
                }
            }),
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
    async cleanupExpiredShares() {
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
    async hasAccessToChild(viewerId, childId) {
        const child = await prisma.child.findUnique({
            where: { id: childId }
        });
        if (!child) {
            return false;
        }
        if (child.userId === viewerId) {
            return true;
        }
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
exports.SharingService = SharingService;
exports.sharingService = new SharingService();
//# sourceMappingURL=sharingService.js.map