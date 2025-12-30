import { Request, Response, NextFunction } from 'express';
import { AdminRole } from '../../generated/prisma';
import { prisma } from '../lib/prisma';

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  MODERATOR: 2,
  VIEWER: 1,
};

// Extend Express Request type to include admin user
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        id: string;
        userId: string;
        role: AdminRole;
        permissions: string[];
      };
    }
  }
}

/**
 * Middleware to require admin authentication
 * Must be used after verifyToken middleware
 */
export const requireAdmin = (minRole?: AdminRole) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Look up admin profile
      const adminUser = await prisma.adminUser.findUnique({
        where: { userId: req.user.id },
        select: {
          id: true,
          userId: true,
          role: true,
          permissions: true,
        }
      });

      if (!adminUser) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      // Check minimum role requirement
      if (minRole) {
        const requiredLevel = ROLE_HIERARCHY[minRole];
        const userLevel = ROLE_HIERARCHY[adminUser.role];

        if (userLevel < requiredLevel) {
          return res.status(403).json({
            success: false,
            error: `Insufficient permissions. Required role: ${minRole}`
          });
        }
      }

      // Attach admin user to request
      req.adminUser = {
        id: adminUser.id,
        userId: adminUser.userId,
        role: adminUser.role,
        permissions: (adminUser.permissions as string[]) || [],
      };

      next();
    } catch (error: any) {
      console.error('Admin auth error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to require a specific permission
 * Must be used after requireAdmin middleware
 */
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // SUPER_ADMIN has all permissions
    if (req.adminUser.role === 'SUPER_ADMIN') {
      return next();
    }

    // Check if user has the specific permission
    if (!req.adminUser.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `Permission denied: ${permission}`
      });
    }

    next();
  };
};

/**
 * Check if admin user has a specific role or higher
 */
export const hasMinRole = (adminRole: AdminRole, minRole: AdminRole): boolean => {
  return ROLE_HIERARCHY[adminRole] >= ROLE_HIERARCHY[minRole];
};

/**
 * Rate limiter for admin endpoints
 */
import rateLimit from 'express-rate-limit';

// Disable express-rate-limit's strict proxy validation (we configure trust proxy in server.ts)
const rateLimitValidation = { trustProxy: false, xForwardedForHeader: false };

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for admin operations
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: rateLimitValidation,
});

// Common permission constants
export const PERMISSIONS = {
  // Vendor management
  VENDOR_VIEW: 'vendor:view',
  VENDOR_CREATE: 'vendor:create',
  VENDOR_UPDATE: 'vendor:update',
  VENDOR_DELETE: 'vendor:delete',
  VENDOR_VERIFY: 'vendor:verify',
  VENDOR_SUSPEND: 'vendor:suspend',

  // Import management
  IMPORT_VIEW: 'import:view',
  IMPORT_CREATE: 'import:create',
  IMPORT_VALIDATE: 'import:validate',
  IMPORT_APPROVE: 'import:approve',
  IMPORT_REJECT: 'import:reject',
  IMPORT_DELETE: 'import:delete',
  IMPORT_UPLOAD: 'import:upload',
  IMPORT_PROCESS: 'import:process',

  // Activity management
  ACTIVITY_VIEW: 'activity:view',
  ACTIVITY_UPDATE: 'activity:update',
  ACTIVITY_DELETE: 'activity:delete',
  ACTIVITY_SPONSOR: 'activity:sponsor',

  // Admin user management
  ADMIN_VIEW: 'admin:view',
  ADMIN_CREATE: 'admin:create',
  ADMIN_UPDATE: 'admin:update',
  ADMIN_DELETE: 'admin:delete',
};
