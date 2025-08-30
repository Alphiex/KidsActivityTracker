const ScraperFactory = require('./scrapers/base/ScraperFactory');
const NVRCScraper = require('./scrapers/providers/NVRCScraper');
const WestVancouverScraper = require('./scrapers/providers/WestVancouverScraper');
const { PrismaClient } = require('./generated/prisma');
const { mapActivityType } = require('./utils/activityTypeMapper');

/**
 * Production multi-provider scraper orchestration
 * This script runs all configured scrapers and saves results to the database
 */
class MultiProviderScraperOrchestrator {
  constructor() {
    this.prisma = new PrismaClient();
    this.results = {
      startTime: new Date(),
      providers: [],
      totalActivities: 0,
      errors: [],
      success: true
    };
  }

  /**
   * Main orchestration method
   */
  async run() {
    console.log('🚀 Multi-Provider Scraper Orchestrator');
    console.log('=====================================');
    console.log(`🕐 Started at: ${this.results.startTime.toISOString()}`);
    console.log('');

    try {
      // Get all active provider configurations
      const providerConfigs = this.getActiveProviderConfigs();
      console.log(`📋 Found ${providerConfigs.length} active providers to scrape:`);
      
      providerConfigs.forEach((config, idx) => {
        console.log(`   ${idx + 1}. ${config.name} (${config.platform})`);
      });
      console.log('');

      // Run migration if needed
      await this.ensureDatabaseSetup();

      // Scrape each provider
      for (const config of providerConfigs) {
        await this.scrapeProvider(config);
      }

      // Generate final report
      await this.generateReport();

    } catch (error) {
      console.error('❌ Multi-provider scraping failed:', error);
      this.results.success = false;
      this.results.errors.push(error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Get all active provider configurations
   * @returns {Array} Provider configurations
   */
  getActiveProviderConfigs() {
    return [
      {
        ...NVRCScraper.getDefaultConfig(),
        priority: 1,
        enabled: true
      },
      {
        ...WestVancouverScraper.getDefaultConfig(),
        priority: 2,
        enabled: true
      }
    ].filter(config => config.enabled);
  }

  /**
   * Ensure database schema is up to date
   */
  async ensureDatabaseSetup() {
    console.log('🔧 Checking database setup...');
    
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection verified');

      // Check if provider enhancements are installed
      const tableExists = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'ProviderMetrics'
        );
      `;
      
      if (!tableExists[0].exists) {
        console.log('⚠️  Provider enhancements not detected');
        console.log('   Run: node run-provider-enhancements.js');
        console.log('   Proceeding without advanced metrics...');
      } else {
        console.log('✅ Provider enhancements detected');
      }

    } catch (error) {
      console.log('⚠️  Database setup check failed:', error.message);
      console.log('   Proceeding with limited functionality...');
    }
  }

  /**
   * Scrape a single provider
   * @param {Object} config - Provider configuration
   */
  async scrapeProvider(config) {
    console.log(`\n🔄 Scraping ${config.name}...`);
    console.log('================================');
    
    const startTime = Date.now();
    const result = {
      provider: config.name,
      platform: config.platform,
      startTime: new Date(),
      activities: [],
      errors: [],
      success: false
    };

    try {
      // Create scraper using factory
      const scraper = ScraperFactory.createScraper(config);
      console.log(`📋 Created ${scraper.constructor.name}`);

      // Validate configuration
      const validation = ScraperFactory.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
      console.log('✅ Configuration validated');

      // Run the scraper
      console.log('🌐 Starting web scraping...');
      const scraperResult = await scraper.scrape();
      
      result.activities = scraperResult.activities || [];
      result.success = true;
      result.duration = (Date.now() - startTime) / 1000;

      console.log(`✅ Scraping completed successfully`);
      console.log(`📊 Found ${result.activities.length} activities`);
      console.log(`⏱️  Duration: ${result.duration.toFixed(1)} seconds`);

      // Save to database if activities were found
      if (result.activities.length > 0) {
        await this.saveActivitiesForProvider(result.activities, config);
        console.log('💾 Activities saved to database');
      }

      // Record metrics if available
      await this.recordProviderMetrics(config, result);

    } catch (error) {
      console.error(`❌ Error scraping ${config.name}:`, error.message);
      result.errors.push(error.message);
      result.success = false;
      result.duration = (Date.now() - startTime) / 1000;
      
      // Record health check
      await this.recordHealthCheck(config, 'error', error.message);
    }

    this.results.providers.push(result);
    this.results.totalActivities += result.activities.length;
  }

  /**
   * Save activities for a provider
   * @param {Array} activities - Activities to save
   * @param {Object} config - Provider configuration
   */
  async saveActivitiesForProvider(activities, config) {
    try {
      // Find or create provider
      let provider = await this.prisma.provider.findFirst({
        where: { name: config.name }
      });

      if (!provider) {
        provider = await this.prisma.provider.create({
          data: {
            name: config.name,
            platform: config.platform,
            region: config.region || 'Unknown',
            isActive: true
          }
        });
        console.log(`📝 Created new provider: ${provider.name}`);
      }

      // Prepare activities for database insertion with type mapping
      const activitiesData = [];
      for (const activity of activities) {
        // Get activity type and subtype mappings
        const { activityTypeId, activitySubtypeId } = await mapActivityType(activity);
        
        activitiesData.push({
          name: activity.name,
          externalId: activity.courseId || activity.categoryId,
          category: activity.category || activity.section,
          subcategory: activity.subcategory || activity.activitySection,
          activityTypeId: activityTypeId,  // Add type mapping
          activitySubtypeId: activitySubtypeId,  // Add subtype mapping
          description: activity.fullDescription,
          cost: activity.cost,
          schedule: activity.schedule || this.formatSchedule(activity),
          locationName: activity.locationName || activity.location,
          ageMin: activity.ageMin,
          ageMax: activity.ageMax,
          dateStart: activity.dateStart ? new Date(activity.dateStart) : null,
          dateEnd: activity.dateEnd ? new Date(activity.dateEnd) : null,
          spotsAvailable: activity.spotsAvailable,
          registrationUrl: activity.registrationUrl,
          providerId: provider.id,
          isActive: true,
          lastSeenAt: new Date()
        });
      }

      // Use upsert to handle duplicates
      let savedCount = 0;
      for (const activityData of activitiesData) {
        if (activityData.externalId) {
          await this.prisma.activity.upsert({
            where: {
              providerId_externalId: {
                providerId: provider.id,
                externalId: activityData.externalId
              }
            },
            update: {
              ...activityData,
              lastSeenAt: new Date()
            },
            create: activityData
          });
          savedCount++;
        }
      }

      console.log(`💾 Saved ${savedCount} activities for ${config.name}`);

    } catch (error) {
      console.error(`❌ Error saving activities for ${config.name}:`, error.message);
    }
  }

  /**
   * Record provider metrics
   * @param {Object} config - Provider configuration
   * @param {Object} result - Scraping result
   */
  async recordProviderMetrics(config, result) {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { name: config.name }
      });

      if (provider) {
        const dataQualityScore = this.calculateDataQuality(result.activities);
        
        await this.prisma.providerMetrics.create({
          data: {
            providerId: provider.id,
            scrapeDate: new Date().toISOString().split('T')[0],
            activitiesFound: result.activities.length,
            activitiesProcessed: result.activities.length,
            dataQualityScore: dataQualityScore,
            scrapeDuration: Math.round(result.duration),
            errors: result.errors.length > 0 ? { errors: result.errors } : null
          }
        });

        console.log(`📊 Recorded metrics for ${config.name}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not record metrics for ${config.name}:`, error.message);
    }
  }

  /**
   * Record health check
   * @param {Object} config - Provider configuration
   * @param {String} status - Health status
   * @param {String} message - Status message
   */
  async recordHealthCheck(config, status, message) {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { name: config.name }
      });

      if (provider) {
        await this.prisma.scraperHealthCheck.create({
          data: {
            providerId: provider.id,
            status: status,
            message: message,
            details: { timestamp: new Date().toISOString() }
          }
        });
      }
    } catch (error) {
      console.log(`⚠️  Could not record health check: ${error.message}`);
    }
  }

  /**
   * Calculate data quality score
   * @param {Array} activities - Activities to analyze
   * @returns {Number} Quality score (0-1)
   */
  calculateDataQuality(activities) {
    if (activities.length === 0) return 0;

    const requiredFields = ['name', 'cost', 'locationName', 'ageMin', 'ageMax'];
    let totalScore = 0;

    activities.forEach(activity => {
      let activityScore = 0;
      requiredFields.forEach(field => {
        if (activity[field] !== null && activity[field] !== undefined) {
          activityScore += 0.2; // Each field worth 20%
        }
      });
      totalScore += activityScore;
    });

    return Math.round((totalScore / activities.length) * 100) / 100;
  }

  /**
   * Format schedule from activity data
   * @param {Object} activity - Activity object
   * @returns {String} Formatted schedule
   */
  formatSchedule(activity) {
    const parts = [];
    
    if (activity.daysOfWeek && activity.daysOfWeek.length > 0) {
      parts.push(activity.daysOfWeek.join(', '));
    }
    
    if (activity.time) {
      parts.push(activity.time);
    } else if (activity.startTime && activity.endTime) {
      parts.push(`${activity.startTime} - ${activity.endTime}`);
    }
    
    return parts.join(' ') || null;
  }

  /**
   * Generate final report
   */
  async generateReport() {
    console.log('\n🎊 Multi-Provider Scraping Complete!');
    console.log('====================================');
    
    const endTime = new Date();
    const totalDuration = (endTime - this.results.startTime) / 1000;
    
    console.log(`🕐 Completed at: ${endTime.toISOString()}`);
    console.log(`⏱️  Total duration: ${totalDuration.toFixed(1)} seconds`);
    console.log(`📋 Providers processed: ${this.results.providers.length}`);
    console.log(`📊 Total activities found: ${this.results.totalActivities}`);
    
    const successfulProviders = this.results.providers.filter(p => p.success).length;
    console.log(`✅ Success rate: ${(successfulProviders / this.results.providers.length * 100).toFixed(1)}%`);
    
    console.log('\n📋 Provider Summary:');
    this.results.providers.forEach(provider => {
      const status = provider.success ? '✅' : '❌';
      console.log(`   ${status} ${provider.provider}`);
      console.log(`      Platform: ${provider.platform}`);
      console.log(`      Activities: ${provider.activities.length}`);
      console.log(`      Duration: ${provider.duration?.toFixed(1) || '0'}s`);
      if (provider.errors.length > 0) {
        console.log(`      Errors: ${provider.errors.length}`);
      }
    });

    if (this.results.errors.length > 0) {
      console.log('\n⚠️  Global Errors:');
      this.results.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }

    console.log('\n🚀 Multi-provider scraping orchestration completed!');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.prisma.$disconnect();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.log('⚠️  Cleanup error:', error.message);
    }
  }
}

// CLI support
async function runCLI() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    provider: args.find(arg => arg.startsWith('--provider='))?.split('=')[1]
  };

  if (args.includes('--help')) {
    console.log(`
Multi-Provider Scraper Orchestrator

Usage: node run-multi-provider-scrapers.js [options]

Options:
  --dry-run         Run in simulation mode (no database writes)
  --verbose         Enable verbose logging
  --provider=NAME   Run only the specified provider
  --help            Show this help message

Examples:
  node run-multi-provider-scrapers.js
  node run-multi-provider-scrapers.js --dry-run
  node run-multi-provider-scrapers.js --provider=NVRC
`);
    process.exit(0);
  }

  if (options.dryRun) {
    console.log('🧪 Running in DRY RUN mode - no database changes will be made');
    console.log('');
  }

  const orchestrator = new MultiProviderScraperOrchestrator();
  
  try {
    await orchestrator.run();
    console.log('\n✅ All scrapers completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Scraping orchestration failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runCLI();
}

module.exports = { MultiProviderScraperOrchestrator };