const puppeteer = require('puppeteer');
const fs = require('fs');
const { PrismaClient } = require('../generated/prisma');
const { extractComprehensiveDetails } = require('./nvrcComprehensiveDetailScraper');
const { parseActivityType, extractAgeRangeFromText } = require('./utils/activityTypeParser');
const { mapActivityType } = require('../utils/activityTypeMapper');

// Helper functions for location normalization
function normalizeLocationName(name) {
  if (!name) return '';
  
  // Basic normalization
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/recreation\s+centre/gi, 'rec centre')
    .replace(/community\s+centre/gi, 'comm centre')
    .replace(/recreation/gi, 'rec')
    .replace(/community/gi, 'comm');
}

function determineFacilityType(locationName) {
  if (!locationName) return 'OTHER';
  
  const name = locationName.toLowerCase();
  
  if (name.includes('pool') || name.includes('aquatic')) {
    return 'POOL';
  } else if (name.includes('arena') || name.includes('ice')) {
    return 'ARENA';
  } else if (name.includes('rec') || name.includes('recreation')) {
    return 'RECREATION_CENTRE';
  } else if (name.includes('comm') || name.includes('community')) {
    return 'COMMUNITY_CENTRE';
  } else if (name.includes('park')) {
    return 'PARK';
  } else if (name.includes('field') || name.includes('sport')) {
    return 'SPORTS_FIELD';
  } else if (name.includes('gym')) {
    return 'GYM';
  } else {
    return 'OTHER';
  }
}

// Function to check if two activities have meaningful differences
function hasSignificantChanges(existing, newData) {
  // Check important fields for changes
  const significantFields = [
    'name', 'description', 'schedule', 'dateStart', 'dateEnd',
    'ageMin', 'ageMax', 'cost', 'spotsAvailable', 'totalSpots',
    'locationId', 'registrationUrl', 'registrationStatus',
    'instructor', 'fullDescription', 'whatToBring'
  ];
  
  for (const field of significantFields) {
    // Handle dates specially
    if (field === 'dateStart' || field === 'dateEnd') {
      const existingDate = existing[field] ? new Date(existing[field]).toISOString().split('T')[0] : null;
      const newDate = newData[field] ? new Date(newData[field]).toISOString().split('T')[0] : null;
      if (existingDate !== newDate) {
        console.log(`  📝 Field '${field}' changed: ${existingDate} → ${newDate}`);
        return true;
      }
    } else if (existing[field] !== newData[field]) {
      // Skip logging for large fields
      if (field !== 'fullDescription' && field !== 'whatToBring') {
        console.log(`  📝 Field '${field}' changed: ${existing[field]} → ${newData[field]}`);
      } else {
        console.log(`  📝 Field '${field}' changed`);
      }
      return true;
    }
  }
  
  return false;
}

class NVRCEnhancedParallelScraperFixed {
  constructor(options = {}) {
    this.options = {
      headless: true,
      maxConcurrency: options.maxConcurrency || 3,
      ...options
    };
    this.activities = [];
    this.prisma = new PrismaClient();
  }

  // Helper method to normalize location names for fuzzy matching
  normalizeLocationName(name) {
    return normalizeLocationName(name);
  }
  
  // Helper method to determine facility type from location name
  determineFacilityType(locationName) {
    return determineFacilityType(locationName);
  }

