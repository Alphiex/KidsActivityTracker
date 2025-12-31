import { Router, Request, Response } from 'express';
import { verifyToken, optionalAuth } from '../middleware/auth';
import { notificationService } from '../services/notificationService';
import { userPreferenceMatcherService } from '../services/userPreferenceMatcherService';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';

const router = Router();

// Validation middleware
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

// =============================================================================
// NOTIFICATION PREFERENCES ENDPOINTS
// =============================================================================

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', verifyToken, async (req: Request, res: Response) => {
  try {
    const preferences = await userPreferenceMatcherService.getUserNotificationPreferences(req.user!.id);

    res.json({
      success: true,
      preferences: preferences || {
        enabled: false,
        newActivities: false,
        favoriteCapacity: false,
        capacityThreshold: 3,
        priceDrops: false,
        weeklyDigest: false,
        dailyDigest: false,
        spotsAvailable: false
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notification preferences'
    });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
router.put(
  '/preferences',
  verifyToken,
  [
    body('enabled').optional().isBoolean(),
    body('newActivities').optional().isBoolean(),
    body('dailyDigest').optional().isBoolean(),
    body('favoriteCapacity').optional().isBoolean(),
    body('capacityThreshold').optional().isInt({ min: 1, max: 10 }),
    body('priceDrops').optional().isBoolean(),
    body('weeklyDigest').optional().isBoolean(),
    body('spotsAvailable').optional().isBoolean(),
    body('quietHoursStart').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('quietHoursEnd').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      await userPreferenceMatcherService.updateUserNotificationPreferences(
        req.user!.id,
        req.body
      );

      const updatedPreferences = await userPreferenceMatcherService.getUserNotificationPreferences(req.user!.id);

      res.json({
        success: true,
        message: 'Notification preferences updated',
        preferences: updatedPreferences
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update notification preferences'
      });
    }
  }
);

/**
 * GET /api/notifications/history
 * Get user's notification history
 */
router.get('/history', verifyToken, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await notificationService.getNotificationHistory(
      req.user!.id,
      limit,
      offset
    );

    res.json({
      success: true,
      notifications: history.map(log => ({
        id: log.id,
        type: log.type,
        activityCount: log.activityIds.length,
        sentAt: log.sentAt,
        status: log.status
      })),
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notification history'
    });
  }
});

/**
 * POST /api/notifications/test
 * Send a test notification email (rate limited to 1 per hour)
 */
router.post('/test', verifyToken, async (req: Request, res: Response) => {
  try {
    // Check for recent test notification
    const recentTest = await notificationService.hasRecentNotification(
      req.user!.id,
      'daily_digest',
      undefined,
      1 // 1 hour
    );

    if (recentTest) {
      return res.status(429).json({
        success: false,
        error: 'You can only send one test notification per hour'
      });
    }

    // Send test daily digest
    const result = await notificationService.sendDailyDigest(req.user!.id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent! Check your email.'
      });
    } else {
      res.json({
        success: false,
        message: result.error || 'Could not send test notification'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test notification'
    });
  }
});

// =============================================================================
// WAITLIST ENDPOINTS
// =============================================================================

/**
 * GET /api/notifications/waitlist
 * Get user's waitlist entries
 */
router.get('/waitlist', verifyToken, async (req: Request, res: Response) => {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      where: { userId: req.user!.id },
      include: {
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      waitlist: entries.map(entry => ({
        id: entry.id,
        activityId: entry.activityId,
        activity: {
          id: entry.activity.id,
          name: entry.activity.name,
          provider: entry.activity.provider?.name,
          location: entry.activity.location?.name,
          spotsAvailable: entry.activity.spotsAvailable,
          cost: entry.activity.cost
        },
        joinedAt: entry.createdAt,
        notifiedAt: entry.notifiedAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch waitlist'
    });
  }
});

/**
 * POST /api/notifications/waitlist/:activityId
 * Join waitlist for an activity
 */
router.post(
  '/waitlist/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { activityId } = req.params;

      // Check if activity exists
      const activity = await prisma.activity.findUnique({
        where: { id: activityId }
      });

      if (!activity) {
        return res.status(404).json({
          success: false,
          error: 'Activity not found'
        });
      }

      // Check if already on waitlist
      const existing = await prisma.waitlistEntry.findUnique({
        where: {
          userId_activityId: {
            userId: req.user!.id,
            activityId
          }
        }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Already on waitlist for this activity'
        });
      }

      // Create waitlist entry
      const entry = await prisma.waitlistEntry.create({
        data: {
          userId: req.user!.id,
          activityId
        },
        include: {
          activity: true
        }
      });

      res.json({
        success: true,
        message: 'Added to waitlist',
        waitlistEntry: {
          id: entry.id,
          activityId: entry.activityId,
          activityName: entry.activity.name,
          joinedAt: entry.createdAt
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to join waitlist'
      });
    }
  }
);

/**
 * DELETE /api/notifications/waitlist/:activityId
 * Leave waitlist for an activity
 */
router.delete(
  '/waitlist/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { activityId } = req.params;

      const result = await prisma.waitlistEntry.deleteMany({
        where: {
          userId: req.user!.id,
          activityId
        }
      });

      if (result.count === 0) {
        return res.status(404).json({
          success: false,
          error: 'Not on waitlist for this activity'
        });
      }

      res.json({
        success: true,
        message: 'Removed from waitlist'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to leave waitlist'
      });
    }
  }
);

// =============================================================================
// UNSUBSCRIBE ENDPOINTS
// =============================================================================

/**
 * GET /api/notifications/unsubscribe/:token
 * Validate unsubscribe token and return type info
 */
router.get(
  '/unsubscribe/:token',
  [param('token').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const unsubToken = await prisma.unsubscribeToken.findUnique({
        where: { token },
        include: { user: { select: { email: true, name: true } } }
      });

      if (!unsubToken) {
        return res.status(404).json({
          success: false,
          error: 'Invalid unsubscribe token'
        });
      }

      if (unsubToken.usedAt) {
        return res.status(400).json({
          success: false,
          error: 'This unsubscribe link has already been used'
        });
      }

      if (unsubToken.expiresAt && unsubToken.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This unsubscribe link has expired'
        });
      }

      const typeDescriptions: Record<string, string> = {
        all: 'all email notifications',
        daily_digest: 'daily activity digest emails',
        weekly_digest: 'weekly summary emails',
        capacity_alerts: 'capacity alert emails',
        price_drops: 'price drop alert emails'
      };

      res.json({
        success: true,
        type: unsubToken.type,
        typeDescription: typeDescriptions[unsubToken.type] || unsubToken.type,
        userEmail: unsubToken.user.email
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to validate unsubscribe token'
      });
    }
  }
);

/**
 * POST /api/notifications/unsubscribe/:token
 * Process unsubscribe request
 */
router.post(
  '/unsubscribe/:token',
  [param('token').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const result = await notificationService.processUnsubscribe(token);

      if (result.success) {
        res.json({
          success: true,
          message: `Successfully unsubscribed from ${result.type === 'all' ? 'all notifications' : result.type?.replace('_', ' ')}`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process unsubscribe'
      });
    }
  }
);

/**
 * POST /api/notifications/unsubscribe-all
 * Quick unsubscribe from all notifications (for authenticated users)
 */
router.post('/unsubscribe-all', verifyToken, async (req: Request, res: Response) => {
  try {
    await userPreferenceMatcherService.updateUserNotificationPreferences(
      req.user!.id,
      { enabled: false }
    );

    res.json({
      success: true,
      message: 'Successfully unsubscribed from all email notifications'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to unsubscribe'
    });
  }
});

export default router;
