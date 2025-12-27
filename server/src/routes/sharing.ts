import { Router, Request, Response } from 'express';
import { verifyToken, logActivity } from '../middleware/auth';
import { sharingService } from '../services/sharingService';
import { subscriptionService } from '../services/subscriptionService';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateShareConfig = [
  body('sharedWithUserId').isUUID().withMessage('Valid user ID is required'),
  body('permissionLevel').isIn(['view_all', 'view_registered', 'view_future']).withMessage('Invalid permission level'),
  body('expiresAt').optional().isISO8601().withMessage('Valid expiry date is required'),
  body('childPermissions').isArray({ min: 1 }).withMessage('At least one child must be shared'),
  body('childPermissions.*.childId').isUUID().withMessage('Valid child ID is required'),
  body('childPermissions.*.canViewInterested').isBoolean(),
  body('childPermissions.*.canViewRegistered').isBoolean(),
  body('childPermissions.*.canViewCompleted').isBoolean(),
  body('childPermissions.*.canViewNotes').isBoolean()
];

const validateShareUpdate = [
  body('permissionLevel').optional().isIn(['view_all', 'view_registered', 'view_future']),
  body('expiresAt').optional({ nullable: true }).isISO8601(),
  body('isActive').optional().isBoolean()
];

const validateChildPermissionUpdate = [
  body('canViewInterested').optional().isBoolean(),
  body('canViewRegistered').optional().isBoolean(),
  body('canViewCompleted').optional().isBoolean(),
  body('canViewNotes').optional().isBoolean()
];

const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * Configure sharing with another user
 * POST /api/sharing
 */
