const PerfectMindScraper = require('../platforms/PerfectMindScraper');
const ActiveNetworkScraper = require('../platforms/ActiveNetworkScraper');
const IntelligenzScraper = require('../platforms/IntelligenzScraper');
const FullCalendarScraper = require('../platforms/FullCalendarScraper');
const IC3Scraper = require('../platforms/IC3Scraper');
const REGPROGScraper = require('../platforms/REGPROGScraper');
const COEScraper = require('../platforms/COEScraper');
const WebTracScraper = require('../platforms/WebTracScraper');
const LookNBookScraper = require('../platforms/LookNBookScraper');
const AmiliaScraper = require('../platforms/AmiliaScraper');
const QidigoScraper = require('../platforms/QidigoScraper');
const ExtensionLoader = require('./ExtensionLoader');

/**
 * Factory class for creating appropriate scraper instances based on provider configuration.
 *
 * The factory supports provider-specific extensions that customize platform scraper behavior.
 * Extensions are automatically loaded from: scrapers/providers/{platform}/{ProviderCode}Extension.js
 */
class ScraperFactory {
  /**
   * Create a scraper instance based on provider configuration
   * @param {Object} providerConfig - Provider configuration object
   * @returns {BaseScraper} - Scraper instance with extension attached if available
   */
  static createScraper(providerConfig) {
    // Validate configuration
    if (!providerConfig) {
      throw new Error('Provider configuration is required');
    }

    if (!providerConfig.platform) {
      throw new Error('Provider platform is required');
    }

    const platform = providerConfig.platform.toLowerCase();
    let scraper;

    // Create scraper based on platform
    switch (platform) {
      case 'perfectmind':
        scraper = new PerfectMindScraper(providerConfig);
        break;

      case 'activenetwork':
        scraper = new ActiveNetworkScraper(providerConfig);
        break;

      case 'intelligenz':
        scraper = new IntelligenzScraper(providerConfig);
        break;

      case 'fullcalendar':
      case 'civicweb':
        scraper = new FullCalendarScraper(providerConfig);
        break;

      case 'ic3':
        scraper = new IC3Scraper(providerConfig);
        break;

      case 'regprog':
        scraper = new REGPROGScraper(providerConfig);
        break;

      case 'coe':
        scraper = new COEScraper(providerConfig);
        break;

      case 'webtrac':
        scraper = new WebTracScraper(providerConfig);
        break;

      case 'looknbook':
        scraper = new LookNBookScraper(providerConfig);
        break;

      case 'amilia':
        scraper = new AmiliaScraper(providerConfig);
        break;

      case 'qidigo':
        scraper = new QidigoScraper(providerConfig);
        break;

      default:
        throw new Error(`Unsupported platform: ${providerConfig.platform}`);
    }

    // Load and attach provider extension if available
    const extension = ExtensionLoader.loadExtension(
      providerConfig.code,
      platform,
      providerConfig
    );

    if (extension) {
      scraper.extension = extension;
      console.log(`[ScraperFactory] Attached extension for ${providerConfig.code}`);
    }

    return scraper;
  }

  /**
   * Check if a provider has a custom extension
   * @param {string} providerCode - Provider code
   * @param {string} platform - Platform name
   * @returns {boolean}
   */
  static hasExtension(providerCode, platform) {
    return ExtensionLoader.hasExtension(providerCode, platform);
  }

  /**
   * List all available extensions for a platform
   * @param {string} platform - Platform name
   * @returns {Array<string>}
   */
  static listExtensions(platform) {
    return ExtensionLoader.listExtensions(platform);
  }

  /**
   * Get available platforms
   * @returns {Array} - Array of supported platform names
   */
  static getSupportedPlatforms() {
    return [
      'perfectmind',
      'activenetwork',
      'intelligenz',
      'fullcalendar',
      'civicweb',
      'ic3',
      'regprog',
      'coe',
      'webtrac',
      'looknbook',
      'amilia',
      'qidigo'
    ];
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