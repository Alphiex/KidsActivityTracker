import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
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

// ============================================
// SYSTEM HEALTH ENDPOINTS
// ============================================

/**
 * @route   GET /api/admin/monitoring/health
 * @desc    Comprehensive system health check
 * @access  Admin
 */
router.get('/health', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const components: any = {};

    // Check database
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      components.database = {
        status: 'healthy',
        latencyMs: Date.now() - dbStart
      };
    } catch (error) {
      components.database = { status: 'unhealthy', error: 'Connection failed' };
    }

    // Check scraper status (any running or failed in last hour)
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [runningJobs, failedLast24h] = await Promise.all([
        prisma.scrapeJob.count({ where: { status: 'RUNNING' } }),
        prisma.scraperRun.count({
          where: {
            status: 'FAILED',
            startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        })
      ]);
      components.scrapers = {
        status: failedLast24h > 5 ? 'degraded' : 'healthy',
        activeJobs: runningJobs,
        failedLast24h
      };
    } catch (error) {
      components.scrapers = { status: 'unknown', error: 'Failed to check' };
    }

    // Check AI service (if configured)
    try {
      const aiConfigured = !!process.env.OPENAI_API_KEY;
      components.ai = {
        status: aiConfigured ? 'healthy' : 'unconfigured',
        configured: aiConfigured
      };
    } catch (error) {
      components.ai = { status: 'unknown' };
    }

    // Determine overall status
    const statuses = Object.values(components).map((c: any) => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (statuses.includes('unhealthy')) {
      overallStatus = 'critical';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    res.json({
      success: true,
      health: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
        components,
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed'
    });
  }
});

// ============================================
// SCRAPER MONITORING ENDPOINTS
// ============================================

/**
 * @route   GET /api/admin/monitoring/scrapers/stats
 * @desc    Aggregated scraper statistics
 * @access  Admin
 */
router.get('/scrapers/stats', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalProviders,
      activeProviders,
      runsLast24h,
      failedLast24h,
      totalActivities,
      recentRuns,
      pendingAlerts
    ] = await Promise.all([
      prisma.provider.count(),
      prisma.provider.count({ where: { isActive: true } }),
      prisma.scraperRun.count({ where: { startedAt: { gte: last24h } } }),
      prisma.scraperRun.count({ where: { status: 'FAILED', startedAt: { gte: last24h } } }),
      prisma.activity.count({ where: { isActive: true } }),
      prisma.scraperRun.findMany({
        where: { startedAt: { gte: last7d } },
        select: {
          startedAt: true,
          completedAt: true,
          activitiesFound: true,
          activitiesCreated: true,
          activitiesUpdated: true,
          avgFieldCoverage: true
        },
        orderBy: { startedAt: 'desc' },
        take: 100
      }),
      prisma.scraperRun.count({ where: { alertSent: false, alertReason: { not: null } } })
    ]);

    // Calculate averages from recent runs
    const avgExecutionTime = recentRuns
      .filter(r => r.completedAt)
      .reduce((sum, r) => {
        const duration = r.completedAt!.getTime() - r.startedAt.getTime();
        return sum + duration;
      }, 0) / (recentRuns.filter(r => r.completedAt).length || 1);

    const avgFieldCoverage = recentRuns
      .filter(r => r.avgFieldCoverage)
      .reduce((sum, r) => sum + (r.avgFieldCoverage || 0), 0) /
      (recentRuns.filter(r => r.avgFieldCoverage).length || 1);

    // Get activity counts by city (top 20)
    const activitiesByCity = await prisma.$queryRaw`
      SELECT l.city, COUNT(a.id)::int as count
      FROM "Activity" a
      JOIN "Location" l ON a."locationId" = l.id
      WHERE a."isActive" = true
      GROUP BY l.city
      ORDER BY count DESC
      LIMIT 20
    ` as { city: string; count: number }[];

    res.json({
      success: true,
      stats: {
        providers: {
          total: totalProviders,
          active: activeProviders
        },
        activities: {
          total: totalActivities,
          byCity: activitiesByCity
        },
        runs: {
          last24h: runsLast24h,
          failedLast24h,
          successRate: runsLast24h > 0
            ? (((runsLast24h - failedLast24h) / runsLast24h) * 100).toFixed(1)
            : '100'
        },
        averages: {
          executionTimeMs: Math.round(avgExecutionTime),
          fieldCoverage: avgFieldCoverage.toFixed(1)
        },
        alerts: {
          pending: pendingAlerts
        }
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Scraper stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get scraper stats'
    });
  }
});

