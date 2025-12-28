import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { verifyToken } from '../../middleware/auth';
import { requireAdmin, requirePermission, PERMISSIONS, adminLimiter } from '../../middleware/adminAuth';
import { vendorService } from '../../services/vendorService';
import { VendorStatus } from '../../../generated/prisma';

const router = Router();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireAdmin('MODERATOR'));
router.use(adminLimiter);

/**
 * GET /api/admin/vendors
 * List all vendors with optional filters
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'INACTIVE']),
    query('search').optional().isString().trim(),
    query('hasFeatured').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { status, search, hasFeatured, limit, offset } = req.query;

      const result = await vendorService.listVendors({
        status: status as VendorStatus,
        search: search as string,
        hasFeatured: hasFeatured === 'true' ? true : hasFeatured === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      return res.json({
        success: true,
        data: result.vendors,
        pagination: {
          total: result.total,
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
        },
      });
    } catch (error: any) {
      console.error('Error listing vendors:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to list vendors',
      });
    }
  }
);

/**
 * GET /api/admin/vendors/:id
 * Get vendor details
 */
router.get(
  '/:id',
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      // Get stats
      const stats = await vendorService.getVendorStats(req.params.id);

      return res.json({
        success: true,
        data: {
          ...vendor,
          stats,
        },
      });
    } catch (error: any) {
      console.error('Error getting vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get vendor',
      });
    }
  }
);

/**
 * POST /api/admin/vendors
 * Create a new vendor
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.VENDOR_CREATE),
  [
    body('code').isString().trim().isLength({ min: 2, max: 50 }),
    body('name').isString().trim().isLength({ min: 2, max: 200 }),
    body('email').isEmail().normalizeEmail(),
    body('website').optional().isURL(),
    body('contactName').optional().isString().trim(),
    body('contactPhone').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('requiresApproval').optional().isBoolean(),
    body('dailyImportLimit').optional().isInt({ min: 1, max: 10000 }),
    body('monthlyImportLimit').optional().isInt({ min: 1, max: 100000 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      // Check for existing vendor with same code or email
      const existingByCode = await vendorService.getVendorByCode(req.body.code);
      if (existingByCode) {
        return res.status(409).json({
          success: false,
          error: 'Vendor with this code already exists',
        });
      }

      const existingByEmail = await vendorService.getVendorByEmail(req.body.email);
      if (existingByEmail) {
        return res.status(409).json({
          success: false,
          error: 'Vendor with this email already exists',
        });
      }

      const vendor = await vendorService.createVendor(req.body);

      return res.status(201).json({
        success: true,
        data: vendor,
      });
    } catch (error: any) {
      console.error('Error creating vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create vendor',
      });
    }
  }
);

/**
 * PUT /api/admin/vendors/:id
 * Update vendor
 */
router.put(
  '/:id',
  requirePermission(PERMISSIONS.VENDOR_UPDATE),
  [
    param('id').isUUID(),
    body('name').optional().isString().trim().isLength({ min: 2, max: 200 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('website').optional().isURL(),
    body('contactName').optional().isString().trim(),
    body('contactPhone').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('logoUrl').optional().isURL(),
    body('requiresApproval').optional().isBoolean(),
    body('autoApproveUpdates').optional().isBoolean(),
    body('dailyImportLimit').optional().isInt({ min: 1, max: 10000 }),
    body('monthlyImportLimit').optional().isInt({ min: 1, max: 100000 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      // Check for email conflict
      if (req.body.email) {
        const existingByEmail = await vendorService.getVendorByEmail(req.body.email);
        if (existingByEmail && existingByEmail.id !== req.params.id) {
          return res.status(409).json({
            success: false,
            error: 'Email already in use by another vendor',
          });
        }
      }

      const updatedVendor = await vendorService.updateVendor(req.params.id, req.body);

      return res.json({
        success: true,
        data: updatedVendor,
      });
    } catch (error: any) {
      console.error('Error updating vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to update vendor',
      });
    }
  }
);

/**
 * POST /api/admin/vendors/:id/verify
 * Verify/approve vendor application
 */
router.post(
  '/:id/verify',
  requirePermission(PERMISSIONS.VENDOR_VERIFY),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      if (vendor.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: `Cannot verify vendor with status: ${vendor.status}`,
        });
      }

      const verifiedVendor = await vendorService.verifyVendor(
        req.params.id,
        req.adminUser!.id
      );

      return res.json({
        success: true,
        data: verifiedVendor,
        message: 'Vendor verified successfully',
      });
    } catch (error: any) {
      console.error('Error verifying vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to verify vendor',
      });
    }
  }
);

/**
 * POST /api/admin/vendors/:id/suspend
 * Suspend vendor
 */
router.post(
  '/:id/suspend',
  requirePermission(PERMISSIONS.VENDOR_SUSPEND),
  [
    param('id').isUUID(),
    body('reason').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      if (vendor.status === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          error: 'Vendor is already suspended',
        });
      }

      const suspendedVendor = await vendorService.suspendVendor(
        req.params.id,
        req.body.reason
      );

      return res.json({
        success: true,
        data: suspendedVendor,
        message: 'Vendor suspended successfully',
      });
    } catch (error: any) {
      console.error('Error suspending vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to suspend vendor',
      });
    }
  }
);

