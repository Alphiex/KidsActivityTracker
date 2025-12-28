import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '../../generated/prisma';
import { verifyToken } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

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
 * @desc    List available partner plans
 * @access  Partner
 */
router.get('/plans', verifyPartnerToken, async (req: Request, res: Response) => {
  try {
    const plans = await prisma.partnerPlan.findMany({
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
