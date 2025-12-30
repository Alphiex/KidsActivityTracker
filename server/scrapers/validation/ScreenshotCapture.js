/**
 * ScreenshotCapture.js
 *
 * Captures full-page screenshots of activity source pages using Puppeteer.
 * Handles different platform layouts and authentication if needed.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class ScreenshotCapture {
  constructor(options = {}) {
    this.screenshotDir = options.screenshotDir ||
      path.join(__dirname, 'screenshots');
    this.browser = null;
    this.page = null;
    this.timeout = options.timeout || 30000;
    this.viewportWidth = options.viewportWidth || 1440;
    this.viewportHeight = options.viewportHeight || 900;
  }

  /**
   * Initialize browser instance
   */
  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }

    // Ensure screenshot directory exists
    await fs.mkdir(this.screenshotDir, { recursive: true });
  }

  /**
   * Capture screenshot of an activity page
   * @param {Object} activity - Activity object with detailUrl/registrationUrl
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} - Screenshot result with path and metadata
   */
  async captureActivity(activity, options = {}) {
    const {
      waitForSelector = null,
      scrollToBottom = true,
      waitAfterLoad = 2000,
      fullPage = true,
    } = options;

    const url = activity.detailUrl || activity.registrationUrl;
    if (!url) {
      return {
        success: false,
        error: 'No URL available for activity',
        activityId: activity.id,
      };
    }

    try {
      await this.init();

      const page = await this.browser.newPage();
      await page.setViewport({
        width: this.viewportWidth,
        height: this.viewportHeight,
      });

      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to page
      console.log(`  Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      // Wait for specific selector if provided
      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: 10000 });
        } catch (e) {
          console.log(`  Warning: Selector "${waitForSelector}" not found`);
        }
      }

      // Wait for dynamic content to load
      await page.waitForTimeout(waitAfterLoad);

      // Scroll to bottom to trigger lazy loading
      if (scrollToBottom) {
        await this.autoScroll(page);
        await page.waitForTimeout(1000);
      }

      // Click expand buttons on PerfectMind to show all details
      await this.expandPerfectMindDetails(page);

      // Generate filename
      const filename = this.generateFilename(activity);
      const filepath = path.join(this.screenshotDir, filename);

      // Capture screenshot
      await page.screenshot({
        path: filepath,
        fullPage,
        type: 'png',
      });

      // Get page metadata
      const pageTitle = await page.title();
      const pageContent = await page.content();

      await page.close();

      return {
        success: true,
        activityId: activity.id,
        url,
        screenshotPath: filepath,
        filename,
        pageTitle,
        timestamp: new Date().toISOString(),
        contentLength: pageContent.length,
      };
    } catch (error) {
      console.error(`  Error capturing ${url}: ${error.message}`);
      return {
        success: false,
        activityId: activity.id,
        url,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Capture multiple activities with rate limiting
   */
  async captureMany(activities, options = {}) {
    const {
      concurrency = 3,
      delayBetween = 1000,
      onProgress = null,
    } = options;

    const results = [];
    let completed = 0;

    // Process in batches
    for (let i = 0; i < activities.length; i += concurrency) {
      const batch = activities.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(activity => this.captureActivity(activity, options))
      );

      results.push(...batchResults);
      completed += batch.length;

      if (onProgress) {
        onProgress({
          completed,
          total: activities.length,
          percent: Math.round((completed / activities.length) * 100),
          lastBatch: batchResults,
        });
      }

      // Rate limiting delay
      if (i + concurrency < activities.length) {
        await this.delay(delayBetween);
      }
    }

    return results;
  }

  /**
   * Auto-scroll page to trigger lazy loading
   */
  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });
  }

  /**
   * Expand PerfectMind detail sections
   */
  async expandPerfectMindDetails(page) {
    try {
      // Click "Show More" or expand buttons
      const expandSelectors = [
        '.show-more-link',
        '.expand-button',
        '[data-toggle="collapse"]',
        '.accordion-toggle',
        '.detail-expander',
        'button:contains("More")',
        'a:contains("Details")',
      ];

      for (const selector of expandSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const el of elements) {
            await el.click();
            await page.waitForTimeout(500);
          }
        } catch (e) {
          // Selector not found, continue
        }
      }
    } catch (error) {
      // Ignore expansion errors
    }
  }

  /**
   * Generate unique filename for screenshot
   */
  generateFilename(activity) {
    const timestamp = Date.now();
    const sanitizedId = activity.id.replace(/[^a-zA-Z0-9]/g, '');
    const shortId = sanitizedId.substring(0, 12);
    return `${shortId}_${timestamp}.png`;
  }

  /**
   * Get platform-specific wait selector
   */
  getWaitSelector(platform) {
    const selectors = {
      PerfectMind: '.activity-detail, .program-detail, #ActivityDetail',
      ActiveNetwork: '.activity-details, .program-info, #activityContent',
      Amilia: '.activity-card, .program-details',
      Intelligenz: '.event-detail, .activity-info',
    };
    return selectors[platform] || null;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get screenshot file as base64 for API calls
   */
  async getScreenshotBase64(filepath) {
    const buffer = await fs.readFile(filepath);
    return buffer.toString('base64');
  }

  /**
   * Clean up old screenshots
   */
  async cleanupOldScreenshots(daysOld = 7) {
    const files = await fs.readdir(this.screenshotDir);
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    let deleted = 0;
    for (const file of files) {
      if (!file.endsWith('.png')) continue;

      const filepath = path.join(this.screenshotDir, file);
      const stats = await fs.stat(filepath);

      if (stats.mtimeMs < cutoff) {
        await fs.unlink(filepath);
        deleted++;
      }
    }

    return deleted;
  }
}

module.exports = ScreenshotCapture;