/**
 * @route   GET /api/admin/monitoring/scrapers/runs
 * @desc    List scraper runs with filtering
 * @access  Admin
 */
router.get('/scrapers/runs', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      providerId,
      status,
      hasAlert,
      startDate,
      endDate
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (providerId) {
      where.providerId = providerId;
    }
    if (status) {
      where.status = status;
    }
    if (hasAlert === 'true') {
      where.alertReason = { not: null };
    }
    if (startDate) {
      where.startedAt = { ...where.startedAt, gte: new Date(startDate as string) };
    }
    if (endDate) {
      where.startedAt = { ...where.startedAt, lte: new Date(endDate as string) };
    }

    const [runs, total] = await Promise.all([
      prisma.scraperRun.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { startedAt: 'desc' }
      }),
      prisma.scraperRun.count({ where })
    ]);

    // Get provider names for the runs
    const providerIds = [...new Set(runs.map(r => r.providerId))];
    const providers = await prisma.provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true }
    });
    const providerMap = new Map(providers.map(p => [p.id, p.name]));

    const runsWithProviders = runs.map(run => ({
      ...run,
      providerName: providerMap.get(run.providerId) || 'Unknown',
      durationMs: run.completedAt
        ? run.completedAt.getTime() - run.startedAt.getTime()
        : null
    }));

    res.json({
      success: true,
      runs: runsWithProviders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Get runs failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get scraper runs'
    });
  }
});

/**
 * @route   GET /api/admin/monitoring/scrapers/providers
 * @desc    List all providers with health status
 * @access  Admin
 */
router.get('/scrapers/providers', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        platform: true,
        region: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });

    // Get last run for each provider
    const lastRuns = await prisma.scraperRun.findMany({
      where: {
        providerId: { in: providers.map(p => p.id) }
      },
      orderBy: { startedAt: 'desc' },
      distinct: ['providerId']
    });

    const lastRunMap = new Map(lastRuns.map(r => [r.providerId, r]));

    // Get activity counts per provider
    const activityCounts = await prisma.activity.groupBy({
      by: ['providerId'],
      where: { isActive: true },
      _count: true
    });
    const countMap = new Map(activityCounts.map(c => [c.providerId, c._count]));

    const providersWithStatus = providers.map(provider => {
      const lastRun = lastRunMap.get(provider.id);
      const daysSinceLastRun = lastRun
        ? (Date.now() - lastRun.startedAt.getTime()) / (1000 * 60 * 60 * 24)
        : null;

      let healthStatus: 'healthy' | 'warning' | 'critical' | 'unknown' = 'unknown';
      if (lastRun) {
        if (lastRun.status === 'FAILED') {
          healthStatus = 'critical';
        } else if (daysSinceLastRun && daysSinceLastRun > 2) {
          healthStatus = 'warning';
        } else {
          healthStatus = 'healthy';
        }
      }

      return {
        ...provider,
        activityCount: countMap.get(provider.id) || 0,
        lastRun: lastRun ? {
          id: lastRun.id,
          status: lastRun.status,
          startedAt: lastRun.startedAt,
          activitiesFound: lastRun.activitiesFound,
          avgFieldCoverage: lastRun.avgFieldCoverage,
          hasAlert: !!lastRun.alertReason
        } : null,
        healthStatus
      };
    });

    res.json({
      success: true,
      providers: providersWithStatus
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Get providers failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get providers'
    });
  }
});

/**
 * @route   GET /api/admin/monitoring/scrapers/providers/:id
 * @desc    Get detailed provider metrics
 * @access  Admin
 */
