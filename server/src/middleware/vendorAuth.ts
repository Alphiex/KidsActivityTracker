import { Request, Response, NextFunction } from 'express';
import { VendorUserRole, VendorStatus } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { verifyToken } from './auth';
import crypto from 'crypto';

// Role hierarchy for vendors
const VENDOR_ROLE_HIERARCHY: Record<VendorUserRole, number> = {
  'MEMBER': 1,
  'ADMIN': 2,
  'OWNER': 3,
};

// Extend Express Request to include vendor context
declare global {
  namespace Express {
    interface Request {
      vendor?: {
        id: string;
        code: string;
        name: string;
        status: VendorStatus;
        providerId: string | null;
      };
      vendorUser?: {
        id: string;
        userId: string;
        vendorId: string;
        role: VendorUserRole;
      };
    }
  }
}

/**
 * Middleware to verify vendor API key
 * Used for programmatic/API access
 */
export const requireVendorApiKey = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key is required'
        });
      }

      // Hash the provided key to compare with stored hash
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Find vendor by API key hash
      const vendor = await prisma.vendor.findFirst({
        where: {
          apiKeyHash: keyHash,
          status: 'ACTIVE',
        },
      });

      if (!vendor) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      // Attach vendor context to request
      req.vendor = {
        id: vendor.id,
        code: vendor.code,
        name: vendor.name,
        status: vendor.status,
        providerId: vendor.providerId,
      };

      next();
    } catch (error: any) {
      console.error('Vendor API auth error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to verify vendor user session
 * Used for user-based/session access (vendor portal UI)
 */
export const requireVendorAuth = (minRole?: VendorUserRole) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // First verify the user token using existing auth
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
      }

      // Use the existing verifyToken middleware logic
      // but we'll need to check vendor membership too
      const token = authHeader.split(' ')[1];

      // Decode and verify token (reusing existing logic)
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // Check vendor ID from query/params or header
      const vendorId = req.params.vendorId || req.query.vendorId || req.headers['x-vendor-id'];

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          error: 'Vendor ID is required'
        });
      }

      // Check if user is a member of the vendor
      const vendorUser = await prisma.vendorUser.findUnique({
        where: {
          vendorId_userId: {
            vendorId: vendorId as string,
            userId: user.id,
          },
        },
        include: {
          vendor: true,
        },
      });

      if (!vendorUser) {
        return res.status(403).json({
          success: false,
          error: 'You are not a member of this vendor organization'
        });
      }

      // Check vendor status
      if (vendorUser.vendor.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: `Vendor account is ${vendorUser.vendor.status.toLowerCase()}`
        });
      }

      // Check role hierarchy if minRole specified
      if (minRole && VENDOR_ROLE_HIERARCHY[vendorUser.role] < VENDOR_ROLE_HIERARCHY[minRole]) {
        return res.status(403).json({
          success: false,
          error: `This action requires at least ${minRole} role`
        });
      }

      // Attach user and vendor context to request
      req.user = {
        id: user.id,
        email: user.email,
      };

      req.vendor = {
        id: vendorUser.vendor.id,
        code: vendorUser.vendor.code,
        name: vendorUser.vendor.name,
        status: vendorUser.vendor.status,
        providerId: vendorUser.vendor.providerId,
      };

      req.vendorUser = {
        id: vendorUser.id,
        userId: vendorUser.userId,
        vendorId: vendorUser.vendorId,
        role: vendorUser.role,
      };

      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }
      console.error('Vendor auth error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware that accepts either API key or user session
 * Useful for endpoints that can be accessed both ways
 */
export const requireVendorAccess = (minRole?: VendorUserRole) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check for API key first
    if (req.headers['x-api-key']) {
      return requireVendorApiKey()(req, res, next);
    }

    // Fall back to session-based auth
    return requireVendorAuth(minRole)(req, res, next);
  };
};

/**
 * Middleware to require a specific vendor role
 * Must be used after requireVendorAuth
 */
export const requireVendorRole = (minRole: VendorUserRole) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.vendorUser) {
      return res.status(403).json({
        success: false,
        error: 'Vendor access required'
      });
    }

    if (VENDOR_ROLE_HIERARCHY[req.vendorUser.role] < VENDOR_ROLE_HIERARCHY[minRole]) {
      return res.status(403).json({
        success: false,
        error: `This action requires at least ${minRole} role`
      });
    }

    next();
  };
};

/**
 * Check if a vendor user has a specific role or higher
 */
export const hasMinVendorRole = (userRole: VendorUserRole, minRole: VendorUserRole): boolean => {
  return VENDOR_ROLE_HIERARCHY[userRole] >= VENDOR_ROLE_HIERARCHY[minRole];
};

/**
 * Rate limiter for vendor endpoints
 */
import rateLimit from 'express-rate-limit';

// Disable express-rate-limit's strict proxy validation (we configure trust proxy in server.ts)
const rateLimitValidation = { trustProxy: false, xForwardedForHeader: false };

export const vendorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Standard limit for vendor operations
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: rateLimitValidation,
});

// Stricter rate limit for import uploads
export const vendorUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 uploads per hour
  message: 'Upload limit reached. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: rateLimitValidation,
});
