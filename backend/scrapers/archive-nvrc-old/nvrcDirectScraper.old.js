const puppeteer = require('puppeteer');
const fs = require('fs');
const { PrismaClient } = require('../generated/prisma');

class NVRCDirectScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.prisma = new PrismaClient();
  }

  async scrape() {
    let browser;
    let scrapeJob;
    
    try {
      console.log('🚀 Starting NVRC Direct Scraper...');
      
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
      
      const launchOptions = {
        headless: this.options.headless !== undefined ? this.options.headless : true,
        slowMo: 0,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ],
        defaultViewport: null
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Step 1: Navigate to the PerfectMind URL
      console.log('\n📍 Step 1: Navigating to NVRC PerfectMind booking system...');
      const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      console.log('✅ Page loaded successfully');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 2: Process specific activity sections
      const targetSections = [
        "Early Years: On My Own",
        "All Ages & Family", 
        "Early Years: Parent Participation",
        "School Age",
        "Youth"
      ];
      
      console.log('\n📋 Step 2: Processing activity links in the following sections:');
      targetSections.forEach(section => console.log(`  - ${section}`));

      // Collect all activity links from the navigation menu
      const activityLinks = await page.evaluate(() => {
        const links = [];
        
        // Define sections we're interested in
        const targetSections = [
          "Early Years: On My Own",
          "All Ages & Family", 
          "Early Years: Parent Participation",
          "School Age",
          "Youth"
        ];
        
        // Get all links from the page
        const allLinks = Array.from(document.querySelectorAll('a'));
        
        // Group links by their section
        let currentSection = null;
        
        allLinks.forEach(link => {
          const text = link.textContent?.trim();
          
          // Check if this is a section header
          if (targetSections.includes(text)) {
            currentSection = text;
            console.log(`Found section: ${currentSection}`);
          }
          // If we're in a target section and this looks like an activity link
          else if (currentSection && text && text.includes('(') && text.includes(')')) {
            // Activity links have patterns like "Arts Dance (0-6yrs)" or "Swimming (0-6yrs PP)"
            links.push({
              section: currentSection,
              text: text,
              href: link.href
            });
            console.log(`  - Activity: ${text}`);
          }
        });
        
        return links;
      });

      console.log(`\n📊 Found ${activityLinks.length} activity links to process`);
      
      // Show sample links
      if (activityLinks.length > 0) {
        console.log('\nSample activity links:');
        activityLinks.slice(0, 5).forEach(link => {
          console.log(`  - ${link.text} (${link.section})`);
        });
      }

      // Process each activity link
      for (const activityLink of activityLinks) {
        console.log(`\n🔍 Processing: ${activityLink.text} (${activityLink.section})`);
        
        try {
          // Navigate to the activity page
          await page.goto(activityLink.href, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Step 3: Expand all "Show" links on the activity page
          console.log('  📂 Expanding all "Show" links...');
          let totalExpanded = 0;
          let hasMore = true;
          
          while (hasMore) {
            const expanded = await page.evaluate(() => {
              const expandButtons = Array.from(document.querySelectorAll('a, button'))
                .filter(el => {
                  const text = el.textContent?.trim().toLowerCase();
                  return text === 'show' || text === 'show more';
                });
              
              let clicked = 0;
              expandButtons.forEach(btn => {
                if (btn && typeof btn.click === 'function') {
                  btn.click();
                  clicked++;
                }
              });
              
              return clicked;
            });
            
            if (expanded > 0) {
              totalExpanded += expanded;
              console.log(`    → Clicked ${expanded} "Show" links`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              hasMore = false;
            }
          }
          
          if (totalExpanded > 0) {
            console.log(`    ✅ Expanded ${totalExpanded} activity groups`);
          }

          // Extract activities from this page
          const pageActivities = await this.extractActivitiesFromPage(page, activityLink.section, activityLink.text);
          console.log(`    ✅ Extracted ${pageActivities.length} sessions`);
          
          this.activities.push(...pageActivities);
          
        } catch (error) {
          console.error(`  ❌ Error processing ${activityLink.text}:`, error.message);
        }
      }

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
      
      // Save results to file for debugging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = {
        timestamp: new Date().toISOString(),
        url: url,
        totalActivities: this.activities.length,
        activities: this.activities,
        summary: this.summarizeActivities(),
        databaseStats: stats
      };
      
      const filename = `nvrc_direct_results_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`   Total activities found: ${this.activities.length}`);
      console.log(`   Activities created: ${stats.created}`);
      console.log(`   Activities updated: ${stats.updated}`);
      console.log(`   Activities removed: ${stats.removed}`);
      console.log(`   Results saved to: ${filename}`);
      
      return this.activities;
      
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
      if (browser) {
        await browser.close();
      }
      await this.prisma.$disconnect();
    }
  }

  async extractActivitiesFromPage(page, sectionName, activityType) {
    try {
      const activities = await page.evaluate((section, type) => {
        const extractedActivities = [];
        
        // Find all tables on the page
        const tables = document.querySelectorAll('table');
        
        tables.forEach((table, tableIndex) => {
          let currentActivityName = null;
          const rows = Array.from(table.querySelectorAll('tr'));
          
          rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const rowText = row.textContent || '';
            
            // Check if this is an activity name header (single cell, no action buttons)
            if (cells.length === 1 && 
                !rowText.includes('Sign Up') && 
                !rowText.includes('Waitlist') && 
                !rowText.includes('Closed')) {
              const headerText = cells[0].textContent?.trim();
              if (headerText && headerText.length > 3 && headerText.length < 200) {
                currentActivityName = headerText;
              }
            }
            
            // Check if this is an activity session row
            if (rowText.includes('Sign Up') || 
                rowText.includes('Waitlist') || 
                rowText.includes('Closed')) {
              
              const activity = {
                section: section,
                activityType: type,
                activityName: currentActivityName || type,
                sessionData: {}
              };
              
              // Extract data from cells
              cells.forEach((cell, cellIndex) => {
                const cellText = cell.textContent?.trim() || '';
                
                // Date pattern (e.g., "Jan 6 - Mar 24, 2025")
                if (cellText.match(/[A-Z][a-z]{2}\s+\d{1,2}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2}/)) {
                  activity.sessionData.dateRange = cellText;
                  
                  // Parse dates
                  const dateMatch = cellText.match(/([A-Z][a-z]{2}\s+\d{1,2})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2}),?\s*(\d{4})?/);
                  if (dateMatch) {
                    const year = dateMatch[3] || new Date().getFullYear();
                    activity.sessionData.startDate = `${dateMatch[1]}, ${year}`;
                    activity.sessionData.endDate = `${dateMatch[2]}, ${year}`;
                  }
                }
                
                // Day pattern
                else if (cellText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)) {
                  activity.sessionData.days = cellText;
                }
                
                // Time pattern
                else if (cellText.match(/\d{1,2}:\d{2}\s*[ap]m/i)) {
                  activity.sessionData.time = cellText;
                  
                  // Parse times
                  const timeMatch = cellText.match(/(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
                  if (timeMatch) {
                    activity.sessionData.startTime = timeMatch[1];
                    activity.sessionData.endTime = timeMatch[2];
                  }
                }
                
                // Price pattern
                else if (cellText.match(/\$[\d,]+(\.\d{2})?/)) {
                  activity.sessionData.price = cellText;
                  // Extract numeric value
                  const priceMatch = cellText.match(/\$([\d,]+(?:\.\d{2})?)/);
                  if (priceMatch) {
                    activity.sessionData.priceAmount = parseFloat(priceMatch[1].replace(',', ''));
                  }
                }
                
                // Age pattern
                else if (cellText.match(/\d+\s*[-–]\s*\d+\s*yr/i) || cellText.match(/\d+\+?\s*yr/i)) {
                  activity.sessionData.ageRange = cellText;
                  
                  // Parse age range
                  const ageMatch = cellText.match(/(\d+)\s*[-–]\s*(\d+)\s*yr/i);
                  if (ageMatch) {
                    activity.sessionData.ageMin = parseInt(ageMatch[1]);
                    activity.sessionData.ageMax = parseInt(ageMatch[2]);
                  } else {
                    const agePlusMatch = cellText.match(/(\d+)\+?\s*yr/i);
                    if (agePlusMatch) {
                      activity.sessionData.ageMin = parseInt(agePlusMatch[1]);
                      activity.sessionData.ageMax = 18;
                    }
                  }
                }
                
                // Status
                else if (cellText === 'Sign Up' || cellText === 'Waitlist' || cellText === 'Closed') {
                  activity.sessionData.status = cellText;
                  
                  // Extract spots if available
                  const parentText = cell.parentElement?.textContent || '';
                  const spotsMatch = parentText.match(/\((\d+)\s*spot/i);
                  if (spotsMatch) {
                    activity.sessionData.spotsAvailable = parseInt(spotsMatch[1]);
                  }
                }
                
                // Location (contains keywords)
                else if (cellText.includes('Centre') || 
                         cellText.includes('Pool') || 
                         cellText.includes('Arena') ||
                         cellText.includes('Park') ||
                         cellText.includes('Gym') ||
                         cellText.includes('Complex')) {
                  activity.sessionData.location = cellText;
                }
              });
              
              // Get registration link
              const regLink = row.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
              if (regLink) {
                activity.sessionData.registrationUrl = regLink.href;
                
                // Extract course ID from URL
                const courseIdMatch = regLink.href.match(/courseId=([^&]+)/);
                if (courseIdMatch) {
                  activity.sessionData.courseId = courseIdMatch[1];
                }
              }
              
              extractedActivities.push(activity);
            }
          });
        });
        
        return extractedActivities;
      }, sectionName, activityType);
      
      return activities;
      
    } catch (error) {
      console.error(`Error extracting activities from ${sectionName}:`, error);
      return [];
    }
  }

  async saveActivitiesToDatabase(providerId) {
    let created = 0;
    let updated = 0;
    let errors = 0;
    
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
        
        if (activity.sessionData.startDate) {
          startDate = new Date(activity.sessionData.startDate);
          if (isNaN(startDate.getTime())) startDate = null;
        }
        
        if (activity.sessionData.endDate) {
          endDate = new Date(activity.sessionData.endDate);
          if (isNaN(endDate.getTime())) endDate = null;
        }
        
        // Create or update location
        let location = null;
        if (activity.sessionData.location) {
          location = await this.prisma.location.upsert({
            where: {
              name_address: {
                name: activity.sessionData.location,
                address: ''
              }
            },
            update: {
              city: 'North Vancouver',
              province: 'BC'
            },
            create: {
              name: activity.sessionData.location,
              address: '',
              city: 'North Vancouver',
              province: 'BC',
              facility: this.determineFacilityType(activity.sessionData.location)
            }
          });
        }
        
        // Generate external ID
        const externalId = activity.sessionData.courseId || 
                          `${activity.activityName}_${activity.sessionData.dateRange}_${activity.sessionData.location}`.replace(/\s+/g, '_');
        
        // Prepare activity data
        const activityData = {
          providerId,
          externalId,
          name: activity.activityName,
          category: activity.section,
          subcategory: activity.activityType,
          description: null,
          schedule: `${activity.sessionData.days || ''} ${activity.sessionData.time || ''}`.trim(),
          dateStart: startDate,
          dateEnd: endDate,
          ageMin: activity.sessionData.ageMin || 0,
          ageMax: activity.sessionData.ageMax || 18,
          cost: activity.sessionData.priceAmount || 0,
          spotsAvailable: activity.sessionData.spotsAvailable || 0,
          locationId: location?.id,
          locationName: activity.sessionData.location,
          registrationUrl: activity.sessionData.registrationUrl,
          courseId: activity.sessionData.courseId,
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
        } else {
          updated++;
        }
        
      } catch (error) {
        console.error(`Error saving activity ${activity.activityName}:`, error.message);
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
    
    return { created, updated, removed, errors };
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
      byStatus: {},
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
      
      // Count by status
      const status = activity.sessionData.status || 'Unknown';
      if (!summary.byStatus[status]) {
        summary.byStatus[status] = 0;
      }
      summary.byStatus[status]++;
      
      // Count by location
      const location = activity.sessionData.location || 'Unknown';
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
      if (activity.sessionData.priceAmount) {
        summary.priceRange.min = Math.min(summary.priceRange.min, activity.sessionData.priceAmount);
        summary.priceRange.max = Math.max(summary.priceRange.max, activity.sessionData.priceAmount);
      }
      
      // Track age ranges
      if (activity.sessionData.ageRange) {
        summary.ageRanges.add(activity.sessionData.ageRange);
      }
    });
    
    summary.ageRanges = Array.from(summary.ageRanges).sort();
    summary.totalActivities = this.activities.length;
    
    return summary;
  }
}

// Run the scraper if called directly
if (require.main === module) {
  const scraper = new NVRCDirectScraper({ 
    headless: process.argv.includes('--debug') ? false : true 
  });
  
  scraper.scrape()
    .then(activities => {
      console.log('\n📊 Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = NVRCDirectScraper;