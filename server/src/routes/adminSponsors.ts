import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '../../generated/prisma';
import { verifyToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Admin middleware - verify user has admin role
const requireAdmin = async (req: Request, res: Response, next: any) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { userId: req.user.id }
    });

    if (!adminUser || !['SUPER_ADMIN', 'ADMIN'].includes(adminUser.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    (req as any).adminUser = adminUser;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to verify admin access' });
  }
};

/**
 * @route   GET /api/admin/sponsors
 * @desc    List all sponsor accounts with stats
 * @access  Admin
 */
router.get('/', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      status,
      tier,
      page = '1',
      limit = '20',
      search
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: any = {};

    if (status) {
      where.subscriptionStatus = status;
    }

    if (tier) {
      where.plan = { tier };
    }

    if (search) {
      where.provider = {
        name: { contains: search as string, mode: 'insensitive' }
      };
    }

    // Get sponsors with aggregated stats
    const [sponsors, total] = await Promise.all([
      prisma.sponsorAccount.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              website: true
            }
          },
          plan: {
            select: {
              id: true,
              name: true,
              tier: true
            }
          },
          _count: {
            select: {
              impressions: true,
              clicks: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sponsorAccount.count({ where })
    ]);

    // Transform with stats
    const sponsorsWithStats = sponsors.map(sponsor => ({
      id: sponsor.id,
      provider: sponsor.provider,
      plan: sponsor.plan,
      subscriptionStatus: sponsor.subscriptionStatus,
      subscriptionStartDate: sponsor.subscriptionStartDate,
      subscriptionEndDate: sponsor.subscriptionEndDate,
      billingEmail: sponsor.billingEmail,
      targetCities: sponsor.targetCities,
      targetProvinces: sponsor.targetProvinces,
      createdAt: sponsor.createdAt,
      stats: {
        totalImpressions: sponsor._count.impressions,
        totalClicks: sponsor._count.clicks,
        ctr: sponsor._count.impressions > 0
          ? ((sponsor._count.clicks / sponsor._count.impressions) * 100).toFixed(2)
          : '0.00'
      }
    }));

    res.json({
      success: true,
      sponsors: sponsorsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('[AdminSponsors] Error listing sponsors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list sponsors'
    });
  }
});

/**
 * @route   GET /api/admin/sponsors/:id
 * @desc    Get sponsor details with full analytics
 * @access  Admin
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Valid sponsor ID required'),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;

    const sponsor = await prisma.sponsorAccount.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            website: true,
            contactInfo: true
          }
        },
        plan: true
      }
    });

    if (!sponsor) {
      return res.status(404).json({ success: false, error: 'Sponsor not found' });
    }

    // Get aggregated stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [impressionCount, clickCount, recentAnalytics] = await Promise.all([
      prisma.sponsorImpression.count({
        where: {
          sponsorAccountId: id,
          timestamp: { gte: thirtyDaysAgo }
        }
      }),
      prisma.sponsorClick.count({
        where: {
          sponsorAccountId: id,
          timestamp: { gte: thirtyDaysAgo }
        }
      }),
      prisma.sponsorAnalyticsDaily.findMany({
        where: {
          sponsorAccountId: id,
          date: { gte: thirtyDaysAgo }
        },
        orderBy: { date: 'asc' }
      })
    ]);

    res.json({
      success: true,
      sponsor: {
        ...sponsor,
        analytics: {
          last30Days: {
            impressions: impressionCount,
            clicks: clickCount,
            ctr: impressionCount > 0
              ? ((clickCount / impressionCount) * 100).toFixed(2)
              : '0.00'
          },
          daily: recentAnalytics
        }
      }
    });
  } catch (error: any) {
    console.error('[AdminSponsors] Error getting sponsor:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sponsor'
    });
  }
});

/**
 * @route   PUT /api/admin/sponsors/:id
 * @desc    Update sponsor settings
 * @access  Admin
 */
router.put('/:id', [
  param('id').isUUID().withMessage('Valid sponsor ID required'),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const {
      planId,
      subscriptionStatus,
      targetCities,
      targetProvinces,
      billingEmail,
      billingName
    } = req.body;

    const updateData: any = {};

    if (planId !== undefined) updateData.planId = planId;
    if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
    if (targetCities !== undefined) updateData.targetCities = targetCities;
    if (targetProvinces !== undefined) updateData.targetProvinces = targetProvinces;
    if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
    if (billingName !== undefined) updateData.billingName = billingName;

    const sponsor = await prisma.sponsorAccount.update({
      where: { id },
      data: updateData,
      include: {
        provider: {
          select: { id: true, name: true }
        },
        plan: true
      }
    });

    res.json({
      success: true,
      sponsor
    });
  } catch (error: any) {
    console.error('[AdminSponsors] Error updating sponsor:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update sponsor'
    });
  }
});

/**
 * @route   GET /api/admin/sponsors/:id/analytics
 * @desc    Get detailed analytics for sponsor
 * @access  Admin
 */
router.get('/:id/analytics', [
  param('id').isUUID().withMessage('Valid sponsor ID required'),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const {
      startDate,
      endDate,
      granularity = 'day'
    } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get daily analytics
    const dailyAnalytics = await prisma.sponsorAnalyticsDaily.findMany({
      where: {
        sponsorAccountId: id,
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: 'asc' }
    });

    // Get breakdown by placement
    const [impressionsByPlacement, clicksByPlacement] = await Promise.all([
      prisma.sponsorImpression.groupBy({
        by: ['placement'],
        where: {
          sponsorAccountId: id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      }),
      prisma.sponsorClick.groupBy({
        by: ['placement'],
        where: {
          sponsorAccountId: id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      })
    ]);

    // Get breakdown by platform
    const [impressionsByPlatform, clicksByPlatform] = await Promise.all([
      prisma.sponsorImpression.groupBy({
        by: ['platform'],
        where: {
          sponsorAccountId: id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      }),
      prisma.sponsorClick.groupBy({
        by: ['platform'],
        where: {
          sponsorAccountId: id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      })
    ]);

    // Calculate totals
    const totalImpressions = dailyAnalytics.reduce((sum, d) => sum + d.impressionsTotal, 0);
    const totalClicks = dailyAnalytics.reduce((sum, d) => sum + d.clicksTotal, 0);

    res.json({
      success: true,
      analytics: {
        period: { start, end },
        totals: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: totalImpressions > 0
            ? ((totalClicks / totalImpressions) * 100).toFixed(2)
            : '0.00'
        },
        timeSeries: dailyAnalytics,
        breakdown: {
          byPlacement: {
            impressions: impressionsByPlacement,
            clicks: clicksByPlacement
          },
          byPlatform: {
            impressions: impressionsByPlatform,
            clicks: clicksByPlatform
          }
        }
      }
    });
  } catch (error: any) {
    console.error('[AdminSponsors] Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get analytics'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/overview
 * @desc    Platform-wide sponsor analytics overview
 * @access  Admin
 */
router.get('/analytics/overview', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get overall stats
    const [
      totalSponsors,
      activeSponsors,
      totalImpressions,
      totalClicks,
      topSponsors
    ] = await Promise.all([
      prisma.sponsorAccount.count(),
      prisma.sponsorAccount.count({ where: { subscriptionStatus: 'active' } }),
      prisma.sponsorImpression.count({ where: { timestamp: { gte: thirtyDaysAgo } } }),
      prisma.sponsorClick.count({ where: { timestamp: { gte: thirtyDaysAgo } } }),
      prisma.sponsorAccount.findMany({
        take: 5,
        include: {
          provider: { select: { name: true } },
          _count: {
            select: {
              impressions: true,
              clicks: true
            }
          }
        },
        orderBy: {
          impressions: { _count: 'desc' }
        }
      })
    ]);

    res.json({
      success: true,
      overview: {
        totalSponsors,
        activeSponsors,
        last30Days: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: totalImpressions > 0
            ? ((totalClicks / totalImpressions) * 100).toFixed(2)
            : '0.00'
        },
        topSponsors: topSponsors.map(s => ({
          id: s.id,
          providerName: s.provider.name,
          impressions: s._count.impressions,
          clicks: s._count.clicks
        }))
      }
    });
  } catch (error: any) {
    console.error('[AdminSponsors] Error getting overview:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get overview'
    });
  }
});

/**
 * @route   POST /api/admin/sponsors
 * @desc    Create a new sponsor account for a provider
 * @access  Admin
 */
router.post('/', [
  body('providerId').isUUID().withMessage('Valid provider ID required'),
  body('billingEmail').isEmail().withMessage('Valid billing email required'),
  body('planId').optional().isUUID(),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      providerId,
      planId,
      billingEmail,
      billingName,
      targetCities,
      targetProvinces
    } = req.body;

    // Check if sponsor account already exists
    const existing = await prisma.sponsorAccount.findUnique({
      where: { providerId }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Sponsor account already exists for this provider'
      });
    }

    const sponsor = await prisma.sponsorAccount.create({
      data: {
        providerId,
        planId: planId || null,
        billingEmail,
        billingName: billingName || null,
        targetCities: targetCities || [],
        targetProvinces: targetProvinces || [],
        subscriptionStatus: 'inactive'
      },
      include: {
        provider: { select: { id: true, name: true } },
        plan: true
      }
    });

    res.status(201).json({
      success: true,
      sponsor
    });
  } catch (error: any) {
    console.error('[AdminSponsors] Error creating sponsor:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create sponsor'
    });
  }
});

/**
 * @route   GET /api/admin/sponsor-plans
 * @desc    List all sponsor plans
 * @access  Admin
 */
router.get('/plans', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plans = await prisma.sponsorPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    });

    res.json({
      success: true,
      plans
    });
  } catch (error: any) {
    console.error('[AdminSponsors] Error listing plans:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list plans'
    });
  }
});

export default router;
