export declare class EmailService {
    private transporter;
    private readonly fromEmail;
    private readonly baseUrl;
    constructor();
    sendVerificationEmail(email: string, name: string, token: string): Promise<void>;
    sendPasswordResetEmail(email: string, name: string, token: string): Promise<void>;
    sendPasswordChangedEmail(email: string, name: string): Promise<void>;
    sendWelcomeEmail(email: string, name: string): Promise<void>;
    private sendEmail;
    sendActivityShareInvitation(recipientEmail: string, senderName: string, token: string, message?: string, expiresInDays?: number, recipientName?: string): Promise<void>;
    sendShareAcceptedNotification(recipientEmail: string, recipientName: string, acceptorName: string): Promise<void>;
    sendShareDeclinedNotification(recipientEmail: string, recipientName: string, declinerName: string): Promise<void>;
    sendShareConfiguredNotification(recipientEmail: string, recipientName: string, sharerName: string, childrenNames: string[]): Promise<void>;
    sendShareRevokedNotification(recipientEmail: string, recipientName: string, revokerName: string): Promise<void>;
    verifyConnection(): Promise<boolean>;
}
export declare const emailService: EmailService;
//# sourceMappingURL=emailService.d.ts.map