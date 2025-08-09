export interface TokenPayload {
    userId: string;
    email: string;
    type: 'access' | 'refresh';
}
export interface DecodedToken extends TokenPayload {
    iat: number;
    exp: number;
}
export declare class TokenUtils {
    generateRandomToken(length?: number): string;
    generateJWT(payload: TokenPayload, secret: string, expiresIn: string): string;
    verifyJWT(token: string, secret: string): DecodedToken;
    decodeJWT(token: string): DecodedToken | null;
    extractTokenFromHeader(authHeader: string | undefined): string | null;
    isTokenExpired(token: string): boolean;
    getTokenExpiry(token: string): Date | null;
    generateSessionId(): string;
    hashToken(token: string): string;
    generateCSRFToken(): string;
    validateCSRFToken(token: string, storedToken: string): boolean;
    getSecureCookieOptions(maxAge?: number): any;
    generateAPIKey(): string;
    validateAPIKeyFormat(apiKey: string): boolean;
}
export declare const tokenUtils: TokenUtils;
//# sourceMappingURL=tokenUtils.d.ts.map