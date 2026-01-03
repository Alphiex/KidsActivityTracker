import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../middleware/auth';
import { emailService } from '../utils/emailService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const RESET_TOKEN_EXPIRY_HOURS = 2;

// Partner portal JWT secret (separate from user auth)
const PARTNER_JWT_SECRET = process.env.SPONSOR_JWT_SECRET || process.env.JWT_SECRET || 'partner-secret';

// Middleware to verify partner token
const verifyPartnerToken = async (req: Request, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, PARTNER_JWT_SECRET) as { sponsorAccountId: string; providerId: string };

    const partner = await prisma.partnerAccount.findUnique({
      where: { id: decoded.sponsorAccountId },
      include: {
        provider: true,
        plan: true
      }
    });

    if (!partner) {
      return res.status(401).json({ success: false, error: 'Invalid partner account' });
    }

    (req as any).partner = partner;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

/**
 * @route   POST /api/partner/auth/login
 * @desc    Partner portal login (uses vendor credentials)
 * @access  Public
 */
router.post('/auth/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        vendorMemberships: {
          include: {
            vendor: {
              include: {
                provider: {
                  include: {
                    partnerAccount: {
                      include: {
                        plan: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Find vendor with partner account
    const vendorWithPartner = user.vendorMemberships.find(
      vm => vm.vendor.provider?.partnerAccount
    );

    if (!vendorWithPartner || !vendorWithPartner.vendor.provider?.partnerAccount) {
      return res.status(403).json({
        success: false,
        error: 'No partner account associated with your vendor account'
      });
    }

    const partnerAccount = vendorWithPartner.vendor.provider.partnerAccount;

    // Generate partner token (keep sponsorAccountId for backward compatibility with existing tokens)
    const token = jwt.sign(
      {
        sponsorAccountId: partnerAccount.id,
        providerId: vendorWithPartner.vendor.providerId,
        userId: user.id
      },
      PARTNER_JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      sponsor: {
        id: partnerAccount.id,
        providerName: vendorWithPartner.vendor.name,
        plan: partnerAccount.plan,
        subscriptionStatus: partnerAccount.subscriptionStatus
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

/**
 * @route   POST /api/partner/auth/forgot-password
 * @desc    Request password reset for sponsor account
 * @access  Public
 */
router.post('/auth/forgot-password', [
  body('email').isEmail().withMessage('Valid email required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        vendorMemberships: {
          include: {
            vendor: {
              include: {
                provider: {
                  include: {
                    partnerAccount: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Check if user has a partner account
    const hasPartnerAccount = user.vendorMemberships.some(
      vm => vm.vendor.provider?.partnerAccount
    );

    if (!hasPartnerAccount) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + RESET_TOKEN_EXPIRY_HOURS);

    // Save reset token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetToken
    );

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request. Please try again.',
    });
  }
});

/**
 * @route   POST /api/partner/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/auth/reset-password', [
  body('token').notEmpty().withMessage('Token required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token, password } = req.body;

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Send confirmation email
    await emailService.sendPasswordChangedEmail(user.email, user.name);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.',
    });
  }
});

/**
 * @route   GET /api/partner/auth/me
 * @desc    Get current partner account details
 * @access  Partner
 */
router.get('/auth/me', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;

    res.json({
      success: true,
      sponsor: {
        id: partner.id,
        provider: partner.provider,
        plan: partner.plan,
        subscriptionStatus: partner.subscriptionStatus,
        subscriptionStartDate: partner.subscriptionStartDate,
        subscriptionEndDate: partner.subscriptionEndDate,
        targetCities: partner.targetCities,
        targetProvinces: partner.targetProvinces,
        billingEmail: partner.billingEmail,
        billingName: partner.billingName
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get account'
    });
  }
});

/**
 * @route   GET /api/partner/dashboard
 * @desc    Get partner's own analytics dashboard data
 * @access  Partner
 */
router.get('/dashboard', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;

    // Get stats for different periods
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      impressionsToday,
      clicksToday,
      impressionsLast7Days,
      clicksLast7Days,
      impressionsLast30Days,
      clicksLast30Days,
      recentDaily
    ] = await Promise.all([
      prisma.partnerImpression.count({
        where: { partnerAccountId: partner.id, timestamp: { gte: today } }
      }),
      prisma.partnerClick.count({
        where: { partnerAccountId: partner.id, timestamp: { gte: today } }
      }),
      prisma.partnerImpression.count({
        where: { partnerAccountId: partner.id, timestamp: { gte: sevenDaysAgo } }
      }),
      prisma.partnerClick.count({
        where: { partnerAccountId: partner.id, timestamp: { gte: sevenDaysAgo } }
      }),
      prisma.partnerImpression.count({
        where: { partnerAccountId: partner.id, timestamp: { gte: thirtyDaysAgo } }
      }),
      prisma.partnerClick.count({
        where: { partnerAccountId: partner.id, timestamp: { gte: thirtyDaysAgo } }
      }),
      prisma.partnerAnalyticsDaily.findMany({
        where: {
          partnerAccountId: partner.id,
          date: { gte: sevenDaysAgo }
        },
        orderBy: { date: 'asc' }
      })
    ]);

    const calculateCTR = (impressions: number, clicks: number) =>
      impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

    res.json({
      success: true,
      dashboard: {
        today: {
          impressions: impressionsToday,
          clicks: clicksToday,
          ctr: calculateCTR(impressionsToday, clicksToday)
        },
        last7Days: {
          impressions: impressionsLast7Days,
          clicks: clicksLast7Days,
          ctr: calculateCTR(impressionsLast7Days, clicksLast7Days)
        },
        last30Days: {
          impressions: impressionsLast30Days,
          clicks: clicksLast30Days,
          ctr: calculateCTR(impressionsLast30Days, clicksLast30Days)
        },
        dailyTrend: recentDaily,
        subscription: {
          plan: partner.plan,
          status: partner.subscriptionStatus,
          endsAt: partner.subscriptionEndDate
        }
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load dashboard'
    });
  }
});

/**
 * @route   GET /api/partner/analytics
 * @desc    Get detailed analytics for own account
 * @access  Partner
 */
router.get('/analytics', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get daily analytics
    const dailyAnalytics = await prisma.partnerAnalyticsDaily.findMany({
      where: {
        partnerAccountId: partner.id,
        date: { gte: start, lte: end }
      },
      orderBy: { date: 'asc' }
    });

    // Get breakdown by placement
    const [impressionsByPlacement, clicksByPlacement] = await Promise.all([
      prisma.partnerImpression.groupBy({
        by: ['placement'],
        where: {
          partnerAccountId: partner.id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      }),
      prisma.partnerClick.groupBy({
        by: ['placement'],
        where: {
          partnerAccountId: partner.id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      })
    ]);

    // Get breakdown by city (top 10)
    const [impressionsByCity, clicksByCity] = await Promise.all([
      prisma.partnerImpression.groupBy({
        by: ['city'],
        where: {
          partnerAccountId: partner.id,
          timestamp: { gte: start, lte: end },
          city: { not: null }
        },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 10
      }),
      prisma.partnerClick.groupBy({
        by: ['city'],
        where: {
          partnerAccountId: partner.id,
          timestamp: { gte: start, lte: end },
          city: { not: null }
        },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 10
      })
    ]);

    const totalImpressions = dailyAnalytics.reduce((sum, d) => sum + d.impressionsTotal, 0);
    const totalClicks = dailyAnalytics.reduce((sum, d) => sum + d.clicksTotal, 0);

    res.json({
      success: true,
      analytics: {
        period: { start, end },
        totals: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'
        },
        timeSeries: dailyAnalytics,
        breakdown: {
          byPlacement: { impressions: impressionsByPlacement, clicks: clicksByPlacement },
          byCity: { impressions: impressionsByCity, clicks: clicksByCity }
        }
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load analytics'
    });
  }
});

/**
 * @route   GET /api/partner/analytics/activities
 * @desc    Get analytics broken down by individual activities
 * @access  Partner
 */
router.get('/analytics/activities', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;
    const { startDate, endDate, limit = '20' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    const limitNum = parseInt(limit as string);

    // Get impressions by activity
    const impressionsByActivity = await prisma.partnerImpression.groupBy({
      by: ['activityId'],
      where: {
        partnerAccountId: partner.id,
        timestamp: { gte: start, lte: end },
        activityId: { not: null }
      },
      _count: true,
      orderBy: { _count: { activityId: 'desc' } },
      take: limitNum
    });

    // Get clicks by activity
    const clicksByActivity = await prisma.partnerClick.groupBy({
      by: ['activityId'],
      where: {
        partnerAccountId: partner.id,
        timestamp: { gte: start, lte: end },
        activityId: { not: null }
      },
      _count: true
    });

    // Create clicks map for easy lookup
    const clicksMap = new Map<string, number>();
    for (const click of clicksByActivity) {
      if (click.activityId) {
        clicksMap.set(click.activityId, click._count);
      }
    }

    // Get activity IDs from impressions
    const activityIds = impressionsByActivity
      .map(i => i.activityId)
      .filter((id): id is string => id !== null);

    // Fetch activity details
    const activities = activityIds.length > 0 ? await prisma.activity.findMany({
      where: { id: { in: activityIds } },
      select: {
        id: true,
        name: true,
        activityType: true,
        location: {
          select: {
            name: true,
            city: true
          }
        }
      }
    }) : [];

    // Create activities map
    const activitiesMap = new Map(activities.map(a => [a.id, a]));

    // Build response with activity details
    const activityAnalytics = impressionsByActivity.map(imp => {
      const activityId = imp.activityId!;
      const activity = activitiesMap.get(activityId);
      const impressions = imp._count;
      const clicks = clicksMap.get(activityId) || 0;

      return {
        activityId,
        name: activity?.name || 'Unknown Activity',
        activityType: activity?.activityType || null,
        location: activity?.location?.name || null,
        city: activity?.location?.city || null,
        impressions,
        clicks,
        ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00'
      };
    });

    // Sort by impressions (already sorted by groupBy, but ensure)
    activityAnalytics.sort((a, b) => b.impressions - a.impressions);

    res.json({
      success: true,
      period: { start, end },
      activities: activityAnalytics,
      totalActivities: activityAnalytics.length
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Activity analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load activity analytics'
    });
  }
});

/**
 * @route   GET /api/partner/analytics/activity/:activityId
 * @desc    Get detailed analytics for a specific activity
 * @access  Partner
 */
router.get('/analytics/activity/:activityId', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;
    const { activityId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Verify the activity belongs to this partner's provider
    const activity = await prisma.activity.findFirst({
      where: {
        id: activityId,
        provider: {
          partnerAccount: {
            id: partner.id
          }
        }
      },
      select: {
        id: true,
        name: true,
        activityType: true,
        location: {
          select: {
            name: true,
            city: true,
            province: true
          }
        }
      }
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found or does not belong to your account'
      });
    }

    // Get impressions and clicks for this activity
    const [impressions, clicks] = await Promise.all([
      prisma.partnerImpression.count({
        where: {
          partnerAccountId: partner.id,
          activityId,
          timestamp: { gte: start, lte: end }
        }
      }),
      prisma.partnerClick.count({
        where: {
          partnerAccountId: partner.id,
          activityId,
          timestamp: { gte: start, lte: end }
        }
      })
    ]);

    // Get daily breakdown
    const dailyImpressions = await prisma.partnerImpression.groupBy({
      by: ['timestamp'],
      where: {
        partnerAccountId: partner.id,
        activityId,
        timestamp: { gte: start, lte: end }
      },
      _count: true
    });

    const dailyClicks = await prisma.partnerClick.groupBy({
      by: ['timestamp'],
      where: {
        partnerAccountId: partner.id,
        activityId,
        timestamp: { gte: start, lte: end }
      },
      _count: true
    });

    // Get clicks by destination type
    const clicksByDestination = await prisma.partnerClick.groupBy({
      by: ['destinationType'],
      where: {
        partnerAccountId: partner.id,
        activityId,
        timestamp: { gte: start, lte: end }
      },
      _count: true
    });

    // Get clicks by placement
    const clicksByPlacement = await prisma.partnerClick.groupBy({
      by: ['placement'],
      where: {
        partnerAccountId: partner.id,
        activityId,
        timestamp: { gte: start, lte: end }
      },
      _count: true
    });

    res.json({
      success: true,
      activity: {
        id: activity.id,
        name: activity.name,
        activityType: activity.activityType,
        location: activity.location
      },
      period: { start, end },
      totals: {
        impressions,
        clicks,
        ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00'
      },
      breakdown: {
        byDestination: clicksByDestination.map(d => ({
          type: d.destinationType,
          count: d._count
        })),
        byPlacement: clicksByPlacement.map(p => ({
          placement: p.placement,
          count: p._count
        }))
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Single activity analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load activity analytics'
    });
  }
});

/**
 * @route   PUT /api/partner/settings
 * @desc    Update targeting settings
 * @access  Partner
 */
router.put('/settings', [
  body('targetCities').optional().isArray(),
  body('targetProvinces').optional().isArray(),
], verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const partner = (req as any).partner;
    const { targetCities, targetProvinces } = req.body;

    const updateData: any = {};
    if (targetCities !== undefined) updateData.targetCities = targetCities;
    if (targetProvinces !== undefined) updateData.targetProvinces = targetProvinces;

    const updated = await prisma.partnerAccount.update({
      where: { id: partner.id },
      data: updateData
    });

    res.json({
      success: true,
      settings: {
        targetCities: updated.targetCities,
        targetProvinces: updated.targetProvinces
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update settings'
    });
  }
});

/**
 * @route   GET /api/partner/plans
 * @desc    List available partner plans (PUBLIC - no auth required)
 * @access  Public
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    // First try to get from database
    let plans = await prisma.partnerPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    });

    // If no plans in database, return static tier info from stripeService
    if (plans.length === 0) {
      const { PARTNER_TIERS } = await import('../services/stripeService');

      // Return static plans based on PARTNER_TIERS config
      const staticPlans = Object.entries(PARTNER_TIERS).map(([tier, config]) => ({
        id: tier,
        name: config.name,
        tier,
        monthlyPrice: (config.monthlyPrice / 100).toString(),
        yearlyPrice: (config.yearlyPrice / 100).toString(),
        impressionLimit: config.impressionLimit,
        features: config.features
      }));

      return res.json({
        success: true,
        plans: staticPlans
      });
    }

    res.json({
      success: true,
      plans: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        impressionLimit: plan.impressionLimit,
        features: plan.features
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load plans'
    });
  }
});

/**
 * @route   PUT /api/partner/billing
 * @desc    Update billing details
 * @access  Partner
 */
router.put('/billing', [
  body('billingEmail').optional().isEmail().withMessage('Valid email required'),
  body('billingName').optional().isString(),
], verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const partner = (req as any).partner;
    const { billingEmail, billingName } = req.body;

    const updateData: any = {};
    if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
    if (billingName !== undefined) updateData.billingName = billingName;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const updated = await prisma.partnerAccount.update({
      where: { id: partner.id },
      data: updateData
    });

    res.json({
      success: true,
      billing: {
        billingEmail: updated.billingEmail,
        billingName: updated.billingName
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Billing update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update billing'
    });
  }
});

/**
 * @route   POST /api/partner/subscription/checkout
 * @desc    Create a Stripe Checkout session for partner subscription
 * @access  Partner
 */
router.post('/subscription/checkout', [
  body('tier').isIn(['bronze', 'silver', 'gold']).withMessage('Tier must be bronze, silver, or gold'),
  body('billingCycle').isIn(['monthly', 'annual']).withMessage('Billing cycle must be monthly or annual'),
], verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const partner = (req as any).partner;
    const { tier, billingCycle } = req.body;

    const { createCheckoutSession, PARTNER_TIERS } = await import('../services/stripeService');

    const tierConfig = PARTNER_TIERS[tier as keyof typeof PARTNER_TIERS];

    // Determine success/cancel URLs from frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const successUrl = `${frontendUrl}/sponsor/billing?success=true`;
    const cancelUrl = `${frontendUrl}/sponsor/plans?cancelled=true`;

    const session = await createCheckoutSession({
      partnerAccountId: partner.id,
      tier: tier as any,
      billingCycle,
      successUrl,
      cancelUrl,
    });

    console.log(`[PartnerPortal] Checkout session created for partner ${partner.id}, tier: ${tier}`);

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      tier,
      billingCycle,
      price: billingCycle === 'annual' ? tierConfig.yearlyPrice / 100 : tierConfig.monthlyPrice / 100,
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Checkout error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session'
    });
  }
});

