import { Invitation, User } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../utils/emailService';
import { securityUtils } from '../utils/securityUtils';
import { pushNotificationService } from './pushNotificationService';

interface CreateInvitationData {
  senderId: string;
  recipientEmail: string;
  message?: string;
  expiresInDays?: number;
}

interface AcceptInvitationData {
  token: string;
  userId: string;
}

interface InvitationWithSender extends Invitation {
  sender: {
    id: string;
    name: string;
    email: string;
  };
}

export class InvitationService {
  private readonly DEFAULT_EXPIRY_DAYS = 7;
  private readonly MAX_ACTIVE_INVITATIONS_PER_USER = 50;

  /**
   * Create and send an invitation
   */
  async createInvitation(data: CreateInvitationData): Promise<Invitation> {
    const { senderId, recipientEmail, message, expiresInDays = this.DEFAULT_EXPIRY_DAYS } = data;

    // Validate sender exists
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, name: true, email: true }
    });

    if (!sender) {
      throw new Error('Sender not found');
    }

    // Normalize email
    const normalizedEmail = recipientEmail.toLowerCase().trim();

    // Check if sender is trying to invite themselves
    if (normalizedEmail === sender.email.toLowerCase()) {
      throw new Error('Cannot invite yourself');
    }

    // Check if recipient is already a user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // Check if they already have an active share
    if (existingUser) {
      const existingShare = await prisma.activityShare.findUnique({
        where: {
          sharingUserId_sharedWithUserId: {
            sharingUserId: senderId,
            sharedWithUserId: existingUser.id
          }
        }
      });

      if (existingShare && existingShare.isActive) {
        throw new Error('You already have an active share with this user');
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        senderId,
        recipientEmail: normalizedEmail,
        status: 'pending',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvitation) {
      throw new Error('An invitation to this email is already pending');
    }

    // Check invitation limit
    const activeInvitationCount = await prisma.invitation.count({
      where: {
        senderId,
        status: 'pending',
        expiresAt: { gt: new Date() }
      }
    });

    if (activeInvitationCount >= this.MAX_ACTIVE_INVITATIONS_PER_USER) {
      throw new Error(`You have reached the maximum of ${this.MAX_ACTIVE_INVITATIONS_PER_USER} active invitations`);
    }

    // Generate secure token
    const token = securityUtils.generateSecureToken();
    
    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        senderId,
        recipientEmail: normalizedEmail,
        recipientUserId: existingUser?.id,
        status: 'pending',
        message,
        token,
        expiresAt
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Send invitation email
    await emailService.sendActivityShareInvitation(
      normalizedEmail,
      sender.name,
      token,
      message,
      expiresInDays,
      existingUser?.name
    );

    // Send push notification if recipient is an existing user
    if (existingUser) {
      try {
        await pushNotificationService.sendInvitationNotification(
          existingUser.id,
          sender.name,
          token
        );
        console.log('[Invitation] Push notification sent to existing user:', existingUser.id);
      } catch (pushError) {
        // Don't fail the invitation if push notification fails
        console.error('[Invitation] Failed to send push notification:', pushError);
      }
    }

    // Log the invitation
    console.log({
      action: 'invitation_created',
      senderId,
      recipientEmail: normalizedEmail,
      invitationId: invitation.id,
      timestamp: new Date().toISOString()
    });

    return invitation;
  }

  /**
   * Get invitations sent by a user
   */
  async getSentInvitations(userId: string): Promise<InvitationWithSender[]> {
    const invitations = await prisma.invitation.findMany({
      where: { senderId: userId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return invitations as InvitationWithSender[];
  }

  /**
   * Get invitations received by a user
   */
  async getReceivedInvitations(userEmail: string): Promise<InvitationWithSender[]> {
    const invitations = await prisma.invitation.findMany({
      where: {
        recipientEmail: userEmail.toLowerCase(),
        status: 'pending',
        expiresAt: { gt: new Date() }
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            children: {
              select: {
                id: true,
                name: true,
                dateOfBirth: true,
                avatarUrl: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return invitations as InvitationWithSender[];
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(data: AcceptInvitationData): Promise<void> {
    const { token, userId } = data;

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        sender: true
      }
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' }
      });
      throw new Error('This invitation has expired');
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      throw new Error(`This invitation has already been ${invitation.status}`);
    }

    // Verify the accepting user
    const acceptingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!acceptingUser) {
      throw new Error('User not found');
    }

    // Check if the invitation is for this user
    if (invitation.recipientEmail.toLowerCase() !== acceptingUser.email.toLowerCase()) {
      throw new Error('This invitation is not for your email address');
    }

    // Start a transaction to accept invitation and create share
    await prisma.$transaction(async (tx) => {
      // Update invitation status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          recipientUserId: userId
        }
      });

      // Check if share already exists (might have been deleted)
      const existingShare = await tx.activityShare.findUnique({
        where: {
          sharingUserId_sharedWithUserId: {
            sharingUserId: invitation.senderId,
            sharedWithUserId: userId
          }
        }
      });

      if (existingShare) {
        // Reactivate the share
        await tx.activityShare.update({
          where: { id: existingShare.id },
          data: { isActive: true }
        });
      } else {
        // Create new activity share with default permissions
        await tx.activityShare.create({
          data: {
            sharingUserId: invitation.senderId,
            sharedWithUserId: userId,
            permissionLevel: 'view_registered',
            isActive: true,
          }
        });
      }
    });

    // Send confirmation emails
    await emailService.sendShareAcceptedNotification(
      invitation.sender.email,
      invitation.sender.name,
      acceptingUser.name
    );

    // Send push notification to the sender
    try {
      await pushNotificationService.sendInvitationAcceptedNotification(
        invitation.senderId,
        acceptingUser.name
      );
      console.log('[Invitation] Push notification sent to sender:', invitation.senderId);
    } catch (pushError) {
      // Don't fail if push notification fails
      console.error('[Invitation] Failed to send acceptance push notification:', pushError);
    }

    // Log the acceptance
    console.log({
      action: 'invitation_accepted',
      invitationId: invitation.id,
      senderId: invitation.senderId,
      acceptorId: userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(token: string, userId: string): Promise<void> {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        sender: true
      }
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // Verify the declining user
    const decliningUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!decliningUser) {
      throw new Error('User not found');
    }

    // Check if the invitation is for this user
    if (invitation.recipientEmail.toLowerCase() !== decliningUser.email.toLowerCase()) {
      throw new Error('This invitation is not for your email address');
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      throw new Error(`This invitation has already been ${invitation.status}`);
    }

    // Update invitation status
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'declined',
        recipientUserId: userId
      }
    });

    // Send notification to sender
    await emailService.sendShareDeclinedNotification(
      invitation.sender.email,
      invitation.sender.name,
      decliningUser.name
    );

    // Log the decline
    console.log({
      action: 'invitation_declined',
      invitationId: invitation.id,
      senderId: invitation.senderId,
      declinerId: userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Cancel a sent invitation
   */
  async cancelInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Verify the user is the sender
    if (invitation.senderId !== userId) {
      throw new Error('You can only cancel invitations you sent');
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      throw new Error('Only pending invitations can be cancelled');
    }

    // Update invitation status
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'cancelled' }
    });

    // Log the cancellation
    console.log({
      action: 'invitation_cancelled',
      invitationId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get invitation by token (for viewing before accepting)
   */
  async getInvitationByToken(token: string): Promise<InvitationWithSender | null> {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            children: {
              where: { isActive: true },
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
    });

    if (!invitation) {
      return null;
    }

    // Check if expired
    if (invitation.expiresAt < new Date() && invitation.status === 'pending') {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' }
      });
      invitation.status = 'expired';
    }

    return invitation as InvitationWithSender;
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(): Promise<number> {
    const result = await prisma.invitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() }
      },
      data: { status: 'expired' }
    });

    console.log({
      action: 'expired_invitations_cleanup',
      count: result.count,
      timestamp: new Date().toISOString()
    });

    return result.count;
  }

  /**
   * Resend an invitation email
   */
  async resendInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        sender: true
      }
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Verify the user is the sender
    if (invitation.senderId !== userId) {
      throw new Error('You can only resend invitations you sent');
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      throw new Error('Only pending invitations can be resent');
    }

    // Check if not expired
    if (invitation.expiresAt < new Date()) {
      throw new Error('This invitation has expired');
    }

    // Resend email
    const recipient = await prisma.user.findUnique({
      where: { email: invitation.recipientEmail }
    });

    await emailService.sendActivityShareInvitation(
      invitation.recipientEmail,
      invitation.sender.name,
      invitation.token,
      invitation.message || undefined,
      Math.ceil((invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      recipient?.name
    );

    console.log({
      action: 'invitation_resent',
      invitationId,
      timestamp: new Date().toISOString()
    });
  }
}

export const invitationService = new InvitationService();