router.get('/scrapers/providers/:id', [
  param('id').isUUID().withMessage('Valid provider ID required'),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [provider, recentRuns, activityCount] = await Promise.all([
      prisma.provider.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          website: true,
          platform: true,
          region: true,
          isActive: true,
          scraperConfig: true
        }
      }),
      prisma.scraperRun.findMany({
        where: { providerId: id, startedAt: { gte: last30d } },
        orderBy: { startedAt: 'desc' },
        take: 50
      }),
      prisma.activity.count({ where: { providerId: id, isActive: true } })
    ]);

    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    // Calculate stats from recent runs
    const successfulRuns = recentRuns.filter(r => r.status === 'COMPLETED');
    const avgDuration = successfulRuns
      .filter(r => r.completedAt)
      .reduce((sum, r) => sum + (r.completedAt!.getTime() - r.startedAt.getTime()), 0) /
      (successfulRuns.length || 1);

    const avgCoverage = successfulRuns
      .filter(r => r.avgFieldCoverage)
      .reduce((sum, r) => sum + (r.avgFieldCoverage || 0), 0) /
      (successfulRuns.filter(r => r.avgFieldCoverage).length || 1);

    res.json({
      success: true,
      provider: {
        ...provider,
        activityCount,
        stats: {
          runsLast30d: recentRuns.length,
          successRate: recentRuns.length > 0
            ? ((successfulRuns.length / recentRuns.length) * 100).toFixed(1)
            : '0',
          avgDurationMs: Math.round(avgDuration),
          avgFieldCoverage: avgCoverage.toFixed(1)
        },
        recentRuns: recentRuns.slice(0, 10).map(r => ({
          id: r.id,
          status: r.status,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          activitiesFound: r.activitiesFound,
          activitiesCreated: r.activitiesCreated,
          activitiesUpdated: r.activitiesUpdated,
          avgFieldCoverage: r.avgFieldCoverage,
          hasAlert: !!r.alertReason,
          alertReason: r.alertReason
        }))
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Get provider failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get provider details'
    });
  }
});

/**
 * @route   GET /api/admin/monitoring/scrapers/alerts
 * @desc    Get pending scraper alerts
 * @access  Admin
 */
router.get('/scrapers/alerts', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { acknowledged = 'false' } = req.query;

    const where: any = {
      alertReason: { not: null }
    };

    if (acknowledged === 'false') {
      where.alertSent = false;
    }

    const alerts = await prisma.scraperRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 50
    });

    // Get provider names
    const providerIds = [...new Set(alerts.map(a => a.providerId))];
    const providers = await prisma.provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true }
    });
    const providerMap = new Map(providers.map(p => [p.id, p.name]));

    const alertsWithProviders = alerts.map(alert => ({
      id: alert.id,
      providerId: alert.providerId,
      providerName: providerMap.get(alert.providerId) || 'Unknown',
      alertReason: alert.alertReason,
      acknowledged: alert.alertSent,
      startedAt: alert.startedAt,
      activitiesFound: alert.activitiesFound,
      avgFieldCoverage: alert.avgFieldCoverage
    }));

    res.json({
      success: true,
      alerts: alertsWithProviders
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Get alerts failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get alerts'
    });
  }
});

/**
 * @route   POST /api/admin/monitoring/scrapers/alerts/:id/acknowledge
 * @desc    Acknowledge a scraper alert
 * @access  Admin
 */
router.post('/scrapers/alerts/:id/acknowledge', [
  param('id').isUUID().withMessage('Valid alert ID required'),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;

    await prisma.scraperRun.update({
      where: { id },
      data: { alertSent: true }
    });

    res.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Acknowledge alert failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to acknowledge alert'
    });
  }
});

// ============================================
// AI MONITORING ENDPOINTS
// ============================================

/**
 * @route   GET /api/admin/monitoring/ai/metrics
 * @desc    Get current AI usage metrics
 * @access  Admin
 */
router.get('/ai/metrics', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      todayStats,
      last30dStats,
      byModel,
      recentRequests
    ] = await Promise.all([
      // Today's stats
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { costUsd: true, tokensIn: true, tokensOut: true },
        _count: true
      }),
      // Last 30 days stats
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: last30d } },
        _sum: { costUsd: true, tokensIn: true, tokensOut: true },
        _count: true
      }),
      // By model breakdown
      prisma.aIUsageLog.groupBy({
        by: ['model'],
        where: { createdAt: { gte: last30d } },
        _sum: { costUsd: true },
        _count: true
      }),
      // Recent requests
      prisma.aIUsageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    const dailyBudget = parseFloat(process.env.AI_DAILY_BUDGET_USD || '10');
    const todayCost = todayStats._sum.costUsd || 0;

    res.json({
      success: true,
      metrics: {
        today: {
          requests: todayStats._count,
          costUsd: todayCost.toFixed(4),
          tokensIn: todayStats._sum.tokensIn || 0,
          tokensOut: todayStats._sum.tokensOut || 0
        },
        last30Days: {
          requests: last30dStats._count,
          costUsd: (last30dStats._sum.costUsd || 0).toFixed(4),
          tokensIn: last30dStats._sum.tokensIn || 0,
          tokensOut: last30dStats._sum.tokensOut || 0,
          avgDailyCost: ((last30dStats._sum.costUsd || 0) / 30).toFixed(4)
        },
        budget: {
          dailyLimitUsd: dailyBudget,
          spentTodayUsd: todayCost.toFixed(4),
          remainingUsd: Math.max(0, dailyBudget - todayCost).toFixed(4),
          percentUsed: ((todayCost / dailyBudget) * 100).toFixed(1)
        },
        byModel: byModel.map(m => ({
          model: m.model,
          requests: m._count,
          costUsd: (m._sum.costUsd || 0).toFixed(4)
        })),
        recentRequests: recentRequests.map(r => ({
          id: r.id,
          model: r.model,
          endpoint: r.endpoint,
          tokensIn: r.tokensIn,
          tokensOut: r.tokensOut,
          costUsd: r.costUsd.toFixed(6),
          latencyMs: r.latencyMs,
          success: r.success,
          cacheHit: r.cacheHit,
          createdAt: r.createdAt
        }))
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] AI metrics failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI metrics'
    });
  }
});

