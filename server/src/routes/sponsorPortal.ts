import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '../../generated/prisma';
import { verifyToken } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// Sponsor portal JWT secret (separate from user auth)
const SPONSOR_JWT_SECRET = process.env.SPONSOR_JWT_SECRET || process.env.JWT_SECRET || 'sponsor-secret';

// Middleware to verify sponsor token
const verifySponsorToken = async (req: Request, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SPONSOR_JWT_SECRET) as { sponsorAccountId: string; providerId: string };

    const sponsor = await prisma.sponsorAccount.findUnique({
      where: { id: decoded.sponsorAccountId },
      include: {
        provider: true,
        plan: true
      }
    });

    if (!sponsor) {
      return res.status(401).json({ success: false, error: 'Invalid sponsor account' });
    }

    (req as any).sponsor = sponsor;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

/**
 * @route   POST /api/sponsor/auth/login
 * @desc    Sponsor portal login (uses vendor credentials)
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
                    sponsorAccount: {
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

    // Find vendor with sponsor account
    const vendorWithSponsor = user.vendorMemberships.find(
      vm => vm.vendor.provider?.sponsorAccount
    );

    if (!vendorWithSponsor || !vendorWithSponsor.vendor.provider?.sponsorAccount) {
      return res.status(403).json({
        success: false,
        error: 'No sponsor account associated with your vendor account'
      });
    }

    const sponsorAccount = vendorWithSponsor.vendor.provider.sponsorAccount;

    // Generate sponsor token
    const token = jwt.sign(
      {
        sponsorAccountId: sponsorAccount.id,
        providerId: vendorWithSponsor.vendor.providerId,
        userId: user.id
      },
      SPONSOR_JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      sponsor: {
        id: sponsorAccount.id,
        providerName: vendorWithSponsor.vendor.name,
        plan: sponsorAccount.plan,
        subscriptionStatus: sponsorAccount.subscriptionStatus
      }
    });
  } catch (error: any) {
    console.error('[SponsorPortal] Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

/**
 * @route   GET /api/sponsor/auth/me
 * @desc    Get current sponsor account details
 * @access  Sponsor
 */
router.get('/auth/me', verifySponsorToken, async (req: Request, res: Response) => {
  try {
    const sponsor = (req as any).sponsor;

    res.json({
      success: true,
      sponsor: {
        id: sponsor.id,
        provider: sponsor.provider,
        plan: sponsor.plan,
        subscriptionStatus: sponsor.subscriptionStatus,
        subscriptionStartDate: sponsor.subscriptionStartDate,
        subscriptionEndDate: sponsor.subscriptionEndDate,
        targetCities: sponsor.targetCities,
        targetProvinces: sponsor.targetProvinces,
        billingEmail: sponsor.billingEmail,
        billingName: sponsor.billingName
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
 * @route   GET /api/sponsor/dashboard
 * @desc    Get sponsor's own analytics dashboard data
 * @access  Sponsor
 */
router.get('/dashboard', verifySponsorToken, async (req: Request, res: Response) => {
  try {
    const sponsor = (req as any).sponsor;

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
      prisma.sponsorImpression.count({
        where: { sponsorAccountId: sponsor.id, timestamp: { gte: today } }
      }),
      prisma.sponsorClick.count({
        where: { sponsorAccountId: sponsor.id, timestamp: { gte: today } }
      }),
      prisma.sponsorImpression.count({
        where: { sponsorAccountId: sponsor.id, timestamp: { gte: sevenDaysAgo } }
      }),
      prisma.sponsorClick.count({
        where: { sponsorAccountId: sponsor.id, timestamp: { gte: sevenDaysAgo } }
      }),
      prisma.sponsorImpression.count({
        where: { sponsorAccountId: sponsor.id, timestamp: { gte: thirtyDaysAgo } }
      }),
      prisma.sponsorClick.count({
        where: { sponsorAccountId: sponsor.id, timestamp: { gte: thirtyDaysAgo } }
      }),
      prisma.sponsorAnalyticsDaily.findMany({
        where: {
          sponsorAccountId: sponsor.id,
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
          plan: sponsor.plan,
          status: sponsor.subscriptionStatus,
          endsAt: sponsor.subscriptionEndDate
        }
      }
    });
  } catch (error: any) {
    console.error('[SponsorPortal] Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load dashboard'
    });
  }
});

/**
 * @route   GET /api/sponsor/analytics
 * @desc    Get detailed analytics for own account
 * @access  Sponsor
 */
router.get('/analytics', verifySponsorToken, async (req: Request, res: Response) => {
  try {
    const sponsor = (req as any).sponsor;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get daily analytics
    const dailyAnalytics = await prisma.sponsorAnalyticsDaily.findMany({
      where: {
        sponsorAccountId: sponsor.id,
        date: { gte: start, lte: end }
      },
      orderBy: { date: 'asc' }
    });

    // Get breakdown by placement
    const [impressionsByPlacement, clicksByPlacement] = await Promise.all([
      prisma.sponsorImpression.groupBy({
        by: ['placement'],
        where: {
          sponsorAccountId: sponsor.id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      }),
      prisma.sponsorClick.groupBy({
        by: ['placement'],
        where: {
          sponsorAccountId: sponsor.id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      })
    ]);

    // Get breakdown by city (top 10)
    const [impressionsByCity, clicksByCity] = await Promise.all([
      prisma.sponsorImpression.groupBy({
        by: ['city'],
        where: {
          sponsorAccountId: sponsor.id,
          timestamp: { gte: start, lte: end },
          city: { not: null }
        },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 10
      }),
      prisma.sponsorClick.groupBy({
        by: ['city'],
        where: {
          sponsorAccountId: sponsor.id,
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
    console.error('[SponsorPortal] Analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load analytics'
    });
  }
});

/**
 * @route   PUT /api/sponsor/settings
 * @desc    Update targeting settings
 * @access  Sponsor
 */
router.put('/settings', [
  body('targetCities').optional().isArray(),
  body('targetProvinces').optional().isArray(),
], verifySponsorToken, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const sponsor = (req as any).sponsor;
    const { targetCities, targetProvinces } = req.body;

    const updateData: any = {};
    if (targetCities !== undefined) updateData.targetCities = targetCities;
    if (targetProvinces !== undefined) updateData.targetProvinces = targetProvinces;

    const updated = await prisma.sponsorAccount.update({
      where: { id: sponsor.id },
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
    console.error('[SponsorPortal] Settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update settings'
    });
  }
});

/**
 * @route   GET /api/sponsor/plans
 * @desc    List available sponsor plans
 * @access  Sponsor
 */
router.get('/plans', verifySponsorToken, async (req: Request, res: Response) => {
  try {
    const plans = await prisma.sponsorPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    });

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
 * @route   GET /api/sponsor/cities
 * @desc    Get available cities for targeting
 * @access  Sponsor
 */
router.get('/cities', verifySponsorToken, async (req: Request, res: Response) => {
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
