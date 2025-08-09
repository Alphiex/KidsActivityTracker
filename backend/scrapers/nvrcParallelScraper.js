const puppeteer = require('puppeteer');
const fs = require('fs');
const { PrismaClient } = require('../generated/prisma');

class NVRCParallelScraper {
  constructor(options = {}) {
    this.options = {
      headless: true,
      maxConcurrency: options.maxConcurrency || 3, // Number of parallel browsers
      ...options
    };
    this.activities = [];
    this.prisma = new PrismaClient();
  }

  async scrape() {
    let scrapeJob;
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting NVRC Parallel Scraper...');
      console.log(`🔧 Max concurrency: ${this.options.maxConcurrency} browsers`);
      
      // Get or create provider
      const provider = await this.prisma.provider.upsert({
        where: { name: 'NVRC' },
        update: {},
        create: {
          name: 'NVRC',
          website: 'https://www.nvrc.ca',
          isActive: true
        }
      });
      
      console.log(`📍 Provider: ${provider.name} (${provider.id})`);
      
      // Create scrape job
      scrapeJob = await this.prisma.scrapeJob.create({
        data: {
          providerId: provider.id,
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

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
        
        // Collect results from successful processes
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
      
      // Save activities to database
      console.log('\n💾 Saving activities to database...');
      const stats = await this.saveActivitiesToDatabase(provider.id);
      
      // Update scrape job
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
      
      // Generate and save report
      const report = this.generateReport(stats, duration);
      console.log(report);
      
      // Save detailed results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_parallel_results_${timestamp}.json`;
      
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
      
      // Save report
      const reportFilename = `nvrc_scraper_report_${timestamp}.txt`;
      fs.writeFileSync(reportFilename, report);
      console.log(`📄 Report saved to ${reportFilename}`);
      
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
              const match = titleText.match(/([A-Za-z\s&]+(?:Early Years|All Ages)?)/);
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
            dates: itemText.match(/([A-Z][a-z]{2}\s+\d{1,2}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2})/)?.[1],
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
            time: itemText.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i)?.[1],
            ageRange: (() => {
              const ageMatch = itemText.match(/Age:\s*(\d+)\s*(?:to|-)?\s*(\d+)?/i);
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
                const match = itemText.match(new RegExp(`([^,\\n]*${keyword}[^,\\n]*)`, 'i'));
                if (match) {
                  return match[1].trim().replace(/\s+/g, ' ').substring(0, 100);
                }
              }
              return null;
            })(),
            price: parseFloat(itemText.match(/\$([0-9,]+(?:\.\d{2})?)/)?.[1]?.replace(',', '') || '0'),
            availability: (() => {
              if (itemText.includes('Closed')) return 'Closed';
              if (itemText.includes('Waitlist')) return 'Waitlist';
              if (itemText.includes('Sign Up')) return 'Open';
              const hasLink = itemRow.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
              if (hasLink) return 'Available';
              return 'Unknown';
            })(),
            spotsAvailable: parseInt(itemText.match(/Sign Up\s*\((\d+)\)/i)?.[1] || '0'),
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

  async saveActivitiesToDatabase(providerId) {
    let created = 0;
    let updated = 0;
    let errors = 0;
    const newActivities = [];
    
    // Mark all existing activities as not seen
    await this.prisma.activity.updateMany({
      where: { providerId },
      data: { isActive: false }
    });
    
    for (const activity of this.activities) {
      try {
        // Parse dates
        let startDate = null;
        let endDate = null;
        
        if (activity.dates) {
          const currentYear = new Date().getFullYear();
          const dateMatch = activity.dates.match(/([A-Z][a-z]{2}\s+\d{1,2})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2})/);
          
          if (dateMatch) {
            startDate = new Date(`${dateMatch[1]}, ${currentYear}`);
            endDate = new Date(`${dateMatch[2]}, ${currentYear}`);
            
            if (endDate < startDate) {
              endDate.setFullYear(currentYear + 1);
            }
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
                          `${activity.name}_${activity.dates}_${activity.time}`.replace(/\s+/g, '_');
        
        // Prepare activity data
        const activityData = {
          providerId,
          externalId,
          name: activity.name || `${activity.activityType} - ${activity.activitySection}`,
          category: activity.section,
          subcategory: activity.activityType,
          description: activity.activitySection,
          schedule: `${activity.daysOfWeek?.join(', ') || ''} ${activity.time || ''}`.trim(),
          dateStart: startDate,
          dateEnd: endDate,
          ageMin: activity.ageRange?.min || 0,
          ageMax: activity.ageRange?.max || 18,
          cost: activity.price || 0,
          spotsAvailable: activity.spotsAvailable || 0,
          locationId: location?.id,
          locationName: activity.location,
          registrationUrl: activity.registrationUrl,
          courseId: activity.registrationUrl?.match(/courseId=([^&]+)/)?.[1],
          isActive: true,
          lastSeenAt: new Date(),
          rawData: activity
        };
        
        // Upsert activity
        const result = await this.prisma.activity.upsert({
          where: {
            providerId_externalId: {
              providerId,
              externalId
            }
          },
          update: {
            ...activityData,
            updatedAt: new Date()
          },
          create: activityData
        });
        
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
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
        } else {
          updated++;
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
    
    return { created, updated, removed, errors, newActivities };
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
      ageRanges: new Set()
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
    });
    
    summary.ageRanges = Array.from(summary.ageRanges).sort();
    summary.totalActivities = this.activities.length;
    
    return summary;
  }

  generateReport(stats, duration) {
    const timestamp = new Date().toISOString();
    const summary = this.summarizeActivities();
    
    let report = `
NVRC ACTIVITY SCRAPER REPORT
============================
Generated: ${timestamp}
Duration: ${duration} minutes

SUMMARY
-------
Total Activities Found: ${this.activities.length}
New Activities Added: ${stats.created}
Activities Updated: ${stats.updated}
Activities Removed: ${stats.removed}
Errors: ${stats.errors}

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
      
      stats.newActivities.forEach((activity, idx) => {
        report += `
${idx + 1}. ${activity.name}
   Category: ${activity.category} / ${activity.subcategory}
   Schedule: ${activity.schedule}
   Cost: $${activity.cost}
   Location: ${activity.location || 'Not specified'}
   Registration: ${activity.registrationUrl ? 'Available' : 'Not available'}
`;
      });
    }
    
    return report;
  }
}

module.exports = NVRCParallelScraper;