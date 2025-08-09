const puppeteer = require('puppeteer');
const fs = require('fs');
const { PrismaClient } = require('../generated/prisma');

class NVRCFixedExtractionScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.prisma = new PrismaClient();
  }

  async scrape() {
    let browser;
    let scrapeJob;
    
    try {
      console.log('🚀 Starting NVRC Fixed Extraction Scraper...');
      
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
        args: this.options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--window-size=1920,1080'
        ],
        defaultViewport: null,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      console.log('Browser launch options:', { ...launchOptions, executablePath: '...' });
      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
          console.log('PAGE LOG:', msg.text());
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the PerfectMind widget directly
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });

      // Wait for the page to load
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Define the sections we need to process
      const targetSections = [
        'Early Years: On My Own',
        'All Ages & Family',
        'Early Years: Parent Participation',
        'School Age',
        'Youth'
      ];

      // Process each section
      for (const sectionName of targetSections) {
        console.log(`\n📂 Processing section: ${sectionName}`);
        
        try {
          // Find and click the section link
          const sectionClicked = await page.evaluate((section) => {
            const links = Array.from(document.querySelectorAll('a'));
            const sectionLink = links.find(link => 
              link.textContent?.trim() === section
            );
            if (sectionLink) {
              sectionLink.click();
              return true;
            }
            return false;
          }, sectionName);
          
          if (!sectionClicked) {
            console.log(`  ⚠️ Could not find section link for ${sectionName}`);
            continue;
          }
          
          // Wait for navigation
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Extract activities from this section
          await this.extractActivitiesFromSectionFixed(page, sectionName);
          
          // Navigate back to main page
          await page.goto(widgetUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`  ❌ Error processing section ${sectionName}:`, error.message);
        }
      }

      console.log(`\n✅ Total activities extracted: ${this.activities.length}`);
      
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
      
      // Save results locally if not in production
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `nvrc_fixed_extraction_${timestamp}.json`;
          
          const results = {
            timestamp: new Date().toISOString(),
            url: widgetUrl,
            activitiesCount: this.activities.length,
            activities: this.activities,
            summary: this.summarizeActivities(),
            databaseStats: stats
          };
          
          fs.writeFileSync(filename, JSON.stringify(results, null, 2));
          console.log(`💾 Results saved to ${filename}`);
        } catch (err) {
          console.log('💾 Could not save results file');
        }
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`   Total activities found: ${this.activities.length}`);
      console.log(`   Activities created: ${stats.created}`);
      console.log(`   Activities updated: ${stats.updated}`);
      console.log(`   Activities removed: ${stats.removed}`);
      
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

  async extractActivitiesFromSectionFixed(page, sectionName) {
    try {
      // First wait for the page to load
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Look for "Show" links that expand activity groups
      const showLinksCount = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, span'));
        const showLinks = links.filter(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'show' || text.includes('Show');
        });
        return showLinks.length;
      });

      if (showLinksCount > 0) {
        console.log(`  📁 Found ${showLinksCount} activity groups to expand...`);
        
        // Click each "Show" link one by one
        for (let i = 0; i < showLinksCount; i++) {
          const clicked = await page.evaluate((index) => {
            const links = Array.from(document.querySelectorAll('a, button, span'));
            const showLinks = links.filter(el => {
              const text = el.textContent?.trim() || '';
              return text.toLowerCase() === 'show' || text.includes('Show');
            });
            
            if (showLinks[index]) {
              showLinks[index].click();
              return true;
            }
            return false;
          }, i);
          
          if (clicked) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
        
        console.log(`  ✅ Expanded all activity groups`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Extract all activities using improved logic
      const pageActivities = await page.evaluate((section) => {
        const activities = [];
        
        // Method 1: Sequential parsing - most reliable
        const titleRows = Array.from(document.querySelectorAll('.bm-group-title-row'));
        
        console.log(`Sequential parsing: Found ${titleRows.length} title rows`);
        
        titleRows.forEach((titleRow, titleIdx) => {
          const titleText = titleRow.textContent?.trim() || '';
          console.log(`Processing title ${titleIdx}: "${titleText}"`);
          
          let nextEl = titleRow.nextElementSibling;
          let itemCount = 0;
          let processedCount = 0;
          
          // Collect all items until we hit another title or run out of siblings
          while (nextEl && !nextEl.classList.contains('bm-group-title-row')) {
            if (nextEl.classList.contains('bm-group-item-row')) {
              itemCount++;
              const itemText = nextEl.textContent || '';
              
              // Only process items that look like actual activities
              if (itemText.includes('Sign Up') || 
                  itemText.includes('Waitlist') || 
                  itemText.includes('Closed')) {
                processedCount++;
                
                try {
                  const activity = {
                    id: `${section}_${titleIdx}_${itemCount}`,
                    section: section,
                    name: titleText,
                    
                    // Extract dates (looking for patterns like "Jan 6 - Mar 24")
                    dates: (() => {
                      const dateMatch = itemText.match(/([A-Z][a-z]{2}\s+\d{1,2}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2})/);
                      return dateMatch ? dateMatch[1] : null;
                    })(),
                    
                    // Extract days of week
                    daysOfWeek: (() => {
                      const days = [];
                      const dayPatterns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 
                                          'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      dayPatterns.forEach(day => {
                        if (itemText.includes(day)) {
                          days.push(day.substring(0, 3)); // Normalize to 3-letter format
                        }
                      });
                      return [...new Set(days)]; // Remove duplicates
                    })(),
                    
                    // Extract time
                    time: (() => {
                      const timeMatch = itemText.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
                      return timeMatch ? timeMatch[1] : null;
                    })(),
                    
                    // Extract age range
                    ageRange: (() => {
                      const ageMatch = itemText.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
                      if (ageMatch) {
                        return {
                          min: parseInt(ageMatch[1]),
                          max: parseInt(ageMatch[2])
                        };
                      }
                      const agePlusMatch = itemText.match(/(\d+)\+?\s*yr?s?/i);
                      if (agePlusMatch) {
                        return {
                          min: parseInt(agePlusMatch[1]),
                          max: 18
                        };
                      }
                      return null;
                    })(),
                    
                    // Extract location
                    location: (() => {
                      const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym', 'Studio'];
                      for (const keyword of locationKeywords) {
                        const match = itemText.match(new RegExp(`([^,\\n]*${keyword}[^,\\n]*)`, 'i'));
                        if (match) {
                          return match[1].trim().replace(/\s+/g, ' ');
                        }
                      }
                      return null;
                    })(),
                    
                    // Extract price
                    price: (() => {
                      const priceMatch = itemText.match(/\$([0-9,]+(?:\.\d{2})?)/);
                      return priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                    })(),
                    
                    // Extract availability status
                    availability: (() => {
                      if (itemText.includes('Closed')) return 'Closed';
                      if (itemText.includes('Waitlist')) return 'Waitlist';
                      if (itemText.includes('Sign Up')) return 'Open';
                      return 'Unknown';
                    })(),
                    
                    // Extract spots available
                    spotsAvailable: (() => {
                      const spotsMatch = itemText.match(/(\d+)\s*spot/i);
                      if (spotsMatch) return parseInt(spotsMatch[1]);
                      
                      const signUpMatch = itemText.match(/Sign Up\s*\((\d+)\)/i);
                      if (signUpMatch) return parseInt(signUpMatch[1]);
                      
                      return null;
                    })(),
                    
                    // Extract registration URL
                    registrationUrl: (() => {
                      const signUpLink = nextEl.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                      return signUpLink?.href || null;
                    })(),
                    
                    // Store raw text for debugging
                    rawText: itemText.substring(0, 500),
                    extractionMethod: 'sequential'
                  };
                  
                  activities.push(activity);
                  
                } catch (error) {
                  console.error('Error extracting activity from item:', error);
                }
              }
            }
            nextEl = nextEl.nextElementSibling;
          }
          
          console.log(`Title "${titleText}": found ${itemCount} items, processed ${processedCount}`);
        });
        
        // Method 2: Container-based approach as fallback
        if (activities.length === 0) {
          console.log('Sequential method found no activities, trying container-based approach...');
          
          const containers = Array.from(document.querySelectorAll('*'));
          
          containers.forEach(container => {
            const titles = container.querySelectorAll('.bm-group-title-row');
            const items = container.querySelectorAll('.bm-group-item-row');
            
            if (titles.length === 1 && items.length > 0) {
              const title = titles[0].textContent?.trim();
              items.forEach((item, idx) => {
                const itemText = item.textContent || '';
                if (itemText.includes('Sign Up') || 
                    itemText.includes('Waitlist') || 
                    itemText.includes('Closed')) {
                  activities.push({
                    id: `${section}_container_${idx}`,
                    section: section,
                    name: title,
                    rawText: itemText.substring(0, 500),
                    extractionMethod: 'container'
                  });
                }
              });
            }
          });
        }
        
        console.log(`Total activities extracted: ${activities.length}`);
        return activities;
      }, sectionName);

      console.log(`  ✅ Extracted ${pageActivities.length} activities from ${sectionName}`);
      
      // Log extraction methods used
      const methods = {};
      pageActivities.forEach(act => {
        methods[act.extractionMethod] = (methods[act.extractionMethod] || 0) + 1;
      });
      console.log(`     Extraction methods:`, methods);
      
      // Add section activities to total
      this.activities.push(...pageActivities);
      
    } catch (error) {
      console.error(`Error extracting activities from section:`, error);
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
                          `${activity.name}_${activity.dates}_${activity.time}`.replace(/\s+/g, '_');
        
        // Prepare activity data
        const activityData = {
          providerId,
          externalId,
          name: activity.name,
          category: activity.section,
          subcategory: null,
          description: null,
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
      byAvailability: {},
      byLocation: {},
      byExtractionMethod: {},
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
      
      // Count by extraction method
      const method = activity.extractionMethod || 'unknown';
      if (!summary.byExtractionMethod[method]) {
        summary.byExtractionMethod[method] = 0;
      }
      summary.byExtractionMethod[method]++;
      
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
}

module.exports = NVRCFixedExtractionScraper;