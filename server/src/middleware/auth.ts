import { Request, Response, NextFunction } from 'express';
import { tokenUtils } from '../utils/tokenUtils';
import { prisma } from '../lib/prisma';

// Validate JWT secrets are configured at startup
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  console.error('CRITICAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Use validated secrets or fallback only in development
const getAccessSecret = () => JWT_ACCESS_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-access-secret-not-for-production' : '');
const getRefreshSecret = () => JWT_REFRESH_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-refresh-secret-not-for-production' : '');

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      session?: any;
    }
  }
}

/**
 * Verify JWT access token
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from header
    const token = tokenUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify token
    const decoded = tokenUtils.verifyJWT(
      token,
      getAccessSecret()
    );

    // Check token type
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    // Check if user exists and is verified
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

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email
    };

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Invalid token'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = tokenUtils.extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = tokenUtils.verifyJWT(
        token,
        getAccessSecret()
      );

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
  } catch {
    // Ignore errors - this is optional auth
  }

  next();
};

/**
 * Rate limiting middleware
 * Disabled in non-production environments for easier testing
 */
import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

// Disable express-rate-limit's strict proxy validation (we configure trust proxy in server.ts)
const rateLimitValidation = { trustProxy: false, xForwardedForHeader: false };

// General API rate limit (disabled in dev/testing)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 0, // 0 = disabled
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retry_after_seconds: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction, // Skip rate limiting in non-production
  validate: rateLimitValidation,
});

// Strict rate limit for auth endpoints (disabled in dev/testing)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 10 : 0,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retry_after_seconds: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => !isProduction,
  validate: rateLimitValidation,
});

// Very strict rate limit for password reset (disabled in dev/testing)
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 5 : 0,
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again later.',
    retry_after_seconds: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  validate: rateLimitValidation,
});

// Email verification rate limit (disabled in dev/testing)
export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 10 : 0,
  message: {
    success: false,
    error: 'Too many email verification attempts, please try again later.',
    retry_after_seconds: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  validate: rateLimitValidation,
});

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionToken = req.session?.csrfToken;

    if (!csrfToken || !sessionToken) {
      return res.status(403).json({
        success: false,
        error: 'CSRF token missing'
      });
    }

    if (!tokenUtils.validateCSRFToken(csrfToken, sessionToken)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token'
      });
    }
  }

  next();
};

/**
 * Validate request body middleware factory
 */
export const validateBody = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
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

/**
 * Check user permissions middleware
 */
export const checkPermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // For now, we'll just check if user is authenticated
    // In the future, you can implement role-based permissions here
    next();
  };
};

/**
 * Log activity middleware
 */
export const logActivity = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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