import { Router, Request, Response } from 'express';
import { verifyToken, optionalAuth } from '../middleware/auth';
import { subscriptionService } from '../services/subscriptionService';
import { body, validationResult } from 'express-validator';

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

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans (public)
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await subscriptionService.getAvailablePlans();

    res.json({
      success: true,
      plans: plans.map(plan => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        features: {
          maxChildren: plan.maxChildren,
          maxFavorites: plan.maxFavorites,
          maxSharedUsers: plan.maxSharedUsers,
          hasAdvancedFilters: plan.hasAdvancedFilters,
          hasCalendarExport: plan.hasCalendarExport,
          hasInstantAlerts: plan.hasInstantAlerts,
          hasSavedSearches: plan.hasSavedSearches,
          savedSearchLimit: plan.savedSearchLimit
        }
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription plans'
    });
  }
});

/**
 * GET /api/subscriptions/current
 * Get current user's subscription with usage stats
 */
router.get('/current', verifyToken, async (req: Request, res: Response) => {
  try {
    const info = await subscriptionService.getUserSubscriptionInfo(req.user!.id);

    res.json({
      success: true,
      subscription: info.subscription ? {
        id: info.subscription.id,
        status: info.subscription.status,
        billingCycle: info.subscription.billingCycle,
        startDate: info.subscription.startDate,
        currentPeriodEnd: info.subscription.currentPeriodEnd,
        trialEndsAt: info.subscription.trialEndsAt,
        externalProvider: info.subscription.externalProvider
      } : null,
      plan: {
        code: info.plan.code,
        name: info.plan.name,
        description: info.plan.description,
        monthlyPrice: info.plan.monthlyPrice,
        annualPrice: info.plan.annualPrice
      },
      limits: info.limits,
      usage: info.usage,
      isTrialing: info.isTrialing,
      trialDaysRemaining: info.trialDaysRemaining
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch subscription info'
    });
  }
});

/**
 * GET /api/subscriptions/limits
 * Get just the limits for the current user (faster endpoint for limit checks)
 */
router.get('/limits', verifyToken, async (req: Request, res: Response) => {
  try {
    const limits = await subscriptionService.getUserLimits(req.user!.id);

    res.json({
      success: true,
      limits
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch limits'
    });
  }
});

/**
 * GET /api/subscriptions/check/:resource
 * Check if user can add more of a specific resource
 * Resources: children, favorites, shares, saved-searches
 */
