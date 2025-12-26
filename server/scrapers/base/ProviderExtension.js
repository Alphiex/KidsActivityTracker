/**
 * Base class for provider-specific scraper extensions.
 *
 * Provider extensions allow customization of platform scraper behavior
 * without modifying the core platform code. Use this when a specific
 * provider's site has variations that require different:
 * - Link discovery logic
 * - Activity parsing
 * - Wait times/selectors
 * - Data normalization
 *
 * Extensions are automatically loaded by the ScraperFactory based on provider code.
 */
class ProviderExtension {
  constructor(config) {
    this.config = config;
    this.providerCode = config.code;
  }

  /**
   * Hook: Called before navigating to the main page
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<void>}
   */
  async beforeNavigate(page) {
    // Override in subclass if needed
  }

  /**
   * Hook: Called after page navigation, before waiting for content
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<void>}
   */
  async afterNavigate(page) {
    // Override in subclass if needed
  }

  /**
   * Hook: Called before link discovery
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<void>}
   */
  async beforeDiscoverLinks(page) {
    // Override in subclass if needed
  }

  /**
   * Custom link discovery logic
   * Return null to use default platform behavior
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<Array|null>} - Array of links or null for default behavior
   */
  async discoverLinks(page) {
    return null; // Use platform default
  }

  /**
   * Hook: Called after link discovery
   * @param {Page} page - Puppeteer page instance
   * @param {Array} links - Discovered links
   * @returns {Promise<Array>} - Modified links array
   */
  async afterDiscoverLinks(page, links) {
    return links; // Return unmodified by default
  }

  /**
   * Custom activity link click handler
   * Return null to use default click behavior
   * @param {Page} page - Puppeteer page instance
   * @param {Object} link - Link element info
   * @returns {Promise<boolean|null>} - true if handled, null for default
   */
  async handleLinkClick(page, link) {
    return null; // Use platform default
  }

  /**
   * Custom activity parsing logic
   * Return null to use default platform behavior
   * @param {Page} page - Puppeteer page instance
   * @param {Object} rawActivity - Raw activity data from page
   * @returns {Promise<Object|null>} - Parsed activity or null for default
   */
  async parseActivity(page, rawActivity) {
    return null; // Use platform default
  }

  /**
   * Hook: Called after activity is parsed, before normalization
   * @param {Object} activity - Parsed activity data
   * @returns {Promise<Object>} - Modified activity data
   */
  async afterParseActivity(activity) {
    return activity; // Return unmodified by default
  }

  /**
   * Custom data normalization
   * Return null to use default platform behavior
   * @param {Object} activity - Activity data to normalize
   * @returns {Promise<Object|null>} - Normalized activity or null for default
   */
  async normalizeActivity(activity) {
    return null; // Use platform default
  }

  /**
   * Get custom wait time for page loads
   * Return null to use config/default value
   * @returns {number|null}
   */
  getWaitTime() {
    return this.config.scraperConfig?.initialWaitTime || null;
  }

  /**
   * Get custom selector to wait for
   * Return null to use config/default value
   * @returns {string|null}
   */
  getWaitSelector() {
    return this.config.scraperConfig?.waitForSelector || null;
  }

  /**
   * Get custom timeout for page operations
   * Return null to use config/default value
   * @returns {number|null}
   */
  getTimeout() {
    return this.config.scraperConfig?.timeout || null;
  }

  /**
   * Filter activities before saving
   * @param {Array} activities - Array of activities
   * @returns {Promise<Array>} - Filtered activities
   */
  async filterActivities(activities) {
    return activities; // Return all by default
  }

  /**
   * Custom error handling for this provider
   * @param {Error} error - The error that occurred
   * @param {string} context - Where the error occurred
   * @returns {Promise<boolean>} - true if error was handled, false to use default
   */
  async handleError(error, context) {
    return false; // Use default error handling
  }

  /**
   * Get provider-specific selectors
   * These override or supplement the platform defaults
   * @returns {Object}
   */
  getSelectors() {
    return this.config.scraperConfig?.selectors || {};
  }

  /**
   * Log with provider prefix
   * @param {string} message - Message to log
   */
  log(message) {
    console.log(`[${this.providerCode.toUpperCase()}:EXT] ${message}`);
  }
}

module.exports = ProviderExtension;
