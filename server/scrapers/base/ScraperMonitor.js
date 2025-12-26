const { PrismaClient } = require('../../generated/prisma');
const fs = require('fs');
const path = require('path');

/**
 * Scraper Monitor Service
 * Tracks scraper run metrics and flags alerts for daily digest
 */
class ScraperMonitor {
  constructor(prisma = null) {
    this.prisma = prisma || new PrismaClient();
    this.config = this.loadConfig();

    // Fields to track for coverage calculation
    this.trackedFields = [
      'name', 'externalId', 'category', 'dateStart', 'dateEnd',
      'startTime', 'endTime', 'dayOfWeek', 'ageMin', 'ageMax',
      'cost', 'spotsAvailable', 'registrationStatus', 'locationName',
      'registrationUrl', 'description'
    ];
  }

  /**
   * Load alert configuration from JSON file
   */
  loadConfig() {
    const configPath = path.join(__dirname, '../configs/alerts.json');
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('Could not load alerts config, using defaults:', error.message);
      return {
        enabled: true,
        recipients: [],
        thresholds: {
          activityCountChangePercent: 20,
          minFieldCoverage: 90
        }
      };
    }
  }

  /**
   * Calculate field coverage from activities array
   * @param {Array} activities - Array of normalized activities
   * @returns {Object} - { fieldName: percentage, ..., average: number }
   */
  calculateFieldCoverage(activities) {
    if (!activities || activities.length === 0) {
      return { average: 0 };
    }

    const totalActivities = activities.length;
    const coverage = {};

    for (const field of this.trackedFields) {
      let count = 0;
      for (const activity of activities) {
        const value = activity[field];
        // Check if field has a meaningful value
        if (value !== null && value !== undefined && value !== '' &&
            !(Array.isArray(value) && value.length === 0)) {
          count++;
        }
      }
      coverage[field] = Math.round((count / totalActivities) * 100);
    }

    // Calculate average
    const values = Object.values(coverage);
    coverage.average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    return coverage;
  }

  /**
   * Record metrics for a scraper run and check for alerts
   * @param {string} providerId - Provider ID
   * @param {string} providerCode - Provider code for logging
   * @param {Object} stats - Scrape stats { created, updated, etc. }
   * @param {Array} activities - Array of activities scraped
   * @param {string} status - Run status ('completed', 'failed', etc.)
   * @returns {Promise<Object>} - Created ScraperRun record
   */
  async recordMetrics(providerId, providerCode, stats, activities, status = 'completed') {
    const fieldCoverage = this.calculateFieldCoverage(activities);
    const activitiesFound = activities ? activities.length : 0;

    // Create the scraper run record
    const scraperRun = await this.prisma.scraperRun.create({
      data: {
        providerId,
        status,
        completedAt: new Date(),
        activitiesFound,
        activitiesCreated: stats?.created || 0,
        activitiesUpdated: stats?.updated || 0,
        activitiesDeactivated: stats?.removed || 0,
        activitiesPurged: 0,
        fieldCoverage,
        avgFieldCoverage: fieldCoverage.average,
        alertSent: false,
        alertReason: null
      }
    });

    // Check and flag alerts
    await this.checkAndFlagAlerts(scraperRun.id, providerId, providerCode, activitiesFound, fieldCoverage);

    return scraperRun;
  }

  /**
   * Check thresholds and flag alerts if exceeded
   * @param {string} runId - Current run ID
   * @param {string} providerId - Provider ID
   * @param {string} providerCode - Provider code for logging
   * @param {number} currentCount - Current activity count
   * @param {Object} currentCoverage - Current field coverage
   */
  async checkAndFlagAlerts(runId, providerId, providerCode, currentCount, currentCoverage) {
    if (!this.config.enabled) {
      return;
    }

    const alerts = [];

    // Get previous successful run for comparison
    const previousRun = await this.prisma.scraperRun.findFirst({
      where: {
        providerId,
        status: 'completed',
        id: { not: runId }
      },
      orderBy: { startedAt: 'desc' }
    });

    // Check activity count change
    if (previousRun && previousRun.activitiesFound > 0) {
      const changePercent = ((currentCount - previousRun.activitiesFound) / previousRun.activitiesFound) * 100;
      const threshold = this.config.thresholds.activityCountChangePercent;

      if (Math.abs(changePercent) > threshold) {
        alerts.push({
          type: 'activity_count_change',
          message: `Activity count changed by ${changePercent.toFixed(1)}% (threshold: ±${threshold}%)`,
          previousValue: previousRun.activitiesFound,
          currentValue: currentCount,
          changePercent
        });
        console.log(`[ALERT] ${providerCode}: Activity count changed by ${changePercent.toFixed(1)}%`);
      }
    }

    // Check field coverage drop
    const minCoverage = this.config.thresholds.minFieldCoverage;
    if (currentCoverage.average < minCoverage) {
      // Find fields below threshold
      const lowFields = Object.entries(currentCoverage)
        .filter(([field, pct]) => field !== 'average' && pct < minCoverage)
        .map(([field, pct]) => `${field} (${pct}%)`)
        .join(', ');

      alerts.push({
        type: 'coverage_drop',
        message: `Field coverage dropped to ${currentCoverage.average}% (threshold: ${minCoverage}%)`,
        previousValue: previousRun?.avgFieldCoverage || null,
        currentValue: currentCoverage.average,
        affectedFields: lowFields
      });
      console.log(`[ALERT] ${providerCode}: Coverage dropped to ${currentCoverage.average}%`);
    }

    // Flag the run if any alerts
    if (alerts.length > 0) {
      const alertReason = alerts.map(a => a.type).join(',');
      await this.prisma.scraperRun.update({
        where: { id: runId },
        data: {
          alertReason,
          logs: { alerts }
        }
      });
    }
  }

  /**
   * Get all pending alerts (flagged but not yet sent in digest)
   * @param {Date} since - Only get alerts since this date
   * @returns {Promise<Array>} - Array of alert records with provider info
   */
  async getPendingAlerts(since = null) {
    const where = {
      alertSent: false,
      alertReason: { not: null }
    };

    if (since) {
      where.startedAt = { gte: since };
    }

    const runs = await this.prisma.scraperRun.findMany({
      where,
      orderBy: { startedAt: 'desc' }
    });

    // Enrich with provider info
    const enrichedAlerts = [];
    for (const run of runs) {
      const provider = await this.prisma.provider.findFirst({
        where: { id: run.providerId }
      });

      // Get previous run for comparison values
      const previousRun = await this.prisma.scraperRun.findFirst({
        where: {
          providerId: run.providerId,
          status: 'completed',
          id: { not: run.id }
        },
        orderBy: { startedAt: 'desc' }
      });

      enrichedAlerts.push({
        id: run.id,
        providerId: run.providerId,
        providerName: provider?.name || 'Unknown',
        providerCode: provider?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown',
        alertReason: run.alertReason,
        alerts: run.logs?.alerts || [],
        currentCount: run.activitiesFound,
        previousCount: previousRun?.activitiesFound || null,
        currentCoverage: run.avgFieldCoverage,
        previousCoverage: previousRun?.avgFieldCoverage || null,
        fieldCoverage: run.fieldCoverage,
        timestamp: run.startedAt
      });
    }

    return enrichedAlerts;
  }

  /**
   * Mark alerts as sent after digest email
   * @param {Array<string>} runIds - Array of ScraperRun IDs
   */
  async markAlertsSent(runIds) {
    await this.prisma.scraperRun.updateMany({
      where: { id: { in: runIds } },
      data: { alertSent: true }
    });
  }

  /**
   * Cleanup - disconnect prisma
   */
  async disconnect() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }
}

module.exports = ScraperMonitor;
