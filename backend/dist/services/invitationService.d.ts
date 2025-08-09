import { Invitation } from '../../generated/prisma';
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
export declare class InvitationService {
    private readonly DEFAULT_EXPIRY_DAYS;
    private readonly MAX_ACTIVE_INVITATIONS_PER_USER;
    createInvitation(data: CreateInvitationData): Promise<Invitation>;
    getSentInvitations(userId: string): Promise<InvitationWithSender[]>;
    getReceivedInvitations(userEmail: string): Promise<InvitationWithSender[]>;
    acceptInvitation(data: AcceptInvitationData): Promise<void>;
    declineInvitation(token: string, userId: string): Promise<void>;
    cancelInvitation(invitationId: string, userId: string): Promise<void>;
    getInvitationByToken(token: string): Promise<InvitationWithSender | null>;
    cleanupExpiredInvitations(): Promise<number>;
    resendInvitation(invitationId: string, userId: string): Promise<void>;
}
export declare const invitationService: InvitationService;
export {};
//# sourceMappingURL=invitationService.d.ts.map