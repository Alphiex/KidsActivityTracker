const { PrismaClient } = require('./backend/generated/prisma');
const fs = require('fs');
const path = require('path');

// Production database URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:kidsactivities2024@35.186.199.172:5432/kids_activity_tracker';

// Load the scrape data
const scrapeFile = path.join(__dirname, 'backend', 'nvrc_working_hierarchical_2025-08-03T20-32-27-985Z.json');
const scrapeData = JSON.parse(fs.readFileSync(scrapeFile, 'utf8'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function importActivities() {
  try {
    const activities = scrapeData.activities;
    console.log(`📤 Importing ${activities.length} activities to production database...`);
    
    // Get the NVRC provider
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found in database');
    }
    
    console.log(`Found provider: ${provider.name} (${provider.id})`);
    
    // First, reactivate any previously deactivated activities that we're about to import
    const externalIds = activities.map(a => {
      // Use the ID field which should be the courseId (barcode) from NVRC
      return a.id || a.courseId || `NVRC_${a.category}_${a.subcategory}_${a.name}_${a.dates}`.replace(/\s+/g, '_');
    });
    
    await prisma.activity.updateMany({
      where: {
        providerId: provider.id,
        externalId: { in: externalIds },
        isActive: false
      },
      data: {
        isActive: true,
        lastSeenAt: new Date()
      }
    });
    
    let saved = 0;
    let errors = 0;
    
    // Process in batches
    for (let i = 0; i < activities.length; i += 20) {
      const batch = activities.slice(i, i + 20);
      
      await Promise.all(batch.map(async (activity) => {
        try {
          // Use the stable ID from the scraper (courseId/barcode)
          const externalId = activity.id || activity.courseId || `NVRC_${activity.category}_${activity.subcategory}_${activity.name}_${activity.dates}`.replace(/\s+/g, '_');
          
          // Parse dates
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
          
          // Handle location
          let locationId = null;
          if (activity.location) {
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
          }
          
          const activityData = {
            providerId: provider.id,
            externalId,
            name: activity.name || 'Unnamed Activity',
            category: activity.category || 'Uncategorized',
            subcategory: activity.subcategory || null,
            description: activity.description || null,
            schedule: activity.schedule || null,
            dateStart,
            dateEnd,
            registrationDate: activity.registrationDate ? new Date(activity.registrationDate) : null,
            ageMin: activity.ageRange?.min || 0,
            ageMax: activity.ageRange?.max || 18,
            cost: activity.cost || 0,
            spotsAvailable: activity.spotsAvailable || null,
            totalSpots: null,
            locationName: activity.location || null,
            locationId,
            registrationUrl: activity.registrationUrl || null,
            courseId: activity.courseId || null,
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
            console.log(`✅ Saved ${saved} activities...`);
          }
        } catch (error) {
          errors++;
          if (errors <= 10) {
            console.error(`❌ Error saving ${activity.name}:`, error.message);
          }
        }
      }));
    }
    
    console.log(`\n📊 Import Summary:`);
    console.log(`   - Total in file: ${activities.length}`);
    console.log(`   - Successfully saved: ${saved}`);
    console.log(`   - Errors: ${errors}`);
    
    // Get final stats
    const totalActive = await prisma.activity.count({
      where: { 
        providerId: provider.id,
        isActive: true 
      }
    });
    
    console.log(`\n✅ Production database now has ${totalActive} active NVRC activities`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importActivities().catch(console.error);