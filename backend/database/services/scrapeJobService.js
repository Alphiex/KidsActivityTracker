const prisma = require('../config/database');

class ScrapeJobService {
  /**
   * Create a new scrape job
   */
  async createJob(providerId) {
    return prisma.scrapeJob.create({
      data: {
        providerId,
        status: 'PENDING'
      }
    });
  }

  /**
   * Start a scrape job
   */
  async startJob(jobId) {
    return prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });
  }

  /**
   * Complete a scrape job
   */
  async completeJob(jobId, metrics) {
    return prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        activitiesFound: metrics.found || 0,
        activitiesCreated: metrics.created || 0,
        activitiesUpdated: metrics.updated || 0,
        activitiesRemoved: metrics.deactivated || 0
      }
    });
  }

  /**
   * Fail a scrape job
   */
  async failJob(jobId, error) {
    return prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message,
        errorDetails: {
          stack: error.stack,
          code: error.code
        }
      }
    });
  }

  /**
   * Get job history
   */
  async getJobHistory(providerId = null, limit = 50) {
    const where = {};
    if (providerId) {
      where.providerId = providerId;
    }

    return prisma.scrapeJob.findMany({
      where,
      include: {
        provider: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalJobs,
      successRate,
      avgDuration,
      byProvider,
      recentFailures
    ] = await Promise.all([
      prisma.scrapeJob.count({
        where: { createdAt: { gte: since } }
      }),
      prisma.scrapeJob.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { id: true }
      }),
      prisma.$queryRaw`
        SELECT 
          AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))) as avg_duration_seconds
        FROM "ScrapeJob"
        WHERE "completedAt" IS NOT NULL 
          AND "startedAt" IS NOT NULL
          AND "createdAt" >= ${since}
      `,
      prisma.scrapeJob.groupBy({
        by: ['providerId', 'status'],
        where: { createdAt: { gte: since } },
        _count: { id: true }
      }),
      prisma.scrapeJob.findMany({
        where: {
          status: 'FAILED',
          createdAt: { gte: since }
        },
        include: { provider: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    // Calculate success rate
    const statusCounts = successRate.reduce((acc, s) => {
      acc[s.status] = s._count.id;
      return acc;
    }, {});

    const successPercentage = totalJobs > 0
      ? ((statusCounts.COMPLETED || 0) / totalJobs * 100).toFixed(1)
      : 0;

    return {
      totalJobs,
      successRate: successPercentage,
      avgDurationMinutes: avgDuration[0]?.avg_duration_seconds 
        ? Math.round(avgDuration[0].avg_duration_seconds / 60)
        : 0,
      byProvider,
      recentFailures,
      statusCounts
    };
  }

  /**
   * Check if a provider needs scraping
   */
  async shouldScrapeProvider(providerId, intervalHours = 1) {
    const lastJob = await prisma.scrapeJob.findFirst({
      where: {
        providerId,
        status: 'COMPLETED'
      },
      orderBy: { completedAt: 'desc' }
    });

    if (!lastJob || !lastJob.completedAt) {
      return true;
    }

    const hoursSinceLastScrape = 
      (Date.now() - lastJob.completedAt.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastScrape >= intervalHours;
  }

  /**
   * Get running jobs
   */
  async getRunningJobs() {
    return prisma.scrapeJob.findMany({
      where: { status: 'RUNNING' },
      include: { provider: true }
    });
  }

  /**
   * Cancel old running jobs
   */
  async cancelStaleJobs(maxAgeMinutes = 60) {
    const staleTime = new Date();
    staleTime.setMinutes(staleTime.getMinutes() - maxAgeMinutes);

    return prisma.scrapeJob.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: staleTime }
      },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorMessage: 'Job cancelled due to timeout'
      }
    });
  }
}

module.exports = new ScrapeJobService();