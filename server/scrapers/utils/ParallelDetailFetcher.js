/**
 * ParallelDetailFetcher - Optimized detail page fetching with browser pool
 *
 * Key optimizations:
 * 1. Uses multiple browser instances in parallel
 * 2. Restarts browsers periodically to prevent timeout
 * 3. Saves progress incrementally to database
 * 4. Handles errors gracefully with retries
 */

const puppeteer = require('puppeteer');

class ParallelDetailFetcher {
  constructor(options = {}) {
    this.browserCount = options.browserCount || 3; // Number of parallel browsers
    this.batchSize = options.batchSize || 10; // Activities per batch
    this.browserRestartInterval = options.browserRestartInterval || 50; // Restart browser every N pages
    this.pageTimeout = options.pageTimeout || 30000;
    this.maxRetries = options.maxRetries || 2;
    this.browsers = [];
    this.pageCounters = [];
    this.logger = options.logger || console.log;
  }

  async initialize() {
    this.logger(`Initializing ${this.browserCount} browser instances...`);

    for (let i = 0; i < this.browserCount; i++) {
      await this.createBrowser(i);
    }
  }

  async createBrowser(index) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    this.browsers[index] = browser;
    this.pageCounters[index] = 0;
    return browser;
  }

  async restartBrowser(index) {
    try {
      await this.browsers[index].close();
    } catch (e) {
      // Browser may already be closed
    }
    await this.createBrowser(index);
    this.logger(`Browser ${index + 1} restarted`);
  }

  async cleanup() {
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    this.browsers = [];
    this.pageCounters = [];
  }

  /**
   * Fetch detail pages in parallel using browser pool
   * @param {Array} activities - Activities to enhance
   * @param {Function} extractFn - Function to extract data from page (receives page object)
   * @param {Function} onBatchComplete - Optional callback when a batch completes (for incremental saves)
   * @returns {Array} Enhanced activities
   */
  async fetchDetails(activities, extractFn, onBatchComplete = null) {
    if (activities.length === 0) return activities;

    await this.initialize();

    const results = new Map(); // Store results by activity index
    const queue = activities.map((a, i) => ({ activity: a, index: i, retries: 0 }));
    let processed = 0;
    let enhanced = 0;

    // Worker function for each browser
    const worker = async (browserIndex) => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        try {
          // Check if browser needs restart
          if (this.pageCounters[browserIndex] >= this.browserRestartInterval) {
            await this.restartBrowser(browserIndex);
          }

          const browser = this.browsers[browserIndex];
          const page = await browser.newPage();

          try {
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
            await page.goto(item.activity.registrationUrl, {
              waitUntil: 'networkidle2',
              timeout: this.pageTimeout
            });

            // Wait for page to render
            await new Promise(r => setTimeout(r, 1500));

            // Extract data using provided function
            const detailData = await extractFn(page);

            // Merge with activity
            const enhancedActivity = { ...item.activity, ...detailData };
            results.set(item.index, enhancedActivity);
            enhanced++;

          } finally {
            await page.close();
            this.pageCounters[browserIndex]++;
          }

          processed++;

          // Log progress periodically
          if (processed % 50 === 0) {
            const pct = ((processed / activities.length) * 100).toFixed(1);
            this.logger(`Progress: ${processed}/${activities.length} (${pct}%) - Enhanced: ${enhanced}`);
          }

          // Call batch complete callback for incremental saves
          if (onBatchComplete && processed % this.batchSize === 0) {
            const batchResults = [];
            for (let i = processed - this.batchSize; i < processed; i++) {
              if (results.has(i)) {
                batchResults.push(results.get(i));
              }
            }
            if (batchResults.length > 0) {
              await onBatchComplete(batchResults);
            }
          }

        } catch (error) {
          // Retry logic
          if (item.retries < this.maxRetries) {
            item.retries++;
            queue.push(item); // Re-queue for retry
          } else {
            // Keep original activity without enhancement
            results.set(item.index, item.activity);
            processed++;
          }
        }
      }
    };

    // Start workers for each browser
    const workers = Array(this.browserCount).fill(null).map((_, i) => worker(i));
    await Promise.all(workers);

    await this.cleanup();

    // Reconstruct array in original order
    const enhancedActivities = [];
    for (let i = 0; i < activities.length; i++) {
      enhancedActivities.push(results.get(i) || activities[i]);
    }

    this.logger(`Detail fetching complete: ${enhanced}/${activities.length} enhanced`);
    return enhancedActivities;
  }
}

module.exports = ParallelDetailFetcher;
