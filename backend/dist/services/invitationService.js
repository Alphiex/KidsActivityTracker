"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationService = exports.InvitationService = void 0;
const prisma_1 = require("../../generated/prisma");
const emailService_1 = require("../utils/emailService");
const securityUtils_1 = require("../utils/securityUtils");
const prisma = new prisma_1.PrismaClient();
class InvitationService {
    constructor() {
        this.DEFAULT_EXPIRY_DAYS = 7;
        this.MAX_ACTIVE_INVITATIONS_PER_USER = 50;
    }
    async createInvitation(data) {
        const { senderId, recipientEmail, message, expiresInDays = this.DEFAULT_EXPIRY_DAYS } = data;
        const sender = await prisma.user.findUnique({
            where: { id: senderId },
            select: { id: true, name: true, email: true }
        });
        if (!sender) {
            throw new Error('Sender not found');
        }
        const normalizedEmail = recipientEmail.toLowerCase().trim();
        if (normalizedEmail === sender.email.toLowerCase()) {
            throw new Error('Cannot invite yourself');
        }
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });
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
        const token = securityUtils_1.securityUtils.generateSecureToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
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
        await emailService_1.emailService.sendActivityShareInvitation(normalizedEmail, sender.name, token, message, expiresInDays, existingUser?.name);
        console.log({
            action: 'invitation_created',
            senderId,
            recipientEmail: normalizedEmail,
            invitationId: invitation.id,
            timestamp: new Date().toISOString()
        });
        return invitation;
    }
    async getSentInvitations(userId) {
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
        return invitations;
    }
    async getReceivedInvitations(userEmail) {
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
        return invitations;
    }
    async acceptInvitation(data) {
        const { token, userId } = data;
        const invitation = await prisma.invitation.findUnique({
            where: { token },
            include: {
                sender: true
            }
        });
        if (!invitation) {
            throw new Error('Invalid invitation token');
        }
        if (invitation.expiresAt < new Date()) {
            await prisma.invitation.update({
                where: { id: invitation.id },
                data: { status: 'expired' }
            });
            throw new Error('This invitation has expired');
        }
        if (invitation.status !== 'pending') {
            throw new Error(`This invitation has already been ${invitation.status}`);
        }
        const acceptingUser = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!acceptingUser) {
            throw new Error('User not found');
        }
        if (invitation.recipientEmail.toLowerCase() !== acceptingUser.email.toLowerCase()) {
            throw new Error('This invitation is not for your email address');
        }
        await prisma.$transaction(async (tx) => {
            await tx.invitation.update({
                where: { id: invitation.id },
                data: {
                    status: 'accepted',
                    acceptedAt: new Date(),
                    recipientUserId: userId
                }
            });
            const existingShare = await tx.activityShare.findUnique({
                where: {
                    sharingUserId_sharedWithUserId: {
                        sharingUserId: invitation.senderId,
                        sharedWithUserId: userId
                    }
                }
            });
            if (existingShare) {
                await tx.activityShare.update({
                    where: { id: existingShare.id },
                    data: { isActive: true }
                });
            }
            else {
                await tx.activityShare.create({
                    data: {
                        sharingUserId: invitation.senderId,
                        sharedWithUserId: userId,
                        permissionLevel: 'view_registered',
                        isActive: true
                    }
                });
            }
        });
        await emailService_1.emailService.sendShareAcceptedNotification(invitation.sender.email, invitation.sender.name, acceptingUser.name);
        console.log({
            action: 'invitation_accepted',
            invitationId: invitation.id,
            senderId: invitation.senderId,
            acceptorId: userId,
            timestamp: new Date().toISOString()
        });
    }
    async declineInvitation(token, userId) {
        const invitation = await prisma.invitation.findUnique({
            where: { token },
            include: {
                sender: true
            }
        });
        if (!invitation) {
            throw new Error('Invalid invitation token');
        }
        const decliningUser = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!decliningUser) {
            throw new Error('User not found');
        }
        if (invitation.recipientEmail.toLowerCase() !== decliningUser.email.toLowerCase()) {
            throw new Error('This invitation is not for your email address');
        }
        if (invitation.status !== 'pending') {
            throw new Error(`This invitation has already been ${invitation.status}`);
        }
        await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
                status: 'declined',
                recipientUserId: userId
            }
        });
        await emailService_1.emailService.sendShareDeclinedNotification(invitation.sender.email, invitation.sender.name, decliningUser.name);
        console.log({
            action: 'invitation_declined',
            invitationId: invitation.id,
            senderId: invitation.senderId,
            declinerId: userId,
            timestamp: new Date().toISOString()
        });
    }
    async cancelInvitation(invitationId, userId) {
        const invitation = await prisma.invitation.findUnique({
            where: { id: invitationId }
        });
        if (!invitation) {
            throw new Error('Invitation not found');
        }
        if (invitation.senderId !== userId) {
            throw new Error('You can only cancel invitations you sent');
        }
        if (invitation.status !== 'pending') {
            throw new Error('Only pending invitations can be cancelled');
        }
        await prisma.invitation.update({
            where: { id: invitationId },
            data: { status: 'cancelled' }
        });
        console.log({
            action: 'invitation_cancelled',
            invitationId,
            userId,
            timestamp: new Date().toISOString()
        });
    }
    async getInvitationByToken(token) {
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
        if (invitation.expiresAt < new Date() && invitation.status === 'pending') {
            await prisma.invitation.update({
                where: { id: invitation.id },
                data: { status: 'expired' }
            });
            invitation.status = 'expired';
        }
        return invitation;
    }
    async cleanupExpiredInvitations() {
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
    async resendInvitation(invitationId, userId) {
        const invitation = await prisma.invitation.findUnique({
            where: { id: invitationId },
            include: {
                sender: true
            }
        });
        if (!invitation) {
            throw new Error('Invitation not found');
        }
        if (invitation.senderId !== userId) {
            throw new Error('You can only resend invitations you sent');
        }
        if (invitation.status !== 'pending') {
            throw new Error('Only pending invitations can be resent');
        }
        if (invitation.expiresAt < new Date()) {
            throw new Error('This invitation has expired');
        }
        const recipient = await prisma.user.findUnique({
            where: { email: invitation.recipientEmail }
        });
        await emailService_1.emailService.sendActivityShareInvitation(invitation.recipientEmail, invitation.sender.name, invitation.token, invitation.message || undefined, Math.ceil((invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)), recipient?.name);
        console.log({
            action: 'invitation_resent',
            invitationId,
            timestamp: new Date().toISOString()
        });
    }
}
exports.InvitationService = InvitationService;
exports.invitationService = new InvitationService();
//# sourceMappingURL=invitationService.js.map