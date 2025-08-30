const PerfectMindScraper = require('../platforms/PerfectMindScraper');
const ActiveNetworkScraper = require('../platforms/ActiveNetworkScraper');

/**
 * Factory class for creating appropriate scraper instances based on provider configuration
 */
class ScraperFactory {
  /**
   * Create a scraper instance based on provider configuration
   * @param {Object} providerConfig - Provider configuration object
   * @returns {BaseScraper} - Scraper instance
   */
  static createScraper(providerConfig) {
    // Validate configuration
    if (!providerConfig) {
      throw new Error('Provider configuration is required');
    }

    if (!providerConfig.platform) {
      throw new Error('Provider platform is required');
    }

    // Create scraper based on platform
    switch (providerConfig.platform.toLowerCase()) {
      case 'perfectmind':
        return new PerfectMindScraper(providerConfig);
      
      case 'activenetwork':
        return new ActiveNetworkScraper(providerConfig);
      
      default:
        throw new Error(`Unsupported platform: ${providerConfig.platform}`);
    }
  }

  /**
   * Get available platforms
   * @returns {Array} - Array of supported platform names
   */
  static getSupportedPlatforms() {
    return ['perfectmind', 'activenetwork'];
  }

  /**
   * Validate provider configuration structure
   * @param {Object} config - Configuration to validate
   * @returns {Object} - Validation result
   */
  static validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredFields = ['name', 'code', 'platform', 'baseUrl'];
    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Platform validation
    if (config.platform && !this.getSupportedPlatforms().includes(config.platform.toLowerCase())) {
      errors.push(`Unsupported platform: ${config.platform}`);
    }

    // URL validation
    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch (e) {
        errors.push(`Invalid baseUrl: ${config.baseUrl}`);
      }
    }

    // Scraper config validation
    if (config.scraperConfig) {
      if (!config.scraperConfig.type) {
        warnings.push('Missing scraperConfig.type');
      }
      
      if (!config.scraperConfig.entryPoints || !Array.isArray(config.scraperConfig.entryPoints)) {
        warnings.push('Missing or invalid scraperConfig.entryPoints');
      }

      // Rate limit validation
      if (config.scraperConfig.rateLimits) {
        const limits = config.scraperConfig.rateLimits;
        if (limits.requestsPerMinute && limits.requestsPerMinute < 1) {
          warnings.push('requestsPerMinute should be at least 1');
        }
        if (limits.concurrentRequests && limits.concurrentRequests < 1) {
          warnings.push('concurrentRequests should be at least 1');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create a test scraper for configuration validation
   * @param {Object} config - Configuration to test
   * @returns {Promise<Object>} - Test result
   */
  static async testConfiguration(config) {
    try {
      // Validate configuration first
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Configuration validation failed',
          details: validation.errors
        };
      }

      // Create scraper instance
      const scraper = this.createScraper(config);
      
      // Test basic functionality
      const providerInfo = scraper.getProviderInfo();
      const configValid = scraper.validateConfig();

      return {
        success: true,
        providerInfo,
        configValid,
        warnings: validation.warnings
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Get default configuration template for a platform
   * @param {String} platform - Platform name
   * @returns {Object} - Default configuration template
   */
  static getDefaultConfiguration(platform) {
    const baseConfig = {
      name: '',
      code: '',
      platform: platform.toLowerCase(),
      baseUrl: '',
      isActive: true,
      scraperConfig: {
        rateLimits: {
          requestsPerMinute: 30,
          concurrentRequests: 3
        },
        timeout: 30000,
        retries: 3
      }
    };

    switch (platform.toLowerCase()) {
      case 'perfectmind':
        return {
          ...baseConfig,
          scraperConfig: {
            ...baseConfig.scraperConfig,
            type: 'widget',
            entryPoints: [],
            sections: [
              'Early Years: Parent Participation',
              'Early Years: On My Own', 
              'School Age',
              'Youth',
              'All Ages & Family'
            ],
            maxConcurrency: 5
          }
        };

      case 'activenetwork':
        return {
          ...baseConfig,
          scraperConfig: {
            ...baseConfig.scraperConfig,
            type: 'search',
            entryPoints: [],
            maxAge: 18,
            categoryFiltering: true,
            searchParams: {
              onlineSiteId: 0,
              activity_select_param: 2,
              viewMode: 'list'
            }
          }
        };

      default:
        return baseConfig;
    }
  }
}

module.exports = ScraperFactory;