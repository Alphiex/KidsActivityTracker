const puppeteer = require('puppeteer');
const fs = require('fs');
const { PrismaClient } = require('../generated/prisma');

class NVRCPerfectMindScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.prisma = new PrismaClient();
  }

  async scrape() {
    let browser;
    let scrapeJob;
    
    try {
      console.log('🚀 Starting NVRC PerfectMind Direct Scraper...');
      
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

      // First, let's analyze the page structure to find activity links
      console.log('\n🔍 Analyzing page structure...');
      
      const pageStructure = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        const structure = {
          totalLinks: allLinks.length,
          linksBySection: {},
          activityPatterns: []
        };
        
        // Group links by their content patterns
        allLinks.forEach(link => {
          const text = link.textContent?.trim() || '';
          
          // Activity links often have patterns like "(0-6yrs)", "(All Ages)", etc.
          if (text.match(/\([^)]+\)/) && !text.includes('Drop-In') && !text.includes('Book')) {
            structure.activityPatterns.push({
              text: text,
              href: link.href,
              hasOnClick: !!link.onclick
            });
          }
        });
        
        return structure;
      });
      
      console.log(`Found ${pageStructure.totalLinks} total links`);
      console.log(`Found ${pageStructure.activityPatterns.length} potential activity links`);
      
      // Process each section by finding and clicking activity links within it
      for (const sectionName of targetSections) {
        console.log(`\n📂 Processing section: ${sectionName}`);
        
        try {
          // Find all activity links that belong to this section
          const sectionLinks = await page.evaluate((section) => {
            const links = [];
            const allElements = Array.from(document.querySelectorAll('*'));
            
            // Find the section header
            let sectionElement = null;
            for (const el of allElements) {
              if (el.textContent?.trim() === section) {
                sectionElement = el;
                break;
              }
            }
            
            if (!sectionElement) {
              console.log(`Section header not found: ${section}`);
              return links;
            }
            
            // Find the container that holds this section's links
            let currentElement = sectionElement;
            let container = null;
            
            // Look for the next sibling or parent that contains links
            while (currentElement && !container) {
              const nextSibling = currentElement.nextElementSibling;
              if (nextSibling) {
                const linksInSibling = nextSibling.querySelectorAll('a');
                if (linksInSibling.length > 0) {
                  container = nextSibling;
                  break;
                }
              }
              
              // Check parent's next sibling
              currentElement = currentElement.parentElement;
              if (currentElement && currentElement.nextElementSibling) {
                const linksInParentSibling = currentElement.nextElementSibling.querySelectorAll('a');
                if (linksInParentSibling.length > 0) {
                  container = currentElement.nextElementSibling;
                  break;
                }
              }
            }
            
            if (container) {
              // Get all links from the container that look like activities
              const containerLinks = Array.from(container.querySelectorAll('a'));
              
              // Stop when we hit the next section
              const nextSectionPatterns = [
                'Early Years: On My Own',
                'All Ages & Family',
                'Early Years: Parent Participation',
                'School Age',
                'Youth',
                'Adult'
              ];
              
              for (const link of containerLinks) {
                const text = link.textContent?.trim() || '';
                
                // Stop if we hit another section
                if (nextSectionPatterns.includes(text) && text !== section) {
                  break;
                }
                
                // Activity links have patterns like "Arts Dance (0-6yrs)"
                if (text.includes('(') && text.includes(')') && 
                    !text.includes('Drop-In') && 
                    !text.includes('Book') &&
                    text.length > 5) {
                  links.push({
                    text: text,
                    element: containerLinks.indexOf(link) // Store index instead of element
                  });
                }
              }
            }
            
            return links;
          }, sectionName);
          
          console.log(`  📋 Found ${sectionLinks.length} activity links in ${sectionName}`);
          
          if (sectionLinks.length > 0) {
            console.log('  Activity links found:');
            sectionLinks.forEach(link => console.log(`    - ${link.text}`));
          }
          
          // Click on each activity link in this section
          for (const linkInfo of sectionLinks) {
            console.log(`\n  🔗 Clicking on: ${linkInfo.text}`);
            
            try {
              // Click the activity link
              const clicked = await page.evaluate((section, linkIndex) => {
                // Re-find the section and container
                const allElements = Array.from(document.querySelectorAll('*'));
                let sectionElement = null;
                
                for (const el of allElements) {
                  if (el.textContent?.trim() === section) {
                    sectionElement = el;
                    break;
                  }
                }
                
                if (!sectionElement) return false;
                
                // Find container again
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
                  const links = Array.from(container.querySelectorAll('a'));
                  if (links[linkIndex]) {
                    links[linkIndex].click();
                    return true;
                  }
                }
                
                return false;
              }, sectionName, linkInfo.element);
              
              if (clicked) {
                // Wait for page to load
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Extract activities from this page
                await this.extractActivitiesFromSection(page, sectionName, linkInfo.text);
                
                // Navigate back to main page
                await page.goto(widgetUrl, {
                  waitUntil: 'networkidle0',
                  timeout: 60000
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
              } else {
                console.log(`    ⚠️  Could not click on ${linkInfo.text}`);
              }
              
            } catch (error) {
              console.error(`    ❌ Error clicking ${linkInfo.text}:`, error.message);
            }
          }
          
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
          const filename = `nvrc_perfectmind_${timestamp}.json`;
          
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

  async extractActivitiesFromSection(page, sectionName, activityType = '') {
    try {
      // First wait for the page to load
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Look for "Show" links that expand activity groups
      const showLinks = await page.evaluate(() => {
        // Find all elements with "Show" text that are likely expand buttons
        const links = Array.from(document.querySelectorAll('a, button, span'));
        const showLinks = links.filter(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'show' || text.includes('Show');
        });
        return showLinks.length;
      });

      if (showLinks > 0) {
        console.log(`  📁 Found ${showLinks} activity groups to expand...`);
        
        // Click each "Show" link one by one
        for (let i = 0; i < showLinks; i++) {
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

      // Extract all activities from the page
      const pageActivities = await page.evaluate((section, actType) => {
        const activities = [];
        
        // PerfectMind uses div-based layouts, not tables
        // Look for activity group titles and items
        const groupTitles = document.querySelectorAll('.bm-group-title-row');
        const groupItems = document.querySelectorAll('.bm-group-item-row');
        
        console.log(`Found ${groupTitles.length} group titles and ${groupItems.length} activity items`);
        
        // Extract activity names from group titles
        const activityNames = {};
        groupTitles.forEach((titleRow, idx) => {
          const titleText = titleRow.textContent?.trim();
          if (titleText) {
            activityNames[idx] = titleText;
            console.log(`Activity group ${idx}: ${titleText}`);
          }
        });
        
        // Extract individual sessions from group items
        console.log(`Processing ${groupItems.length} group items...`);
        
        groupItems.forEach((itemRow, idx) => {
          try {
            const itemText = itemRow.textContent || '';
            
            // Debug logging
            if (idx < 3) {
              console.log(`Item ${idx} text preview: ${itemText.substring(0, 100)}...`);
            }
            
            // Look for any activity indicator (price, course ID, or registration link)
            const hasPrice = itemText.includes('$');
            const hasCourseId = itemText.includes('#');
            const hasLink = itemRow.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
            
            if (!hasPrice && !hasCourseId && !hasLink) {
              console.log(`Skipping item ${idx} - no activity indicators`);
              return;
            }
            
            // Extract activity name from the specific element
            const nameElement = itemRow.querySelector('.bm-group-item-name');
            const courseIdElement = itemRow.querySelector('.bm-group-item-course-id');
            
            let activityName = nameElement?.textContent?.trim() || '';
            const courseId = courseIdElement?.textContent?.trim() || '';
            
            // If no name found, try to extract from text
            if (!activityName) {
              const nameMatch = itemText.match(/^([^#\n]+?)(?:#|$)/);
              if (nameMatch) {
                activityName = nameMatch[1].trim();
              }
            }
            
            // Find which section this belongs to
            let activitySection = actType;
            let prevTitle = itemRow.previousElementSibling;
            while (prevTitle) {
              if (prevTitle.classList.contains('bm-group-title-row')) {
                const titleText = prevTitle.textContent?.trim() || '';
                // Extract just the section name (e.g., "Arts & Crafts Early Years")
                const sectionMatch = titleText.match(/^[A-Z]?\s*(.+?)(?:\s+Read more|\s+Show|\s+Hide|$)/);
                if (sectionMatch) {
                  activitySection = sectionMatch[1].trim();
                }
                break;
              }
              prevTitle = prevTitle.previousElementSibling;
            }
            
            // Extract data from the row
            const activity = {
              id: `${section}_item_${idx}`,
              section: section,
              activityType: actType,
              activitySection: activitySection,
              name: activityName,
              code: courseId,
                
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
                  // Look for patterns like "5-12 yrs" or "6+" 
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
                  // Look for location patterns
                  const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym', 'Studio'];
                  for (const keyword of locationKeywords) {
                    const match = itemText.match(new RegExp(`([^,\\n]*${keyword}[^,\\n]*)`, 'i'));
                    if (match) {
                      const loc = match[1].trim();
                      // Clean up location
                      return loc.replace(/\s+/g, ' ').substring(0, 100);
                    }
                  }
                  return null;
                })(),
                
                // Extract price
                price: (() => {
                  const priceMatch = itemText.match(/\$([0-9,]+(?:\.\d{2})?)/);
                  return priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                })(),
                
                // Extract availability status and spots
                availability: (() => {
                  if (itemText.includes('Closed')) return 'Closed';
                  if (itemText.includes('Waitlist')) return 'Waitlist';
                  if (itemText.includes('Sign Up')) return 'Open';
                  // If no explicit status but has price, check for registration link
                  const hasLink = itemRow.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                  if (hasLink) return 'Available';
                  return 'Unknown';
                })(),
                
                spotsAvailable: (() => {
                  const spotsMatch = itemText.match(/(\d+)\s*spot/i);
                  if (spotsMatch) return parseInt(spotsMatch[1]);
                  
                  // If it says "Sign Up" with a number in parentheses
                  const signUpMatch = itemText.match(/Sign Up\s*\((\d+)\)/i);
                  if (signUpMatch) return parseInt(signUpMatch[1]);
                  
                  return null;
                })(),
                
                // Extract registration URL
                registrationUrl: (() => {
                  // Look for any link that might be a registration link
                  const possibleLinks = itemRow.querySelectorAll('a[href]');
                  for (const link of possibleLinks) {
                    const href = link.href;
                    // Check if it's a registration-related URL
                    if (href.includes('BookMe4') || 
                        href.includes('courseId') || 
                        href.includes('register') ||
                        href.includes('enroll') ||
                        href.includes('signup')) {
                      return href;
                    }
                  }
                  // If no specific registration link found, return the first link
                  return possibleLinks[0]?.href || null;
                })(),
                
                // Store raw text for debugging
                rawText: itemText.substring(0, 500)
              };
              
              // Only add if we have meaningful data
              if (activity.name && activity.name.length > 3) {
                activities.push(activity);
              }
              
            } catch (error) {
              console.error('Error extracting activity from row:', error);
            }
          });
        
        // If no activities found, log what we did find
        if (activities.length === 0) {
          console.log('No activities found using PerfectMind structure.');
          console.log(`Debug: Found ${groupTitles.length} group titles and ${groupItems.length} group items`);
        }
        
        return activities;
      }, sectionName, activityType);

      console.log(`  ✅ Extracted ${pageActivities.length} activities from ${sectionName}`);
      
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
          // Extract year (current year if not specified)
          const currentYear = new Date().getFullYear();
          const dateMatch = activity.dates.match(/([A-Z][a-z]{2}\s+\d{1,2})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2})/);
          
          if (dateMatch) {
            startDate = new Date(`${dateMatch[1]}, ${currentYear}`);
            endDate = new Date(`${dateMatch[2]}, ${currentYear}`);
            
            // If end date is before start date, it's probably next year
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
          subcategory: activity.activityType,
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
}

module.exports = NVRCPerfectMindScraper;