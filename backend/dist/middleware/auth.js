"use strict";
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
const createNoOpLimiter = () => {
    return (req, res, next) => {
        next();
    };
};
exports.apiLimiter = createNoOpLimiter();
exports.authLimiter = createNoOpLimiter();
exports.passwordResetLimiter = createNoOpLimiter();
exports.emailVerificationLimiter = createNoOpLimiter();
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