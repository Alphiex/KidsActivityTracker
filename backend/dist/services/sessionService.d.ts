interface SessionData {
    userId: string;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
}
export declare class SessionService {
    private readonly SESSION_EXPIRY_DAYS;
    private readonly MAX_SESSIONS_PER_USER;
    createSession(data: SessionData): Promise<string>;
    validateRefreshToken(userId: string, refreshToken: string): Promise<boolean>;
    revokeRefreshToken(userId: string, refreshToken: string): Promise<void>;
    revokeAllUserSessions(userId: string): Promise<void>;
    getUserSessions(userId: string): Promise<any[]>;
    updateSessionActivity(sessionId: string): Promise<void>;
    cleanupExpiredSessions(): Promise<number>;
    private cleanupUserSessions;
    generateDeviceFingerprint(userAgent: string, ipAddress: string): string;
    isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean>;
    addTrustedDevice(userId: string, deviceFingerprint: string, name?: string): Promise<void>;
}
export declare const sessionService: SessionService;
export {};
//# sourceMappingURL=sessionService.d.ts.map