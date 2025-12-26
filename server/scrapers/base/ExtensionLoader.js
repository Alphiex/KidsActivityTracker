const path = require('path');
const fs = require('fs');
const ProviderExtension = require('./ProviderExtension');

/**
 * Loads provider-specific extensions for scrapers.
 *
 * Extension files should be located at:
 *   scrapers/providers/{platform}/{ProviderCode}Extension.js
 *
 * For example:
 *   scrapers/providers/perfectmind/SurreyExtension.js
 *   scrapers/providers/activenetwork/VancouverExtension.js
 */
class ExtensionLoader {
  static extensionCache = new Map();

  /**
   * Load an extension for a provider
   * @param {string} providerCode - Provider code (e.g., 'surrey')
   * @param {string} platform - Platform name (e.g., 'perfectmind')
   * @param {Object} config - Provider configuration
   * @returns {ProviderExtension|null} - Extension instance or null if none exists
   */
  static loadExtension(providerCode, platform, config) {
    // Check cache first
    const cacheKey = `${platform}:${providerCode}`;
    if (this.extensionCache.has(cacheKey)) {
      const ExtensionClass = this.extensionCache.get(cacheKey);
      return ExtensionClass ? new ExtensionClass(config) : null;
    }

    // Build extension file path
    const extensionName = this.toExtensionName(providerCode);
    const extensionPath = path.join(
      __dirname,
      '..',
      'providers',
      platform.toLowerCase(),
      `${extensionName}Extension.js`
    );

    // Check if extension file exists
    if (!fs.existsSync(extensionPath)) {
      this.extensionCache.set(cacheKey, null);
      return null;
    }

    try {
      const ExtensionClass = require(extensionPath);

      // Validate it's a proper extension
      if (!(ExtensionClass.prototype instanceof ProviderExtension) &&
          ExtensionClass !== ProviderExtension) {
        console.warn(`[ExtensionLoader] ${extensionPath} does not extend ProviderExtension`);
        this.extensionCache.set(cacheKey, null);
        return null;
      }

      this.extensionCache.set(cacheKey, ExtensionClass);
      console.log(`[ExtensionLoader] Loaded extension: ${extensionName} for ${platform}`);
      return new ExtensionClass(config);
    } catch (error) {
      console.error(`[ExtensionLoader] Error loading extension ${extensionPath}:`, error.message);
      this.extensionCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Convert provider code to extension class name format
   * e.g., 'surrey' -> 'Surrey', 'north-vancouver' -> 'NorthVancouver'
   */
  static toExtensionName(providerCode) {
    return providerCode
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  /**
   * List all available extensions for a platform
   * @param {string} platform - Platform name
   * @returns {Array<string>} - Array of provider codes with extensions
   */
  static listExtensions(platform) {
    const extensionsDir = path.join(
      __dirname,
      '..',
      'providers',
      platform.toLowerCase()
    );

    if (!fs.existsSync(extensionsDir)) {
      return [];
    }

    const files = fs.readdirSync(extensionsDir);
    return files
      .filter(f => f.endsWith('Extension.js'))
      .map(f => {
        // Convert 'SurreyExtension.js' to 'surrey'
        const name = f.replace('Extension.js', '');
        return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
      });
  }

  /**
   * Check if an extension exists for a provider
   * @param {string} providerCode - Provider code
   * @param {string} platform - Platform name
   * @returns {boolean}
   */
  static hasExtension(providerCode, platform) {
    const extensionName = this.toExtensionName(providerCode);
    const extensionPath = path.join(
      __dirname,
      '..',
      'providers',
      platform.toLowerCase(),
      `${extensionName}Extension.js`
    );
    return fs.existsSync(extensionPath);
  }

  /**
   * Clear the extension cache (useful for testing)
   */
  static clearCache() {
    this.extensionCache.clear();
  }
}

module.exports = ExtensionLoader;
