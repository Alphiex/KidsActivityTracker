const { PrismaClient } = require('./generated/prisma');
const NVRCDetailedRegistrationScraper = require('./scrapers/nvrcDetailedRegistrationScraper');
const activityService = require('./database/services/activityService');
const providerService = require('./database/services/providerService');
const scrapeJobService = require('./database/services/scrapeJobService');

const prisma = new PrismaClient();

async function runDetailedCloudScraper() {
  let scrapeJob = null;
  const startTime = new Date();
  
  console.log('🚀 Starting NVRC Detailed Registration Scraper Job...');
  console.log(`📅 Time: ${startTime.toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`💾 Database URL: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  
  try {
    // Ensure NVRC provider exists
    const provider = await providerService.upsertProvider({
      name: 'NVRC',
      website: 'https://www.nvrc.ca',
      scraperConfig: {
        type: 'detailed-registration-puppeteer',
        url: 'https://www.nvrc.ca/programs-memberships/find-program'
      }
    });
    
    console.log('✅ Provider ready:', provider.name);
    
    // Create scrape job record
    scrapeJob = await scrapeJobService.createJob(provider.id, 'detailed-registration');
    
    // Initialize the scraper with cloud-optimized settings
    const scraper = new NVRCDetailedRegistrationScraper({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      detailPageTimeout: 45000 // Increase timeout for cloud environment
    });
    
    // Run the scraper
    console.log('\n📊 Running detailed registration scraper...');
    const result = await scraper.scrape();
    
    console.log(`\n✅ Scraper completed. Found ${result.count} activities with detailed information`);
    
    if (result.activities.length === 0) {
      console.error('⚠️ WARNING: No activities found!');
      await scrapeJobService.failJob(scrapeJob.id, 'No activities found');
      return;
    }
    
    if (result.activities.length < 100) {
      console.warn(`⚠️ WARNING: Only found ${result.activities.length} activities. Expected 1000+.`);
      console.log('Continuing with import despite low count...');
    }
    
    // Log enhanced data statistics
    const sessionsCount = result.activities.filter(a => a.sessions && a.sessions.length > 0).length;
    const multiSessionCount = result.activities.filter(a => a.hasMultipleSessions).length;
    const prereqCount = result.activities.filter(a => a.hasPrerequisites).length;
    const enhancedCount = result.activities.filter(a => 
      a.instructor || a.fullDescription || a.whatToBring
    ).length;
    
    console.log('\n📊 Enhanced Data Statistics:');
    console.log(`   - Activities with sessions: ${sessionsCount}`);
    console.log(`   - Multi-session activities: ${multiSessionCount}`);
    console.log(`   - Activities with prerequisites: ${prereqCount}`);
    console.log(`   - Activities with enhanced details: ${enhancedCount}`);
    
    // Update database using activity service
    console.log('\n💾 Updating database with enhanced activity data...');
    
    // Transform activities to match service format
    const transformedActivities = result.activities.map(activity => ({
      // Basic fields
      id: activity.courseId || activity.id,
      name: activity.name,
      category: activity.category,
      subcategory: activity.subcategory,
      description: activity.alert || activity.description,
      location: activity.location,
      schedule: activity.schedule,
      dates: activity.dates,
      ageRange: activity.ageRange,
      cost: activity.cost,
      spotsAvailable: activity.spotsAvailable,
      
      // Registration info
      courseId: activity.courseId,
      registrationUrl: activity.registrationUrl,
      registrationStatus: activity.registrationStatus,
      registrationButtonText: activity.registrationButtonText,
      detailUrl: activity.detailUrl,
      
      // Enhanced fields from registration page
      instructor: activity.instructor,
      fullDescription: activity.fullDescription,
      whatToBring: activity.whatToBring,
      fullAddress: activity.fullAddress,
      latitude: activity.latitude,
      longitude: activity.longitude,
      directRegistrationUrl: activity.directRegistrationUrl,
      contactInfo: activity.contactInfo,
      
      // New fields
      sessions: activity.sessions,
      prerequisites: activity.prerequisites,
      hasMultipleSessions: activity.hasMultipleSessions,
      sessionCount: activity.sessionCount,
      hasPrerequisites: activity.hasPrerequisites,
      
      // Date range if available
      dateRange: activity.dateRange,
      registrationDate: activity.registrationDate
    }));
    
    const updateResult = await activityService.upsertActivities(
      transformedActivities,
      provider.id
    );
    
    console.log('\n✅ Database update completed:');
    console.log(`   - Created: ${updateResult.created}`);
    console.log(`   - Updated: ${updateResult.updated}`);
    console.log(`   - Deactivated: ${updateResult.deactivated}`);
    console.log(`   - Errors: ${updateResult.errors.length}`);
    
    if (updateResult.errors.length > 0) {
      console.error('\n❌ Errors encountered:');
      updateResult.errors.slice(0, 5).forEach(error => {
        console.error(`   - Activity ${error.activityId}: ${error.error}`);
      });
      if (updateResult.errors.length > 5) {
        console.error(`   ... and ${updateResult.errors.length - 5} more errors`);
      }
    }
    
    // Complete the job
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    await scrapeJobService.completeJob(scrapeJob.id, {
      activitiesFound: result.activities.length,
      activitiesCreated: updateResult.created,
      activitiesUpdated: updateResult.updated,
      activitiesDeactivated: updateResult.deactivated,
      errors: updateResult.errors.length,
      duration,
      enhancedStats: {
        sessionsCount,
        multiSessionCount,
        prereqCount,
        enhancedCount
      }
    });
    
    console.log(`\n🎉 Job completed successfully in ${duration} seconds`);
    
    // Save raw data for backup/debugging
    if (process.env.SAVE_RAW_DATA === 'true') {
      const filename = result.filename || `nvrc_detailed_${new Date().toISOString().split('T')[0]}.json`;
      console.log(`💾 Raw data saved to: ${filename}`);
    }
    
  } catch (error) {
    console.error('\n❌ Scraper job failed:', error);
    
    if (scrapeJob) {
      await scrapeJobService.failJob(scrapeJob.id, error.message);
    }
    
    // Re-throw the error to ensure proper exit code
    throw error;
    
  } finally {
    // Ensure database connection is closed
    await prisma.$disconnect();
  }
}

// Execute the scraper job
runDetailedCloudScraper()
  .then(() => {
    console.log('\n✅ Scraper job finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Scraper job failed:', error);
    process.exit(1);
  });