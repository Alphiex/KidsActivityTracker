const { PrismaClient } = require('./generated/prisma');
const NVRCCloudSolution = require('./scrapers/nvrcCloudSolution');

const prisma = new PrismaClient();

async function runCloudScraper() {
  console.log('🚀 Starting NVRC Cloud Scraper Job...');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  
  try {
    // Initialize the scraper
    const scraper = new NVRCCloudSolution({
      headless: true
    });
    
    // Run the scraper
    console.log('\n📊 Running cloud solution scraper...');
    const activities = await scraper.scrape();
    
    console.log(`\n✅ Scraper completed. Found ${activities.length} unique activities`);
    
    if (activities.length === 0) {
      console.error('⚠️ WARNING: No activities found!');
      console.log('Skipping database update to prevent data loss.');
      return;
    }
    
    if (activities.length < 100) {
      console.warn(`⚠️ WARNING: Only found ${activities.length} activities. Expected 1700+.`);
      console.log('Skipping database update to prevent data loss.');
      return;
    }
    
    // Update database
    console.log('\n💾 Updating database...');
    
    const currentActivities = await prisma.activity.findMany({
      where: { organizationId: 'nvrc' }
    });
    
    console.log(`📊 Current activities in database: ${currentActivities.length}`);
    
    const currentMap = new Map();
    currentActivities.forEach(activity => {
      if (activity.externalId) {
        currentMap.set(activity.externalId, activity);
      }
    });
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
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
          tags: [activity.category, activity.source].filter(Boolean),
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
runCloudScraper()
  .then(() => {
    console.log('\n✅ Job completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Job failed:', error);
    process.exit(1);
  });