const { PrismaClient } = require('@prisma/client');
const NVRCComprehensiveScraper = require('./scrapers/nvrcComprehensiveScraper');

const prisma = new PrismaClient();

async function runComprehensiveScraper() {
  console.log('🚀 Starting NVRC Comprehensive Scraper Job...');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  
  try {
    // Initialize the scraper with production settings
    const scraper = new NVRCComprehensiveScraper({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ]
    });
    
    // Run the scraper
    console.log('\n📊 Running comprehensive scraper...');
    const activities = await scraper.scrape();
    
    console.log(`\n✅ Scraper completed. Found ${activities.length} unique activities`);
    
    if (activities.length === 0) {
      console.error('⚠️ WARNING: No activities found! Database will not be updated.');
      return;
    }
    
    // Update database
    console.log('\n💾 Updating database...');
    
    // Get all current activities
    const currentActivities = await prisma.activity.findMany({
      where: { organizationId: 'nvrc' }
    });
    
    console.log(`📊 Current activities in database: ${currentActivities.length}`);
    
    // Create maps for efficient lookups
    const currentActivitiesMap = new Map();
    currentActivities.forEach(activity => {
      // Use externalId (courseId) as the key
      if (activity.externalId) {
        currentActivitiesMap.set(activity.externalId, activity);
      }
    });
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    // Process each scraped activity
    for (const activity of activities) {
      try {
        // Use courseId as the unique identifier
        const externalId = activity.courseId || activity.id;
        const existingActivity = currentActivitiesMap.get(externalId);
        
        // Prepare activity data
        const activityData = {
          name: activity.name || 'Unnamed Activity',
          organizationId: 'nvrc',
          externalId: externalId,
          category: activity.category || 'General',
          subcategory: activity.ageInfo || null,
          description: [
            activity.name,
            activity.time,
            activity.location,
            activity.ageInfo,
            activity.price ? `$${activity.price}` : null,
            `Status: ${activity.status || 'open'}`
          ].filter(Boolean).join('\n'),
          location: activity.location || 'TBD',
          dates: activity.date || activity.time || 'Ongoing',
          times: activity.time || 'Various',
          price: activity.price ? `$${activity.price}` : 'Contact for pricing',
          registrationRequired: true,
          registrationUrl: activity.registrationUrl || 'https://www.nvrc.ca/programs-memberships/find-program',
          ageRange: activity.ageInfo || 'All Ages',
          tags: [
            activity.category,
            activity.status || 'open',
            activity.location
          ].filter(Boolean),
          isActive: activity.status !== 'closed',
          lastScraped: new Date(),
          rawData: activity
        };
        
        if (existingActivity) {
          // Update existing activity
          await prisma.activity.update({
            where: { id: existingActivity.id },
            data: activityData
          });
          updated++;
        } else {
          // Create new activity
          await prisma.activity.create({
            data: activityData
          });
          created++;
        }
        
        // Remove from map so we can track what needs to be marked inactive
        currentActivitiesMap.delete(externalId);
        
      } catch (error) {
        console.error(`❌ Error processing activity ${activity.name}:`, error.message);
        errors++;
      }
    }
    
    // Mark remaining activities as inactive (they weren't found in the latest scrape)
    const toMarkInactive = Array.from(currentActivitiesMap.values());
    if (toMarkInactive.length > 0 && activities.length > 100) {
      // Only mark inactive if we found a substantial number of activities
      // This prevents marking everything inactive if the scraper fails
      console.log(`\n📝 Marking ${toMarkInactive.length} activities as inactive...`);
      
      await prisma.activity.updateMany({
        where: {
          id: {
            in: toMarkInactive.map(a => a.id)
          }
        },
        data: {
          isActive: false,
          lastScraped: new Date()
        }
      });
    }
    
    console.log('\n📊 Database update complete:');
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📝 Marked inactive: ${toMarkInactive.length}`);
    
    // Get final count
    const finalCount = await prisma.activity.count({
      where: { 
        organizationId: 'nvrc',
        isActive: true
      }
    });
    
    console.log(`\n📊 Total active NVRC activities in database: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Job failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the job
runComprehensiveScraper()
  .then(() => {
    console.log('\n✅ Job completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Job failed:', error);
    process.exit(1);
  });