/**
 * FixValidator.js
 *
 * Tests proposed selector fixes against sample pages before applying them.
 * Compares extracted values with expected values from validation screenshots.
 */

const puppeteer = require('puppeteer');
const ClaudeVisionExtractor = require('./ClaudeVisionExtractor');
const ScreenshotCapture = require('./ScreenshotCapture');

class FixValidator {
  constructor(options = {}) {
    this.browser = null;
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
    this.visionExtractor = new ClaudeVisionExtractor(options);
    this.screenshotCapture = options.screenshotCapture || null;

    // Minimum accuracy threshold to consider a fix valid
    this.minAccuracy = options.minAccuracy || 0.7; // 70%
  }

  /**
   * Initialize browser
   */
  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.headless ? 'new' : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    if (!this.screenshotCapture) {
      this.screenshotCapture = new ScreenshotCapture({ browser: this.browser });
    }

    return this.browser;
  }

  /**
   * Test a selector fix on multiple sample URLs
   * @param {Object} fix - Selector fix to test
   * @param {Array<Object>} samples - Sample pages to test on
   * @returns {Promise<Object>} Validation results
   */
  async validateFix(fix, samples) {
    await this.init();

    const { field, selector, alternativeSelectors = [] } = fix;
    const allSelectors = [selector, ...alternativeSelectors].filter(Boolean);

    const results = [];
    let successCount = 0;

    for (const sample of samples.slice(0, 10)) { // Limit to 10 samples
      const result = await this.testSelectorOnPage(
        sample.sourceUrl,
        field,
        allSelectors,
        sample.expectedValue
      );

      results.push({
        url: sample.sourceUrl,
        ...result,
      });

      if (result.success && result.matchesExpected) {
        successCount++;
      }
    }

    const accuracy = results.length > 0 ? successCount / results.length : 0;

    return {
      field,
      selector,
      accuracy,
      isValid: accuracy >= this.minAccuracy,
      successCount,
      totalSamples: results.length,
      results,
      bestSelector: this.findBestSelector(results, allSelectors),
    };
  }

  /**
   * Test selectors on a single page
   */
  async testSelectorOnPage(url, field, selectors, expectedValue) {
    const page = await this.browser.newPage();

    try {
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      // Wait for content
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try each selector
      const selectorResults = [];
      for (const selector of selectors) {
        const result = await this.extractWithSelector(page, selector, field);
        selectorResults.push({
          selector,
          ...result,
        });
      }

      // Find the best result
      const successfulResults = selectorResults.filter(r => r.found);
      const matchingResults = successfulResults.filter(r =>
        this.valuesMatch(r.value, expectedValue, field)
      );

      const bestResult = matchingResults[0] || successfulResults[0] || selectorResults[0];

      return {
        success: bestResult?.found || false,
        extractedValue: bestResult?.value || null,
        expectedValue,
        matchesExpected: bestResult?.found && this.valuesMatch(bestResult.value, expectedValue, field),
        usedSelector: bestResult?.selector,
        allResults: selectorResults,
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        expectedValue,
        matchesExpected: false,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Extract value using a specific selector
   */
  async extractWithSelector(page, selector, field) {
    try {
      const element = await page.$(selector);
      if (!element) {
        return { found: false, selector };
      }

      // Extract based on field type
      let value = await element.evaluate((el, fieldName) => {
        const text = el.textContent?.trim();

        // Field-specific extraction
        switch (fieldName) {
          case 'instructor':
          case 'location':
          case 'room':
            return text;

          case 'sessionCount':
          case 'spotsAvailable':
          case 'ageMin':
          case 'ageMax': {
            const match = text.match(/\d+/);
            return match ? parseInt(match[0], 10) : null;
          }

          case 'cost': {
            const match = text.match(/\$?([\d,.]+)/);
            return match ? parseFloat(match[1].replace(',', '')) : null;
          }

          case 'registrationStatus': {
            const lower = text.toLowerCase();
            if (lower.includes('waitlist')) return 'Waitlist';
            if (lower.includes('full') || lower.includes('sold out')) return 'Full';
            if (lower.includes('closed') || lower.includes('cancelled')) return 'Closed';
            if (lower.includes('open') || lower.includes('register')) return 'Open';
            return text;
          }

          default:
            return text;
        }
      }, field);

      return {
        found: value !== null && value !== undefined && value !== '',
        value,
        selector,
      };

    } catch (error) {
      return {
        found: false,
        error: error.message,
        selector,
      };
    }
  }

  /**
   * Compare extracted value with expected value
   */
  valuesMatch(extracted, expected, field) {
    if (extracted === null || extracted === undefined) return false;
    if (expected === null || expected === undefined) return true; // No expected = any value is OK

    // Numeric fields
    if (['sessionCount', 'spotsAvailable', 'ageMin', 'ageMax', 'cost'].includes(field)) {
      const extractedNum = typeof extracted === 'number' ? extracted : parseFloat(extracted);
      const expectedNum = typeof expected === 'number' ? expected : parseFloat(expected);

      if (isNaN(extractedNum) || isNaN(expectedNum)) return false;

      // Allow small tolerance for cost
      if (field === 'cost') {
        return Math.abs(extractedNum - expectedNum) < 0.02;
      }

      return extractedNum === expectedNum;
    }

    // Status field - normalize and compare
    if (field === 'registrationStatus') {
      const normalize = (s) => String(s).toLowerCase().trim();
      return normalize(extracted) === normalize(expected) ||
             (normalize(extracted).includes('waitlist') && normalize(expected).includes('waitlist')) ||
             (normalize(extracted).includes('full') && normalize(expected).includes('full')) ||
             (normalize(extracted).includes('open') && normalize(expected).includes('open'));
    }

    // String fields - fuzzy match
    const extractedStr = String(extracted).toLowerCase().trim();
    const expectedStr = String(expected).toLowerCase().trim();

    // Exact match
    if (extractedStr === expectedStr) return true;

    // Contains match (for longer strings)
    if (extractedStr.includes(expectedStr) || expectedStr.includes(extractedStr)) {
      return true;
    }

    // Similarity check for instructor names etc.
    const similarity = this.calculateSimilarity(extractedStr, expectedStr);
    return similarity > 0.8;
  }

  /**
   * Calculate string similarity
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    const longerLength = longer.length;
    if (longerLength === 0) return 1;

    // Simple Levenshtein distance
    const matrix = [];
    for (let i = 0; i <= shorter.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= longer.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= shorter.length; i++) {
      for (let j = 1; j <= longer.length; j++) {
        const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return (longerLength - matrix[shorter.length][longer.length]) / longerLength;
  }

  /**
   * Find the best performing selector from results
   */
  findBestSelector(results, selectors) {
    const selectorStats = {};

    for (const selector of selectors) {
      selectorStats[selector] = { success: 0, match: 0, total: 0 };
    }

    for (const result of results) {
      if (result.allResults) {
        for (const sr of result.allResults) {
          if (selectorStats[sr.selector]) {
            selectorStats[sr.selector].total++;
            if (sr.found) selectorStats[sr.selector].success++;
          }
        }
      }
      if (result.usedSelector && result.matchesExpected) {
        if (selectorStats[result.usedSelector]) {
          selectorStats[result.usedSelector].match++;
        }
      }
    }

    // Score selectors
    const scored = Object.entries(selectorStats)
      .map(([selector, stats]) => ({
        selector,
        ...stats,
        score: stats.match * 10 + stats.success * 5,
      }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.selector || selectors[0];
  }

  /**
   * Validate fix using Claude Vision as ground truth
   * @param {Object} fix - Selector fix
   * @param {Array<string>} urls - URLs to test
   * @returns {Promise<Object>} Validation with vision comparison
   */
  async validateWithVision(fix, urls) {
    await this.init();

    const { field, selector, alternativeSelectors = [] } = fix;
    const allSelectors = [selector, ...alternativeSelectors];

    const results = [];

    for (const url of urls.slice(0, 5)) {
      const page = await this.browser.newPage();

      try {
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: this.timeout });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Take screenshot
        const screenshotPath = `/tmp/validation_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // Extract using selector
        const selectorResult = await this.extractWithSelector(page, selector, field);

        // Extract using Claude Vision
        const visionResult = await this.visionExtractor.extractFromScreenshot(screenshotPath, {
          platform: fix.platform,
        });

        const visionValue = visionResult.extractedData?.[field] ||
                          this.getNestedValue(visionResult.extractedData, field);

        const matches = this.valuesMatch(selectorResult.value, visionValue, field);

        results.push({
          url,
          selectorValue: selectorResult.value,
          visionValue,
          matches,
          selectorFound: selectorResult.found,
        });

      } catch (error) {
        results.push({
          url,
          error: error.message,
          matches: false,
        });
      } finally {
        await page.close();
      }
    }

    const matchCount = results.filter(r => r.matches).length;
    const accuracy = results.length > 0 ? matchCount / results.length : 0;

    return {
      field,
      selector,
      accuracy,
      isValid: accuracy >= this.minAccuracy,
      results,
      visionCost: this.visionExtractor.getUsageStats(),
    };
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    if (!obj) return undefined;

    // Map field names to nested paths
    const pathMap = {
      instructor: 'instructor',
      sessionCount: 'sessions.count',
      cost: 'cost.amount',
      registrationStatus: 'availability.status',
      spotsAvailable: 'availability.spotsAvailable',
      ageMin: 'ageRange.minAge',
      ageMax: 'ageRange.maxAge',
      location: 'location.name',
    };

    const actualPath = pathMap[path] || path;
    return actualPath.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Run comprehensive validation on multiple fixes
   */
  async validateMultipleFixes(fixes, samplesByField) {
    const results = [];

    for (const fix of fixes) {
      const samples = samplesByField[fix.field] || [];

      if (samples.length === 0) {
        results.push({
          field: fix.field,
          skipped: true,
          reason: 'No samples available',
        });
        continue;
      }

      const validation = await this.validateFix(fix, samples);
      results.push(validation);
    }

    const validFixes = results.filter(r => r.isValid);
    const invalidFixes = results.filter(r => !r.isValid && !r.skipped);

    return {
      totalFixes: fixes.length,
      validCount: validFixes.length,
      invalidCount: invalidFixes.length,
      skippedCount: results.filter(r => r.skipped).length,
      validFixes,
      invalidFixes,
      allResults: results,
    };
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

module.exports = FixValidator;
