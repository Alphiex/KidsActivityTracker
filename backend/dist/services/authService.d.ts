interface RegisterData {
    email: string;
    password: string;
    name: string;
    phoneNumber?: string;
}
interface LoginData {
    email: string;
    password: string;
}
interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
}
interface ResetPasswordData {
    token: string;
    newPassword: string;
}
export declare class AuthService {
    private readonly SALT_ROUNDS;
    private readonly ACCESS_TOKEN_EXPIRY;
    private readonly REFRESH_TOKEN_EXPIRY;
    private readonly RESET_TOKEN_EXPIRY_HOURS;
    private readonly VERIFICATION_TOKEN_EXPIRY_HOURS;
    register(data: RegisterData): Promise<{
        user: any;
        tokens: AuthTokens;
    }>;
    login(data: LoginData): Promise<{
        user: any;
        tokens: AuthTokens;
    }>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    verifyEmail(token: string): Promise<void>;
    requestPasswordReset(email: string): Promise<void>;
    resetPassword(data: ResetPasswordData): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    resendVerificationEmail(email: string): Promise<void>;
    getUserProfile(userId: string): Promise<any>;
    updateUserProfile(userId: string, data: {
        name?: string;
        phoneNumber?: string;
        preferences?: any;
    }): Promise<any>;
    private generateTokens;
    private validatePasswordStrength;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=authService.d.ts.map