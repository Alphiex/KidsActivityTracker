import { Router, Request, Response } from 'express';
import { sponsoredActivityService } from '../services/sponsoredActivityService';
import { verifyToken, optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/v1/sponsored/analytics/:activityId
 * @desc    Get analytics for a specific sponsored activity
 * @access  Private (requires auth, activity must belong to user's provider)
 */
router.get('/analytics/:activityId', verifyToken, async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const { months = '6' } = req.query;

    const analytics = await sponsoredActivityService.getActivityAnalytics(
      activityId,
      parseInt(months as string)
    );

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Sponsored analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

/**
 * @route   GET /api/v1/sponsored/provider/:providerId/analytics
 * @desc    Get analytics for all sponsored activities of a provider
 * @access  Private (requires auth, must be provider admin)
 */
router.get('/provider/:providerId/analytics', verifyToken, async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;

    const analytics = await sponsoredActivityService.getProviderSponsoredAnalytics(providerId);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Provider sponsored analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get provider analytics'
    });
  }
});

/**
 * @route   GET /api/v1/sponsored/section
 * @desc    Get sponsored activities for the sponsor section on explore page
 * @access  Public
 */
router.get('/section', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      limit = '6',
      ageMin,
      ageMax,
      location,
      activityType,
      sessionId
    } = req.query;

    // Build a basic where clause for matching
    const baseWhere: any = {
      isActive: true
    };

    // Apply age filter if provided
    if (ageMin) {
      baseWhere.ageMax = { gte: parseInt(ageMin as string) };
    }
    if (ageMax) {
      baseWhere.ageMin = { lte: parseInt(ageMax as string) };
    }

    // Get sponsored activities for the section (no limit on quota for sponsor section)
    const result = await sponsoredActivityService.selectSponsoredActivities(
      baseWhere,
      parseInt(limit as string),
      false // This IS the sponsor section
    );

    // Record impressions for sponsor section
    if (result.sponsoredActivities.length > 0) {
      sponsoredActivityService.recordImpressions(
        result.sponsoredActivities.map(a => a.id),
        'sponsor_section',
        {
          userId: (req as any).userId,
          sessionId: sessionId as string,
          filters: { ageMin, ageMax, location, activityType },
          deviceType: req.headers['x-device-type'] as string || 'web'
        }
      ).catch(err => console.error('Failed to record sponsor section impressions:', err));
    }

    res.json({
      success: true,
      activities: result.sponsoredActivities,
      total: result.totalMatching
    });
  } catch (error: any) {
    console.error('Sponsored section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sponsored activities'
    });
  }
});

/**
 * @route   GET /api/v1/sponsored/tier-limits
 * @desc    Get the impression limits for each tier
 * @access  Public
 */
router.get('/tier-limits', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      gold: {
        monthlyLimit: null,
        description: 'Unlimited impressions'
      },
      silver: {
        monthlyLimit: 25000,
        description: 'Up to 25,000 impressions per month'
      },
      bronze: {
        monthlyLimit: 5000,
        description: 'Up to 5,000 impressions per month'
      }
    }
  });
});

export default router;
