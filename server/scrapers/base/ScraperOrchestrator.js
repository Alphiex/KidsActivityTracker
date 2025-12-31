const fs = require('fs');
const path = require('path');
const ScraperFactory = require('./ScraperFactory');
const ScraperMonitor = require('./ScraperMonitor');
const { PrismaClient } = require('../../generated/prisma');

/**
 * Orchestrator for managing and running multiple scrapers
 * Handles scheduling, coordination, and monitoring of scraping jobs
 */
class ScraperOrchestrator {
  constructor() {
    this.prisma = new PrismaClient();
    this.monitor = new ScraperMonitor(this.prisma);
    this.providersConfigPath = path.join(__dirname, '../configs/providers');
    this.runningScrapers = new Map();
  }

  /**
   * Load all provider configurations
   * @returns {Array} Provider configurations
   */
  loadProviderConfigs() {
    const configs = [];

    if (!fs.existsSync(this.providersConfigPath)) {
      console.warn(`Provider configs directory not found: ${this.providersConfigPath}`);
      return configs;
    }

    const files = fs.readdirSync(this.providersConfigPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const configPath = path.join(this.providersConfigPath, file);
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          configs.push(config);
        } catch (error) {
          console.error(`Error loading config ${file}:`, error.message);
        }
      }
    }

    return configs;
  }

  /**
   * Get active provider configurations
   * @returns {Array} Active provider configurations
   */
  getActiveProviders() {
    return this.loadProviderConfigs().filter(config => config.isActive);
  }

  /**
   * Run all active scrapers
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Run results
   */
  async runAll(options = {}) {
    const { dryRun = false, sequential = false, platforms = null } = options;

    console.log('='.repeat(60));
    console.log('SCRAPER ORCHESTRATOR - RUN ALL');
    console.log('='.repeat(60));
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Execution: ${sequential ? 'Sequential' : 'Parallel by Platform'}`);
    console.log('');

    let providers = this.getActiveProviders();

    // Filter by platform if specified
    if (platforms && platforms.length > 0) {
      providers = providers.filter(p => platforms.includes(p.platform));
    }

    console.log(`Found ${providers.length} active providers`);

    if (providers.length === 0) {
      return { success: false, error: 'No active providers found' };
    }

    const results = {
      startTime: new Date(),
      providers: [],
      summary: {
        total: providers.length,
        successful: 0,
        failed: 0,
        activitiesFound: 0,
        activitiesCreated: 0,
        activitiesUpdated: 0
      }
    };

    if (sequential) {
      // Run scrapers one by one
      for (const provider of providers) {
        const result = await this.runSingle(provider.code, { dryRun });
        results.providers.push(result);
        this.updateSummary(results.summary, result);
      }
    } else {
      // Separate long-running scrapers (>30 min estimated) from quick ones
      const longRunningCodes = ['vancouver', 'toronto', 'hamilton', 'vernon', 'ottawa', 'burnaby', 'north-vancouver', 'surrey'];
      const longRunning = providers.filter(p =>
        (p.metadata?.estimatedDuration && p.metadata.estimatedDuration > 30) ||
        longRunningCodes.includes(p.code)
      );
      const quickRunning = providers.filter(p => !longRunning.includes(p));

      console.log(`\n--- Long-running scrapers (${longRunning.length}): ${longRunning.map(p => p.code).join(', ')} ---`);
      console.log(`--- Quick scrapers (${quickRunning.length}) ---\n`);

      // Start all long-running scrapers in parallel immediately
      const longPromises = longRunning.map(p => {
        console.log(`[PARALLEL] Starting long-running scraper: ${p.code}`);
        return this.runSingle(p.code, { dryRun }).then(result => ({ provider: p, result }));
      });

      // Run quick scrapers in batches of 5 while long ones are running
      const quickBatchSize = 5;
      for (let i = 0; i < quickRunning.length; i += quickBatchSize) {
        const batch = quickRunning.slice(i, i + quickBatchSize);
        console.log(`\n--- Processing quick batch ${Math.floor(i / quickBatchSize) + 1} (${batch.length} providers) ---`);

        const batchPromises = batch.map(p => this.runSingle(p.code, { dryRun }));
        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            results.providers.push(result.value);
            this.updateSummary(results.summary, result.value);
          } else {
            results.providers.push({
              provider: batch[idx].code,
              success: false,
              error: result.reason?.message || 'Unknown error'
            });
            results.summary.failed++;
          }
        });
      }

      // Wait for all long-running scrapers to complete
      if (longPromises.length > 0) {
        console.log(`\n--- Waiting for ${longPromises.length} long-running scrapers to complete ---`);
        const longResults = await Promise.allSettled(longPromises);

        longResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.providers.push(result.value.result);
            this.updateSummary(results.summary, result.value.result);
            console.log(`[PARALLEL] Completed: ${result.value.provider.code}`);
          } else {
            results.providers.push({
              provider: 'unknown',
              success: false,
              error: result.reason?.message || 'Unknown error'
            });
            results.summary.failed++;
          }
        });
      }
    }

    results.endTime = new Date();
    results.durationMinutes = ((results.endTime - results.startTime) / 1000 / 60).toFixed(1);

    // Print summary
    this.printRunSummary(results);

    // Log to database
    if (!dryRun) {
      await this.logRun(results);
    }

    return results;
  }

  /**
   * Run scrapers by platform
   * @param {String} platform - Platform name
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Run results
   */
  async runByPlatform(platform, options = {}) {
    console.log(`Running all ${platform} scrapers...`);
    return this.runAll({ ...options, platforms: [platform] });
  }

  /**
   * Run scrapers by schedule tier
   * @param {String} tier - Schedule tier (critical, high, standard, low)
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Run results
   */
  async runByTier(tier, options = {}) {
    const { dryRun = false, batch = null, batchSize = 5 } = options;

    console.log('='.repeat(60));
    console.log(`SCRAPER ORCHESTRATOR - RUN BY TIER: ${tier.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    if (batch !== null) console.log(`Batch: ${batch}`);
    console.log('');

    const allProviders = this.getActiveProviders();
    let tierProviders = allProviders.filter(p =>
      (p.schedule?.tier || 'standard') === tier
    );

    // If batch specified, split into batches
    if (batch !== null) {
      const batches = [];
      for (let i = 0; i < tierProviders.length; i += batchSize) {
        batches.push(tierProviders.slice(i, i + batchSize));
      }

      if (batch >= batches.length) {
        console.log(`Batch ${batch} does not exist (only ${batches.length} batches)`);
        return { success: true, providers: [], message: 'No providers in this batch' };
      }

      tierProviders = batches[batch];
      console.log(`Running batch ${batch + 1}/${batches.length} (${tierProviders.length} providers)`);
    }

    console.log(`Found ${tierProviders.length} ${tier} tier providers:`);
    tierProviders.forEach(p => console.log(`  - ${p.code} (${p.platform})`));
    console.log('');

    const results = {
      startTime: new Date(),
      tier,
      batch,
      providers: [],
      summary: {
        total: tierProviders.length,
        successful: 0,
        failed: 0,
        activitiesFound: 0,
        activitiesCreated: 0,
        activitiesUpdated: 0
      }
    };

    // Run sequentially within tier to avoid overloading
    for (const provider of tierProviders) {
      try {
        const result = await this.runSingle(provider.code, { dryRun });
        results.providers.push(result);

        if (result.success) {
          results.summary.successful++;
          results.summary.activitiesFound += result.activitiesFound || 0;
          results.summary.activitiesCreated += result.stats?.created || 0;
          results.summary.activitiesUpdated += result.stats?.updated || 0;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        results.summary.failed++;
        results.providers.push({
          provider: provider.code,
          success: false,
          error: error.message
        });
      }

      // Small delay between scrapers to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    results.endTime = new Date();
    results.durationMinutes = ((results.endTime - results.startTime) / 1000 / 60).toFixed(1);

    this.printRunSummary(results);

    return results;
  }

  /**
   * Get providers grouped by tier with batch assignments
   * @param {Number} batchSize - Number of providers per batch
   * @returns {Object} Tier schedule information
   */
  getTierSchedule(batchSize = 5) {
    const providers = this.getActiveProviders();
    const tiers = {};

    for (const provider of providers) {
      const tier = provider.schedule?.tier || 'standard';
      if (!tiers[tier]) {
        tiers[tier] = [];
      }
      tiers[tier].push(provider.code);
    }

    const schedule = {};
    for (const [tier, codes] of Object.entries(tiers)) {
      const batches = [];
      for (let i = 0; i < codes.length; i += batchSize) {
        batches.push(codes.slice(i, i + batchSize));
      }
      schedule[tier] = {
        total: codes.length,
        batches: batches.length,
        providers: batches
      };
    }

    return schedule;
  }

  /**
   * Run a single scraper by provider code
   * @param {String} providerCode - Provider code
   * @param {Object} options - Run options
   * @returns {Promise<Object>} Run result
   */
  async runSingle(providerCode, options = {}) {
    const { dryRun = false } = options;

    const config = this.loadProviderConfigs().find(p => p.code === providerCode);

    if (!config) {
      return {
        provider: providerCode,
        success: false,
        error: `Provider not found: ${providerCode}`
      };
    }

    console.log(`\n🚀 Starting scraper: ${config.name} (${config.code})`);
    console.log(`   Platform: ${config.platform}`);
    console.log(`   URL: ${config.baseUrl}`);

    const startTime = Date.now();

    try {
      const scraper = ScraperFactory.createScraper(config);

      if (dryRun) {
        console.log('   [DRY RUN] Would scrape this provider');
        return {
          provider: providerCode,
          name: config.name,
          platform: config.platform,
          success: true,
          dryRun: true
        };
      }

      const result = await scraper.scrape();

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

      console.log(`✅ ${config.name} completed in ${duration} minutes`);
      console.log(`   Activities: ${result.activities.length}`);
      console.log(`   New: ${result.stats.created}, Updated: ${result.stats.updated}`);

      // Record metrics and check for alerts
      try {
        const provider = await this.prisma.provider.findFirst({
          where: { name: config.name }
        });

        if (provider) {
          await this.monitor.recordMetrics(
            provider.id,
            providerCode,
            result.stats,
            result.activities,
            'completed'
          );
        }
      } catch (monitorError) {
        console.warn(`   Warning: Could not record metrics: ${monitorError.message}`);
      }

      return {
        provider: providerCode,
        name: config.name,
        platform: config.platform,
        success: true,
        duration: parseFloat(duration),
        activitiesFound: result.activities.length,
        stats: result.stats
      };

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.error(`❌ ${config.name} failed after ${duration} minutes: ${error.message}`);

      return {
        provider: providerCode,
        name: config.name,
        platform: config.platform,
        success: false,
        duration: parseFloat(duration),
        error: error.message
      };
    }
  }

  /**
   * Get status of all scrapers
   * @returns {Promise<Object>} Status information
   */
  async getStatus() {
    const providers = this.loadProviderConfigs();

    const status = {
      totalProviders: providers.length,
      activeProviders: providers.filter(p => p.isActive).length,
      byPlatform: {},
      byScheduleTier: {}
    };

    // Count by platform
    providers.forEach(p => {
      if (!status.byPlatform[p.platform]) {
        status.byPlatform[p.platform] = { total: 0, active: 0 };
      }
      status.byPlatform[p.platform].total++;
      if (p.isActive) status.byPlatform[p.platform].active++;

      // Count by tier
      const tier = p.schedule?.tier || 'unknown';
      if (!status.byScheduleTier[tier]) {
        status.byScheduleTier[tier] = 0;
      }
      status.byScheduleTier[tier]++;
    });

    // Get last run info from database
    try {
      const lastRuns = await this.prisma.provider.findMany({
        select: {
          name: true,
          lastScrapeAt: true,
          lastScrapeStatus: true
        }
      });
      status.lastRuns = lastRuns;
    } catch (error) {
      status.lastRuns = [];
    }

    return status;
  }

  /**
   * Get scrape history for a provider
   * @param {String} providerCode - Provider code
   * @param {Number} limit - Number of records to return
   * @returns {Promise<Array>} Scrape history
   */
  async getHistory(providerCode, limit = 10) {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { name: { contains: providerCode } }
      });

      if (!provider) return [];

      // Would need a scrapeRuns table for full history
      return [{
        provider: providerCode,
        lastScrape: provider.lastScrapeAt,
        status: provider.lastScrapeStatus
      }];
    } catch (error) {
      return [];
    }
  }

  /**
   * Group providers by platform
   * @param {Array} providers - Provider configurations
   * @returns {Object} Providers grouped by platform
   */
  groupByPlatform(providers) {
    return providers.reduce((groups, provider) => {
      const platform = provider.platform;
      if (!groups[platform]) {
        groups[platform] = [];
      }
      groups[platform].push(provider);
      return groups;
    }, {});
  }

  /**
   * Update summary with run result
   * @param {Object} summary - Summary object to update
   * @param {Object} result - Run result
   */
  updateSummary(summary, result) {
    if (result.success) {
      summary.successful++;
      summary.activitiesFound += result.activitiesFound || 0;
      if (result.stats) {
        summary.activitiesCreated += result.stats.created || 0;
        summary.activitiesUpdated += result.stats.updated || 0;
      }
    } else {
      summary.failed++;
    }
  }

  /**
   * Print run summary
   * @param {Object} results - Run results
   */
  printRunSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('RUN SUMMARY');
    console.log('='.repeat(60));
    console.log(`Duration: ${results.durationMinutes} minutes`);
    console.log(`Providers: ${results.summary.successful}/${results.summary.total} successful`);
    console.log(`Activities Found: ${results.summary.activitiesFound}`);
    console.log(`Activities Created: ${results.summary.activitiesCreated}`);
    console.log(`Activities Updated: ${results.summary.activitiesUpdated}`);

    if (results.summary.failed > 0) {
      console.log(`\n⚠️  Failed Providers (${results.summary.failed}):`);
      results.providers
        .filter(p => !p.success)
        .forEach(p => console.log(`   - ${p.provider}: ${p.error}`));
    }

    console.log('='.repeat(60));
  }

  /**
   * Log run to database
   * @param {Object} results - Run results
   */
  async logRun(results) {
    try {
      // Update provider lastScrapeAt timestamps
      for (const result of results.providers) {
        if (result.success && result.provider) {
          await this.prisma.provider.updateMany({
            where: { name: { contains: result.provider } },
            data: {
              lastScrapeAt: new Date(),
              lastScrapeStatus: 'success'
            }
          });
        }
      }
    } catch (error) {
      console.error('Error logging run:', error.message);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.prisma.$disconnect();
  }
}

module.exports = ScraperOrchestrator;
