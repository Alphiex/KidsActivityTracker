/**
 * HTMLCapture.js
 *
 * Captures raw HTML from activity pages for LLM analysis.
 * Extracts relevant sections and cleans up the HTML for efficient processing.
 */

const puppeteer = require('puppeteer');

class HTMLCapture {
  constructor(options = {}) {
    this.browser = null;
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * Initialize browser instance
   */
  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.headless ? 'new' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Capture HTML from a URL
   * @param {string} url - URL to capture
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} Captured HTML and metadata
   */
  async capture(url, options = {}) {
    const {
      waitFor = 'networkidle2',
      waitForSelector = null,
      extractSelectors = [], // Specific selectors to extract
      maxLength = 50000, // Max HTML length to return
      cleanHtml = true,
    } = options;

    await this.init();
    const page = await this.browser.newPage();

    try {
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1280, height: 800 });

      // Navigate to page
      await page.goto(url, {
        waitUntil: waitFor,
        timeout: this.timeout,
      });

      // Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {});
      }

      // Wait a bit for dynamic content
      await this.delay(2000);

      // Get full HTML
      let fullHtml = await page.content();

      // Extract specific sections if selectors provided
      const extractedSections = {};
      if (extractSelectors.length > 0) {
        for (const selector of extractSelectors) {
          const elements = await page.$$(selector);
          extractedSections[selector] = [];
          for (const el of elements) {
            const html = await el.evaluate(e => e.outerHTML);
            extractedSections[selector].push(html);
          }
        }
      }

      // Get the main content area (try common selectors)
      const mainContentSelectors = [
        'main',
        '#main-content',
        '.main-content',
        '#content',
        '.content',
        '.activity-details',
        '.course-details',
        '.program-details',
        '[role="main"]',
      ];

      let mainContent = null;
      for (const selector of mainContentSelectors) {
        const element = await page.$(selector);
        if (element) {
          mainContent = await element.evaluate(e => e.outerHTML);
          break;
        }
      }

      // Clean HTML if requested
      if (cleanHtml) {
        fullHtml = this.cleanHtml(fullHtml);
        if (mainContent) {
          mainContent = this.cleanHtml(mainContent);
        }
      }

      // Truncate if too long
      if (fullHtml.length > maxLength) {
        fullHtml = fullHtml.substring(0, maxLength) + '\n<!-- TRUNCATED -->';
      }

      // Get page title and meta info
      const title = await page.title();
      const metaDescription = await page.$eval(
        'meta[name="description"]',
        el => el.content
      ).catch(() => null);

      return {
        success: true,
        url,
        title,
        metaDescription,
        fullHtml,
        mainContent,
        extractedSections,
        htmlLength: fullHtml.length,
        capturedAt: new Date().toISOString(),
      };

    } catch (error) {
      return {
        success: false,
        url,
        error: error.message,
        capturedAt: new Date().toISOString(),
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Capture multiple URLs
   * @param {Array<string>} urls - URLs to capture
   * @param {Object} options - Capture options
   * @returns {Promise<Array>} Array of capture results
   */
  async captureMany(urls, options = {}) {
    const { concurrency = 2, delayBetween = 1000, onProgress } = options;

    const results = [];
    const queue = [...urls];
    let completed = 0;

    const processQueue = async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        const result = await this.capture(url, options);
        results.push(result);
        completed++;

        if (onProgress) {
          onProgress({
            completed,
            total: urls.length,
            percent: Math.round((completed / urls.length) * 100),
            lastUrl: url,
            success: result.success,
          });
        }

        if (queue.length > 0) {
          await this.delay(delayBetween);
        }
      }
    };

    // Run with limited concurrency
    const workers = [];
    for (let i = 0; i < Math.min(concurrency, urls.length); i++) {
      workers.push(processQueue());
    }

    await Promise.all(workers);
    return results;
  }

  /**
   * Clean HTML by removing scripts, styles, and unnecessary attributes
   */
  cleanHtml(html) {
    // Remove script tags and content
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove style tags and content
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove comments
    html = html.replace(/<!--[\s\S]*?-->/g, '');

    // Remove noscript tags
    html = html.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    // Remove SVG content (usually icons, can be large)
    html = html.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '[SVG]');

    // Remove data attributes (often large)
    html = html.replace(/\s+data-[a-z0-9-]+="[^"]*"/gi, '');

    // Remove inline styles
    html = html.replace(/\s+style="[^"]*"/gi, '');

    // Remove tracking/analytics attributes
    html = html.replace(/\s+(onclick|onload|onerror|onmouseover)="[^"]*"/gi, '');

    // Collapse multiple whitespace
    html = html.replace(/\s+/g, ' ');

    // Remove empty tags (but keep structural ones)
    html = html.replace(/<(span|div|p)\s*>\s*<\/\1>/gi, '');

    return html.trim();
  }

  /**
   * Extract just the activity detail section for a specific field
   * @param {string} html - Full HTML
   * @param {string} fieldName - Field we're looking for
   * @returns {string} Relevant HTML section
   */
  extractRelevantSection(html, fieldName) {
    const fieldPatterns = {
      instructor: [
        /instructor/i, /teacher/i, /staff/i, /leader/i, /coach/i,
        /facilitat/i, /supervisor/i,
      ],
      sessionCount: [
        /session/i, /class(?:es)?/i, /meeting/i, /occurrence/i,
      ],
      cost: [
        /cost/i, /price/i, /fee/i, /\$\d+/i, /amount/i,
      ],
      registrationStatus: [
        /status/i, /availab/i, /register/i, /waitlist/i,
        /full/i, /open/i, /spots?/i,
      ],
      spotsAvailable: [
        /spots?/i, /availab/i, /remaining/i, /capacity/i, /openings?/i,
      ],
      ageRange: [
        /age/i, /years?\s*old/i, /yrs?/i, /\d+\s*-\s*\d+/,
      ],
      schedule: [
        /schedule/i, /time/i, /day/i, /when/i, /date/i,
        /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
      ],
      location: [
        /location/i, /venue/i, /address/i, /facility/i, /room/i, /where/i,
      ],
    };

    const patterns = fieldPatterns[fieldName] || [new RegExp(fieldName, 'i')];

    // Find sections of HTML that match the patterns
    const lines = html.split(/(?=<)/);
    const relevantLines = [];
    let inRelevantSection = false;
    let sectionDepth = 0;

    for (const line of lines) {
      const matchesPattern = patterns.some(p => p.test(line));

      if (matchesPattern) {
        inRelevantSection = true;
        sectionDepth = 0;
      }

      if (inRelevantSection) {
        relevantLines.push(line);

        // Track depth to capture full section
        const openTags = (line.match(/<[a-z][^>]*(?<!\/)\s*>/gi) || []).length;
        const closeTags = (line.match(/<\/[a-z]+>/gi) || []).length;
        sectionDepth += openTags - closeTags;

        // End section after closing
        if (sectionDepth <= 0 && relevantLines.length > 5) {
          inRelevantSection = false;
        }

        // Limit section size
        if (relevantLines.length > 50) {
          break;
        }
      }
    }

    return relevantLines.join('').trim() || html.substring(0, 5000);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = HTMLCapture;
