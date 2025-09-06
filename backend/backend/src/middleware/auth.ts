import { Request, Response, NextFunction } from 'express';
import { tokenUtils } from '../utils/tokenUtils';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

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
      process.env.JWT_ACCESS_SECRET || 'access-secret'
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
        process.env.JWT_ACCESS_SECRET || 'access-secret'
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
 * Rate limiting middleware - DISABLED FOR PRODUCTION
 */
import rateLimit from 'express-rate-limit';

// Create no-op middleware that bypasses rate limiting
const createNoOpLimiter = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
};

// RATE LIMITING DISABLED - Using no-op middleware
export const apiLimiter = createNoOpLimiter();
export const authLimiter = createNoOpLimiter();
export const passwordResetLimiter = createNoOpLimiter();
export const emailVerificationLimiter = createNoOpLimiter();

/* ORIGINAL RATE LIMITING CONFIGURATION (DISABLED)
// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Very strict rate limit for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification rate limit
export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour
  message: 'Too many email verification attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
*/

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