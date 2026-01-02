/**
 * PlatformAnalyzer.js
 *
 * Analyzes provider configurations to map providers to platforms.
 * Determines whether issues are platform-wide or provider-specific.
 */

const fs = require('fs').promises;
const path = require('path');

class PlatformAnalyzer {
  constructor(options = {}) {
    this.configsDir = options.configsDir || path.join(__dirname, '../configs/providers');
    this.platformConfigsDir = options.platformConfigsDir || path.join(__dirname, '../configs/platforms');
    this.providersDir = options.providersDir || path.join(__dirname, '../providers');
    this.platformsDir = options.platformsDir || path.join(__dirname, '../platforms');

    // Cache
    this._providerConfigs = null;
    this._platformMap = null;
  }

  /**
   * Load all provider configurations
   * @returns {Promise<Object>} Map of provider code to config
   */
  async loadProviderConfigs() {
    if (this._providerConfigs) return this._providerConfigs;

    const configs = {};

    try {
      const files = await fs.readdir(this.configsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(this.configsDir, file), 'utf-8');
          const config = JSON.parse(content);

          // Normalize provider code
          const code = config.code || file.replace('.json', '').toLowerCase();
          configs[code] = {
            ...config,
            code,
            configFile: file,
          };
        } catch (err) {
          console.warn(`Failed to load config ${file}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`Failed to read configs directory: ${err.message}`);
    }

    this._providerConfigs = configs;
    return configs;
  }

  /**
   * Build a map of providers to platforms
   * @returns {Promise<Object>} Platform mapping
   */
  async buildPlatformMap() {
    if (this._platformMap) return this._platformMap;

    const configs = await this.loadProviderConfigs();

    const platformMap = {
      byPlatform: {}, // platform -> [providers]
      byProvider: {}, // provider -> platform
      platformStats: {}, // platform -> stats
    };

    for (const [code, config] of Object.entries(configs)) {
      const platform = (config.platform || 'unknown').toLowerCase();

      // Map provider to platform
      platformMap.byProvider[code] = platform;

      // Map platform to providers
      if (!platformMap.byPlatform[platform]) {
        platformMap.byPlatform[platform] = [];
      }
      platformMap.byPlatform[platform].push(code);
    }

    // Calculate stats
    for (const [platform, providers] of Object.entries(platformMap.byPlatform)) {
      platformMap.platformStats[platform] = {
        providerCount: providers.length,
        providers,
      };
    }

    this._platformMap = platformMap;
    return platformMap;
  }

  /**
   * Get the platform for a provider
   * @param {string} providerCode - Provider code (e.g., "vancouver", "mississauga")
   * @returns {Promise<string|null>} Platform name
   */
  async getPlatformForProvider(providerCode) {
    const map = await this.buildPlatformMap();
    const normalized = this.normalizeProviderCode(providerCode);
    return map.byProvider[normalized] || null;
  }

  /**
   * Get all providers for a platform
   * @param {string} platform - Platform name
   * @returns {Promise<Array<string>>} Provider codes
   */
  async getProvidersForPlatform(platform) {
    const map = await this.buildPlatformMap();
    return map.byPlatform[platform.toLowerCase()] || [];
  }

  /**
   * Normalize provider code (handle variations)
   */
  normalizeProviderCode(code) {
    return code
      .toLowerCase()
      .replace(/[-_\s]+/g, '-')
      .replace(/^city-of-/, '')
      .replace(/-rec$/, '')
      .replace(/-parks$/, '');
  }

  /**
   * Check if a provider has a custom extension
   * @param {string} providerCode - Provider code
   * @param {string} platform - Platform name
   * @returns {Promise<Object>} Extension info
   */
  async checkForExtension(providerCode, platform) {
    const normalized = this.normalizeProviderCode(providerCode);
    const platformLower = platform.toLowerCase();

    // Check for extension file
    const possiblePaths = [
      path.join(this.providersDir, platformLower, `${this.toExtensionName(normalized)}Extension.js`),
      path.join(this.providersDir, `${this.toExtensionName(normalized)}Scraper.js`),
    ];

    for (const extPath of possiblePaths) {
      try {
        await fs.access(extPath);
        return {
          hasExtension: true,
          extensionPath: extPath,
          extensionName: path.basename(extPath),
        };
      } catch {}
    }

    return { hasExtension: false };
  }

  /**
   * Convert provider code to extension name (PascalCase)
   */
  toExtensionName(code) {
    return code
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Analyze discrepancies to determine if issue is platform-wide or provider-specific
   * @param {string} field - Field with discrepancy
   * @param {Array<string>} affectedProviders - Providers with this issue
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeIssueScope(field, affectedProviders) {
    const map = await this.buildPlatformMap();

    // Group affected providers by platform
    const affectedByPlatform = {};
    for (const provider of affectedProviders) {
      const normalized = this.normalizeProviderCode(provider);
      const platform = map.byProvider[normalized] || 'unknown';

      if (!affectedByPlatform[platform]) {
        affectedByPlatform[platform] = [];
      }
      affectedByPlatform[platform].push(normalized);
    }

    // Determine scope for each platform
    const scopeAnalysis = {};
    for (const [platform, affected] of Object.entries(affectedByPlatform)) {
      const totalOnPlatform = map.byPlatform[platform]?.length || 0;
      const affectedCount = affected.length;
      const affectedRatio = totalOnPlatform > 0 ? affectedCount / totalOnPlatform : 0;

      // Thresholds for determining scope
      const isPlatformWide = affectedRatio >= 0.5 || affectedCount >= 10;
      const isProviderSpecific = affectedRatio < 0.3 && affectedCount <= 3;

      scopeAnalysis[platform] = {
        platform,
        field,
        affectedProviders: affected,
        affectedCount,
        totalProviders: totalOnPlatform,
        affectedRatio,
        scope: isPlatformWide ? 'platform' : isProviderSpecific ? 'provider' : 'mixed',
        recommendation: isPlatformWide
          ? `Fix in ${this.getPlatformScraperName(platform)} (affects ${Math.round(affectedRatio * 100)}% of ${platform} providers)`
          : isProviderSpecific
            ? `Create provider-specific fix for: ${affected.join(', ')}`
            : `Review manually - affects ${affectedCount}/${totalOnPlatform} ${platform} providers`,
        targetFile: isPlatformWide
          ? this.getPlatformScraperPath(platform)
          : affected.length === 1
            ? this.getProviderExtensionPath(affected[0], platform)
            : null,
      };
    }

    // Determine overall recommendation
    const platforms = Object.keys(scopeAnalysis);
    const platformScopes = Object.values(scopeAnalysis);
    const allPlatformWide = platformScopes.every(s => s.scope === 'platform');
    const allProviderSpecific = platformScopes.every(s => s.scope === 'provider');

    return {
      field,
      affectedProviders,
      affectedByPlatform,
      scopeAnalysis,
      overallScope: allPlatformWide
        ? 'platform-wide'
        : allProviderSpecific
          ? 'provider-specific'
          : 'mixed',
      primaryPlatform: platforms.sort((a, b) =>
        (affectedByPlatform[b]?.length || 0) - (affectedByPlatform[a]?.length || 0)
      )[0],
    };
  }

  /**
   * Get platform scraper file name
   */
  getPlatformScraperName(platform) {
    const names = {
      perfectmind: 'PerfectMindScraper.js',
      activenetwork: 'ActiveNetworkScraper.js',
      amilia: 'AmiliaScraper.js',
      ic3: 'IC3Scraper.js',
      webtrac: 'WebTracScraper.js',
      intelligenz: 'IntelligenzScraper.js',
      qidigo: 'QidigoScraper.js',
    };
    return names[platform.toLowerCase()] || `${this.toExtensionName(platform)}Scraper.js`;
  }

  /**
   * Get platform scraper file path
   */
  getPlatformScraperPath(platform) {
    return path.join(this.platformsDir, this.getPlatformScraperName(platform));
  }

  /**
   * Get provider extension file path
   */
  getProviderExtensionPath(provider, platform) {
    const extensionName = `${this.toExtensionName(provider)}Extension.js`;
    return path.join(this.providersDir, platform.toLowerCase(), extensionName);
  }

  /**
   * Generate a fix routing plan based on discrepancies
   * @param {Object} analysis - Discrepancy analysis from DiscrepancyAnalyzer
   * @returns {Promise<Object>} Routing plan
   */
  async generateFixRoutingPlan(analysis) {
    const routingPlan = {
      platformFixes: [], // Fixes to apply to platform scrapers
      providerFixes: [], // Fixes to apply to provider extensions
      manualReview: [], // Issues needing manual review
    };

    // Group patterns by field - include all auto-fixable patterns (missing_field and incorrect_value)
    const fieldPatterns = analysis.patterns.filter(p => p.autoFixable && p.field);

    for (const pattern of fieldPatterns) {
      const scope = await this.analyzeIssueScope(pattern.field, pattern.affectedProviders || []);

      for (const [platform, platformScope] of Object.entries(scope.scopeAnalysis)) {
        if (platformScope.scope === 'platform') {
          routingPlan.platformFixes.push({
            field: pattern.field,
            platform,
            targetFile: platformScope.targetFile,
            affectedProviders: platformScope.affectedProviders,
            affectedRatio: platformScope.affectedRatio,
            samples: pattern.samples?.filter(s =>
              platformScope.affectedProviders.includes(this.normalizeProviderCode(s.provider || ''))
            ),
          });
        } else if (platformScope.scope === 'provider') {
          for (const provider of platformScope.affectedProviders) {
            const extensionInfo = await this.checkForExtension(provider, platform);
            routingPlan.providerFixes.push({
              field: pattern.field,
              platform,
              provider,
              hasExtension: extensionInfo.hasExtension,
              extensionPath: extensionInfo.extensionPath || this.getProviderExtensionPath(provider, platform),
              samples: pattern.samples?.filter(s =>
                this.normalizeProviderCode(s.provider || '') === provider
              ),
            });
          }
        } else {
          routingPlan.manualReview.push({
            field: pattern.field,
            platform,
            scope: platformScope.scope,
            affectedProviders: platformScope.affectedProviders,
            recommendation: platformScope.recommendation,
          });
        }
      }
    }

    return routingPlan;
  }

  /**
   * Print a summary of the fix routing plan
   */
  formatRoutingPlan(plan) {
    const lines = [];

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                      FIX ROUTING PLAN                         ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    if (plan.platformFixes.length > 0) {
      lines.push('PLATFORM-LEVEL FIXES (apply to base scraper):');
      lines.push('───────────────────────────────────────────────────────────────');
      for (const fix of plan.platformFixes) {
        lines.push(`  • ${fix.field} → ${path.basename(fix.targetFile)}`);
        lines.push(`    Platform: ${fix.platform} (${Math.round(fix.affectedRatio * 100)}% affected)`);
        lines.push(`    Providers: ${fix.affectedProviders.slice(0, 5).join(', ')}${fix.affectedProviders.length > 5 ? '...' : ''}`);
        lines.push('');
      }
    }

    if (plan.providerFixes.length > 0) {
      lines.push('PROVIDER-SPECIFIC FIXES (apply to extensions):');
      lines.push('───────────────────────────────────────────────────────────────');
      for (const fix of plan.providerFixes) {
        const status = fix.hasExtension ? 'exists' : 'CREATE NEW';
        lines.push(`  • ${fix.field} → ${fix.provider} (${fix.platform})`);
        lines.push(`    Extension: ${path.basename(fix.extensionPath)} [${status}]`);
        lines.push('');
      }
    }

    if (plan.manualReview.length > 0) {
      lines.push('NEEDS MANUAL REVIEW:');
      lines.push('───────────────────────────────────────────────────────────────');
      for (const item of plan.manualReview) {
        lines.push(`  • ${item.field} on ${item.platform}`);
        lines.push(`    ${item.recommendation}`);
        lines.push('');
      }
    }

    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

module.exports = PlatformAnalyzer;
