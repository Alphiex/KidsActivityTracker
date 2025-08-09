const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function importEnhancedActivities(filename) {
  try {
    console.log('📥 Starting enhanced activity import...');
    
    // Read the JSON file
    const rawData = fs.readFileSync(filename, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.activities.length} activities to import`);
    
    // Ensure NVRC provider exists
    const provider = await prisma.provider.upsert({
      where: { name: 'NVRC' },
      update: {},
      create: {
        name: 'NVRC',
        website: 'https://www.nvrc.ca',
        scraperConfig: {
          type: 'enhanced-puppeteer',
          url: 'https://www.nvrc.ca/programs-memberships/find-program'
        }
      }
    });
    
    console.log('✅ Provider ready:', provider.name);
    
    // Process activities in batches
    const batchSize = 50;
    let imported = 0;
    let updated = 0;
    let errors = 0;
    
    for (let i = 0; i < data.activities.length; i += batchSize) {
      const batch = data.activities.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}...`);
      
      for (const activity of batch) {
        try {
          // Create or find location
          let location = null;
          if (activity.location || activity.fullAddress) {
            const locationName = activity.location || 'Unknown Location';
            const address = activity.fullAddress || '';
            
            location = await prisma.location.upsert({
              where: {
                name_address: {
                  name: locationName,
                  address: address
                }
              },
              update: {
                latitude: activity.latitude,
                longitude: activity.longitude,
                facility: activity.location
              },
              create: {
                name: locationName,
                address: address,
                city: 'North Vancouver',
                province: 'BC',
                country: 'Canada',
                latitude: activity.latitude,
                longitude: activity.longitude,
                facility: activity.location
              }
            });
          }
          
          // Parse days of week from schedule
          const dayOfWeek = [];
          if (activity.schedule) {
            const dayMapping = {
              'Mon': 'Monday',
              'Tue': 'Tuesday',
              'Wed': 'Wednesday',
              'Thu': 'Thursday',
              'Fri': 'Friday',
              'Sat': 'Saturday',
              'Sun': 'Sunday'
            };
            
            Object.keys(dayMapping).forEach(abbr => {
              if (activity.schedule.includes(abbr)) {
                dayOfWeek.push(dayMapping[abbr]);
              }
            });
          }
          
          // Prepare activity data
          const activityData = {
            providerId: provider.id,
            externalId: activity.id,
            name: activity.name,
            category: activity.category,
            subcategory: activity.subcategory,
            description: activity.description,
            schedule: activity.schedule,
            dateStart: activity.dateRange?.start ? new Date(activity.dateRange.start) : null,
            dateEnd: activity.dateRange?.end ? new Date(activity.dateRange.end) : null,
            registrationDate: activity.registrationDate ? new Date(activity.registrationDate) : null,
            ageMin: activity.ageRange?.min || null,
            ageMax: activity.ageRange?.max || null,
            cost: activity.cost || 0,
            spotsAvailable: activity.spotsAvailable,
            totalSpots: activity.totalSpots,
            locationId: location?.id,
            locationName: activity.location,
            registrationUrl: activity.registrationUrl,
            courseId: activity.courseId,
            dayOfWeek: dayOfWeek,
            registrationStatus: activity.registrationStatus || 'Unknown',
            registrationButtonText: activity.registrationButtonText,
            detailUrl: activity.detailUrl,
            fullDescription: activity.fullDescription,
            instructor: activity.instructor,
            prerequisites: activity.prerequisites,
            whatToBring: activity.whatToBring,
            fullAddress: activity.fullAddress,
            latitude: activity.latitude,
            longitude: activity.longitude,
            directRegistrationUrl: activity.directRegistrationUrl || activity.registrationUrl,
            contactInfo: activity.contactInfo,
            isActive: true,
            lastSeenAt: new Date(),
            rawData: activity
          };
          
          // Upsert the activity
          const result = await prisma.activity.upsert({
            where: {
              providerId_externalId: {
                providerId: provider.id,
                externalId: activity.id
              }
            },
            update: activityData,
            create: activityData
          });
          
          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            imported++;
          } else {
            updated++;
          }
          
        } catch (error) {
          console.error(`❌ Error processing activity ${activity.name}:`, error.message);
          errors++;
        }
      }
      
      console.log(`  ✅ Batch complete. Imported: ${imported}, Updated: ${updated}, Errors: ${errors}`);
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  🔄 Updated: ${updated}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📈 Total processed: ${imported + updated + errors}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get filename from command line or use most recent
const filename = process.argv[2] || (() => {
  const files = fs.readdirSync('.')
    .filter(f => f.startsWith('nvrc_enhanced_activities_') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files[0];
})();

if (!filename) {
  console.error('❌ No activity file found. Please run the enhanced scraper first.');
  process.exit(1);
}

console.log(`📂 Using file: ${filename}`);

importEnhancedActivities(filename)
  .then(() => {
    console.log('\n✨ Import completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });