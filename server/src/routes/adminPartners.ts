import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../middleware/auth';

const router = Router();

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
 * @route   GET /api/admin/partners
 * @desc    List all partner accounts with stats
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

    // Get partners with aggregated stats
    const [partners, total] = await Promise.all([
      prisma.partnerAccount.findMany({
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
      prisma.partnerAccount.count({ where })
    ]);

    // Transform with stats (keep 'sponsors' key for backward compatibility with frontend)
    const partnersWithStats = partners.map(partner => ({
      id: partner.id,
      provider: partner.provider,
      plan: partner.plan,
      subscriptionStatus: partner.subscriptionStatus,
      subscriptionStartDate: partner.subscriptionStartDate,
      subscriptionEndDate: partner.subscriptionEndDate,
      billingEmail: partner.billingEmail,
      targetCities: partner.targetCities,
      targetProvinces: partner.targetProvinces,
      createdAt: partner.createdAt,
      stats: {
        totalImpressions: partner._count.impressions,
        totalClicks: partner._count.clicks,
        ctr: partner._count.impressions > 0
          ? ((partner._count.clicks / partner._count.impressions) * 100).toFixed(2)
          : '0.00'
      }
    }));

    res.json({
      success: true,
      sponsors: partnersWithStats, // Keep for backward compatibility
      partners: partnersWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('[AdminPartners] Error listing partners:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list partners'
    });
  }
});

/**
 * @route   GET /api/admin/partners/:id
 * @desc    Get partner details with full analytics
 * @access  Admin
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Valid partner ID required'),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;

    const partner = await prisma.partnerAccount.findUnique({
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

    if (!partner) {
      return res.status(404).json({ success: false, error: 'Partner not found' });
    }

    // Get aggregated stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [impressionCount, clickCount, recentAnalytics] = await Promise.all([
      prisma.partnerImpression.count({
        where: {
          partnerAccountId: id,
          timestamp: { gte: thirtyDaysAgo }
        }
      }),
      prisma.partnerClick.count({
        where: {
          partnerAccountId: id,
          timestamp: { gte: thirtyDaysAgo }
        }
      }),
      prisma.partnerAnalyticsDaily.findMany({
        where: {
          partnerAccountId: id,
          date: { gte: thirtyDaysAgo }
        },
        orderBy: { date: 'asc' }
      })
    ]);

    res.json({
      success: true,
      sponsor: { // Keep for backward compatibility
        ...partner,
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
      },
      partner: {
        ...partner,
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
    console.error('[AdminPartners] Error getting partner:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get partner'
    });
  }
});

/**
 * @route   PUT /api/admin/partners/:id
 * @desc    Update partner settings
 * @access  Admin
 */
router.put('/:id', [
  param('id').isUUID().withMessage('Valid partner ID required'),
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

    const partner = await prisma.partnerAccount.update({
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
      sponsor: partner, // Keep for backward compatibility
      partner
    });
  } catch (error: any) {
    console.error('[AdminPartners] Error updating partner:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update partner'
    });
  }
});

/**
 * @route   GET /api/admin/partners/:id/analytics
 * @desc    Get detailed analytics for partner
 * @access  Admin
 */
router.get('/:id/analytics', [
  param('id').isUUID().withMessage('Valid partner ID required'),
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
    const dailyAnalytics = await prisma.partnerAnalyticsDaily.findMany({
      where: {
        partnerAccountId: id,
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: 'asc' }
    });

    // Get breakdown by placement
    const [impressionsByPlacement, clicksByPlacement] = await Promise.all([
      prisma.partnerImpression.groupBy({
        by: ['placement'],
        where: {
          partnerAccountId: id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      }),
      prisma.partnerClick.groupBy({
        by: ['placement'],
        where: {
          partnerAccountId: id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      })
    ]);

    // Get breakdown by platform
    const [impressionsByPlatform, clicksByPlatform] = await Promise.all([
      prisma.partnerImpression.groupBy({
        by: ['platform'],
        where: {
          partnerAccountId: id,
          timestamp: { gte: start, lte: end }
        },
        _count: true
      }),
      prisma.partnerClick.groupBy({
        by: ['platform'],
        where: {
          partnerAccountId: id,
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
    console.error('[AdminPartners] Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get analytics'
    });
  }
});

/**
 * @route   GET /api/admin/partners/analytics/overview
 * @desc    Platform-wide partner analytics overview
 * @access  Admin
 */
router.get('/analytics/overview', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get overall stats
    const [
      totalPartners,
      activePartners,
      totalImpressions,
      totalClicks,
      topPartners
    ] = await Promise.all([
      prisma.partnerAccount.count(),
      prisma.partnerAccount.count({ where: { subscriptionStatus: 'active' } }),
      prisma.partnerImpression.count({ where: { timestamp: { gte: thirtyDaysAgo } } }),
      prisma.partnerClick.count({ where: { timestamp: { gte: thirtyDaysAgo } } }),
      prisma.partnerAccount.findMany({
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
        totalSponsors: totalPartners, // Keep for backward compatibility
        totalPartners,
        activeSponsors: activePartners, // Keep for backward compatibility
        activePartners,
        last30Days: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: totalImpressions > 0
            ? ((totalClicks / totalImpressions) * 100).toFixed(2)
            : '0.00'
        },
        topSponsors: topPartners.map(p => ({ // Keep for backward compatibility
          id: p.id,
          providerName: p.provider.name,
          impressions: p._count.impressions,
          clicks: p._count.clicks
        })),
        topPartners: topPartners.map(p => ({
          id: p.id,
          providerName: p.provider.name,
          impressions: p._count.impressions,
          clicks: p._count.clicks
        }))
      }
    });
  } catch (error: any) {
    console.error('[AdminPartners] Error getting overview:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get overview'
    });
  }
});

/**
 * @route   POST /api/admin/partners
 * @desc    Create a new partner account for a provider
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

    // Check if partner account already exists
    const existing = await prisma.partnerAccount.findUnique({
      where: { providerId }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Partner account already exists for this provider'
      });
    }

    const partner = await prisma.partnerAccount.create({
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
      sponsor: partner, // Keep for backward compatibility
      partner
    });
  } catch (error: any) {
    console.error('[AdminPartners] Error creating partner:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create partner'
    });
  }
});

/**
 * @route   GET /api/admin/partner-plans
 * @desc    List all partner plans
 * @access  Admin
 */
router.get('/plans', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const plans = await prisma.partnerPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    });

    res.json({
      success: true,
      plans
    });
  } catch (error: any) {
    console.error('[AdminPartners] Error listing plans:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list plans'
    });
  }
});

export default router;
