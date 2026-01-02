import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireVendorAuth } from '../../middleware/vendorAuth';
import { sponsoredActivityService } from '../../services/sponsoredActivityService';

const router = Router({ mergeParams: true });

// All analytics routes require vendor authentication
router.use(requireVendorAuth());

// Tier configuration (matches sponsoredActivityService)
const TIER_CONFIG = {
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
};

/**
 * @swagger
 * /api/vendor/{vendorId}/analytics/sponsored:
 *   get:
 *     summary: Get sponsored activity analytics for this vendor
 *     tags: [Vendor - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: months
 *         description: Number of months of history to include
 *         schema:
 *           type: integer
 *           default: 6
 */
router.get('/sponsored', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { months = '6' } = req.query;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthsNum = parseInt(months as string);

    // Get all featured activities for this vendor with their stats and location
    const sponsoredActivities = await prisma.activity.findMany({
      where: {
        vendorId,
        isFeatured: true
      },
      include: {
        sponsoredMonthlyStats: {
          where: {
            OR: [
              { year: currentYear, month: { lte: currentMonth } },
              { year: { lt: currentYear } }
            ]
          },
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ],
          take: monthsNum
        },
        location: {
          select: {
            name: true,
            city: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Process each activity
    const activities = sponsoredActivities.map(activity => {
      const tier = (activity.featuredTier?.toLowerCase() || 'bronze') as keyof typeof TIER_CONFIG;
      const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;

      // Current month stats
      const currentMonthStats = activity.sponsoredMonthlyStats.find(
        s => s.year === currentYear && s.month === currentMonth
      );

      const currentImpressions = currentMonthStats?.totalImpressions || 0;
      const topResultCount = currentMonthStats?.topResultCount || 0;
      const sponsorSectionCount = currentMonthStats?.sponsorSectionCount || 0;

      return {
        activityId: activity.id,
        activityName: activity.name,
        category: activity.category,
        location: activity.location?.name || activity.locationName,
        city: activity.location?.city || null,
        tier: activity.featuredTier,
        isActive: activity.isActive,
        featuredStartDate: activity.featuredStartDate,
        featuredEndDate: activity.featuredEndDate,
        currentMonth: {
          year: currentYear,
          month: currentMonth,
          impressions: currentImpressions,
          topResultCount,
          sponsorSectionCount,
          monthlyLimit: config.monthlyLimit,
          remainingQuota: config.monthlyLimit === null ? null : config.monthlyLimit - currentImpressions,
          usagePercent: config.monthlyLimit ? Math.round((currentImpressions / config.monthlyLimit) * 100) : null
        },
        history: activity.sponsoredMonthlyStats.map(s => ({
          year: s.year,
          month: s.month,
          impressions: s.totalImpressions,
          topResultCount: s.topResultCount,
          sponsorSectionCount: s.sponsorSectionCount,
          uniqueUsers: s.uniqueUsers
        }))
      };
    });

    // Calculate summary stats
    const totalImpressions = activities.reduce(
      (sum, a) => sum + a.currentMonth.impressions, 0
    );

    const byTier = {
      gold: activities.filter(a => a.tier?.toLowerCase() === 'gold'),
      silver: activities.filter(a => a.tier?.toLowerCase() === 'silver'),
      bronze: activities.filter(a => a.tier?.toLowerCase() === 'bronze')
    };

    res.json({
      success: true,
      data: {
        vendorId,
        currentMonth: { year: currentYear, month: currentMonth },
        summary: {
          totalFeaturedActivities: sponsoredActivities.length,
          totalImpressionsThisMonth: totalImpressions,
          byTier: {
            gold: {
              count: byTier.gold.length,
              impressions: byTier.gold.reduce((sum, a) => sum + a.currentMonth.impressions, 0),
              limit: TIER_CONFIG.gold.monthlyLimit,
              description: TIER_CONFIG.gold.description
            },
            silver: {
              count: byTier.silver.length,
              impressions: byTier.silver.reduce((sum, a) => sum + a.currentMonth.impressions, 0),
              limit: TIER_CONFIG.silver.monthlyLimit,
              description: TIER_CONFIG.silver.description
            },
            bronze: {
              count: byTier.bronze.length,
              impressions: byTier.bronze.reduce((sum, a) => sum + a.currentMonth.impressions, 0),
              limit: TIER_CONFIG.bronze.monthlyLimit,
              description: TIER_CONFIG.bronze.description
            }
          }
        },
        activities,
        tierLimits: TIER_CONFIG
      }
    });
  } catch (error: any) {
    console.error('Error fetching vendor sponsored analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sponsored analytics'
    });
  }
});

/**
 * @swagger
 * /api/vendor/{vendorId}/analytics/sponsored/{activityId}:
 *   get:
 *     summary: Get detailed analytics for a specific sponsored activity
 *     tags: [Vendor - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: months
 *         description: Number of months of history
 *         schema:
 *           type: integer
 *           default: 6
 */
router.get('/sponsored/:activityId', async (req: Request, res: Response) => {
  try {
    const { vendorId, activityId } = req.params;
    const { months = '6' } = req.query;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Verify activity belongs to this vendor
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { vendorId: true }
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    if (activity.vendorId !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Activity does not belong to this vendor'
      });
    }

    // Get detailed analytics using the sponsored service
    const analytics = await sponsoredActivityService.getActivityAnalytics(
      activityId,
      parseInt(months as string)
    );

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found or not featured'
      });
    }

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Error fetching activity sponsored analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity analytics'
    });
  }
});

/**
 * @swagger
 * /api/vendor/{vendorId}/analytics/overview:
 *   get:
 *     summary: Get overall analytics overview for vendor
 *     tags: [Vendor - Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonth = lastMonthDate.getMonth() + 1;

    // Get activity stats
    const [
      totalActivities,
      activeActivities,
      featuredActivities,
      currentMonthStats,
      lastMonthStats
    ] = await Promise.all([
      prisma.activity.count({
        where: { vendorId }
      }),
      prisma.activity.count({
        where: { vendorId, isActive: true }
      }),
      prisma.activity.count({
        where: { vendorId, isFeatured: true }
      }),
      prisma.sponsoredMonthlyStats.aggregate({
        where: {
          activity: { vendorId },
          year: currentYear,
          month: currentMonth
        },
        _sum: {
          totalImpressions: true,
          topResultCount: true,
          sponsorSectionCount: true
        }
      }),
      prisma.sponsoredMonthlyStats.aggregate({
        where: {
          activity: { vendorId },
          year: lastMonthYear,
          month: lastMonth
        },
        _sum: {
          totalImpressions: true
        }
      })
    ]);

    const currentImpressions = currentMonthStats._sum.totalImpressions || 0;
    const lastMonthImpressions = lastMonthStats._sum.totalImpressions || 0;
    const impressionChange = lastMonthImpressions > 0
      ? Math.round(((currentImpressions - lastMonthImpressions) / lastMonthImpressions) * 100)
      : null;

    res.json({
      success: true,
      data: {
        activities: {
          total: totalActivities,
          active: activeActivities,
          featured: featuredActivities
        },
        impressions: {
          currentMonth: currentImpressions,
          lastMonth: lastMonthImpressions,
          changePercent: impressionChange,
          breakdown: {
            topResult: currentMonthStats._sum.topResultCount || 0,
            sponsorSection: currentMonthStats._sum.sponsorSectionCount || 0
          }
        },
        period: {
          currentMonth: { year: currentYear, month: currentMonth },
          lastMonth: { year: lastMonthYear, month: lastMonth }
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching vendor analytics overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics overview'
    });
  }
});

export default router;