/**
 * @route   POST /api/partner/subscription/portal
 * @desc    Create a Stripe Customer Portal session for managing subscription
 * @access  Partner
 */
router.post('/subscription/portal', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;

    const { createCustomerPortalSession } = await import('../services/stripeService');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const returnUrl = `${frontendUrl}/sponsor/billing`;

    const session = await createCustomerPortalSession({
      partnerAccountId: partner.id,
      returnUrl,
    });

    res.json({
      success: true,
      portalUrl: session.url,
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Portal session error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create portal session'
    });
  }
});

/**
 * @route   GET /api/partner/subscription/details
 * @desc    Get detailed subscription information from Stripe
 * @access  Partner
 */
router.get('/subscription/details', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;

    const { getSubscriptionDetails } = await import('../services/stripeService');

    const details = await getSubscriptionDetails(partner.id);

    res.json({
      success: true,
      subscription: details || {
        status: partner.subscriptionStatus || 'inactive',
        currentPeriodEnd: partner.subscriptionEndDate,
        cancelAtPeriodEnd: false,
        plan: partner.plan?.name || null,
      },
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Subscription details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscription details'
    });
  }
});

/**
 * @route   POST /api/partner/subscription/request
 * @desc    Request a subscription upgrade (legacy - kept for backward compatibility)
 * @access  Partner
 */
