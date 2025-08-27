const NVRCWorkingHierarchicalScraper = require('./scrapers/nvrcWorkingHierarchicalScraper');
const { PrismaClient } = require('./generated/prisma');

async function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Handle format like "May 21, 2025 9:00am"
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
    
    // Get all existing activities for this provider to track what's no longer available
    const existingActivities = await prisma.activity.findMany({
      where: { providerId: provider.id },
      select: { id: true, externalId: true }
    });
    
    const existingIds = new Set(existingActivities.map(a => a.externalId));
    const currentIds = new Set();
    
    // Save activities to database
    let saved = 0;
    let errors = 0;
    const errorDetails = [];
    
    for (const activity of activities) {
      try {
        // Generate external ID
        const externalId = activity.id || activity.courseId || `${activity.name}-${activity.dateRange?.start || Date.now()}`;
        currentIds.add(externalId);
        
        // Parse dates
        const dateStart = activity.dateRange?.start ? new Date(activity.dateRange.start) : new Date();
        const dateEnd = activity.dateRange?.end ? new Date(activity.dateRange.end) : new Date();
        const registrationDate = await parseDate(activity.registrationDate);
        
        // Validate dates
        if (isNaN(dateStart.getTime())) {
          throw new Error(`Invalid start date: ${activity.dateRange?.start}`);
        }
        if (isNaN(dateEnd.getTime())) {
          throw new Error(`Invalid end date: ${activity.dateRange?.end}`);
        }
        
        // Handle location first
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
              update: {
                facility: activity.facility || null
              },
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
            console.error(`Location error for ${activity.location}:`, locError.message);
          }
        }
        
        // Prepare activity data
        const activityData = {
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
        
        // Upsert activity
        const upserted = await prisma.activity.upsert({
          where: {
            providerId_externalId: {
              providerId: provider.id,
              externalId
            }
          },
          update: activityData,
          create: {
            ...activityData,
            providerId: provider.id
          }
        });
        
        saved++;
        if (saved % 50 === 0) {
          console.log(`💾 Saved ${saved} activities...`);
        }
      } catch (error) {
        errors++;
        errorDetails.push({
          activity: activity.name,
          error: error.message
        });
        if (errors <= 5) {
          console.error(`❌ Error saving activity ${activity.name}:`, error.message);
        }
      }
    }
    
    // Mark activities that weren't in this scrape as inactive
    const toDeactivate = [...existingIds].filter(id => !currentIds.has(id));
    if (toDeactivate.length > 0) {
      const deactivated = await prisma.activity.updateMany({
        where: {
          providerId: provider.id,
          externalId: { in: toDeactivate }
        },
        data: {
          isActive: false,
          lastSeenAt: new Date()
        }
      });
      console.log(`   - Marked ${deactivated.count} activities as inactive (no longer available)`);
    }
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`   - Total scraped: ${activities.length}`);
    console.log(`   - Successfully saved: ${saved}`);
    console.log(`   - Errors: ${errors}`);
    
    if (errorDetails.length > 0) {
      console.log('\n❌ Error summary:');
      const errorTypes = {};
      errorDetails.forEach(e => {
        const key = e.error.split(':')[0];
        errorTypes[key] = (errorTypes[key] || 0) + 1;
      });
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} activities`);
      });
    }
    
    // Final count
    const finalCount = await prisma.activity.count({
      where: {
        providerId: provider.id,
        isActive: true
      }
    });
    console.log(`\n📊 Total active activities in database: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Scraper error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the scraper
runScraper().catch(console.error);