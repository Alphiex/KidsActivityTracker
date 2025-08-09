const NVRCPerfectMindScraper = require('./scrapers/nvrcPerfectMindScraper');
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

async function runPerfectMindScraper() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('🚀 Starting NVRC PerfectMind Scraper Job...');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    // Get provider from database
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found in database');
    }
    
    console.log(`📍 Found provider: ${provider.name} (${provider.id})`);
    
    // Initialize scraper
    const isProduction = process.env.NODE_ENV === 'production';
    const scraper = new NVRCPerfectMindScraper({
      headless: isProduction ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });
    
    console.log('🔍 Scraping activities from PerfectMind...');
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
          // Create a unique external ID
          const externalId = activity.id || 
                           `NVRC_${activity.section}_${activity.name}_${activity.dates}`.replace(/\s+/g, '_');
          currentIds.add(externalId);
          
          // Parse dates
          let dateStart = new Date();
          let dateEnd = new Date();
          
          if (activity.dates) {
            // Parse date range like "Jan 6 - Mar 24"
            const dateMatch = activity.dates.match(/([A-Z][a-z]{2}\s+\d{1,2})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2})/);
            if (dateMatch) {
              const currentYear = new Date().getFullYear();
              dateStart = new Date(`${dateMatch[1]} ${currentYear}`);
              dateEnd = new Date(`${dateMatch[2]} ${currentYear}`);
              
              // Adjust year if end date is before start date
              if (dateEnd < dateStart) {
                dateEnd.setFullYear(currentYear + 1);
              }
            }
          }
          
          // Handle location
          let locationId = null;
          if (activity.location) {
            try {
              const location = await prisma.location.upsert({
                where: {
                  name_address: {
                    name: activity.location,
                    address: ''
                  }
                },
                update: {},
                create: {
                  name: activity.location,
                  address: '',
                  city: 'North Vancouver',
                  province: 'BC'
                }
              });
              locationId = location.id;
            } catch (locError) {
              // Try to find existing location
              const existingLocation = await prisma.location.findFirst({
                where: { name: activity.location }
              });
              if (existingLocation) {
                locationId = existingLocation.id;
              }
            }
          }
          
          // Map availability to spots
          let spotsAvailable = activity.spotsAvailable;
          if (!spotsAvailable && activity.availability) {
            if (activity.availability === 'Closed') spotsAvailable = 0;
            else if (activity.availability === 'Waitlist') spotsAvailable = -1; // Use -1 for waitlist
            else if (activity.availability === 'Open' && !activity.spotsAvailable) spotsAvailable = 1; // At least 1 spot
          }
          
          // Create activity data
          const activityData = {
            providerId: provider.id,
            externalId,
            name: activity.name || 'Unnamed Activity',
            category: activity.section || 'Uncategorized',
            subcategory: null,
            description: `${activity.daysOfWeek?.join(', ') || ''} ${activity.time || ''}`.trim() || null,
            schedule: activity.time || null,
            dateStart,
            dateEnd,
            registrationDate: null,
            ageMin: activity.ageRange?.min || 0,
            ageMax: activity.ageRange?.max || 18,
            cost: activity.price || 0,
            spotsAvailable: spotsAvailable || 0,
            totalSpots: null,
            locationName: activity.location || null,
            locationId,
            registrationUrl: activity.registrationUrl || null,
            courseId: activity.id || null,
            isActive: true,
            lastSeenAt: new Date(),
            rawData: activity
          };
          
          await prisma.activity.upsert({
            where: {
              providerId_externalId: {
                providerId: provider.id,
                externalId
              }
            },
            update: activityData,
            create: activityData
          });
          
          saved++;
          if (saved % 100 === 0) {
            console.log(`💾 Progress: ${saved}/${activities.length} activities saved...`);
          }
        } catch (error) {
          errors++;
          if (errors <= 10) {
            console.error(`Error saving ${activity.name}: ${error.message}`);
          }
        }
      }));
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
runPerfectMindScraper().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});