router.post('/subscription/request', [
  body('planId').notEmpty().withMessage('Plan ID required'),
  body('billingCycle').isIn(['monthly', 'annual']).withMessage('Billing cycle must be monthly or annual'),
  body('message').optional().isString(),
], verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const partner = (req as any).partner;
    const { planId, billingCycle, message } = req.body;

    // Get the requested plan
    const plan = await prisma.partnerPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Log the upgrade request (in production, would send email to admin)
    console.log(`[PartnerPortal] Subscription request:`, {
      partnerId: partner.id,
      providerName: partner.provider?.name,
      currentPlan: partner.plan?.name,
      requestedPlan: plan.name,
      billingCycle,
      message,
      billingEmail: partner.billingEmail
    });

    // Redirect to use the checkout endpoint instead
    res.json({
      success: true,
      message: 'Please use the /subscription/checkout endpoint to subscribe.',
      checkoutEndpoint: '/api/partner/subscription/checkout',
      requestDetails: {
        requestedPlan: plan.name,
        billingCycle,
        price: billingCycle === 'annual' ? plan.yearlyPrice : plan.monthlyPrice
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Subscription request error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process request'
    });
  }
});

/**
 * @route   POST /api/partner/subscription/cancel
 * @desc    Cancel current subscription via Stripe
 * @access  Partner
 */
