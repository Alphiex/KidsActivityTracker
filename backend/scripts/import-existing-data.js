// Import existing scraped data into database
const { PrismaClient } = require('../generated/prisma');
const fs = require('fs');

const prisma = new PrismaClient();

async function importExistingData(filename) {
  console.log(`📂 Importing data from ${filename}...`);
  
  try {
    // Read JSON file
    const rawData = fs.readFileSync(filename, 'utf8');
    const data = JSON.parse(rawData);
    
    // Extract activities array
    const activities = data.activities || data;
    
    if (!Array.isArray(activities)) {
      throw new Error('Invalid data format - expected array of activities');
    }
    
    console.log(`📊 Found ${activities.length} activities to import`);
    
    // Get NVRC provider
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found');
    }
    
    // Create import job
    const job = await prisma.scrapeJob.create({
      data: {
        providerId: provider.id,
        status: 'RUNNING',
        startedAt: new Date()
      }
    });
    
    console.log(`🏃 Created import job: ${job.id}`);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    // Process each activity
    for (const activity of activities) {
      try {
        // Skip if no ID
        if (!activity.id) {
          console.log('⚠️  Skipping activity without ID');
          errors++;
          continue;
        }
        
        // Find or create location
        let location = null;
        if (activity.locationName || activity.location) {
          const locationName = activity.locationName || activity.location;
          const address = activity.address || '';
          
          location = await prisma.location.findFirst({
            where: {
              name: locationName,
              address: address
            }
          });
          
          if (!location) {
            location = await prisma.location.create({
              data: {
                name: locationName,
                address: address,
                city: activity.city || 'North Vancouver',
                province: 'BC',
                country: 'Canada',
                facility: activity.facility || null
              }
            });
          }
        }
        
        // Parse dates
        const parseDate = (dateStr) => {
          if (!dateStr) return null;
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? null : date;
        };
        
        // Check if activity exists
        const existing = await prisma.activity.findFirst({
          where: {
            providerId: provider.id,
            externalId: activity.id.toString()
          }
        });
        
        // Prepare activity data
        const activityData = {
          providerId: provider.id,
          externalId: activity.id.toString(),
          name: activity.name || activity.title || 'Unnamed Activity',
          category: activity.category || activity.type || 'Other',
          subcategory: activity.subcategory || activity.subtype || null,
          description: activity.description || null,
          schedule: activity.schedule || activity.time || null,
          dateStart: parseDate(activity.dateStart || activity.startDate),
          dateEnd: parseDate(activity.dateEnd || activity.endDate),
          registrationDate: parseDate(activity.registrationDate),
          ageMin: activity.ageMin || (activity.ageRange?.min ? parseInt(activity.ageRange.min) : null),
          ageMax: activity.ageMax || (activity.ageRange?.max ? parseInt(activity.ageRange.max) : null),
          cost: parseFloat(activity.cost || activity.price || 0),
          spotsAvailable: activity.spotsAvailable != null ? parseInt(activity.spotsAvailable) : null,
          totalSpots: activity.totalSpots != null ? parseInt(activity.totalSpots) : null,
          locationId: location?.id || null,
          locationName: activity.locationName || activity.location || null,
          registrationUrl: activity.registrationUrl || activity.url || null,
          courseId: activity.courseId || null,
          registrationStatus: activity.registrationStatus || activity.status || null,
          directRegistrationUrl: activity.signupUrl || null,
          detailUrl: activity.detailsUrl || null,
          isActive: true,
          rawData: {
            imported: true,
            importDate: new Date().toISOString(),
            originalData: activity
          }
        };
        
        if (existing) {
          await prisma.activity.update({
            where: { id: existing.id },
            data: activityData
          });
          updated++;
        } else {
          await prisma.activity.create({
            data: activityData
          });
          created++;
        }
        
        if ((created + updated) % 50 === 0) {
          console.log(`Progress: ${created} created, ${updated} updated, ${errors} errors`);
        }
        
      } catch (error) {
        console.error(`Error processing activity ${activity.id}:`, error.message);
        errors++;
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
        activitiesUpdated: updated,
        errorMessage: errors > 0 ? `${errors} activities failed to import` : null
      }
    });
    
    console.log(`
✅ Import completed successfully!
📊 Results:
   - Total activities: ${activities.length}
   - Created: ${created}
   - Updated: ${updated}
   - Errors: ${errors}
    `);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get filename from command line
const filename = process.argv[2];

if (!filename) {
  console.error('Usage: node import-existing-data.js <filename.json>');
  process.exit(1);
}

if (!fs.existsSync(filename)) {
  console.error(`File not found: ${filename}`);
  process.exit(1);
}

// Run import
importExistingData(filename);