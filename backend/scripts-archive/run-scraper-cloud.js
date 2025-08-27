const NVRCWorkingHierarchicalScraper = require('./scrapers/nvrcWorkingHierarchicalScraper');
const { PrismaClient } = require('./generated/prisma');

async function runScraper() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('🚀 Starting NVRC Working Hierarchical Scraper...');
    
    // Get provider from database
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found in database');
    }
    
    console.log(`📍 Found provider: ${provider.name} (${provider.id})`);
    
    const scraper = new NVRCWorkingHierarchicalScraper();
    
    console.log('🔍 Scraping activities...');
    const activities = await scraper.scrape();
    
    console.log(`✅ Scraped ${activities.length} activities`);
    
    // Save activities to database
    let saved = 0;
    let errors = 0;
    
    for (const activity of activities) {
      try {
        // Prepare activity data
        const activityData = {
          providerId: provider.id,
          externalId: activity.id || activity.courseId || `${activity.name}-${activity.dateRange?.start}`,
          name: activity.name,
          category: activity.category || 'Uncategorized',
          subcategory: activity.subcategory || null,
          description: activity.description || activity.alert || null,
          schedule: activity.schedule || null,
          dateStart: activity.dateRange?.start ? new Date(activity.dateRange.start) : new Date(),
          dateEnd: activity.dateRange?.end ? new Date(activity.dateRange.end) : new Date(),
          registrationDate: activity.registrationDate ? (() => {
            try {
              // Handle format like "May 21, 2025 9:00am"
              const dateStr = activity.registrationDate.replace(' at ', ' ').replace(/(\d{1,2}):(\d{2})([ap]m)/i, (match, h, m, ampm) => {
                let hour = parseInt(h);
                if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
                if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
                return ` ${hour}:${m}:00`;
              });
              const parsed = new Date(dateStr);
              return isNaN(parsed.getTime()) ? null : parsed;
            } catch {
              return null;
            }
          })() : null,
          ageMin: activity.ageRange?.min || null,
          ageMax: activity.ageRange?.max || null,
          cost: activity.cost || 0,
          spotsAvailable: activity.spotsAvailable || null,
          totalSpots: activity.totalSpots || null,
          locationName: activity.location || null,
          registrationUrl: activity.registrationUrl || null,
          courseId: activity.courseId || null,
          isActive: true,
          lastSeenAt: new Date(),
          rawData: activity
        };
        
        // Handle location
        if (activity.location) {
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
          activityData.locationId = location.id;
        }
        
        // Upsert activity
        await prisma.activity.upsert({
          where: {
            providerId_externalId: {
              providerId: provider.id,
              externalId: activityData.externalId
            }
          },
          update: {
            ...activityData,
            locationId: activityData.locationId
          },
          create: activityData
        });
        
        saved++;
        if (saved % 10 === 0) {
          console.log(`💾 Saved ${saved} activities...`);
        }
      } catch (error) {
        console.error(`❌ Error saving activity ${activity.name}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`   - Total scraped: ${activities.length}`);
    console.log(`   - Successfully saved: ${saved}`);
    console.log(`   - Errors: ${errors}`);
    
    // Mark stale activities as inactive
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 24);
    
    const updated = await prisma.activity.updateMany({
      where: {
        providerId: provider.id,
        lastSeenAt: {
          lt: staleDate
        }
      },
      data: {
        isActive: false
      }
    });
    
    console.log(`   - Marked ${updated.count} stale activities as inactive`);
    
  } catch (error) {
    console.error('❌ Scraper error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the scraper
runScraper().catch(console.error);