  async scrape() {
    let scrapeJob;
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting NVRC Enhanced Parallel Scraper (FIXED)...');
      console.log('✅ Using courseId for deduplication');
      console.log(`🔧 Max concurrency: ${this.options.maxConcurrency} browsers`);
      
      // Get existing provider
      const provider = await this.prisma.provider.findFirst({
        where: { name: 'NVRC' }
      });
      
      if (!provider) {
        throw new Error('NVRC provider not found in database.');
      }
      
      console.log(`📍 Provider: ${provider.name} (${provider.id})`);
      
      // Create scrape job (skip in production if table doesn't exist)
      try {
        scrapeJob = await this.prisma.scrapeJob.create({
          data: {
            providerId: provider.id,
            status: 'RUNNING',
            startedAt: new Date()
          }
        });
      } catch (error) {
        if (error.code === 'P2021') {
          console.log('⚠️  ScrapeJob table not found, continuing without job tracking');
        } else {
          throw error;
        }
      }
      
      // Launch browsers
      console.log(`🌐 Launching ${this.options.maxConcurrency} browser instances...`);
      const browsers = [];
      for (let i = 0; i < this.options.maxConcurrency; i++) {
        const browser = await puppeteer.launch(this.options);
        browsers.push(browser);
        console.log(`  ✓ Browser ${i + 1} launched`);
      }
      
      const page = await browsers[0].newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('📄 Loading NVRC activities page...');
      const url = 'https://anc.ca.apm.activecommunities.com/northvanrec/activity/search?onlineSiteId=0&activity_select_param=2&activity_category_ids=1,19,16,23,24,18,22,9,21,28,20,11&viewMode=list';
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      console.log('⏳ Waiting for activities to load...');
      
      // Wait for search results to appear
      try {
        await page.waitForSelector('.activity-search-results, .bm-results-section', { 
          timeout: 30000 
        });
        console.log('✓ Search results loaded');
      } catch (e) {
        console.log('⚠️  Results section not found, checking for alternative selectors...');
        const content = await page.content();
        if (content.includes('No activities found')) {
          console.log('❌ No activities found on page');
          throw new Error('No activities found');
        }
      }
      
      // Function to extract activities from the current page
      const extractActivitiesFromPage = async () => {
        return await page.evaluate(() => {
          const activities = [];
          
          // Find all sections with activities
          const sections = document.querySelectorAll('.bm-section-group, .activity-group-section, .activity-section');
          
          sections.forEach(section => {
            // Get section title
            const sectionTitle = section.querySelector('.bm-section-group-title, .section-title, h2, h3')?.textContent?.trim() || 'Unknown Section';
            
            // Find activity subsections
            const subsections = section.querySelectorAll('.bm-group-single-listing, .activity-subsection, .activity-listing');
            
            subsections.forEach(subsection => {
              // Get subsection/activity type title
              const activitySection = subsection.querySelector('.bm-group-title-text, .activity-type-title, h4')?.textContent?.trim() || '';
              
              // Find all activity items in this subsection
              const items = subsection.querySelectorAll('.bm-group-item, .activity-item, .program-item');
              
              items.forEach(itemRow => {
                const itemText = itemRow.textContent || '';
                
                // Skip items that are headers or don't have essential info
                const hasPrice = itemText.includes('$');
                const hasCourseId = itemText.includes('#');
                const hasLink = itemRow.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
                
                if (!hasPrice && !hasCourseId && !hasLink) {
                  return; // Skip this item
                }
                
                // Extract activity details
                const nameElement = itemRow.querySelector('.bm-group-item-name');
                const courseIdElement = itemRow.querySelector('.bm-group-item-course-id');
                
                let activityName = nameElement?.textContent?.trim() || '';
                const courseId = courseIdElement?.textContent?.trim() || '';
                
                // Find section title
                let activityType = activitySection;
                if (!activityType) {
                  const parentGroup = itemRow.closest('.bm-group-single-listing');
                  if (parentGroup) {
                    activityType = parentGroup.querySelector('.bm-group-title-text')?.textContent?.trim() || '';
                  }
                }
                
                // Clean up activity name
                activityName = activityName.replace(/\\s+/g, ' ').trim();
                if (activityName.includes('#')) {
                  activityName = activityName.split('#')[0].trim();
                }
                
                const activity = {
                  section: sectionTitle,
                  activityType: activityType,
                  activitySection: activitySection,
                  name: activityName,
                  code: courseId,
                  dates: itemText.match(/([A-Z][a-z]{2}\\s+\\d{1,2}\\s*-\\s*[A-Z][a-z]{2}\\s+\\d{1,2})/)?.[1],
                  daysOfWeek: (() => {
                    const days = [];
                    const dayPatterns = {
                      'Mon': 'Monday',
                      'Tue': 'Tuesday', 
                      'Wed': 'Wednesday',
                      'Thu': 'Thursday',
                      'Fri': 'Friday',
                      'Sat': 'Saturday',
                      'Sun': 'Sunday'
                    };
                    
                    Object.keys(dayPatterns).forEach(abbr => {
                      if (itemText.includes(abbr)) {
                        days.push(dayPatterns[abbr]);
                      }
                    });
                    
                    return days.length > 0 ? days : null;
                  })(),
                  time: itemText.match(/(\\d{1,2}:\\d{2}\\s*[AP]M\\s*-\\s*\\d{1,2}:\\d{2}\\s*[AP]M)/)?.[1],
                  ageRange: (() => {
                    const ageMatch = itemText.match(/(\\d+)\\s*-\\s*(\\d+)\\s*(yrs?|years?|months?|mos?)/i);
                    if (ageMatch) {
                      const min = parseInt(ageMatch[1]);
                      const max = parseInt(ageMatch[2]);
                      const unit = ageMatch[3].toLowerCase();
                      
                      if (unit.includes('month') || unit.includes('mo')) {
                        return { min: Math.floor(min / 12), max: Math.floor(max / 12) };
                      }
                      return { min, max };
                    }
                    
                    const singleAge = itemText.match(/(\\d+)\\+?\\s*(yrs?|years?)/i);
                    if (singleAge) {
                      const age = parseInt(singleAge[1]);
                      return { min: age, max: singleAge[0].includes('+') ? 18 : age };
                    }
                    
                    return null;
                  })(),
                  location: (() => {
                    const locationMatch = itemText.match(/at\\s+([^,]+?)(?:,|\\s+-\\s+|\\s+\\||$)/);
                    return locationMatch?.[1]?.trim();
                  })(),
                  spotsAvailable: (() => {
                    const spotsMatch = itemText.match(/(\\d+)\\s+spots?\\s+(?:left|available|remaining)/i);
                    return spotsMatch ? parseInt(spotsMatch[1]) : null;
                  })(),
                  price: (() => {
                    const priceMatch = itemText.match(/\\$(\\d+(?:\\.\\d{2})?)/);
                    return priceMatch ? parseFloat(priceMatch[1]) : null;
                  })(),
                  registrationStatus: (() => {
                    if (itemText.includes('Full')) return 'Full';
                    if (itemText.includes('Waitlist')) return 'Waitlist';
                    if (itemText.includes('Sign Up')) return 'Open';
                    const hasLink = itemRow.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                    if (hasLink) return 'Available';
                    return 'Unknown';
                  })(),
                  hasMultipleSessions: itemText.includes('session') || itemText.includes('class'),
                  sessionCount: (() => {
                    const sessionMatch = itemText.match(/(\\d+)\\s+(?:sessions?|classes)/i);
                    return sessionMatch ? parseInt(sessionMatch[1]) : 0;
                  })()
                };
                
                // Extract registration link
                const links = itemRow.querySelectorAll('a');
                for (const link of links) {
                  if (link && link.href) {
                    const href = link.href;
                    if (href.includes('BookMe4') || 
                        href.includes('courseId') || 
                        href.includes('register') ||
                        href.includes('enroll')) {
                      activity.registrationUrl = href;
                      
                      // Extract courseId from URL if not already found
                      if (!activity.code) {
                        const courseIdMatch = href.match(/courseId=([^&]+)/);
                        if (courseIdMatch) {
                          activity.code = courseIdMatch[1];
                        }
                      }
                      break;
                    }
                  }
                }
                
                activities.push(activity);
              });
            });
          });
          
          return activities;
        });
      };
      
      // Extract activities from first page
      console.log('📊 Extracting activities from page...');
      const pageActivities = await extractActivitiesFromPage();
      this.activities = [...this.activities, ...pageActivities];
      console.log(`  ✓ Found ${pageActivities.length} activities on current page`);
      
      // Check for pagination and load more if needed
      let hasNextPage = true;
      let pageNum = 2;
      
      while (hasNextPage && pageNum <= 10) { // Limit to 10 pages for safety
        try {
          const nextButton = await page.$('.pagination-next:not(.disabled), .next-page:not(.disabled), [aria-label="Next page"]:not([disabled])');
          
          if (nextButton) {
            console.log(`📄 Loading page ${pageNum}...`);
            await nextButton.click();
            
            // Wait for new content to load
            await page.waitForTimeout(2000);
            
            const newActivities = await extractActivitiesFromPage();
            if (newActivities.length > 0) {
              this.activities = [...this.activities, ...newActivities];
              console.log(`  ✓ Found ${newActivities.length} activities on page ${pageNum}`);
              pageNum++;
            } else {
              hasNextPage = false;
            }
          } else {
            hasNextPage = false;
          }
        } catch (e) {
          console.log('  ℹ️  No more pages found');
          hasNextPage = false;
        }
      }
      
      console.log(`\n📊 Total activities found: ${this.activities.length}`);
      
      // Filter activities to only include those with essential data
      const validActivities = this.activities.filter(a => 
        a.name && (a.code || a.registrationUrl)
      );
      
      console.log(`✓ Valid activities with essential data: ${validActivities.length}`);
      
      // Process activities to get comprehensive details
      console.log('\n🔍 Fetching comprehensive details for each activity...');
      console.log(`  Processing ${validActivities.length} activities across ${this.options.maxConcurrency} browsers`);
      
      const detailedActivities = [];
      const batchSize = Math.ceil(validActivities.length / this.options.maxConcurrency);
      
      const processingPromises = browsers.map(async (browser, browserIndex) => {
        const startIdx = browserIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, validActivities.length);
        const batch = validActivities.slice(startIdx, endIdx);
        
        console.log(`  🌐 Browser ${browserIndex + 1}: Processing ${batch.length} activities (${startIdx + 1}-${endIdx})`);
        
        const batchResults = [];
        for (let i = 0; i < batch.length; i++) {
          const activity = batch[i];
          try {
            if (activity.registrationUrl) {
              console.log(`    [Browser ${browserIndex + 1}] ${i + 1}/${batch.length}: ${activity.name}`);
              const details = await extractComprehensiveDetails(browser, activity.registrationUrl);
              
              batchResults.push({
                ...activity,
                // Basic info
                name: details.name || activity.name,
                courseId: details.courseId || activity.code,
                courseDetails: details.courseDetails,
                
                // Schedule info
                startTime: details.startTime,
                endTime: details.endTime,
                daysOfWeek: details.daysOfWeek || activity.daysOfWeek,
                
                // Age and restrictions
                ageRestrictions: details.ageRestrictions,
                ageRange: details.ageRange || activity.ageRange,
                
                // Pricing
                cost: details.cost || activity.price,
                costIncludesTax: details.costIncludesTax,
                taxAmount: details.taxAmount,
                
                // Registration info
                registrationDate: details.registrationDate,
                registrationEndDate: details.registrationEndDate,
                registrationEndTime: details.registrationEndTime,
                spotsAvailable: details.spotsAvailable !== undefined ? details.spotsAvailable : activity.spotsAvailable,
                totalSpots: details.totalSpots,
                waitlistAvailable: details.waitlistAvailable,
                
                // Location
                location: details.locationName || activity.location,
                fullAddress: details.fullAddress,
                latitude: details.latitude,
                longitude: details.longitude,
                
                // Additional details
                instructor: details.instructor,
                fullDescription: details.description,
                whatToBring: details.whatToBring,
                hasPrerequisites: details.hasPrerequisites,
                prerequisites: details.prerequisites,
                
                // Keep original data
                ...activity
              });
            } else {
              batchResults.push(activity);
            }
          } catch (error) {
            console.error(`    ❌ [Browser ${browserIndex + 1}] Error processing ${activity.name}:`, error.message);
            batchResults.push(activity); // Keep the basic activity even if details fail
          }
        }
        
        return batchResults;
      });
      
