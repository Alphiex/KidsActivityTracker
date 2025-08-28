const { PrismaClient } = require('./backend/generated/prisma');
const fs = require('fs');
const path = require('path');

// Load the latest scrape file
const scrapeFile = path.join(__dirname, 'backend', 'nvrc_working_hierarchical_2025-08-03T20-32-27-985Z.json');
const scrapeData = JSON.parse(fs.readFileSync(scrapeFile, 'utf8'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function importActivities() {
  try {
    const activities = scrapeData.activities;
    console.log(`Importing ${activities.length} activities from latest scrape...`);
    
    // Get the NVRC provider ID
    const nvrcProvider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!nvrcProvider) {
      throw new Error('NVRC provider not found in database');
    }
    
    console.log(`Using provider ID: ${nvrcProvider.id}`);
    
    let saved = 0;
    let errors = 0;
    
    for (const activity of activities) {
      try {
        // Prepare activity data
        const activityData = {
          providerId: nvrcProvider.id,
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
          ageMin: activity.ageRange?.min || 0,
          ageMax: activity.ageRange?.max || 18,
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
              providerId: nvrcProvider.id,
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
        if (saved % 50 === 0) {
          console.log(`💾 Saved ${saved} activities...`);
        }
      } catch (error) {
        console.error(`❌ Error saving activity ${activity.name}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Import complete!`);
    console.log(`   - Total in scrape file: ${activities.length}`);
    console.log(`   - Successfully saved: ${saved}`);
    console.log(`   - Errors: ${errors}`);
    
    // Mark stale activities as inactive
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 24);
    
    const updated = await prisma.activity.updateMany({
      where: {
        providerId: nvrcProvider.id,
        lastSeenAt: {
          lt: staleDate
        }
      },
      data: {
        isActive: false
      }
    });
    
    console.log(`   - Marked ${updated.count} stale activities as inactive`);
    
    // Get final stats
    const totalActive = await prisma.activity.count({
      where: { 
        providerId: nvrcProvider.id,
        isActive: true 
      }
    });
    const totalInactive = await prisma.activity.count({
      where: { 
        providerId: nvrcProvider.id,
        isActive: false 
      }
    });
    
    console.log(`\n📊 Final Database Stats:`);
    console.log(`   - Total active NVRC activities: ${totalActive}`);
    console.log(`   - Total inactive NVRC activities: ${totalInactive}`);
    console.log(`   - Grand total: ${totalActive + totalInactive}`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importActivities().catch(console.error);