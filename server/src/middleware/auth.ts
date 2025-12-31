import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { verifyFirebaseToken, isFirebaseInitialized } from '../config/firebase';
import { tokenUtils } from '../utils/tokenUtils';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firebaseUid?: string;
        authProvider?: string;
      };
      firebaseUser?: {
        uid: string;
        email?: string;
        name?: string;
        picture?: string;
        emailVerified?: boolean;
      };
      session?: any;
    }
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Find or create PostgreSQL user from Firebase user data
 */
async function findOrCreateUser(
  firebaseUid: string,
  email: string,
  name: string | undefined,
  authProvider: string
): Promise<{ id: string; email: string; firebaseUid: string; authProvider: string } | null> {
  try {
    // First, try to find user by firebaseUid
    let user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true, email: true, firebaseUid: true, authProvider: true }
    });

    if (user && user.firebaseUid) {
      return { ...user, firebaseUid: user.firebaseUid };
    }

    // Check if user exists by email (for linking accounts)
    user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firebaseUid: true, authProvider: true }
    });

    if (user) {
      // Link existing email user to Firebase account
      user = await prisma.user.update({
        where: { email },
        data: {
          firebaseUid,
          authProvider,
          isVerified: true, // Firebase has verified the email
        },
        select: { id: true, email: true, firebaseUid: true, authProvider: true }
      });
      console.log(`[Auth] Linked existing user ${user.id} to Firebase account ${firebaseUid}`);
      return { ...user, firebaseUid: user.firebaseUid! };
    }

    // Create new user
    user = await prisma.user.create({
      data: {
        firebaseUid,
        email,
        name: name || email.split('@')[0],
        authProvider,
        isVerified: true, // Firebase handles email verification
      },
      select: { id: true, email: true, firebaseUid: true, authProvider: true }
    });

    console.log(`[Auth] Created new user ${user.id} from Firebase account ${firebaseUid}`);
    return { ...user, firebaseUid: user.firebaseUid! };
  } catch (error) {
    console.error('[Auth] Error finding/creating user:', error);
    return null;
  }
}

/**
 * Verify Firebase ID token and attach user to request
 * This replaces the old JWT verification
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if Firebase is configured
    if (!isFirebaseInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Authentication service unavailable'
      });
    }

    // Extract token from header
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify Firebase ID token
    const decodedToken = await verifyFirebaseToken(token);

    if (!decodedToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Extract user info from Firebase token
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name as string | undefined;
    const picture = decodedToken.picture as string | undefined;
    const emailVerified = decodedToken.email_verified;

    // Determine auth provider from Firebase token
    let authProvider = 'email';
    if (decodedToken.firebase?.sign_in_provider) {
      const provider = decodedToken.firebase.sign_in_provider;
      if (provider === 'google.com') {
        authProvider = 'google';
      } else if (provider === 'apple.com') {
        authProvider = 'apple';
      }
    }

    if (!email) {
      return res.status(401).json({
        success: false,
        error: 'Email not available in token'
      });
    }

    // Find or create PostgreSQL user
    const user = await findOrCreateUser(firebaseUid, email, name, authProvider);

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process user account'
      });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      firebaseUid: user.firebaseUid || undefined,
      authProvider: user.authProvider
    };

    // Also attach Firebase user info for additional data (like profile picture)
    req.firebaseUser = {
      uid: firebaseUid,
      email,
      name,
      picture,
      emailVerified
    };

    next();
  } catch (error: any) {
    console.error('[Auth] Token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work both authenticated and unauthenticated
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (token && isFirebaseInitialized()) {
      const decodedToken = await verifyFirebaseToken(token);

      if (decodedToken && decodedToken.email) {
        // Try to find existing user
        const user = await prisma.user.findUnique({
          where: { firebaseUid: decodedToken.uid },
          select: { id: true, email: true, firebaseUid: true, authProvider: true }
        });

        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            firebaseUid: user.firebaseUid || undefined,
            authProvider: user.authProvider
          };

          req.firebaseUser = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name as string | undefined,
            picture: decodedToken.picture as string | undefined,
            emailVerified: decodedToken.email_verified
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

// General API rate limit (disabled in dev/testing, high limit in production)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 1000 : 0, // 1000 requests per 15 min in production, disabled in dev
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