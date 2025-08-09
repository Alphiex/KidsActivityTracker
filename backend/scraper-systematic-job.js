const { PrismaClient } = require('./generated/prisma');
const NVRCSystematicScraper = require('./scrapers/nvrcSystematicScraper');

const prisma = new PrismaClient();

async function runSystematicScraper() {
  console.log('🚀 Starting NVRC Systematic Scraper Job...');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🔧 Puppeteer path: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'default'}`);
  
  try {
    // Initialize the scraper
    const scraper = new NVRCSystematicScraper({
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
    console.log('\n📊 Running systematic scraper...');
    const activities = await scraper.scrape();
    
    console.log(`\n✅ Scraper completed. Found ${activities.length} unique activities`);
    
    if (activities.length === 0) {
      console.error('⚠️ WARNING: No activities found! This might indicate a scraping issue.');
      
      // Don't update database if no activities found
      // This prevents accidentally clearing all activities
      return;
    }
    
    // Only update database if we found a reasonable number of activities
    if (activities.length < 100) {
      console.warn(`⚠️ WARNING: Only found ${activities.length} activities. Expected 1700+.`);
      console.log('Database update skipped to prevent data loss.');
      return;
    }
    
    // Update database
    console.log('\n💾 Updating database...');
    
    // Get current activities
    const currentActivities = await prisma.activity.findMany({
      where: { organizationId: 'nvrc' }
    });
    
    console.log(`📊 Current activities in database: ${currentActivities.length}`);
    
    // Create map for lookups
    const currentMap = new Map();
    currentActivities.forEach(activity => {
      if (activity.externalId) {
        currentMap.set(activity.externalId, activity);
      }
    });
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    // Process each scraped activity
    for (const activity of activities) {
      try {
        const externalId = activity.courseId || activity.id;
        const existing = currentMap.get(externalId);
        
        const activityData = {
          name: activity.name || 'Unnamed Activity',
          organizationId: 'nvrc',
          externalId: externalId,
          category: activity.category || 'General',
          subcategory: null,
          description: [
            activity.name,
            activity.time,
            activity.location,
            activity.price ? `$${activity.price}` : null,
            `Status: ${activity.status || 'open'}`
          ].filter(Boolean).join('\n'),
          location: activity.location || 'TBD',
          dates: 'See schedule',
          times: activity.time || 'Various',
          price: activity.price ? `$${activity.price}` : 'Contact for pricing',
          registrationRequired: true,
          registrationUrl: 'https://www.nvrc.ca/programs-memberships/find-program',
          ageRange: 'See program details',
          tags: [activity.category, activity.status, activity.location].filter(Boolean),
          isActive: activity.status !== 'closed',
          lastScraped: new Date(),
          rawData: activity
        };
        
        if (existing) {
          await prisma.activity.update({
            where: { id: existing.id },
            data: activityData
          });
          updated++;
          currentMap.delete(externalId);
        } else {
          await prisma.activity.create({
            data: activityData
          });
          created++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing activity ${activity.name}:`, error.message);
        errors++;
      }
    }
    
    // Mark remaining as inactive
    const toMarkInactive = Array.from(currentMap.values());
    if (toMarkInactive.length > 0 && activities.length >= 100) {
      console.log(`\n📝 Marking ${toMarkInactive.length} activities as inactive...`);
      
      await prisma.activity.updateMany({
        where: {
          id: { in: toMarkInactive.map(a => a.id) }
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
    
    const finalCount = await prisma.activity.count({
      where: { 
        organizationId: 'nvrc',
        isActive: true
      }
    });
    
    console.log(`\n📊 Total active NVRC activities: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Job failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the job
runSystematicScraper()
  .then(() => {
    console.log('\n✅ Job completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Job failed:', error);
    process.exit(1);
  });