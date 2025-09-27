const { PrismaClient } = require('../../generated/prisma');
const ScraperFactory = require('../scrapers/base/ScraperFactory');

/**
 * Service for managing provider configurations and scraper settings
 */
class ProviderConfigService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all provider configurations
   * @param {Boolean} activeOnly - Only return active providers
   * @returns {Promise<Array>} Provider configurations
   */
  async getAllConfigurations(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};
    
    const providers = await this.prisma.provider.findMany({
      where,
      include: {
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return providers.map(provider => this.formatProviderConfig(provider));
  }

  /**
   * Get provider configuration by code
   * @param {String} code - Provider code
   * @returns {Promise<Object|null>} Provider configuration
   */
  async getConfigurationByCode(code) {
    const provider = await this.prisma.provider.findFirst({
      where: { 
        OR: [
          { name: { contains: code, mode: 'insensitive' } },
          { website: { contains: code, mode: 'insensitive' } }
        ]
      },
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });

    return provider ? this.formatProviderConfig(provider) : null;
  }

  /**
   * Get provider configuration by ID
   * @param {String} id - Provider ID
   * @returns {Promise<Object|null>} Provider configuration
   */
  async getConfigurationById(id) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });

    return provider ? this.formatProviderConfig(provider) : null;
  }

  /**
   * Create new provider configuration
   * @param {Object} config - Provider configuration
   * @returns {Promise<Object>} Created provider configuration
   */
  async createConfiguration(config) {
    // Validate configuration
    const validation = ScraperFactory.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Check if provider with same name already exists
    const existing = await this.prisma.provider.findFirst({
      where: { name: config.name }
    });

    if (existing) {
      throw new Error(`Provider with name "${config.name}" already exists`);
    }

    // Create provider record
    const provider = await this.prisma.provider.create({
      data: {
        name: config.name,
        website: config.baseUrl,
        scraperConfig: {
          code: config.code,
          platform: config.platform,
          baseUrl: config.baseUrl,
          scraperConfig: config.scraperConfig,
          fieldMappings: config.fieldMappings || {},
          isActive: config.isActive !== false
        },
        isActive: config.isActive !== false
      },
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });

    console.log(`✅ Created provider configuration: ${provider.name}`);
    return this.formatProviderConfig(provider);
  }

  /**
   * Update provider configuration
   * @param {String} id - Provider ID
   * @param {Object} updates - Configuration updates
   * @returns {Promise<Object>} Updated provider configuration
   */
  async updateConfiguration(id, updates) {
    const existing = await this.prisma.provider.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new Error(`Provider with ID "${id}" not found`);
    }

    // Merge existing scraper config with updates
    const currentConfig = existing.scraperConfig || {};
    const updatedConfig = {
      ...currentConfig,
      ...updates
    };

    // Validate updated configuration
    const validation = ScraperFactory.validateConfiguration(updatedConfig);
    if (!validation.isValid) {
      console.warn(`Configuration warnings: ${validation.warnings.join(', ')}`);
    }

    // Update provider record
    const provider = await this.prisma.provider.update({
      where: { id },
      data: {
        name: updates.name || existing.name,
        website: updates.baseUrl || existing.website,
        scraperConfig: updatedConfig,
        isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
        updatedAt: new Date()
      },
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });

    console.log(`✅ Updated provider configuration: ${provider.name}`);
    return this.formatProviderConfig(provider);
  }

  /**
   * Delete provider configuration (soft delete - mark as inactive)
   * @param {String} id - Provider ID
   * @returns {Promise<Boolean>} Success status
   */
  async deleteConfiguration(id) {
    const provider = await this.prisma.provider.findUnique({
      where: { id }
    });

    if (!provider) {
      throw new Error(`Provider with ID "${id}" not found`);
    }

    // Soft delete - mark as inactive
    await this.prisma.provider.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    // Also deactivate all activities from this provider
    await this.prisma.activity.updateMany({
      where: { providerId: id },
      data: { isActive: false }
    });

    console.log(`✅ Deactivated provider: ${provider.name}`);
    return true;
  }

  /**
   * Test provider configuration by creating a scraper instance
   * @param {String} id - Provider ID
   * @returns {Promise<Object>} Test results
   */
  async testConfiguration(id) {
    const config = await this.getConfigurationById(id);
    if (!config) {
      throw new Error(`Provider with ID "${id}" not found`);
    }

    try {
      // Test configuration with ScraperFactory
      const testResult = await ScraperFactory.testConfiguration(config);
      
      // Update last tested timestamp
      await this.prisma.provider.update({
        where: { id },
        data: { 
          scraperConfig: {
            ...config,
            lastTested: new Date().toISOString()
          }
        }
      });

      return testResult;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get provider statistics
   * @param {String} id - Provider ID
   * @returns {Promise<Object>} Provider statistics
   */
  async getProviderStatistics(id) {
    const [
      activityCounts,
      recentActivities,
      lastScrapeJob
    ] = await Promise.all([
      // Activity counts by status
      this.prisma.activity.groupBy({
        by: ['isActive'],
        where: { providerId: id },
        _count: { id: true }
      }),
      
      // Recent activities
      this.prisma.activity.findMany({
        where: { providerId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          name: true,
          category: true,
          cost: true,
          createdAt: true,
          isActive: true
        }
      }),
      
      // Last scrape job
      this.prisma.scrapeJob.findFirst({
        where: { providerId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          completedAt: true,
          activitiesFound: true,
          activitiesCreated: true,
          activitiesUpdated: true,
          errorMessage: true
        }
      })
    ]);

    const stats = {
      totalActivities: 0,
      activeActivities: 0,
      inactiveActivities: 0
    };

    activityCounts.forEach(count => {
      if (count.isActive) {
        stats.activeActivities = count._count.id;
      } else {
        stats.inactiveActivities = count._count.id;
      }
      stats.totalActivities += count._count.id;
    });

    return {
      ...stats,
      recentActivities,
      lastScrapeJob
    };
  }

  /**
   * Get default configuration template for platform
   * @param {String} platform - Platform name
   * @returns {Object} Default configuration template
   */
  getDefaultConfiguration(platform) {
    return ScraperFactory.getDefaultConfiguration(platform);
  }

  /**
   * Get supported platforms
   * @returns {Array} Supported platform names
   */
  getSupportedPlatforms() {
    return ScraperFactory.getSupportedPlatforms();
  }

  /**
   * Bulk update provider configurations
   * @param {Array} updates - Array of {id, config} objects
   * @returns {Promise<Array>} Results of updates
   */
  async bulkUpdateConfigurations(updates) {
    const results = [];

    for (const update of updates) {
      try {
        const result = await this.updateConfiguration(update.id, update.config);
        results.push({ success: true, id: update.id, result });
      } catch (error) {
        results.push({ success: false, id: update.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Export provider configurations
   * @param {Array} ids - Provider IDs to export (empty for all)
   * @returns {Promise<Array>} Exported configurations
   */
  async exportConfigurations(ids = []) {
    const where = ids.length > 0 ? { id: { in: ids } } : { isActive: true };
    
    const providers = await this.prisma.provider.findMany({
      where,
      select: {
        name: true,
        website: true,
        scraperConfig: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return providers.map(provider => ({
      ...provider.scraperConfig,
      name: provider.name,
      baseUrl: provider.website,
      isActive: provider.isActive,
      exported: new Date().toISOString()
    }));
  }

  /**
   * Import provider configurations
   * @param {Array} configs - Configurations to import
   * @returns {Promise<Object>} Import results
   */
  async importConfigurations(configs) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const config of configs) {
      try {
        // Check if provider already exists
        const existing = await this.prisma.provider.findFirst({
          where: { name: config.name }
        });

        if (existing) {
          // Update existing
          await this.updateConfiguration(existing.id, config);
        } else {
          // Create new
          await this.createConfiguration(config);
        }
        
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          config: config.name,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Format provider record to configuration object
   * @param {Object} provider - Provider record from database
   * @returns {Object} Formatted configuration
   */
  formatProviderConfig(provider) {
    const config = provider.scraperConfig || {};
    
    return {
      id: provider.id,
      name: provider.name,
      code: config.code || provider.name.toLowerCase().replace(/\s+/g, ''),
      platform: config.platform,
      baseUrl: provider.website || config.baseUrl,
      scraperConfig: config.scraperConfig || {},
      fieldMappings: config.fieldMappings || {},
      isActive: provider.isActive,
      activityCount: provider._count?.activities || 0,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      lastTested: config.lastTested
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.prisma.$disconnect();
  }
}

module.exports = ProviderConfigService;