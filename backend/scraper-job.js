const NVRCWorkingHierarchicalScraper = require('./scrapers/nvrcWorkingHierarchicalScraper');
const { PrismaClient } = require('./generated/prisma');

async function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    const cleaned = dateStr
      .replace(' at ', ' ')
      .replace(/(\d{1,2}):(\d{2})([ap]m)/i, (match, h, m, ampm) => {
        let hour = parseInt(h);
        if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
        if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
        return ` ${hour}:${m}:00`;
      });
    
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

async function runScraper() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('🚀 Starting NVRC Scraper Job...');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    // Get provider from database
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found in database');
    }
    
    console.log(`📍 Found provider: ${provider.name} (${provider.id})`);
    
    // Initialize scraper with headless mode for cloud
    const scraper = new NVRCWorkingHierarchicalScraper({
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
    
    console.log('🔍 Scraping activities...');
    const activities = await scraper.scrape();
    
    console.log(`✅ Scraped ${activities.length} activities`);
    
    // Get existing activities
    const existingActivities = await prisma.activity.findMany({
      where: { providerId: provider.id },
      select: { id: true, externalId: true }
    });
    
    const existingIds = new Set(existingActivities.map(a => a.externalId));
    const currentIds = new Set();
    
    // Process activities in batches
    let saved = 0;
    let errors = 0;
    const batchSize = 10;
    
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (activity) => {
        try {
          const externalId = activity.id || activity.courseId || `${activity.name}-${Date.now()}`;
          currentIds.add(externalId);
          
          // Parse dates safely
          let dateStart = new Date();
          let dateEnd = new Date();
          
          if (activity.dateRange?.start) {
            const parsed = new Date(activity.dateRange.start);
            if (!isNaN(parsed.getTime())) dateStart = parsed;
          }
          
          if (activity.dateRange?.end) {
            const parsed = new Date(activity.dateRange.end);
            if (!isNaN(parsed.getTime())) dateEnd = parsed;
          }
          
          const registrationDate = await parseDate(activity.registrationDate);
          
          // Handle location
          let locationId = null;
          if (activity.location) {
            try {
              const location = await prisma.location.upsert({
                where: {
                  name_address: {
                    name: activity.location,
                    address: activity.facility || ''
                  }
                },
                update: {},
                create: {
                  name: activity.location,
                  address: activity.facility || '',
                  city: 'North Vancouver',
                  province: 'BC',
                  facility: activity.facility || null
                }
              });
              locationId = location.id;
            } catch (locError) {
              console.error(`Location error: ${locError.message}`);
            }
          }
          
          // Create/update activity - using raw query to avoid Prisma validation issues
          const activityData = {
            providerId: provider.id,
            externalId,
            name: activity.name || 'Unnamed Activity',
            category: activity.category || 'Uncategorized',
            subcategory: activity.subcategory || null,
            description: activity.description || activity.alert || null,
            schedule: activity.schedule || null,
            dateStart,
            dateEnd,
            registrationDate,
            ageMin: activity.ageRange?.min || null,
            ageMax: activity.ageRange?.max || null,
            cost: parseFloat(activity.cost) || 0,
            spotsAvailable: parseInt(activity.spotsAvailable) || null,
            totalSpots: parseInt(activity.totalSpots) || null,
            locationName: activity.location || null,
            locationId,
            registrationUrl: activity.registrationUrl || null,
            courseId: activity.courseId || null,
            isActive: true,
            lastSeenAt: new Date(),
            rawData: activity
          };
          
          // Check if exists
          const existing = await prisma.activity.findUnique({
            where: {
              providerId_externalId: {
                providerId: provider.id,
                externalId
              }
            }
          });
          
          if (existing) {
            await prisma.activity.update({
              where: { id: existing.id },
              data: activityData
            });
          } else {
            await prisma.activity.create({
              data: activityData
            });
          }
          
          saved++;
        } catch (error) {
          errors++;
          if (errors <= 10) {
            console.error(`Error saving ${activity.name}: ${error.message}`);
          }
        }
      }));
      
      if (saved % 100 === 0) {
        console.log(`💾 Progress: ${saved}/${activities.length} activities saved...`);
      }
    }
    
    // Deactivate missing activities
    const toDeactivate = [...existingIds].filter(id => !currentIds.has(id));
    if (toDeactivate.length > 0) {
      await prisma.activity.updateMany({
        where: {
          providerId: provider.id,
          externalId: { in: toDeactivate }
        },
        data: {
          isActive: false,
          lastSeenAt: new Date()
        }
      });
      console.log(`📉 Deactivated ${toDeactivate.length} activities no longer available`);
    }
    
    // Final summary
    const finalCount = await prisma.activity.count({
      where: {
        providerId: provider.id,
        isActive: true
      }
    });
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`   - Total scraped: ${activities.length}`);
    console.log(`   - Successfully saved: ${saved}`);
    console.log(`   - Errors: ${errors}`);
    console.log(`   - Total active in DB: ${finalCount}`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    
    // Exit with appropriate code
    process.exit(errors > activities.length / 2 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Scraper job failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the scraper
runScraper().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});