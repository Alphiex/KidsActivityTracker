const puppeteer = require('puppeteer');
const fs = require('fs');
const { PrismaClient } = require('../generated/prisma');
const { extractComprehensiveDetails } = require('./nvrcComprehensiveDetailScraper');

class NVRCEnhancedParallelScraper {
  constructor(options = {}) {
    this.options = {
      headless: true,
      maxConcurrency: options.maxConcurrency || 3,
      ...options
    };
    this.activities = [];
    this.prisma = new PrismaClient();
  }

  async scrape() {
    let scrapeJob;
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting NVRC Enhanced Parallel Scraper...');
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
          scrapeJob = null;
        } else {
          throw error;
        }
      }

      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      
      // First, get all activity links from the main page
      console.log('\n📍 Fetching activity links from main page...');
      const activityLinks = await this.fetchActivityLinks(widgetUrl);
      
      console.log(`\n📊 Found ${activityLinks.totalLinks} total activity links across all sections`);
      
      // Process sections in parallel
      const sections = Object.keys(activityLinks.bySection);
      console.log(`📂 Processing ${sections.length} sections in parallel...`);
      
      // Create batches based on max concurrency
      const batches = [];
      for (let i = 0; i < sections.length; i += this.options.maxConcurrency) {
        batches.push(sections.slice(i, i + this.options.maxConcurrency));
      }
      
      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`\n🔄 Processing batch ${batchIndex + 1}/${batches.length}: ${batch.join(', ')}`);
        
        const batchPromises = batch.map(section => 
          this.processSectionInParallel(widgetUrl, section, activityLinks.bySection[section], provider.id)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            this.activities.push(...result.value);
            console.log(`✅ ${batch[idx]}: ${result.value.length} activities`);
          } else {
            console.error(`❌ ${batch[idx]}: ${result.reason.message}`);
          }
        });
      }

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log(`\n✅ Total activities extracted: ${this.activities.length} in ${duration} minutes`);
      
      // Enhance activities with detailed information
      console.log('\n🔍 Enhancing activities with detailed information...');
      const enhancedActivities = await this.enhanceActivitiesWithDetails(this.activities);
      this.activities = enhancedActivities;
      
      // Save activities to database
      console.log('\n💾 Saving activities to database...');
      const stats = await this.saveActivitiesToDatabase(provider.id);
      
      // Update scrape job if it exists
      if (scrapeJob) {
        await this.prisma.scrapeJob.update({
          where: { id: scrapeJob.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            activitiesFound: this.activities.length,
            activitiesCreated: stats.created,
            activitiesUpdated: stats.updated,
            activitiesRemoved: stats.removed
          }
        });
      }
      
      // Generate and save report
      const report = this.generateReport(stats, duration);
      console.log(report);
      
      // Save detailed results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_enhanced_results_${timestamp}.json`;
      
      const results = {
        timestamp: new Date().toISOString(),
        url: widgetUrl,
        duration: `${duration} minutes`,
        activitiesCount: this.activities.length,
        summary: this.summarizeActivities(),
        databaseStats: stats,
        activities: this.activities
      };
      
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 Detailed results saved to ${filename}`);
      
      return {
        activities: this.activities,
        stats: stats,
        report: report
      };
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      
      if (scrapeJob) {
        await this.prisma.scrapeJob.update({
          where: { id: scrapeJob.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error.message,
            errorDetails: { stack: error.stack }
          }
        });
      }
      
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async fetchActivityLinks(widgetUrl) {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      await page.goto(widgetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get all activity links organized by section
      const activityLinks = await page.evaluate(() => {
        const result = {
          bySection: {},
          totalLinks: 0
        };
        
        const targetSections = [
          'Early Years: On My Own',
          'All Ages & Family',
          'Early Years: Parent Participation',
          'School Age',
          'Youth'
        ];
        
        targetSections.forEach(sectionName => {
          const links = [];
          const allElements = Array.from(document.querySelectorAll('*'));
          
          // Find the section header
          let sectionElement = null;
          for (const el of allElements) {
            if (el.textContent?.trim() === sectionName) {
              sectionElement = el;
              break;
            }
          }
          
          if (!sectionElement) return;
          
          // Find container with links
          let currentElement = sectionElement;
          let container = null;
          
          while (currentElement && !container) {
            const nextSibling = currentElement.nextElementSibling;
            if (nextSibling && nextSibling.querySelectorAll('a').length > 0) {
              container = nextSibling;
              break;
            }
            currentElement = currentElement.parentElement;
            if (currentElement && currentElement.nextElementSibling && 
                currentElement.nextElementSibling.querySelectorAll('a').length > 0) {
              container = currentElement.nextElementSibling;
              break;
            }
          }
          
          if (container) {
            const containerLinks = Array.from(container.querySelectorAll('a'));
            
            for (const link of containerLinks) {
              const text = link.textContent?.trim() || '';
              
              // Stop if we hit another section
              if (targetSections.includes(text) && text !== sectionName) {
                break;
              }
              
              // Activity links have patterns like "Arts Dance (0-6yrs)"
              if (text.includes('(') && text.includes(')') && 
                  !text.includes('Drop-In') && 
                  !text.includes('Book') &&
                  text.length > 5) {
                links.push({
                  text: text,
                  href: link.href
                });
              }
            }
          }
          
          if (links.length > 0) {
            result.bySection[sectionName] = links;
            result.totalLinks += links.length;
          }
        });
        
        return result;
      });
      
      return activityLinks;
      
    } finally {
      if (browser) await browser.close();
    }
  }

  async processSectionInParallel(widgetUrl, sectionName, sectionLinks, providerId) {
    let browser;
    const sectionActivities = [];
    
    try {
      browser = await puppeteer.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      console.log(`\n🔄 [${sectionName}] Starting processing of ${sectionLinks.length} activities...`);
      
      for (const linkInfo of sectionLinks) {
        try {
          // Navigate to main page
          await page.goto(widgetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Click the activity link
          const clicked = await page.evaluate((linkText) => {
            const links = Array.from(document.querySelectorAll('a'));
            const targetLink = links.find(l => l.textContent?.trim() === linkText);
            if (targetLink) {
              targetLink.click();
              return true;
            }
            return false;
          }, linkInfo.text);
          
          if (clicked) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Extract activities from this page
            const pageActivities = await this.extractActivitiesFromPage(page, sectionName, linkInfo.text);
            sectionActivities.push(...pageActivities);
            
            console.log(`  ✅ [${sectionName}] ${linkInfo.text}: ${pageActivities.length} activities`);
          } else {
            console.log(`  ⚠️  [${sectionName}] Could not click: ${linkInfo.text}`);
          }
          
        } catch (error) {
          console.error(`  ❌ [${sectionName}] Error processing ${linkInfo.text}:`, error.message);
        }
      }
      
      console.log(`✅ [${sectionName}] Completed: ${sectionActivities.length} total activities`);
      return sectionActivities;
      
    } catch (error) {
      console.error(`❌ [${sectionName}] Section error:`, error.message);
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }

  async extractActivitiesFromPage(page, sectionName, activityType) {
    // First expand all "Show" buttons
    const showLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, span'));
      const showLinks = links.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.toLowerCase() === 'show' || text.includes('Show');
      });
      
      showLinks.forEach(link => link.click());
      return showLinks.length;
    });

    if (showLinks > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Extract activities
    const pageActivities = await page.evaluate((section, actType) => {
      const activities = [];
      const groupItems = document.querySelectorAll('.bm-group-item-row');
      const groupTitles = document.querySelectorAll('.bm-group-title-row');
      
      // Create a map of positions to titles
      const titlePositions = [];
      groupTitles.forEach(title => {
        const rect = title.getBoundingClientRect();
        titlePositions.push({
          title: title.textContent?.trim() || '',
          top: rect.top,
          element: title
        });
      });
      
      groupItems.forEach((itemRow, idx) => {
        try {
          const itemText = itemRow.textContent || '';
          
          // Look for any activity indicator
          const hasPrice = itemText.includes('$');
          const hasCourseId = itemText.includes('#');
          const hasLink = itemRow.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
          
          if (!hasPrice && !hasCourseId && !hasLink) {
            return;
          }
          
          // Extract activity details
          const nameElement = itemRow.querySelector('.bm-group-item-name');
          const courseIdElement = itemRow.querySelector('.bm-group-item-course-id');
          
          let activityName = nameElement?.textContent?.trim() || '';
          const courseId = courseIdElement?.textContent?.trim() || '';
          
          // Find section title
          let activitySection = actType;
          const rowRect = itemRow.getBoundingClientRect();
          for (let i = titlePositions.length - 1; i >= 0; i--) {
            if (titlePositions[i].top < rowRect.top) {
              const titleText = titlePositions[i].title;
              const match = titleText.match(/([A-Za-z\\s&]+(?:Early Years|All Ages)?)/);
              if (match) {
                activitySection = match[1].trim();
              }
              break;
            }
          }
          
          const activity = {
            id: `${section}_${idx}_${Date.now()}`,
            section: section,
            activityType: actType,
            activitySection: activitySection,
            name: activityName,
            code: courseId,
            dates: itemText.match(/([A-Z][a-z]{2}\\s+\\d{1,2}\\s*-\\s*[A-Z][a-z]{2}\\s+\\d{1,2})/)?.[1],
            daysOfWeek: (() => {
              const days = [];
              const dayPatterns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 
                                  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              dayPatterns.forEach(day => {
                if (itemText.includes(day)) {
                  days.push(day.substring(0, 3));
                }
              });
              return [...new Set(days)];
            })(),
            time: itemText.match(/(\\d{1,2}:\\d{2}\\s*[ap]\\.?m\\.?\\s*-\\s*\\d{1,2}:\\d{2}\\s*[ap]\\.?m\\.?)/i)?.[1],
            ageRange: (() => {
              const ageMatch = itemText.match(/Age:\\s*(\\d+)\\s*(?:to|-)?\\s*(\\d+)?/i);
              if (ageMatch) {
                return {
                  min: parseInt(ageMatch[1]),
                  max: ageMatch[2] ? parseInt(ageMatch[2]) : parseInt(ageMatch[1])
                };
              }
              return null;
            })(),
            location: (() => {
              const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym', 'Studio', 'Complex'];
              for (const keyword of locationKeywords) {
                const match = itemText.match(new RegExp(`([^,\\\\n]*${keyword}[^,\\\\n]*)`, 'i'));
                if (match) {
                  return match[1].trim().replace(/\\s+/g, ' ').substring(0, 100);
                }
              }
              return null;
            })(),
            price: parseFloat(itemText.match(/\\$([0-9,]+(?:\\.\\d{2})?)/)?.[1]?.replace(',', '') || '0'),
            availability: (() => {
              if (itemText.includes('Closed')) return 'Closed';
              if (itemText.includes('Waitlist')) return 'Waitlist';
              if (itemText.includes('Sign Up')) return 'Open';
              const hasLink = itemRow.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
              if (hasLink) return 'Available';
              return 'Unknown';
            })(),
            spotsAvailable: (() => {
              // Try multiple patterns for spots
              const patterns = [
                /Sign Up\\s*\\((\\d+)\\)/i,  // "Sign Up (7)"
                /(\\d+)\\s*spot(?:s)?\\s*(?:left|available)/i,  // "7 spots left" or "7 spots available"
                /\\((\\d+)\\s*(?:spot|seat)s?\\)/i  // "(7 spots)" or "(7 seats)"
              ];
              
              for (const pattern of patterns) {
                const match = itemText.match(pattern);
                if (match) {
                  return parseInt(match[1]);
                }
              }
              return 0;
            })(),
            registrationUrl: (() => {
              const possibleLinks = itemRow.querySelectorAll('a[href]');
              for (const link of possibleLinks) {
                const href = link.href;
                if (href.includes('BookMe4') || 
                    href.includes('courseId') || 
                    href.includes('register') ||
                    href.includes('enroll')) {
                  return href;
                }
              }
              return possibleLinks[0]?.href || null;
            })(),
            rawText: itemText.substring(0, 500)
          };
          
          if (activity.name || activity.code) {
            activities.push(activity);
          }
          
        } catch (error) {
          console.error('Error extracting activity:', error);
        }
      });
      
      return activities;
    }, sectionName, activityType);

    return pageActivities;
  }

  async enhanceActivitiesWithDetails(activities) {
    console.log(`🔍 Enhancing ${activities.length} activities with detailed information...`);
    
    let browser;
    const enhanced = [];
    const batchSize = 10; // Increased from 5 to 10 for faster processing
    
    try {
      browser = await puppeteer.launch({
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      
      for (let i = 0; i < activities.length; i += batchSize) { // Process all activities
        const batch = activities.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(activities.length / batchSize);
        const progress = ((i / activities.length) * 100).toFixed(1);
        console.log(`🔄 Processing batch ${batchNum}/${totalBatches} (${progress}% complete) - ${batch.length} activities...`);
        
        const batchResults = await Promise.all(
          batch.map(async (activity) => {
            if (!activity.registrationUrl) {
              return activity;
            }
            
            const page = await browser.newPage();
            try {
              await page.goto(activity.registrationUrl, { waitUntil: 'networkidle2', timeout: 30000 });
              
              // Extract comprehensive details using the dedicated extractor
              const details = await extractComprehensiveDetails(page);
              
              await page.close();
              
              // Merge the detailed information with the activity
              return {
                ...activity,
                // Basic info
                name: details.name || activity.name,
                courseId: details.courseId || activity.code,
                courseDetails: details.courseDetails,
                
                // Dates and times
                startDate: details.startDate,
                endDate: details.endDate, 
                startTime: details.startTime,
                endTime: details.endTime,
                registrationEndDate: details.registrationEndDate,
                registrationEndTime: details.registrationEndTime,
                
                // Costs
                cost: details.cost || activity.price,
                costIncludesTax: details.costIncludesTax,
                taxAmount: details.taxAmount,
                
                // Availability
                spotsAvailable: details.spotsAvailable !== undefined ? details.spotsAvailable : activity.spotsAvailable,
                totalSpots: details.totalSpots,
                registrationStatus: details.registrationStatus || activity.availability,
                
                // Location
                location: details.location || activity.location,
                fullAddress: details.fullAddress,
                
                // Details
                fullDescription: details.fullDescription,
                instructor: details.instructor,
                whatToBring: details.whatToBring,
                ageRestrictions: details.ageRestrictions,
                prerequisites: details.prerequisites,
                
                // Sessions
                sessions: details.sessions,
                hasMultipleSessions: details.sessions.length > 1,
                sessionCount: details.sessions.length,
                hasPrerequisites: details.prerequisites.length > 0,
                
                // Required Extras
                requiredExtras: details.requiredExtras
              };
            } catch (error) {
              console.warn(`Failed to fetch details for ${activity.name}:`, error.message);
              await page.close();
              return activity;
            }
          })
        );
        
        enhanced.push(...batchResults);
      }
    } finally {
      if (browser) await browser.close();
    }
    
    console.log(`✅ Enhanced ${enhanced.length} activities with detailed information`);
    return enhanced;
  }

  async saveActivitiesToDatabase(providerId) {
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    const newActivities = [];
    const changedActivities = [];
    
    // Mark all existing activities as not seen
    await this.prisma.activity.updateMany({
      where: { providerId },
      data: { isActive: false }
    });
    
    for (const activity of this.activities) {
      try {
        // Parse dates - handle both old format (MMM DD) and new format (MM/DD/YY)
        let startDate = null;
        let endDate = null;
        let dateRangeString = '';
        
        // First try to use the enhanced startDate/endDate fields (MM/DD/YY format)
        if (activity.startDate && activity.endDate) {
          try {
            // Parse MM/DD/YY format
            const parseEnhancedDate = (dateStr) => {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                const month = parseInt(parts[0]) - 1; // JS months are 0-indexed
                const day = parseInt(parts[1]);
                const year = 2000 + parseInt(parts[2]); // Convert YY to YYYY
                return new Date(year, month, day);
              }
              return null;
            };
            
            startDate = parseEnhancedDate(activity.startDate);
            endDate = parseEnhancedDate(activity.endDate);
            
            // Create a readable date range string
            if (startDate && endDate) {
              const formatDate = (date) => {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${months[date.getMonth()]} ${date.getDate()}`;
              };
              dateRangeString = `${formatDate(startDate)} - ${formatDate(endDate)}`;
            }
          } catch (e) {
            console.warn('Failed to parse enhanced dates:', e);
          }
        }
        
        // Fall back to old format if enhanced dates not available
        if (!startDate && activity.dates) {
          const currentYear = new Date().getFullYear();
          const dateMatch = activity.dates.match(/([A-Z][a-z]{2}\\s+\\d{1,2})\\s*-\\s*([A-Z][a-z]{2}\\s+\\d{1,2})/);
          
          if (dateMatch) {
            startDate = new Date(`${dateMatch[1]}, ${currentYear}`);
            endDate = new Date(`${dateMatch[2]}, ${currentYear}`);
            
            if (endDate < startDate) {
              endDate.setFullYear(currentYear + 1);
            }
            
            dateRangeString = activity.dates;
          }
        }
        
        // Create or update location
        let location = null;
        if (activity.location) {
          location = await this.prisma.location.upsert({
            where: {
              name_address: {
                name: activity.location,
                address: ''
              }
            },
            update: {
              city: 'North Vancouver',
              province: 'BC'
            },
            create: {
              name: activity.location,
              address: '',
              city: 'North Vancouver',
              province: 'BC',
              facility: this.determineFacilityType(activity.location)
            }
          });
        }
        
        // Generate external ID
        const externalId = activity.registrationUrl?.match(/courseId=([^&]+)/)?.[1] || 
                          activity.code ||
                          `${activity.name}_${activity.dates}_${activity.time}`.replace(/\\s+/g, '_');
        
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
        
        // Prepare activity data with all new fields
        const activityData = {
          providerId,
          externalId,
          name: activity.name || `${activity.activityType} - ${activity.activitySection}`,
          category: activity.section,
          subcategory: activity.activityType,
          description: activity.fullDescription || activity.activitySection,
          schedule: `${activity.daysOfWeek?.join(', ') || ''} ${activity.time || ''}`.trim(),
          dates: dateRangeString || activity.dates, // Add dates string field
          dateStart: startDate,
          dateEnd: endDate,
          registrationDate: activity.registrationDate ? new Date(activity.registrationDate) : null,
          registrationEndDate,
          registrationEndTime: activity.registrationEndTime,
          startTime: activity.startTime,
          endTime: activity.endTime,
          ageMin: activity.ageRange?.min || 0,
          ageMax: activity.ageRange?.max || 18,
          cost: activity.cost || activity.price || 0,
          costIncludesTax: activity.costIncludesTax !== undefined ? activity.costIncludesTax : true,
          taxAmount: activity.taxAmount,
          spotsAvailable: activity.spotsAvailable || 0,
          totalSpots: activity.totalSpots,
          locationId: location?.id,
          locationName: activity.location,
          registrationUrl: activity.registrationUrl,
          registrationStatus: activity.registrationStatus || (activity.spotsAvailable > 0 ? 'Open' : 'Unknown'),
          courseId: activity.courseId || activity.registrationUrl?.match(/courseId=([^&]+)/)?.[1],
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
          courseDetails: activity.courseDetails
        };
        
        // First, check if activity exists
        const existingActivity = await this.prisma.activity.findUnique({
          where: {
            providerId_externalId: {
              providerId,
              externalId
            }
          }
        });
        
        let result;
        let hasChanges = false;
        
        if (existingActivity) {
          // Compare key fields to detect changes
          const fieldsToCompare = [
            'name', 'description', 'schedule', 'dates', 'cost', 
            'spotsAvailable', 'registrationStatus', 'instructor',
            'fullDescription', 'startTime', 'endTime', 'totalSpots',
            'costIncludesTax', 'taxAmount', 'registrationEndDate',
            'registrationEndTime', 'courseDetails'
          ];
          
          // Check for changes
          const changes = [];
          for (const field of fieldsToCompare) {
            if (existingActivity[field] !== activityData[field]) {
              hasChanges = true;
              changes.push({
                field,
                oldValue: existingActivity[field],
                newValue: activityData[field]
              });
            }
          }
          
          // Also check date changes
          if (!hasChanges && (
            existingActivity.dateStart?.getTime() !== activityData.dateStart?.getTime() ||
            existingActivity.dateEnd?.getTime() !== activityData.dateEnd?.getTime()
          )) {
            hasChanges = true;
            console.log(`  Change detected in ${activity.name}: date range changed`);
          }
          
          // Update with conditional updatedAt
          if (hasChanges) {
            result = await this.prisma.activity.update({
              where: {
                providerId_externalId: {
                  providerId,
                  externalId
                }
              },
              data: {
                ...activityData,
                lastSeenAt: new Date(), // Always update lastSeenAt
                updatedAt: new Date()   // Only update if there are changes
              }
            });
            updated++;
            
            // Track changed activities
            if (changes.length > 0) {
              changedActivities.push({
                name: result.name,
                changes: changes
              });
              
              // Log significant changes
              for (const change of changes) {
                console.log(`  📝 ${activity.name}: ${change.field} changed from "${change.oldValue}" to "${change.newValue}"`);
              }
            }
          } else {
            // No changes, just update lastSeenAt
            result = await this.prisma.activity.update({
              where: {
                providerId_externalId: {
                  providerId,
                  externalId
                }
              },
              data: {
                lastSeenAt: new Date(), // Update lastSeenAt to show it's still active
                isActive: true
              }
            });
            unchanged++;
          }
        } else {
          // Create new activity
          result = await this.prisma.activity.create({
            data: activityData
          });
          created++;
          newActivities.push({
            name: result.name,
            category: result.category,
            subcategory: result.subcategory,
            schedule: result.schedule,
            cost: result.cost,
            location: result.locationName,
            registrationUrl: result.registrationUrl
          });
        }
        
        // Handle sessions
        if (activity.sessions && activity.sessions.length > 0) {
          // Delete existing sessions
          await this.prisma.activitySession.deleteMany({
            where: { activityId: result.id }
          });
          
          // Create new sessions
          const sessionData = activity.sessions.map((session, index) => ({
            activityId: result.id,
            sessionNumber: session.sessionNumber || index + 1,
            date: session.date,
            dayOfWeek: session.dayOfWeek,
            startTime: session.startTime,
            endTime: session.endTime,
            location: session.location,
            subLocation: session.subLocation,
            instructor: session.instructor,
            notes: session.notes
          }));
          
          await this.prisma.activitySession.createMany({
            data: sessionData
          });
        }
        
        // Handle prerequisites
        if (activity.prerequisites && activity.prerequisites.length > 0) {
          // Delete existing prerequisites
          await this.prisma.activityPrerequisite.deleteMany({
            where: { activityId: result.id }
          });
          
          // Create new prerequisites
          const prereqData = activity.prerequisites.map(prereq => ({
            activityId: result.id,
            name: prereq.name,
            url: prereq.url,
            courseId: prereq.courseId,
            isRequired: true
          }));
          
          await this.prisma.activityPrerequisite.createMany({
            data: prereqData
          });
        }
        
      } catch (error) {
        console.error(`Error saving activity ${activity.name}:`, error.message);
        errors++;
      }
    }
    
    // Count removed activities
    const removed = await this.prisma.activity.count({
      where: {
        providerId,
        isActive: false
      }
    });
    
    return { created, updated, unchanged, removed, errors, newActivities, changedActivities };
  }

  determineFacilityType(locationName) {
    const name = locationName.toLowerCase();
    if (name.includes('pool')) return 'Pool';
    if (name.includes('arena')) return 'Arena';
    if (name.includes('gym')) return 'Gym';
    if (name.includes('field')) return 'Field';
    if (name.includes('park')) return 'Park';
    if (name.includes('centre') || name.includes('center')) return 'Recreation Centre';
    if (name.includes('complex')) return 'Complex';
    return 'Facility';
  }

  summarizeActivities() {
    const summary = {
      bySection: {},
      byAvailability: {},
      byLocation: {},
      byActivityType: {},
      priceRange: { min: Infinity, max: 0 },
      ageRanges: new Set(),
      enhancedCount: 0,
      sessionsCount: 0,
      prerequisitesCount: 0
    };
    
    this.activities.forEach(activity => {
      // Count by section
      if (!summary.bySection[activity.section]) {
        summary.bySection[activity.section] = 0;
      }
      summary.bySection[activity.section]++;
      
      // Count by availability
      const availability = activity.availability || 'Unknown';
      if (!summary.byAvailability[availability]) {
        summary.byAvailability[availability] = 0;
      }
      summary.byAvailability[availability]++;
      
      // Count by location
      const location = activity.location || 'Unknown';
      if (!summary.byLocation[location]) {
        summary.byLocation[location] = 0;
      }
      summary.byLocation[location]++;
      
      // Count by activity type
      if (!summary.byActivityType[activity.activityType]) {
        summary.byActivityType[activity.activityType] = 0;
      }
      summary.byActivityType[activity.activityType]++;
      
      // Track price range
      if (activity.price) {
        summary.priceRange.min = Math.min(summary.priceRange.min, activity.price);
        summary.priceRange.max = Math.max(summary.priceRange.max, activity.price);
      }
      
      // Track age ranges
      if (activity.ageRange) {
        summary.ageRanges.add(`${activity.ageRange.min}-${activity.ageRange.max} years`);
      }
      
      // Count enhanced activities
      if (activity.sessions || activity.prerequisites || activity.instructor) {
        summary.enhancedCount++;
      }
      if (activity.sessions && activity.sessions.length > 0) {
        summary.sessionsCount++;
      }
      if (activity.prerequisites && activity.prerequisites.length > 0) {
        summary.prerequisitesCount++;
      }
    });
    
    summary.ageRanges = Array.from(summary.ageRanges).sort();
    summary.totalActivities = this.activities.length;
    
    return summary;
  }

  generateReport(stats, duration) {
    const timestamp = new Date().toISOString();
    const summary = this.summarizeActivities();
    
    let report = `
NVRC ENHANCED ACTIVITY SCRAPER REPORT
=====================================
Generated: ${timestamp}
Duration: ${duration} minutes

SUMMARY
-------
Total Activities Found: ${this.activities.length}
New Activities Added: ${stats.created}
Activities Updated: ${stats.updated}
Activities Unchanged: ${stats.unchanged || 0}
Activities Removed: ${stats.removed}
Errors: ${stats.errors}

ENHANCEMENT STATISTICS
---------------------
Activities with Enhanced Details: ${summary.enhancedCount}
Activities with Sessions: ${summary.sessionsCount}
Activities with Prerequisites: ${summary.prerequisitesCount}

ACTIVITIES BY SECTION
--------------------
`;
    
    Object.entries(summary.bySection).forEach(([section, count]) => {
      report += `${section}: ${count}\n`;
    });
    
    report += `
ACTIVITIES BY TYPE
------------------
`;
    
    Object.entries(summary.byActivityType).forEach(([type, count]) => {
      report += `${type}: ${count}\n`;
    });
    
    report += `
ACTIVITIES BY AVAILABILITY
--------------------------
`;
    
    Object.entries(summary.byAvailability).forEach(([status, count]) => {
      report += `${status}: ${count}\n`;
    });
    
    report += `
PRICE RANGE
-----------
`;
    
    if (summary.priceRange.min !== Infinity) {
      report += `Minimum: $${summary.priceRange.min}\n`;
      report += `Maximum: $${summary.priceRange.max}\n`;
    } else {
      report += `No price information available\n`;
    }
    
    report += `
AGE RANGES
----------
`;
    
    summary.ageRanges.forEach(range => {
      report += `${range}\n`;
    });
    
    if (stats.newActivities && stats.newActivities.length > 0) {
      report += `
NEW ACTIVITIES ADDED
--------------------
`;
      
      stats.newActivities.slice(0, 10).forEach((activity, idx) => {
        report += `
${idx + 1}. ${activity.name}
   Category: ${activity.category} / ${activity.subcategory}
   Schedule: ${activity.schedule}
   Cost: $${activity.cost}
   Location: ${activity.location || 'Not specified'}
   Registration: ${activity.registrationUrl ? 'Available' : 'Not available'}
`;
      });
      
      if (stats.newActivities.length > 10) {
        report += `\n... and ${stats.newActivities.length - 10} more activities\n`;
      }
    }
    
    if (stats.changedActivities && stats.changedActivities.length > 0) {
      report += `

ACTIVITIES WITH CHANGES
-----------------------
`;
      
      stats.changedActivities.slice(0, 10).forEach((activity, idx) => {
        report += `
${idx + 1}. ${activity.name}
`;
        activity.changes.forEach(change => {
          report += `   - ${change.field}: "${change.oldValue}" → "${change.newValue}"\n`;
        });
      });
      
      if (stats.changedActivities.length > 10) {
        report += `\n... and ${stats.changedActivities.length - 10} more activities with changes\n`;
      }
    }
    
    return report;
  }
}

module.exports = NVRCEnhancedParallelScraper;