router.get('/check/:resource', verifyToken, async (req: Request, res: Response) => {
  try {
    const { resource } = req.params;
    let result: { allowed: boolean; current: number; limit: number };

    switch (resource) {
      case 'children':
        result = await subscriptionService.canAddChild(req.user!.id);
        break;
      case 'favorites':
        result = await subscriptionService.canAddFavorite(req.user!.id);
        break;
      case 'shares':
        result = await subscriptionService.canShareWithUser(req.user!.id);
        break;
      case 'saved-searches':
        result = await subscriptionService.canCreateSavedSearch(req.user!.id);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown resource: ${resource}. Valid resources: children, favorites, shares, saved-searches`
        });
    }

    res.json({
      success: true,
      resource,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check resource limit'
    });
  }
});

/**
 * GET /api/subscriptions/feature/:feature
 * Check if user has access to a specific feature
 */
router.get('/feature/:feature', verifyToken, async (req: Request, res: Response) => {
  try {
    const { feature } = req.params;
    const validFeatures = [
      'hasAdvancedFilters',
      'hasCalendarExport',
      'hasInstantAlerts',
      'hasSavedSearches'
    ];

    if (!validFeatures.includes(feature)) {
      return res.status(400).json({
        success: false,
        error: `Unknown feature: ${feature}. Valid features: ${validFeatures.join(', ')}`
      });
    }

    const hasAccess = await subscriptionService.hasFeature(
      req.user!.id,
      feature as any
    );

    res.json({
      success: true,
      feature,
      hasAccess
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check feature access'
    });
  }
});

/**
 * POST /api/subscriptions/verify
 * Verify a purchase from the mobile app (RevenueCat)
 */
router.post(
  '/verify',
  verifyToken,
  [
    body('externalId').notEmpty().withMessage('External ID is required'),
    body('externalProvider').isIn(['revenuecat', 'stripe']).withMessage('Valid provider required'),
    body('planCode').optional().isIn(['free', 'premium']).withMessage('Valid plan code required'),
    body('billingCycle').optional().isIn(['monthly', 'annual']).withMessage('Valid billing cycle required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { externalId, externalProvider, planCode, billingCycle, currentPeriodEnd } = req.body;

      const subscription = await subscriptionService.activateFromExternal(
        req.user!.id,
        externalId,
        externalProvider,
        planCode || 'premium',
        billingCycle || 'monthly',
        currentPeriodEnd ? new Date(currentPeriodEnd) : undefined
      );

      const info = await subscriptionService.getUserSubscriptionInfo(req.user!.id);

      res.json({
        success: true,
        message: 'Subscription activated successfully',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billingCycle
        },
        plan: {
          code: info.plan.code,
          name: info.plan.name
        },
        limits: info.limits
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to verify purchase'
      });
    }
  }
);

/**
 * POST /api/subscriptions/restore
 * Restore purchases (check with RevenueCat and update local state)
 */
router.post(
  '/restore',
  verifyToken,
  [
    body('externalId').notEmpty().withMessage('External ID is required'),
    body('externalProvider').isIn(['revenuecat', 'stripe']).withMessage('Valid provider required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { externalId, externalProvider, planCode, billingCycle, currentPeriodEnd } = req.body;

      // If the external ID exists and is valid, restore the subscription
      if (planCode && planCode !== 'free') {
        const subscription = await subscriptionService.activateFromExternal(
          req.user!.id,
          externalId,
          externalProvider,
          planCode,
          billingCycle || 'monthly',
          currentPeriodEnd ? new Date(currentPeriodEnd) : undefined
        );

        const info = await subscriptionService.getUserSubscriptionInfo(req.user!.id);

        return res.json({
          success: true,
          restored: true,
          message: 'Subscription restored successfully',
          subscription: {
            id: subscription.id,
            status: subscription.status
          },
          plan: {
            code: info.plan.code,
            name: info.plan.name
          },
          limits: info.limits
        });
      }

      // No active subscription to restore
      const info = await subscriptionService.getUserSubscriptionInfo(req.user!.id);

      res.json({
        success: true,
        restored: false,
        message: 'No active subscription found to restore',
        plan: {
          code: info.plan.code,
          name: info.plan.name
        },
        limits: info.limits
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to restore purchases'
      });
    }
  }
);

/**
 * POST /api/subscriptions/cancel
 * Cancel the current subscription
 */
router.post('/cancel', verifyToken, async (req: Request, res: Response) => {
  try {
    await subscriptionService.cancelSubscription(req.user!.id);

    const info = await subscriptionService.getUserSubscriptionInfo(req.user!.id);

    res.json({
      success: true,
      message: 'Subscription cancelled. You will retain access until the current period ends.',
      plan: {
        code: info.plan.code,
        name: info.plan.name
      },
      limits: info.limits
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to cancel subscription'
    });
  }
});

/**
 * POST /api/subscriptions/start-trial
 * Start a premium trial for the user
 */
router.post('/start-trial', verifyToken, async (req: Request, res: Response) => {
  try {
    const info = await subscriptionService.getUserSubscriptionInfo(req.user!.id);

    // Check if user already has or had premium
    if (info.subscription && info.plan.code === 'premium') {
      return res.status(400).json({
        success: false,
        error: 'You already have a premium subscription'
      });
    }

    // Create trial subscription
    const subscription = await subscriptionService.createSubscription({
      userId: req.user!.id,
      planCode: 'premium',
      trialDays: 7
    });

    const newInfo = await subscriptionService.getUserSubscriptionInfo(req.user!.id);

    res.json({
      success: true,
      message: 'Your 7-day premium trial has started!',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt
      },
      plan: {
        code: newInfo.plan.code,
        name: newInfo.plan.name
      },
      limits: newInfo.limits,
      trialDaysRemaining: newInfo.trialDaysRemaining
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to start trial'
    });
  }
});

export default router;