/**
 * @route   GET /api/admin/monitoring/ai/history
 * @desc    Get historical AI usage data
 * @access  Admin
 */
router.get('/ai/history', [
  query('period').optional().isIn(['daily', 'weekly', 'monthly']),
  query('days').optional().isInt({ min: 1, max: 90 }),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = 'daily', days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    // Get daily aggregated data
    const dailyData = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*)::int as requests,
        SUM(cost_usd)::float as cost_usd,
        SUM(tokens_in)::int as tokens_in,
        SUM(tokens_out)::int as tokens_out,
        COUNT(CASE WHEN cache_hit THEN 1 END)::int as cache_hits
      FROM "AIUsageLog"
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    ` as any[];

    res.json({
      success: true,
      history: {
        period,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        data: dailyData.map(d => ({
          date: d.date,
          requests: d.requests,
          costUsd: (d.cost_usd || 0).toFixed(4),
          tokensIn: d.tokens_in || 0,
          tokensOut: d.tokens_out || 0,
          cacheHits: d.cache_hits || 0,
          cacheHitRate: d.requests > 0
            ? ((d.cache_hits / d.requests) * 100).toFixed(1)
            : '0'
        }))
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] AI history failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI history'
    });
  }
});

/**
 * @route   GET /api/admin/monitoring/ai/budget
 * @desc    Get AI budget settings
 * @access  Admin
 */
router.get('/ai/budget', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const dailyBudget = parseFloat(process.env.AI_DAILY_BUDGET_USD || '10');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySpent = await prisma.aIUsageLog.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { costUsd: true }
    });

    const spentToday = todaySpent._sum.costUsd || 0;

    res.json({
      success: true,
      budget: {
        dailyLimitUsd: dailyBudget,
        spentTodayUsd: spentToday.toFixed(4),
        remainingUsd: Math.max(0, dailyBudget - spentToday).toFixed(4),
        percentUsed: ((spentToday / dailyBudget) * 100).toFixed(1),
        isExceeded: spentToday >= dailyBudget
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Budget check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get budget'
    });
  }
});

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

/**
 * @route   GET /api/admin/notifications
 * @desc    List admin notifications
 * @access  Admin
 */
router.get('/notifications', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('unreadOnly').optional().isBoolean(),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      unreadOnly = 'false',
      type,
      severity
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (unreadOnly === 'true') {
      where.isRead = false;
    }
    if (type) {
      where.type = type;
    }
    if (severity) {
      where.severity = severity;
    }

    const [notifications, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.adminNotification.count({ where })
    ]);

    res.json({
      success: true,
      notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Get notifications failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get notifications'
    });
  }
});

/**
 * @route   GET /api/admin/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Admin
 */
router.get('/notifications/unread-count', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const count = await prisma.adminNotification.count({
      where: { isRead: false }
    });

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Unread count failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count'
    });
  }
});

/**
 * @route   POST /api/admin/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Admin
 */
router.post('/notifications/:id/read', [
  param('id').isUUID().withMessage('Valid notification ID required'),
], verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const adminUser = (req as any).adminUser;

    await prisma.adminNotification.update({
      where: { id },
      data: {
        isRead: true,
        readBy: adminUser.id,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Mark read failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark as read'
    });
  }
});

/**
 * @route   POST /api/admin/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Admin
 */
router.post('/notifications/mark-all-read', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser;

    await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: {
        isRead: true,
        readBy: adminUser.id,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error: any) {
    console.error('[AdminMonitoring] Mark all read failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark all as read'
    });
  }
});

export default router;
