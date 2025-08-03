const Queue = require('bull');
const cron = require('node-cron');
const providerService = require('../database/services/providerService');
const activityService = require('../database/services/activityService');
const scrapeJobService = require('../database/services/scrapeJobService');

class ScraperJobService {
  constructor() {
    this.scrapers = new Map();
    this.queue = null;
    this.cronJob = null;
  }

  /**
   * Initialize the scraper job service
   */
  async initialize() {
    console.log('🚀 Initializing scraper job service...');

    // Initialize Redis-based job queue
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.queue = new Queue('scraper-jobs', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000 // 1 minute
        }
      }
    });

    // Set up queue event handlers
    this.setupQueueHandlers();

    // Load scrapers
    await this.loadScrapers();

    // Start cron scheduler
    this.startScheduler();

    // Process jobs
    this.queue.process('scrape-provider', async (job) => {
      return this.processScrapeJob(job);
    });

    console.log('✅ Scraper job service initialized');
  }

  /**
   * Load available scrapers
   */
  async loadScrapers() {
    try {
      // Load NVRC scraper
      const NVRCWorkingHierarchicalScraper = require('../scrapers/nvrcWorkingHierarchicalScraper');
      this.scrapers.set('nvrcWorkingHierarchicalScraper', NVRCWorkingHierarchicalScraper);
      console.log('✅ Loaded NVRC scraper');
    } catch (error) {
      console.error('❌ Failed to load scrapers:', error);
    }
  }

  /**
   * Set up queue event handlers
   */
  setupQueueHandlers() {
    this.queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed:`, result);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed:`, err.message);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${job.id} stalled`);
    });

    this.queue.on('error', (error) => {
      console.error('❌ Queue error:', error);
    });
  }

  /**
   * Start the cron scheduler
   */
  startScheduler() {
    const intervalHours = parseInt(process.env.SCRAPE_INTERVAL_HOURS) || 1;
    
    // Run every hour by default
    const cronExpression = intervalHours === 1 ? '0 * * * *' : `0 */${intervalHours} * * *`;
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      console.log('🕐 Running scheduled scrape check...');
      await this.scheduleScrapingJobs();
    });

    console.log(`✅ Cron scheduler started (every ${intervalHours} hour(s))`);

    // Run immediately on startup
    this.scheduleScrapingJobs();
  }

  /**
   * Schedule scraping jobs for providers that need it
   */
  async scheduleScrapingJobs() {
    try {
      // Cancel stale jobs first
      await scrapeJobService.cancelStaleJobs();

      // Get providers that need scraping
      const providers = await providerService.getProvidersToScrape();
      
      console.log(`📋 Found ${providers.length} providers to scrape`);

      for (const provider of providers) {
        const jobData = {
          providerId: provider.id,
          providerName: provider.name,
          scraperConfig: provider.scraperConfig
        };

        await this.queue.add('scrape-provider', jobData, {
          delay: Math.random() * 5000, // Random delay to spread load
          priority: provider.name === 'NVRC' ? 1 : 2
        });

        console.log(`📥 Queued scrape job for ${provider.name}`);
      }
    } catch (error) {
      console.error('❌ Error scheduling scrape jobs:', error);
    }
  }

  /**
   * Process a scrape job
   */
  async processScrapeJob(job) {
    const { providerId, providerName, scraperConfig } = job.data;
    
    console.log(`🔄 Processing scrape job for ${providerName}`);

    // Create job record
    const scrapeJob = await scrapeJobService.createJob(providerId);
    
    try {
      // Start the job
      await scrapeJobService.startJob(scrapeJob.id);
      
      // Get the scraper class
      const ScraperClass = this.scrapers.get(scraperConfig.scraperClass);
      if (!ScraperClass) {
        throw new Error(`Scraper ${scraperConfig.scraperClass} not found`);
      }

      // Run the scraper
      const scraper = new ScraperClass();
      const activities = await scraper.scrape();
      
      console.log(`📊 Scraped ${activities.length} activities from ${providerName}`);

      // Upsert activities to database
      const result = await activityService.upsertActivities(activities, providerId);
      
      // Complete the job
      await scrapeJobService.completeJob(scrapeJob.id, {
        found: activities.length,
        ...result
      });

      return {
        providerId,
        providerName,
        activitiesFound: activities.length,
        ...result
      };

    } catch (error) {
      console.error(`❌ Scrape job failed for ${providerName}:`, error);
      
      // Fail the job
      await scrapeJobService.failJob(scrapeJob.id, error);
      
      throw error;
    }
  }

  /**
   * Manually trigger a scrape for a provider
   */
  async triggerScrape(providerId) {
    const provider = await providerService.getProviderById(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    const jobData = {
      providerId: provider.id,
      providerName: provider.name,
      scraperConfig: provider.scraperConfig
    };

    const job = await this.queue.add('scrape-provider', jobData, {
      priority: 0 // High priority for manual triggers
    });

    return {
      jobId: job.id,
      providerId,
      providerName: provider.name
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    ] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.getPausedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + delayed
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(olderThanDays = 7) {
    const olderThan = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const cleaned = await this.queue.clean(
      olderThan,
      'completed'
    );

    console.log(`🧹 Cleaned ${cleaned.length} old completed jobs`);
    return cleaned.length;
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown() {
    console.log('🛑 Shutting down scraper job service...');
    
    if (this.cronJob) {
      this.cronJob.stop();
    }

    if (this.queue) {
      await this.queue.close();
    }

    console.log('✅ Scraper job service shut down');
  }
}

module.exports = new ScraperJobService();