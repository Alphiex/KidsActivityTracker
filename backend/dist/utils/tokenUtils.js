"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenUtils = exports.TokenUtils = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
class TokenUtils {
    generateRandomToken(length = 32) {
        return crypto_1.default.randomBytes(length).toString('hex');
    }
    generateJWT(payload, secret, expiresIn) {
        return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
    }
    verifyJWT(token, secret) {
        try {
            return jsonwebtoken_1.default.verify(token, secret);
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new Error('Token has expired');
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }
    decodeJWT(token) {
        try {
            return jsonwebtoken_1.default.decode(token);
        }
        catch {
            return null;
        }
    }
    extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }
    isTokenExpired(token) {
        const decoded = this.decodeJWT(token);
        if (!decoded || !decoded.exp) {
            return true;
        }
        return Date.now() >= decoded.exp * 1000;
    }
    getTokenExpiry(token) {
        const decoded = this.decodeJWT(token);
        if (!decoded || !decoded.exp) {
            return null;
        }
        return new Date(decoded.exp * 1000);
    }
    generateSessionId() {
        return this.generateRandomToken(32);
    }
    hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
    generateCSRFToken() {
        return this.generateRandomToken(32);
    }
    validateCSRFToken(token, storedToken) {
        return crypto_1.default.timingSafeEqual(Buffer.from(token), Buffer.from(storedToken));
    }
    getSecureCookieOptions(maxAge) {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: maxAge || 7 * 24 * 60 * 60 * 1000,
            path: '/'
        };
    }
    generateAPIKey() {
        const prefix = 'kat_';
        const key = this.generateRandomToken(32);
        return `${prefix}${key}`;
    }
    validateAPIKeyFormat(apiKey) {
        return /^kat_[a-f0-9]{64}$/.test(apiKey);
    }
}
exports.TokenUtils = TokenUtils;
exports.tokenUtils = new TokenUtils();
//# sourceMappingURL=tokenUtils.js.map