router.post(
  '/',
  verifyToken,
  validateShareConfig,
  handleValidationErrors,
  logActivity('configure_sharing'),
  async (req: Request, res: Response) => {
    try {
      // Check subscription limit for sharing
      const limitCheck = await subscriptionService.canShareWithUser(req.user!.id);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: 'SUBSCRIPTION_LIMIT_REACHED',
          message: `You have reached your limit of ${limitCheck.limit} shared ${limitCheck.limit === 1 ? 'user' : 'users'}. Upgrade to Premium to share with more family members.`,
          limit: limitCheck.limit,
          current: limitCheck.current
        });
      }

      const share = await sharingService.configureSharing(req.user!.id, {
        sharedWithUserId: req.body.sharedWithUserId,
        permissionLevel: req.body.permissionLevel,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        childPermissions: req.body.childPermissions
      });

      res.status(201).json({
        success: true,
        share: {
          id: share.id,
          sharedWithUserId: share.sharedWithUserId,
          permissionLevel: share.permissionLevel,
          expiresAt: share.expiresAt,
          isActive: share.isActive,
          createdAt: share.createdAt
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Get all shares (both created and received)
 * GET /api/sharing
 */
router.get(
  '/',
  verifyToken,
  logActivity('view_shares'),
  async (req: Request, res: Response) => {
    try {
      const shares = await sharingService.getUserShares(req.user!.id);

      res.json({
        success: true,
        myShares: shares.myShares.map(share => ({
          id: share.id,
          sharedWithUser: {
            id: share.sharedWithUser.id,
            name: share.sharedWithUser.name,
            email: share.sharedWithUser.email
          },
          permissionLevel: share.permissionLevel,
          expiresAt: share.expiresAt,
          isActive: share.isActive,
          children: share.profiles.map(profile => ({
            id: profile.child.id,
            name: profile.child.name,
            permissions: {
              canViewInterested: profile.canViewInterested,
              canViewRegistered: profile.canViewRegistered,
              canViewCompleted: profile.canViewCompleted,
              canViewNotes: profile.canViewNotes
            }
          })),
          createdAt: share.createdAt,
          updatedAt: share.updatedAt
        })),
        sharedWithMe: shares.sharedWithMe.map(share => ({
          id: share.id,
          sharingUser: {
            id: share.sharingUser.id,
            name: share.sharingUser.name,
            email: share.sharingUser.email
          },
          permissionLevel: share.permissionLevel,
          expiresAt: share.expiresAt,
          children: share.profiles.map(profile => ({
            id: profile.child.id,
            name: profile.child.name,
            dateOfBirth: profile.child.dateOfBirth,
            interests: profile.child.interests,
            permissions: {
              canViewInterested: profile.canViewInterested,
              canViewRegistered: profile.canViewRegistered,
              canViewCompleted: profile.canViewCompleted,
              canViewNotes: profile.canViewNotes
            }
          })),
          createdAt: share.createdAt
        }))
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shares'
      });
    }
  }
);

/**
 * Update share settings
 * PATCH /api/sharing/:id
 */
router.patch(
  '/:id',
  verifyToken,
  param('id').isUUID(),
  validateShareUpdate,
  handleValidationErrors,
  logActivity('update_share'),
  async (req: Request, res: Response) => {
    try {
      const updateData: any = {};
      if (req.body.permissionLevel !== undefined) updateData.permissionLevel = req.body.permissionLevel;
      if (req.body.expiresAt !== undefined) updateData.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

      const share = await sharingService.updateShare(
        req.params.id,
        req.user!.id,
        updateData
      );

      res.json({
        success: true,
        share: {
          id: share.id,
          sharedWithUserId: share.sharedWithUserId,
          permissionLevel: share.permissionLevel,
          expiresAt: share.expiresAt,
          isActive: share.isActive,
          updatedAt: share.updatedAt
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Update child-specific permissions
 * PATCH /api/sharing/:shareId/children/:childId
 */
router.patch(
  '/:shareId/children/:childId',
  verifyToken,
  param('shareId').isUUID(),
  param('childId').isUUID(),
  validateChildPermissionUpdate,
  handleValidationErrors,
  logActivity('update_child_permissions'),
  async (req: Request, res: Response) => {
    try {
      const profile = await sharingService.updateChildPermissions(
        req.params.shareId,
        req.params.childId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        profile: {
          childId: profile.childId,
          canViewInterested: profile.canViewInterested,
          canViewRegistered: profile.canViewRegistered,
          canViewCompleted: profile.canViewCompleted,
          canViewNotes: profile.canViewNotes
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Remove a child from sharing
 * DELETE /api/sharing/:shareId/children/:childId
 */
router.delete(
  '/:shareId/children/:childId',
  verifyToken,
  param('shareId').isUUID(),
  param('childId').isUUID(),
  handleValidationErrors,
  logActivity('remove_child_from_share'),
  async (req: Request, res: Response) => {
    try {
      await sharingService.removeChildFromShare(
        req.params.shareId,
        req.params.childId,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Child removed from share'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Add a child to an existing share
 * POST /api/sharing/:shareId/children
 */
router.post(
  '/:shareId/children',
  verifyToken,
  param('shareId').isUUID(),
  body('childId').isUUID(),
  validateChildPermissionUpdate,
  handleValidationErrors,
  logActivity('add_child_to_share'),
  async (req: Request, res: Response) => {
    try {
      const profile = await sharingService.addChildToShare(
        req.params.shareId,
        req.body.childId,
        req.user!.id,
        {
          canViewInterested: req.body.canViewInterested,
          canViewRegistered: req.body.canViewRegistered,
          canViewCompleted: req.body.canViewCompleted,
          canViewNotes: req.body.canViewNotes
        }
      );

      res.status(201).json({
        success: true,
        profile: {
          childId: profile.childId,
          canViewInterested: profile.canViewInterested,
          canViewRegistered: profile.canViewRegistered,
          canViewCompleted: profile.canViewCompleted,
          canViewNotes: profile.canViewNotes
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Get sharing statistics
 * GET /api/sharing/stats
 */
router.get(
  '/stats',
  verifyToken,
  logActivity('view_sharing_stats'),
  async (req: Request, res: Response) => {
    try {
      const stats = await sharingService.getSharingStats(req.user!.id);

      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sharing statistics'
      });
    }
  }
);

/**
 * Revoke/deactivate a share
 * DELETE /api/sharing/:id
 */
router.delete(
  '/:id',
  verifyToken,
  param('id').isUUID(),
  handleValidationErrors,
  logActivity('revoke_share'),
  async (req: Request, res: Response) => {
    try {
      await sharingService.updateShare(
        req.params.id,
        req.user!.id,
        { isActive: false }
      );

      res.json({
        success: true,
        message: 'Share revoked successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;