import { Request } from 'express';
export declare class SecurityUtils {
    sanitizeInput(input: string): string;
    isValidEmail(email: string): boolean;
    isValidPhoneNumber(phone: string): boolean;
    generateSecurePassword(length?: number): string;
    maskData(data: string, visibleChars?: number): string;
    maskEmail(email: string): string;
    getClientIp(req: Request): string;
    getUserAgent(req: Request): string;
    isBot(userAgent: string): boolean;
    validatePasswordComplexity(password: string): {
        isValid: boolean;
        errors: string[];
    };
    generateSecureToken(length?: number): string;
    generateOTP(length?: number): string;
    hashOTP(otp: string): string;
    verifyOTP(inputOTP: string, hashedOTP: string): boolean;
    generateSecureFilename(originalName: string): string;
    isValidFileType(filename: string, allowedTypes: string[]): boolean;
    encodeHTML(str: string): string;
    getSecurityHeaders(): Record<string, string>;
}
export declare const securityUtils: SecurityUtils;
//# sourceMappingURL=securityUtils.d.ts.map