      const results = await Promise.all(processingPromises);
      results.forEach(batch => {
        detailedActivities.push(...batch);
      });
      
      console.log(`✓ Detailed information fetched for ${detailedActivities.length} activities`);
      
      // Process and save activities with proper deduplication
      const processedActivities = [];
      const stats = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      };
      
      console.log('\n💾 Saving activities to database with deduplication...');
      const providerId = provider.id;
      
      for (const activity of detailedActivities) {
        try {
          // CRITICAL FIX: Use courseId as the unique identifier
          const courseId = activity.courseId || activity.code;
          
          if (!courseId) {
            console.log(`  ⚠️  Skipping activity without courseId: ${activity.name}`);
            stats.skipped++;
            continue;
          }
          
          // Parse dates
          let startDate = null;
          let endDate = null;
          let dateRangeString = activity.dates;
          
          if (activity.dates) {
            const dateMatch = activity.dates.match(/([A-Z][a-z]{2})\\s+(\\d{1,2})\\s*-\\s*([A-Z][a-z]{2})\\s+(\\d{1,2})/);
            if (dateMatch) {
              const currentYear = new Date().getFullYear();
              const startMonth = dateMatch[1];
              const startDay = parseInt(dateMatch[2]);
              const endMonth = dateMatch[3];
              const endDay = parseInt(dateMatch[4]);
              
              const monthMap = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              };
              
              startDate = new Date(currentYear, monthMap[startMonth], startDay);
              endDate = new Date(currentYear, monthMap[endMonth], endDay);
              
              if (endDate < startDate) {
                endDate.setFullYear(currentYear + 1);
              }
              
              const today = new Date();
              if (startDate < today && startDate.getMonth() > today.getMonth() + 3) {
                startDate.setFullYear(currentYear - 1);
                if (endDate.getFullYear() === currentYear) {
                  endDate.setFullYear(currentYear - 1);
                }
              }
            }
          }
          
          // Get or create location
          let location = null;
          if (activity.location) {
            location = await this.prisma.location.findFirst({
              where: { 
                name: activity.location 
              }
            });
            
            if (!location) {
              const normalizedName = this.normalizeLocationName(activity.location);
              location = await this.prisma.location.findFirst({
                where: {
                  OR: [
                    { normalizedName },
                    { name: { contains: activity.location, mode: 'insensitive' } }
                  ]
                }
              });
            }
            
            if (!location) {
              location = await this.prisma.location.create({
                data: {
                  name: activity.location,
                  normalizedName: this.normalizeLocationName(activity.location),
                  address: activity.fullAddress,
                  city: 'North Vancouver',
                  province: 'BC',
                  country: 'Canada',
                  latitude: activity.latitude,
                  longitude: activity.longitude,
                  facilityType: this.determineFacilityType(activity.location),
                  isActive: true
                }
              });
            } else if (!location.address && activity.fullAddress) {
              const updates = {};
              if (!location.address && activity.fullAddress) {
                updates.address = activity.fullAddress;
              }
              if (!location.latitude && activity.latitude) {
                updates.latitude = activity.latitude;
              }
              if (!location.longitude && activity.longitude) {
                updates.longitude = activity.longitude;
              }
              
              if (Object.keys(updates).length > 0) {
                location = await this.prisma.location.update({
                  where: { id: location.id },
                  data: updates
                });
              }
            }
          }
          
          // Generate externalId (fallback, but we'll use courseId for lookup)
          const externalId = courseId;
          
          // Parse registration end date if provided
          let registrationEndDate = null;
          if (activity.registrationEndDate) {
            try {
              registrationEndDate = new Date(activity.registrationEndDate);
              if (isNaN(registrationEndDate.getTime())) {
                registrationEndDate = null;
              }
            } catch (e) {
              registrationEndDate = null;
            }
          }
          
          // Parse activity type to separate type from age range
          const parsedType = parseActivityType(activity.activityType);
          
          // Extract age range from activity details if not already present
          let ageMin = activity.ageRange?.min;
          let ageMax = activity.ageRange?.max;
          
          // Use parsed age range if we don't have one
          if ((ageMin === null || ageMin === undefined) && parsedType.ageMin !== null) {
            ageMin = parsedType.ageMin;
          }
          if ((ageMax === null || ageMax === undefined) && parsedType.ageMax !== null) {
            ageMax = parsedType.ageMax;
          }
          
          // If still no age range, try to extract from description
          if ((ageMin === null || ageMin === undefined) && activity.ageRestrictions) {
            const extractedAge = extractAgeRangeFromText(activity.ageRestrictions);
            if (extractedAge.min !== null) {
              ageMin = extractedAge.min;
              ageMax = extractedAge.max;
            }
          }
          
          // Default age range if still not found
          if (ageMin === null || ageMin === undefined) ageMin = 0;
          if (ageMax === null || ageMax === undefined) ageMax = 18;
          
          // Map activity to proper type and subtype
          const typeMapping = await mapActivityType({
            name: activity.name || `${parsedType.type} - ${activity.activitySection}`,
            category: parsedType.category || activity.section,
            subcategory: parsedType.type
          });
          
          // Prepare activity data with all new fields
          const activityData = {
            providerId,
            externalId,
            name: activity.name || `${parsedType.type} - ${activity.activitySection}`,
            category: parsedType.category || activity.section,
            subcategory: parsedType.type,
            description: activity.fullDescription || activity.activitySection,
            schedule: `${activity.daysOfWeek?.join(', ') || ''} ${activity.time || ''}`.trim(),
            dates: dateRangeString || activity.dates,
            dateStart: startDate,
            dateEnd: endDate,
            registrationDate: activity.registrationDate ? new Date(activity.registrationDate) : null,
            registrationEndDate,
            registrationEndTime: activity.registrationEndTime,
            startTime: activity.startTime,
            endTime: activity.endTime,
            ageMin: ageMin,
            ageMax: ageMax,
            cost: activity.cost || activity.price || 0,
            costIncludesTax: activity.costIncludesTax !== undefined ? activity.costIncludesTax : true,
            taxAmount: activity.taxAmount,
            spotsAvailable: activity.spotsAvailable || 0,
            totalSpots: activity.totalSpots,
            locationId: location?.id,
            locationName: activity.location,
            registrationUrl: activity.registrationUrl,
            registrationStatus: activity.registrationStatus || (
              activity.spotsAvailable === 0 ? 'Full' : 
              activity.spotsAvailable > 0 ? 'Open' : 'Unknown'
            ),
            courseId: courseId,  // Use the courseId directly
            isActive: true,
            lastSeenAt: new Date(),
            rawData: activity,
            hasMultipleSessions: activity.hasMultipleSessions || false,
            sessionCount: activity.sessionCount || 0,
            hasPrerequisites: activity.hasPrerequisites || false,
            instructor: activity.instructor,
            fullDescription: activity.fullDescription,
            whatToBring: activity.whatToBring,
            fullAddress: activity.fullAddress,
            courseDetails: activity.courseDetails,
            // Add the mapped type and subtype IDs
            activityTypeId: typeMapping.typeId,
            activitySubtypeId: typeMapping.subtypeId
          };
          
          // CRITICAL FIX: Check for existing activity by courseId
          const existingActivity = await this.prisma.activity.findFirst({
            where: {
              courseId: courseId,
              providerId: providerId
            }
          });
          
          let result;
          if (existingActivity) {
            // Check if there are meaningful changes before updating
            if (hasSignificantChanges(existingActivity, activityData)) {
              console.log(`  🔄 Updating activity: ${activity.name} (courseId: ${courseId})`);
              
              result = await this.prisma.activity.update({
                where: { id: existingActivity.id },
                data: {
                  ...activityData,
                  updatedAt: new Date()
                }
              });
              stats.updated++;
            } else {
              console.log(`  ⏭️  No changes for: ${activity.name} (courseId: ${courseId})`);
              // Just update lastSeenAt to track we've seen it
              result = await this.prisma.activity.update({
                where: { id: existingActivity.id },
                data: {
                  lastSeenAt: new Date()
                }
              });
              stats.skipped++;
            }
          } else {
            console.log(`  ✅ Creating new activity: ${activity.name} (courseId: ${courseId})`);
            
            result = await this.prisma.activity.create({
              data: activityData
            });
            stats.created++;
          }
          
          processedActivities.push(result);
          
        } catch (error) {
          console.error(`  ❌ Error processing activity ${activity.name}:`, error.message);
          stats.errors++;
        }
      }
      
      // Clean up browsers
      console.log('\n🧹 Cleaning up browsers...');
      for (const browser of browsers) {
        await browser.close();
      }
      
      // Mark activities not seen in this scrape as inactive
      const activeActivityIds = processedActivities.map(a => a.id);
      const inactiveCount = await this.prisma.activity.updateMany({
        where: {
          providerId,
          id: { notIn: activeActivityIds },
          isActive: true
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });
      
      stats.removed = inactiveCount.count;
      
      // Update scrape job if it exists
      if (scrapeJob) {
        try {
          await this.prisma.scrapeJob.update({
            where: { id: scrapeJob.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              activitiesFound: processedActivities.length,
              activitiesCreated: stats.created,
              activitiesUpdated: stats.updated,
              activitiesRemoved: stats.removed,
              errors: stats.errors
            }
          });
        } catch (error) {
          // Ignore if scrapeJob table doesn't exist
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 Scraping Summary:');
      console.log('='.repeat(60));
      console.log(`✓ Total activities processed: ${processedActivities.length}`);
      console.log(`✓ New activities created: ${stats.created}`);
      console.log(`✓ Activities updated: ${stats.updated}`);
      console.log(`✓ Activities unchanged: ${stats.skipped}`);
      console.log(`✓ Activities marked inactive: ${stats.removed}`);
      console.log(`✓ Errors: ${stats.errors}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log('='.repeat(60));
      
      return {
        activities: processedActivities,
        stats
      };
      
    } catch (error) {
      console.error('❌ Fatal error during scraping:', error);
      
      if (scrapeJob) {
        try {
          await this.prisma.scrapeJob.update({
            where: { id: scrapeJob.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              errors: 1,
              errorMessages: [error.message]
            }
          });
        } catch (e) {
          // Ignore if scrapeJob table doesn't exist
        }
      }
      
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

module.exports = NVRCEnhancedParallelScraperFixed;