router.post('/subscription/cancel', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const partner = (req as any).partner;

    if (partner.subscriptionStatus !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }

    // Cancel via Stripe (will cancel at period end)
    const { cancelSubscription } = await import('../services/stripeService');
    await cancelSubscription(partner.id);

    const updated = await prisma.partnerAccount.findUnique({
      where: { id: partner.id }
    });

    console.log(`[PartnerPortal] Subscription cancelled via Stripe:`, {
      partnerId: partner.id,
      providerName: partner.provider?.name,
      endDate: updated?.subscriptionEndDate
    });

    res.json({
      success: true,
      message: 'Subscription cancelled. Your benefits will remain active until the end of your billing period.',
      subscription: {
        status: updated?.subscriptionStatus,
        endDate: updated?.subscriptionEndDate
      }
    });
  } catch (error: any) {
    console.error('[PartnerPortal] Subscription cancel error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel subscription'
    });
  }
});

/**
 * @route   GET /api/partner/cities
 * @desc    Get available cities for targeting
 * @access  Partner
 */
router.get('/cities', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const cities = await prisma.city.findMany({
      orderBy: [{ province: 'asc' }, { name: 'asc' }]
    });

    // Group by province
    const byProvince: Record<string, string[]> = {};
    for (const city of cities) {
      if (!byProvince[city.province]) {
        byProvince[city.province] = [];
      }
      byProvince[city.province].push(city.name);
    }

    res.json({
      success: true,
      cities,
      byProvince
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load cities'
    });
  }
});

export default router;
