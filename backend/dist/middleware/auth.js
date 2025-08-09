"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = exports.checkPermission = exports.validateBody = exports.csrfProtection = exports.emailVerificationLimiter = exports.passwordResetLimiter = exports.authLimiter = exports.apiLimiter = exports.optionalAuth = exports.verifyToken = void 0;
const tokenUtils_1 = require("../utils/tokenUtils");
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const verifyToken = async (req, res, next) => {
    try {
        const token = tokenUtils_1.tokenUtils.extractTokenFromHeader(req.headers.authorization);
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }
        const decoded = tokenUtils_1.tokenUtils.verifyJWT(token, process.env.JWT_ACCESS_SECRET || 'access-secret');
        if (decoded.type !== 'access') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token type'
            });
        }
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, isVerified: true }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }
        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                error: 'Email not verified'
            });
        }
        req.user = {
            id: user.id,
            email: user.email
        };
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            error: error.message || 'Invalid token'
        });
    }
};
exports.verifyToken = verifyToken;
const optionalAuth = async (req, res, next) => {
    try {
        const token = tokenUtils_1.tokenUtils.extractTokenFromHeader(req.headers.authorization);
        if (token) {
            const decoded = tokenUtils_1.tokenUtils.verifyJWT(token, process.env.JWT_ACCESS_SECRET || 'access-secret');
            if (decoded.type === 'access') {
                const user = await prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: { id: true, email: true, isVerified: true }
                });
                if (user && user.isVerified) {
                    req.user = {
                        id: user.id,
                        email: user.email
                    };
                }
            }
        }
    }
    catch {
    }
    next();
};
exports.optionalAuth = optionalAuth;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
exports.passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.emailVerificationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many email verification attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const csrfProtection = (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const csrfToken = req.headers['x-csrf-token'];
        const sessionToken = req.session?.csrfToken;
        if (!csrfToken || !sessionToken) {
            return res.status(403).json({
                success: false,
                error: 'CSRF token missing'
            });
        }
        if (!tokenUtils_1.tokenUtils.validateCSRFToken(csrfToken, sessionToken)) {
            return res.status(403).json({
                success: false,
                error: 'Invalid CSRF token'
            });
        }
    }
    next();
};
exports.csrfProtection = csrfProtection;
const validateBody = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        next();
    };
};
exports.validateBody = validateBody;
const checkPermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        next();
    };
};
exports.checkPermission = checkPermission;
const logActivity = (action) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        res.on('finish', async () => {
            const duration = Date.now() - startTime;
            const userId = req.user?.id || 'anonymous';
            console.log({
                action,
                userId,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            });
        });
        next();
    };
};
exports.logActivity = logActivity;
//# sourceMappingURL=auth.js.map