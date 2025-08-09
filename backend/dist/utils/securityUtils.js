"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityUtils = exports.SecurityUtils = void 0;
const crypto_1 = __importDefault(require("crypto"));
class SecurityUtils {
    sanitizeInput(input) {
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidPhoneNumber(phone) {
        const phoneRegex = /^\+?1?\d{10,14}$/;
        return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
    }
    generateSecurePassword(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
        let password = '';
        const randomBytes = crypto_1.default.randomBytes(length);
        for (let i = 0; i < length; i++) {
            password += charset[randomBytes[i] % charset.length];
        }
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasDigit = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*()_+-=]/.test(password);
        if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
            return this.generateSecurePassword(length);
        }
        return password;
    }
    maskData(data, visibleChars = 4) {
        if (data.length <= visibleChars) {
            return '*'.repeat(data.length);
        }
        const visible = data.slice(-visibleChars);
        const masked = '*'.repeat(data.length - visibleChars);
        return masked + visible;
    }
    maskEmail(email) {
        const [localPart, domain] = email.split('@');
        if (!domain)
            return this.maskData(email);
        const maskedLocal = localPart.length > 2
            ? localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1]
            : '*'.repeat(localPart.length);
        return `${maskedLocal}@${domain}`;
    }
    getClientIp(req) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
        return ip || 'unknown';
    }
    getUserAgent(req) {
        return req.headers['user-agent'] || 'unknown';
    }
    isBot(userAgent) {
        const botPatterns = [
            /bot/i,
            /crawler/i,
            /spider/i,
            /scraper/i,
            /curl/i,
            /wget/i,
            /python/i,
            /java/i
        ];
        return botPatterns.some(pattern => pattern.test(userAgent));
    }
    validatePasswordComplexity(password) {
        const errors = [];
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        const weakPasswords = [
            'password', 'password123', '12345678', 'qwerty123',
            'admin123', 'letmein', 'welcome123', 'monkey123'
        ];
        if (weakPasswords.includes(password.toLowerCase())) {
            errors.push('Password is too common, please choose a stronger password');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    generateSecureToken(length = 32) {
        return crypto_1.default.randomBytes(length).toString('hex');
    }
    generateOTP(length = 6) {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * digits.length)];
        }
        return otp;
    }
    hashOTP(otp) {
        return crypto_1.default.createHash('sha256').update(otp).digest('hex');
    }
    verifyOTP(inputOTP, hashedOTP) {
        const inputHash = this.hashOTP(inputOTP);
        return crypto_1.default.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hashedOTP));
    }
    generateSecureFilename(originalName) {
        const ext = originalName.split('.').pop() || '';
        const randomName = crypto_1.default.randomBytes(16).toString('hex');
        return `${randomName}${ext ? '.' + ext : ''}`;
    }
    isValidFileType(filename, allowedTypes) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        return allowedTypes.includes(ext);
    }
    encodeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    getSecurityHeaders() {
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        };
    }
}
exports.SecurityUtils = SecurityUtils;
exports.securityUtils = new SecurityUtils();
//# sourceMappingURL=securityUtils.js.map