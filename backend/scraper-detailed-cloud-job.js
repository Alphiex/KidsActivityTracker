const { PrismaClient } = require('./generated/prisma');
const NVRCEnhancedParallelScraper = require('./scrapers/nvrcEnhancedParallelScraper');
const { extractComprehensiveDetails } = require('./scrapers/nvrcComprehensiveDetailScraper');
const activityService = require('./database/services/activityService');
const providerService = require('./database/services/providerService');
const scrapeJobService = require('./database/services/scrapeJobService');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

async function fetchDetailedInfo(activities) {
  console.log(`🔍 Enhancing ${activities.length} activities with detailed information...`);
  
  let browser;
  const enhanced = [];
  const batchSize = 5;
  
  try {
    browser = await puppeteer.launch({
      headless: process.env.NODE_ENV === 'production' ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
    
    for (let i = 0; i < activities.length; i += batchSize) { // Process all activities
      const batch = activities.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}...`);
      
      const batchResults = await Promise.all(
        batch.map(async (activity) => {
          if (!activity.registrationUrl && !activity.detailUrl) {
            return activity;
          }
          
          const page = await browser.newPage();
          try {
            const url = activity.registrationUrl || activity.detailUrl;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Extract detailed information using the comprehensive extractor
            const details = await extractComprehensiveDetails(page);
            
            await page.close();
            
            return {
              ...activity,
              // Use the properly extracted dates from the detail page
              startDate: details.startDate || activity.startDate,
              endDate: details.endDate || activity.endDate,
              startTime: details.startTime || activity.startTime,
              endTime: details.endTime || activity.endTime,
              sessions: details.sessions || [],
              prerequisites: details.prerequisites || [],
              instructor: details.instructor,
              fullDescription: details.fullDescription,
              whatToBring: details.whatToBring,
              hasMultipleSessions: details.sessions.length > 1,
              sessionCount: details.sessions.length,
              hasPrerequisites: details.prerequisites.length > 0
            };
          } catch (error) {
            console.warn(`Failed to fetch details for ${activity.name}:`, error.message);
            await page.close();
            return activity;
          }
        })
      );
      
      enhanced.push(...batchResults);
    }
  } finally {
    if (browser) await browser.close();
  }
  
  console.log(`✅ Enhanced ${enhanced.length} activities with detailed information`);
  return enhanced;
}

async function updateSchema() {
  console.log('🔄 Checking and updating database schema...');
  
  try {
    // Create ActivitySession table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivitySession" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "activityId" TEXT NOT NULL,
        "sessionNumber" INTEGER,
        "date" TEXT,
        "startTime" TEXT,
        "endTime" TEXT,
        "location" TEXT,
        "instructor" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('✅ ActivitySession table ready');

    // Create ActivityPrerequisite table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityPrerequisite" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "activityId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "url" TEXT,
        "courseId" TEXT,
        "isRequired" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ActivityPrerequisite_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('✅ ActivityPrerequisite table ready');

    // Add foreign key constraints
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivitySession_activityId_fkey') THEN
          ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_activityId_fkey" 
            FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityPrerequisite_activityId_fkey') THEN
          ALTER TABLE "ActivityPrerequisite" ADD CONSTRAINT "ActivityPrerequisite_activityId_fkey" 
            FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ActivitySession_activityId_idx" ON "ActivitySession"("activityId");
      CREATE INDEX IF NOT EXISTS "ActivitySession_date_idx" ON "ActivitySession"("date");
      CREATE INDEX IF NOT EXISTS "ActivityPrerequisite_activityId_idx" ON "ActivityPrerequisite"("activityId");
    `);

    // Add new fields to Activity table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasMultipleSessions" BOOLEAN DEFAULT false;
      ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "sessionCount" INTEGER DEFAULT 0;
      ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasPrerequisites" BOOLEAN DEFAULT false;
    `);
    
    console.log('✅ Schema update completed successfully');
  } catch (error) {
    console.error('⚠️ Schema update error (may be normal if already exists):', error.message);
  }
}

async function runDetailedCloudScraper() {
  let scrapeJob = null;
  const startTime = new Date();
  
  console.log('🚀 Starting NVRC Detailed Registration Scraper Job...');
  console.log(`📅 Time: ${startTime.toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`💾 Database URL: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  
  try {
    // Update schema first
    await updateSchema();
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
    
    // Initialize the enhanced parallel scraper with cloud-optimized settings
    const isProduction = process.env.NODE_ENV === 'production';
    const scraper = new NVRCEnhancedParallelScraper({
      headless: isProduction,
      maxConcurrency: 5,  // Use 5 parallel browsers
      timeout: 20 * 60 * 1000  // 20 minutes timeout
    });
    
    // Run the enhanced scraper (it handles detail fetching internally)
    console.log('\n📊 Running enhanced parallel scraper...');
    const scraperResult = await scraper.scrape();
    const activities = scraperResult.activities || [];
    
    console.log(`\n✅ Enhanced scraper completed. Found ${activities.length} activities`);
    
    if (activities.length === 0) {
      console.error('⚠️ WARNING: No activities found!');
      await scrapeJobService.failJob(scrapeJob.id, 'No activities found');
      return;
    }
    
    // The enhanced scraper already saved to database and provides stats
    const stats = scraperResult.stats || {};
    console.log('\n📊 Database Update Statistics:');
    console.log(`   - Created: ${stats.created || 0}`);
    console.log(`   - Updated: ${stats.updated || 0}`);
    console.log(`   - Removed: ${stats.removed || 0}`);
    console.log(`   - Unchanged: ${stats.unchanged || 0}`);
    
    // Complete the job
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    await scrapeJobService.completeJob(scrapeJob.id, {
      activitiesFound: activities.length,
      activitiesCreated: stats.created || 0,
      activitiesUpdated: stats.updated || 0,
      activitiesDeactivated: stats.removed || 0,
      errors: 0,
      duration,
      enhancedStats: scraperResult.stats
    });
    
    console.log(`\n🎉 Job completed successfully in ${duration} seconds`);
    
    // Save raw data for backup/debugging
    if (process.env.SAVE_RAW_DATA === 'true') {
      const filename = `nvrc_enhanced_activities_${new Date().toISOString().split('T')[0]}.json`;
      require('fs').writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        activitiesCount: activities.length,
        enhancedStats: scraperResult.stats,
        activities: activities
      }, null, 2));
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