/**
 * POST /api/admin/vendors/:id/reactivate
 * Reactivate suspended vendor
 */
router.post(
  '/:id/reactivate',
  requirePermission(PERMISSIONS.VENDOR_SUSPEND),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      if (vendor.status !== 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          error: 'Vendor is not suspended',
        });
      }

      const reactivatedVendor = await vendorService.reactivateVendor(req.params.id);

      return res.json({
        success: true,
        data: reactivatedVendor,
        message: 'Vendor reactivated successfully',
      });
    } catch (error: any) {
      console.error('Error reactivating vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to reactivate vendor',
      });
    }
  }
);

/**
 * POST /api/admin/vendors/:id/reject
 * Reject vendor application
 */
router.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.VENDOR_VERIFY),
  [
    param('id').isUUID(),
    body('reason').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      if (vendor.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: `Cannot reject vendor with status: ${vendor.status}`,
        });
      }

      const rejectedVendor = await vendorService.rejectVendor(
        req.params.id,
        req.body.reason
      );

      return res.json({
        success: true,
        data: rejectedVendor,
        message: 'Vendor application rejected',
      });
    } catch (error: any) {
      console.error('Error rejecting vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to reject vendor',
      });
    }
  }
);

/**
 * DELETE /api/admin/vendors/:id
 * Delete vendor (soft delete)
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.VENDOR_DELETE),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      await vendorService.deleteVendor(req.params.id);

      return res.json({
        success: true,
        message: 'Vendor deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete vendor',
      });
    }
  }
);

/**
 * POST /api/admin/vendors/:id/api-key
 * Generate or rotate API key for vendor
 */
router.post(
  '/:id/api-key',
  requireAdmin('ADMIN'),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      if (vendor.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: 'Can only generate API key for active vendors',
        });
      }

      const { apiKey } = await vendorService.generateApiKey(req.params.id);

      return res.json({
        success: true,
        data: {
          apiKey,
          message: 'API key generated. Store this securely - it cannot be retrieved again.',
        },
      });
    } catch (error: any) {
      console.error('Error generating API key:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate API key',
      });
    }
  }
);

/**
 * DELETE /api/admin/vendors/:id/api-key
 * Revoke API key for vendor
 */
router.delete(
  '/:id/api-key',
  requireAdmin('ADMIN'),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      await vendorService.revokeApiKey(req.params.id);

      return res.json({
        success: true,
        message: 'API key revoked successfully',
      });
    } catch (error: any) {
      console.error('Error revoking API key:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to revoke API key',
      });
    }
  }
);

/**
 * PUT /api/admin/vendors/:id/featured
 * Update vendor featured status
 */
router.put(
  '/:id/featured',
  requirePermission(PERMISSIONS.ACTIVITY_SPONSOR),
  [
    param('id').isUUID(),
    body('defaultFeaturedTier').optional({ nullable: true }).isIn(['gold', 'silver', 'bronze', null]),
    body('featuredStartDate').optional({ nullable: true }).isISO8601(),
    body('featuredEndDate').optional({ nullable: true }).isISO8601(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      const updatedVendor = await vendorService.updateFeatured(req.params.id, {
        defaultFeaturedTier: req.body.defaultFeaturedTier,
        featuredStartDate: req.body.featuredStartDate ? new Date(req.body.featuredStartDate) : null,
        featuredEndDate: req.body.featuredEndDate ? new Date(req.body.featuredEndDate) : null,
      });

      return res.json({
        success: true,
        data: updatedVendor,
      });
    } catch (error: any) {
      console.error('Error updating featured status:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to update featured status',
      });
    }
  }
);

/**
 * POST /api/admin/vendors/:id/apply-featured
 * Apply vendor's featured status to all their activities
 */
router.post(
  '/:id/apply-featured',
  requirePermission(PERMISSIONS.ACTIVITY_SPONSOR),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      if (!vendor.defaultFeaturedTier) {
        return res.status(400).json({
          success: false,
          error: 'Vendor does not have a featured tier configured',
        });
      }

      const count = await vendorService.applyFeatured(req.params.id);

      return res.json({
        success: true,
        data: {
          activitiesUpdated: count,
        },
        message: `Featured status applied to ${count} activities`,
      });
    } catch (error: any) {
      console.error('Error applying featured status:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to apply featured status',
      });
    }
  }
);

/**
 * POST /api/admin/vendors/:id/remove-featured
 * Remove featured status from all vendor's activities
 */
router.post(
  '/:id/remove-featured',
  requirePermission(PERMISSIONS.ACTIVITY_SPONSOR),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      const count = await vendorService.removeFeatured(req.params.id);

      return res.json({
        success: true,
        data: {
          activitiesUpdated: count,
        },
        message: `Featured status removed from ${count} activities`,
      });
    } catch (error: any) {
      console.error('Error removing featured status:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to remove featured status',
      });
    }
  }
);

/**
 * GET /api/admin/vendors/:id/rate-limits
 * Get vendor's current rate limits and usage
 */
router.get(
  '/:id/rate-limits',
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found',
        });
      }

      const limits = await vendorService.checkImportLimits(req.params.id);

      return res.json({
        success: true,
        data: limits,
      });
    } catch (error: any) {
      console.error('Error getting rate limits:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get rate limits',
      });
    }
  }
);

export default router;
