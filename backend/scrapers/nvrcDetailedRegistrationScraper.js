const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCDetailedRegistrationScraper {
  constructor(options = {}) {
    this.options = options;
    this.maxRetries = options.maxRetries || 3;
    this.detailPageTimeout = options.detailPageTimeout || 30000;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Detailed Registration Scraper...');
      
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
          '--window-size=1440,900'
        ],
        defaultViewport: null,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
          console.log('PAGE LOG:', msg.text());
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // First, get all activities using the existing logic
      console.log('\n📍 Getting activity list...');
      const activities = await this.getActivityList(page);
      
      console.log(`\n✅ Found ${activities.length} activities`);
      
      // Now visit registration pages for complete details
      console.log('\n📄 Fetching detailed registration information...');
      
      const batchSize = 5; // Process fewer at a time for more detailed extraction
      const detailedActivities = [];
      
      for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(activities.length/batchSize)}`);
        
        const batchPromises = batch.map(async (activity) => {
          if (!activity.registrationUrl && !activity.detailUrl) {
            console.log(`⚠️  No registration URL for: ${activity.name}`);
            return activity;
          }
          
          try {
            const detailPage = await browser.newPage();
            await detailPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
            
            // Use registration URL if available, otherwise detail URL
            const targetUrl = activity.registrationUrl || activity.detailUrl;
            console.log(`📄 Fetching details for: ${activity.name} (${activity.courseId})`);
            
            await detailPage.goto(targetUrl, {
              waitUntil: 'networkidle2',
              timeout: this.detailPageTimeout
            });
            
            // Wait for content to load
            await detailPage.waitForSelector('body', { timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Extract comprehensive details from registration page
            const registrationDetails = await detailPage.evaluate(() => {
              const details = {
                sessions: [],
                prerequisites: []
              };
              
              // Helper function to clean text
              const cleanText = (text) => {
                return text ? text.replace(/\s+/g, ' ').trim() : '';
              };
              
              // Extract course ID from various possible locations
              const courseIdSelectors = [
                '.barcode', '.course-code', '.activity-code', '[class*="barcode"]',
                'td:contains("Barcode")+td', 'td:contains("Course Code")+td',
                'dt:contains("Barcode")+dd', 'dt:contains("Course Code")+dd'
              ];
              
              for (const selector of courseIdSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el && el.textContent.trim()) {
                    details.courseId = cleanText(el.textContent);
                    break;
                  }
                } catch (e) {}
              }
              
              // Extract cost - look for various patterns
              const costSelectors = [
                '.price', '.cost', '.fee', '[class*="price"]', '[class*="cost"]',
                'td:contains("Price")+td', 'td:contains("Cost")+td', 'td:contains("Fee")+td',
                'dt:contains("Price")+dd', 'dt:contains("Cost")+dd', 'dt:contains("Fee")+dd'
              ];
              
              for (const selector of costSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el) {
                    const costText = el.textContent;
                    const costMatch = costText.match(/\$?([\d,]+(?:\.\d{2})?)/);
                    if (costMatch) {
                      details.cost = parseFloat(costMatch[1].replace(',', ''));
                      break;
                    }
                  }
                } catch (e) {}
              }
              
              // Extract location details
              const locationSelectors = [
                '.location', '.venue', '.facility', '[class*="location"]',
                'td:contains("Location")+td', 'dt:contains("Location")+dd',
                'td:contains("Facility")+td', 'dt:contains("Facility")+dd'
              ];
              
              for (const selector of locationSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el && el.textContent.trim()) {
                    details.location = cleanText(el.textContent);
                    break;
                  }
                } catch (e) {}
              }
              
              // Extract age restrictions
              const ageSelectors = [
                '.age-range', '.ages', '[class*="age"]',
                'td:contains("Age")+td', 'dt:contains("Age")+dd',
                'td:contains("Ages")+td', 'dt:contains("Ages")+dd'
              ];
              
              for (const selector of ageSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el) {
                    const ageText = el.textContent;
                    const ageMatch = ageText.match(/(\d+)\s*[-–]\s*(\d+)/);
                    if (ageMatch) {
                      details.ageMin = parseInt(ageMatch[1]);
                      details.ageMax = parseInt(ageMatch[2]);
                    }
                  }
                } catch (e) {}
              }
              
              // Extract registration dates
              const regDateSelectors = [
                '.registration-date', '.reg-date', '[class*="registration"][class*="date"]',
                'td:contains("Registration")+td', 'dt:contains("Registration")+dd'
              ];
              
              for (const selector of regDateSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el && el.textContent.trim()) {
                    details.registrationDate = cleanText(el.textContent);
                  }
                } catch (e) {}
              }
              
              // Extract prerequisites
              const prereqSelectors = [
                '.prerequisites', '.requirements', '[class*="prerequisite"]',
                'h2:contains("Prerequisite")+*', 'h3:contains("Prerequisite")+*',
                'td:contains("Prerequisite")+td', 'dt:contains("Prerequisite")+dd'
              ];
              
              for (const selector of prereqSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el) {
                    // Look for links within prerequisites
                    const prereqLinks = el.querySelectorAll('a');
                    if (prereqLinks.length > 0) {
                      prereqLinks.forEach(link => {
                        details.prerequisites.push({
                          name: cleanText(link.textContent),
                          url: link.href
                        });
                      });
                    } else {
                      // Just text prerequisites
                      const prereqText = cleanText(el.textContent);
                      if (prereqText) {
                        details.prerequisites.push({
                          name: prereqText,
                          url: null
                        });
                      }
                    }
                  }
                } catch (e) {}
              }
              
              // Extract sessions - look for multiple date/time entries
              const sessionSelectors = [
                '.session', '.schedule-item', '.date-time', '[class*="session"]',
                'table.schedule tr', 'table.sessions tr', '.sessions-list li'
              ];
              
              // First try to find a sessions table or list
              const sessionTable = document.querySelector('table.schedule, table.sessions, .sessions-list');
              if (sessionTable) {
                const rows = sessionTable.querySelectorAll('tr, li');
                rows.forEach((row, index) => {
                  if (index === 0 && row.querySelector('th')) return; // Skip header
                  
                  const session = {};
                  
                  // Extract from table cells or list items
                  const cells = row.querySelectorAll('td');
                  if (cells.length >= 2) {
                    // Assuming format: Date | Time | Location | etc.
                    session.date = cleanText(cells[0].textContent);
                    session.time = cleanText(cells[1].textContent);
                    if (cells[2]) session.location = cleanText(cells[2].textContent);
                  } else {
                    // Try to parse from text
                    const text = row.textContent;
                    const dateMatch = text.match(/(\w+\s+\d+,?\s*\d{4})/);
                    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
                    
                    if (dateMatch) session.date = dateMatch[1];
                    if (timeMatch) session.time = timeMatch[1];
                  }
                  
                  if (session.date || session.time) {
                    details.sessions.push(session);
                  }
                });
              }
              
              // If no sessions found, try to extract single session from date/time fields
              if (details.sessions.length === 0) {
                const dateSelectors = [
                  '.start-date', '.date', '[class*="date"]',
                  'td:contains("Date")+td', 'dt:contains("Date")+dd',
                  'td:contains("Start")+td', 'dt:contains("Start")+dd'
                ];
                
                const timeSelectors = [
                  '.time', '.schedule', '[class*="time"]',
                  'td:contains("Time")+td', 'dt:contains("Time")+dd',
                  'td:contains("Schedule")+td', 'dt:contains("Schedule")+dd'
                ];
                
                let sessionDate = '';
                let sessionTime = '';
                
                for (const selector of dateSelectors) {
                  try {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim()) {
                      sessionDate = cleanText(el.textContent);
                      break;
                    }
                  } catch (e) {}
                }
                
                for (const selector of timeSelectors) {
                  try {
                    const el = document.querySelector(selector);
                    if (el && el.textContent.trim()) {
                      sessionTime = cleanText(el.textContent);
                      break;
                    }
                  } catch (e) {}
                }
                
                if (sessionDate || sessionTime) {
                  details.sessions.push({
                    date: sessionDate,
                    time: sessionTime,
                    location: details.location
                  });
                }
              }
              
              // Extract instructor
              const instructorSelectors = [
                '.instructor', '.teacher', '[class*="instructor"]',
                'td:contains("Instructor")+td', 'dt:contains("Instructor")+dd',
                'td:contains("Teacher")+td', 'dt:contains("Teacher")+dd'
              ];
              
              for (const selector of instructorSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el && el.textContent.trim()) {
                    details.instructor = cleanText(el.textContent);
                    break;
                  }
                } catch (e) {}
              }
              
              // Extract full description
              const descSelectors = [
                '.description', '.details', '.overview', '[class*="description"]',
                'h2:contains("Description")+*', 'h3:contains("Description")+*',
                'h2:contains("Overview")+*', 'h3:contains("Overview")+*'
              ];
              
              for (const selector of descSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el && el.textContent.trim()) {
                    details.fullDescription = cleanText(el.textContent);
                    break;
                  }
                } catch (e) {}
              }
              
              // Extract what to bring
              const bringSelectors = [
                '.what-to-bring', '.supplies', '[class*="bring"]',
                'h2:contains("What to Bring")+*', 'h3:contains("What to Bring")+*',
                'h2:contains("Supplies")+*', 'h3:contains("Supplies")+*'
              ];
              
              for (const selector of bringSelectors) {
                try {
                  const el = document.querySelector(selector);
                  if (el && el.textContent.trim()) {
                    details.whatToBring = cleanText(el.textContent);
                    break;
                  }
                } catch (e) {}
              }
              
              return details;
            });
            
            await detailPage.close();
            
            // Merge registration details with activity, using registration page as source of truth
            const enhancedActivity = {
              ...activity,
              // Override with registration page data
              courseId: registrationDetails.courseId || activity.courseId,
              cost: registrationDetails.cost !== undefined ? registrationDetails.cost : activity.cost,
              location: registrationDetails.location || activity.location,
              ageMin: registrationDetails.ageMin !== undefined ? registrationDetails.ageMin : activity.ageMin,
              ageMax: registrationDetails.ageMax !== undefined ? registrationDetails.ageMax : activity.ageMax,
              registrationDate: registrationDetails.registrationDate || activity.registrationDate,
              instructor: registrationDetails.instructor,
              fullDescription: registrationDetails.fullDescription,
              whatToBring: registrationDetails.whatToBring,
              prerequisites: registrationDetails.prerequisites,
              sessions: registrationDetails.sessions,
              // Keep original fields that might not be on registration page
              schedule: activity.schedule,
              dateRange: activity.dateRange,
              spotsAvailable: activity.spotsAvailable,
              registrationStatus: activity.registrationStatus
            };
            
            console.log(`✅ Enhanced: ${activity.name} - Found ${registrationDetails.sessions.length} sessions`);
            
            return enhancedActivity;
            
          } catch (error) {
            console.error(`❌ Error fetching details for ${activity.name}:`, error.message);
            return activity;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        detailedActivities.push(...batchResults);
        
        // Respectful delay between batches
        if (i + batchSize < activities.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`\n✅ Enhanced ${detailedActivities.length} activities with registration details`);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `nvrc_detailed_registration_${timestamp}.json`;
      
      // Save the results
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'NVRC Detailed Registration Scraper',
        totalActivities: detailedActivities.length,
        activities: detailedActivities
      }, null, 2));
      
      console.log(`\n📁 Results saved to: ${filename}`);
      
      await browser.close();
      
      return {
        success: true,
        count: detailedActivities.length,
        filename,
        activities: detailedActivities
      };
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }

  async getActivityList(page) {
    // Navigate to the find program page
    await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
      waitUntil: 'networkidle0',
      timeout: 120000
    });

    await page.waitForSelector('form', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select kids age groups
    console.log('\n📋 Selecting kids age groups...');
    
    const ageGroups = [
      '0 - 6 years, Parent Participation',
      '0 - 6 years, On My Own',
      '5 - 13 years, School Age',
      '10 - 18 years, Youth'
    ];
    
    for (const ageGroup of ageGroups) {
      const selected = await page.evaluate((age) => {
        const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .find(cb => {
            const label = cb.parentElement?.textContent || '';
            return label.includes(age);
          });
        
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          return true;
        }
        return false;
      }, ageGroup);
      
      if (selected) {
        console.log(`  ✓ Selected: ${ageGroup}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Wait for activities to load
    await page.waitForFunction(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => {
          const label = cb.parentElement?.textContent || '';
          return label.match(/(Swim|Camp|Sport|Art|Dance|Music|Gym|Climb|Martial|Cooking|Yoga|Tennis|Basketball|Soccer)/i) &&
                 !label.includes('years');
        });
      return checkboxes.length > 5;
    }, { timeout: 15000 });

    // Select all activity types
    const activityTypes = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => {
          const label = cb.parentElement?.textContent || '';
          return label.match(/(Swim|Camp|Sport|Art|Dance|Music|Gym|Climb|Martial|Cooking|Yoga|Tennis|Basketball|Soccer|Skate|Fitness|Early Years)/i) &&
                 !label.includes('years') &&
                 !label.includes('Adult');
        });
      
      checkboxes.forEach(cb => {
        if (!cb.checked) cb.click();
      });
      
      return checkboxes.map(cb => cb.parentElement?.textContent?.trim() || '');
    });

    console.log(`\n📋 Selected ${activityTypes.length} activity types`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Select all locations
    await page.waitForFunction(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => {
          const label = cb.parentElement?.textContent || '';
          return label.match(/(Centre|Center|Library|Pool|Park|Field|Arena|School)/i) &&
                 !label.includes('years') &&
                 !label.includes('Adult');
        });
      return checkboxes.length > 0;
    }, { timeout: 15000 });

    const locations = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => {
          const label = cb.parentElement?.textContent || '';
          return label.match(/(Centre|Center|Library|Pool|Park|Field|Arena|School)/i) &&
                 !label.includes('years') &&
                 !label.includes('Adult');
        });
      
      checkboxes.forEach(cb => {
        if (!cb.checked) cb.click();
      });
      
      return checkboxes.map(cb => cb.parentElement?.textContent?.trim() || '');
    });

    console.log(`\n📋 Selected ${locations.length} locations`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Show Results
    console.log('\n🔍 Clicking Show Results...');
    await page.evaluate(() => {
      const showButton = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        .find(btn => btn.textContent?.toLowerCase().includes('show') && 
                     btn.textContent?.toLowerCase().includes('result'));
      if (showButton) showButton.click();
    });

    // Wait for results
    await page.waitForSelector('.nvrc-activities-category, .events-row, .activity-item, [class*="activity"]', {
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract activities
    const activities = await page.evaluate(() => {
      const results = [];
      
      // Find all category sections
      const categorySections = document.querySelectorAll('.nvrc-activities-category');
      
      categorySections.forEach(categorySection => {
        const categoryName = categorySection.querySelector('.nvrc-activities-category__title')?.textContent?.trim() || 'Unknown';
        
        // Find all service groups within this category
        const serviceGroups = categorySection.querySelectorAll('.nvrc-activities-service');
        
        serviceGroups.forEach(serviceGroup => {
          const serviceName = serviceGroup.querySelector('.activities-service__title')?.textContent?.trim() || 'Unknown Service';
          
          // Find all events/activities within this service
          const eventRows = serviceGroup.querySelectorAll('.nvrc-activities-events__row');
          
          eventRows.forEach((row) => {
            try {
              // Extract all available data
              const titleLink = row.querySelector('.events-row__title a');
              const name = titleLink?.textContent?.trim() || serviceName;
              const detailUrl = titleLink?.href || '';
              const dates = row.querySelector('.events-row__dates')?.textContent?.trim() || '';
              const schedule = row.querySelector('.events-row__schedule')?.textContent?.trim() || '';
              const ageRange = row.querySelector('.events-row__ages')?.textContent?.trim() || '';
              const location = row.querySelector('.events-row__location')?.textContent?.trim() || '';
              const cost = row.querySelector('.events-row__cost')?.textContent?.trim() || '';
              const spotsText = row.querySelector('.events-row__spots')?.textContent?.trim() || '';
              const courseId = row.querySelector('.events-row__barcode')?.textContent?.trim() || '';
              const alert = row.querySelector('.events-row__alert')?.textContent?.trim() || '';
              
              // Extract registration button info
              const registerButton = row.querySelector('.events-row__register a, .events-row__register button');
              let registrationStatus = 'Unknown';
              let registrationUrl = '';
              let registrationButtonText = '';
              
              if (registerButton) {
                registrationButtonText = registerButton.textContent?.trim() || '';
                registrationUrl = registerButton.href || '';
                
                if (registrationButtonText.toLowerCase().includes('closed')) {
                  registrationStatus = 'Closed';
                } else if (registrationButtonText.toLowerCase().includes('waitlist')) {
                  registrationStatus = 'WaitList';
                } else if (registrationButtonText.toLowerCase().includes('sign up') || 
                         registrationButtonText.toLowerCase().includes('register')) {
                  registrationStatus = 'Open';
                }
              }
              
              // Parse basic data
              let ageMin = null, ageMax = null;
              const ageMatch = ageRange.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
              if (ageMatch) {
                ageMin = parseInt(ageMatch[1]);
                ageMax = parseInt(ageMatch[2]);
              }
              
              let spotsAvailable = null;
              if (spotsText) {
                const spotsMatch = spotsText.match(/(\d+)/);
                if (spotsMatch) {
                  spotsAvailable = parseInt(spotsMatch[1]);
                }
              }
              
              let costAmount = 0;
              if (cost) {
                const costMatch = cost.match(/\$?([\d,]+(?:\.\d{2})?)/);
                if (costMatch) {
                  costAmount = parseFloat(costMatch[1].replace(',', ''));
                }
              }
              
              // Parse dates
              let dateRange = null;
              if (dates) {
                const dateMatch = dates.match(/(\w+\s+\d+)\s*[-–]\s*(\w+\s+\d+),?\s*(\d{4})/);
                if (dateMatch) {
                  const year = dateMatch[3];
                  const startDate = new Date(`${dateMatch[1]}, ${year}`);
                  const endDate = new Date(`${dateMatch[2]}, ${year}`);
                  
                  if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    dateRange = {
                      start: startDate.toISOString(),
                      end: endDate.toISOString()
                    };
                  }
                }
              }
              
              results.push({
                name,
                category: categoryName,
                subcategory: serviceName,
                detailUrl,
                dates,
                schedule,
                ageRange,
                ageMin,
                ageMax,
                location,
                cost: costAmount,
                spotsAvailable,
                courseId,
                alert,
                registrationStatus,
                registrationUrl,
                registrationButtonText,
                dateRange
              });
              
            } catch (error) {
              console.error('Error parsing activity row:', error);
            }
          });
        });
      });
      
      return results;
    });

    return activities;
  }
}

// Export for use as module
module.exports = NVRCDetailedRegistrationScraper;

// Run directly if called from command line
if (require.main === module) {
  const scraper = new NVRCDetailedRegistrationScraper({
    headless: process.env.HEADLESS !== 'false',
    maxRetries: 3,
    detailPageTimeout: 30000
  });
  
  scraper.scrape()
    .then(result => {
      console.log('\n✅ Scraping completed successfully!');
      console.log(`Total activities: ${result.count}`);
      console.log(`Results saved to: ${result.filename}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Scraping failed:', error);
      process.exit(1);
    });
}