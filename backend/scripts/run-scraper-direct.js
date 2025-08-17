// Direct Scraper Runner - Bypasses job queue for immediate execution
const { PrismaClient } = require('../generated/prisma');
const NVRCScraper = require('../scrapers/nvrcWorkingHierarchicalScraper');

const prisma = new PrismaClient();

async function runScraperDirect() {
  console.log('🚀 Starting direct scraper execution...');
  
  try {
    // Get NVRC provider
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found');
    }
    
    console.log(`📋 Found provider: ${provider.name}`);
    
    // Create scrape job
    const job = await prisma.scrapeJob.create({
      data: {
        providerId: provider.id,
        status: 'RUNNING',
        startedAt: new Date()
      }
    });
    
    console.log(`🏃 Created job: ${job.id}`);
    
    try {
      // Initialize scraper
      const scraper = new NVRCScraper();
      console.log('🕷️ Running scraper...');
      
      // Run scraper
      const activities = await scraper.scrape();
      console.log(`✅ Found ${activities.length} activities`);
      
      // Process activities
      let created = 0;
      let updated = 0;
      
      for (const activityData of activities) {
        try {
          // Find or create location
          let location = null;
          if (activityData.locationName) {
            location = await prisma.location.findFirst({
              where: {
                name: activityData.locationName,
                address: activityData.address || ''
              }
            });
            
            if (!location) {
              location = await prisma.location.create({
                data: {
                  name: activityData.locationName,
                  address: activityData.address || '',
                  city: activityData.city || 'North Vancouver',
                  province: 'BC',
                  country: 'Canada'
                }
              });
            }
          }
          
          // Check if activity exists
          const existing = await prisma.activity.findFirst({
            where: {
              providerId: provider.id,
              externalId: activityData.id
            }
          });
          
          const activityRecord = {
            providerId: provider.id,
            externalId: activityData.id,
            name: activityData.name,
            category: activityData.category || 'Other',
            subcategory: activityData.subcategory,
            description: activityData.description,
            schedule: activityData.schedule,
            dateStart: activityData.dateStart ? new Date(activityData.dateStart) : null,
            dateEnd: activityData.dateEnd ? new Date(activityData.dateEnd) : null,
            registrationDate: activityData.registrationDate ? new Date(activityData.registrationDate) : null,
            ageMin: activityData.ageMin,
            ageMax: activityData.ageMax,
            cost: activityData.cost || 0,
            spotsAvailable: activityData.spotsAvailable,
            totalSpots: activityData.totalSpots,
            locationId: location?.id,
            locationName: activityData.locationName,
            registrationUrl: activityData.registrationUrl,
            courseId: activityData.courseId,
            registrationStatus: activityData.registrationStatus,
            signupUrl: activityData.signupUrl,
            detailsUrl: activityData.detailsUrl,
            isActive: true,
            metadata: activityData.metadata || {}
          };
          
          if (existing) {
            await prisma.activity.update({
              where: { id: existing.id },
              data: activityRecord
            });
            updated++;
          } else {
            await prisma.activity.create({
              data: activityRecord
            });
            created++;
          }
          
          if ((created + updated) % 100 === 0) {
            console.log(`Progress: ${created} created, ${updated} updated`);
          }
        } catch (error) {
          console.error(`Error processing activity ${activityData.id}:`, error.message);
        }
      }
      
      // Update job
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          activitiesFound: activities.length,
          activitiesCreated: created,
          activitiesUpdated: updated
        }
      });
      
      console.log(`
✅ Scraping completed successfully!
📊 Results:
   - Activities found: ${activities.length}
   - Created: ${created}
   - Updated: ${updated}
      `);
      
    } catch (error) {
      // Update job with error
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
          errorDetails: { stack: error.stack }
        }
      });
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Scraper failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the scraper
runScraperDirect();