// Run Enhanced Detail Scraper with Direct Database Integration
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function runEnhancedScraper() {
  console.log('🚀 Starting NVRC Enhanced Detail Scraper...');
  console.log('Target: 4000+ activities with full details');
  console.log('');
  
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
      // Load the enhanced scraper
      const NVRCEnhancedScraper = require('../scrapers/nvrcEnhancedDetailScraper');
      
      console.log('🕷️ Initializing enhanced scraper...');
      console.log('Features:');
      console.log('  - Captures registration status (Open/Closed/WaitList)');
      console.log('  - Visits detail pages for additional information');
      console.log('  - Extracts direct signup URLs');
      console.log('  - Gets instructor info, prerequisites, what to bring');
      console.log('  - Captures GPS coordinates and full addresses');
      console.log('');
      
      // Run the scraper
      const startTime = Date.now();
      const activities = await NVRCEnhancedScraper.scrape();
      const scrapeDuration = Math.round((Date.now() - startTime) / 1000);
      
      console.log(`✅ Scraping completed in ${scrapeDuration} seconds`);
      console.log(`📊 Found ${activities.length} activities`);
      
      if (activities.length < 3000) {
        console.warn(`⚠️  Warning: Expected 3000+ activities but only got ${activities.length}`);
      }
      
      // Process activities
      let created = 0;
      let updated = 0;
      let errors = 0;
      
      console.log('\n💾 Processing activities...');
      
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        
        try {
          // Skip if no ID
          if (!activity.id) {
            errors++;
            continue;
          }
          
          // Find or create location
          let location = null;
          if (activity.locationName || activity.location) {
            const locationName = activity.locationName || activity.location;
            const address = activity.fullAddress || activity.address || '';
            
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
                  facility: activity.facility || null,
                  latitude: activity.latitude || null,
                  longitude: activity.longitude || null
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
          
          // Prepare activity data with enhanced fields
          const activityData = {
            providerId: provider.id,
            externalId: activity.id.toString(),
            name: activity.name || activity.title || 'Unnamed Activity',
            category: activity.category || activity.type || 'Other',
            subcategory: activity.subcategory || activity.subtype || null,
            description: activity.description || null,
            fullDescription: activity.fullDescription || null,
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
            fullAddress: activity.fullAddress || null,
            latitude: activity.latitude || null,
            longitude: activity.longitude || null,
            registrationUrl: activity.registrationUrl || activity.url || null,
            directRegistrationUrl: activity.directRegistrationUrl || activity.signupUrl || null,
            detailUrl: activity.detailUrl || activity.detailsUrl || null,
            courseId: activity.courseId || null,
            registrationStatus: activity.registrationStatus || activity.status || null,
            registrationButtonText: activity.registrationButtonText || null,
            instructor: activity.instructor || null,
            prerequisites: activity.prerequisites || null,
            whatToBring: activity.whatToBring || null,
            contactInfo: activity.contactInfo || null,
            isActive: true,
            rawData: {
              enhanced: true,
              scrapedAt: new Date().toISOString(),
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
          
          // Progress logging
          if ((i + 1) % 100 === 0) {
            const progress = Math.round(((i + 1) / activities.length) * 100);
            console.log(`Progress: ${progress}% (${i + 1}/${activities.length}) - Created: ${created}, Updated: ${updated}`);
          }
          
        } catch (error) {
          console.error(`Error processing activity ${activity.id}:`, error.message);
          errors++;
        }
      }
      
      // Update job with results
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          activitiesFound: activities.length,
          activitiesCreated: created,
          activitiesUpdated: updated,
          errorMessage: errors > 0 ? `${errors} activities failed to process` : null,
          errorDetails: {
            duration: `${scrapeDuration}s`,
            errors: errors
          }
        }
      });
      
      console.log(`
========================================
✅ Enhanced scraping completed successfully!
========================================
📊 Summary:
   - Total activities found: ${activities.length}
   - Created: ${created}
   - Updated: ${updated}
   - Errors: ${errors}
   - Duration: ${scrapeDuration} seconds
   
🎯 Expected vs Actual:
   - Expected: 3000+ activities
   - Actual: ${activities.length} activities
   - Status: ${activities.length >= 3000 ? '✅ Target met!' : '⚠️ Below target'}
========================================
      `);
      
    } catch (error) {
      // Update job with error
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
          errorDetails: { 
            stack: error.stack,
            type: error.constructor.name
          }
        }
      });
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Enhanced scraper failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the enhanced scraper
console.log('NVRC Enhanced Detail Scraper');
console.log('============================');
console.log('This scraper is designed to capture 4000+ activities');
console.log('with comprehensive details including:');
console.log('- Registration status and buttons');
console.log('- Detail page information');
console.log('- GPS coordinates');
console.log('- Instructor information');
console.log('- Prerequisites and what to bring');
console.log('');

runEnhancedScraper();