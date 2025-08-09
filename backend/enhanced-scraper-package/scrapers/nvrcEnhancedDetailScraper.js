const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCEnhancedDetailScraper {
  constructor(options = {}) {
    this.options = options;
    this.maxRetries = options.maxRetries || 3;
    this.detailPageTimeout = options.detailPageTimeout || 30000;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Enhanced Detail Scraper...');
      
      // Use headless mode for production/cloud environments
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

      // Navigate to the find program page
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 120000
      });

      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 1: Select kids age groups
      console.log('\n📋 STEP 1: Selecting kids age groups...');
      
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

      // Wait for Step 2 to load
      console.log('\n⏳ Waiting for Step 2 program activities to appear...');
      
      await page.waitForFunction(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .filter(cb => {
            const label = cb.parentElement?.textContent || '';
            return label.match(/(Swim|Camp|Sport|Art|Dance|Music|Gym|Climb|Martial|Cooking|Yoga|Tennis|Basketball|Soccer)/i) &&
                   !label.includes('years');
          });
        return checkboxes.length > 5;
      }, { timeout: 60000 });

      // STEP 2: Select all activity categories
      console.log('\n🎯 STEP 2: Selecting ALL activity categories...');
      
      const selectedCategories = await page.evaluate(() => {
        const activityCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .filter(cb => {
            const label = cb.parentElement?.textContent || '';
            return label.match(/(Swim|Camp|Sport|Art|Dance|Music|Gym|Climb|Martial|Cooking|Yoga|Tennis|Basketball|Soccer|Learn|Play|Early|Youth|Fitness|Skate|Hockey)/i) &&
                   !label.includes('years') &&
                   !label.includes('Membership') &&
                   !label.includes('Pass');
          });
        
        let selectedCount = 0;
        activityCheckboxes.forEach(checkbox => {
          if (!checkbox.checked) {
            checkbox.click();
            selectedCount++;
          }
        });
        
        return selectedCount;
      });
      
      console.log(`  ✅ Selected ${selectedCategories} activity categories`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for Step 3 (locations) to appear
      console.log('\n⏳ Waiting for Step 3 locations to appear...');
      
      await page.waitForFunction(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const selectAllOption = labels.find(label => {
          const text = label.textContent || '';
          return text.includes('Select all locations') || 
                 text.includes('all locations available') ||
                 text.includes('All locations');
        });
        
        const locationCheckboxes = labels.filter(label => {
          const text = label.textContent || '';
          return text.includes('Centre') || 
                 text.includes('Park') || 
                 text.includes('Arena') ||
                 text.includes('Pool');
        });
        
        return selectAllOption || locationCheckboxes.length > 5;
      }, { timeout: 90000 });
      
      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting all locations...');
      
      const locationSelected = await page.evaluate(() => {
        const selectAllLabel = Array.from(document.querySelectorAll('label'))
          .find(label => {
            const text = label.textContent || '';
            return text.includes('Select all locations') || 
                   text.includes('all locations available') ||
                   text.includes('All locations');
          });
        
        if (selectAllLabel) {
          const checkbox = selectAllLabel.querySelector('input[type="checkbox"]') ||
                          selectAllLabel.previousElementSibling;
          
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return { method: 'select-all', count: 1 };
          }
        }
        
        // If no "select all" option, select individual locations
        const locationLabels = Array.from(document.querySelectorAll('label'))
          .filter(label => {
            const text = label.textContent || '';
            return (text.includes('Centre') || 
                    text.includes('Park') || 
                    text.includes('Arena') ||
                    text.includes('Pool') ||
                    text.includes('Field') ||
                    text.includes('Gym')) &&
                   !text.includes('years') &&
                   !text.includes('Select all');
          });
        
        let selectedCount = 0;
        locationLabels.forEach(label => {
          const checkbox = label.querySelector('input[type="checkbox"]') ||
                          label.previousElementSibling;
          
          if (checkbox && checkbox.type === 'checkbox' && !checkbox.checked) {
            checkbox.click();
            selectedCount++;
          }
        });
        
        return { method: 'individual', count: selectedCount };
      });
      
      console.log(`  ✅ Location selection: ${locationSelected.method} method, ${locationSelected.count} locations`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find and click the "Show Results" button
      console.log('\n🔍 Looking for "Show Results" button...');
      
      const buttonClicked = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('input[type="submit"], button'))
          .find(btn => {
            const text = btn.value || btn.textContent || '';
            return text.includes('Show Results');
          });
        
        if (button) {
          button.click();
          return true;
        }
        return false;
      });
      
      if (!buttonClicked) {
        throw new Error('Could not find "Show Results" button');
      }
      
      console.log('  ✅ Clicked "Show Results" button');

      // Wait for results to load
      console.log('\n⏳ Waiting for activity results to load...');
      
      try {
        await page.waitForSelector('.nvrc-activities-category, .activities-category, iframe[src*="perfectmind"], #activities-widget', {
          timeout: 60000
        });
      } catch (timeoutError) {
        console.log('⚠️  Timeout waiting for activity selectors or iframes');
      }
      
      // Extract activities with enhanced details
      const activities = await page.evaluate(() => {
        const allActivities = [];
        
        // Find all category sections
        const categorySections = document.querySelectorAll('.nvrc-activities-category');
        console.log(`Found ${categorySections.length} activity categories`);
        
        categorySections.forEach(categorySection => {
          const categoryName = categorySection.querySelector('.activities-category__title')?.textContent?.trim() || 'Unknown';
          
          // Find all service groups within this category
          const serviceGroups = categorySection.querySelectorAll('.nvrc-activities-service');
          
          serviceGroups.forEach(serviceGroup => {
            const serviceName = serviceGroup.querySelector('.activities-service__title')?.textContent?.trim() || 'Unknown Service';
            
            // Find all events/activities within this service
            const eventRows = serviceGroup.querySelectorAll('.nvrc-activities-events__row');
            
            eventRows.forEach((row, index) => {
              try {
                // Extract basic details
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
                
                // Extract registration button status and URL
                const registerButton = row.querySelector('.events-row__register a, .events-row__register button');
                let registrationStatus = 'Unknown';
                let registrationUrl = '';
                let registrationButtonText = '';
                
                if (registerButton) {
                  registrationButtonText = registerButton.textContent?.trim() || '';
                  registrationUrl = registerButton.href || '';
                  
                  // Determine status based on button text and classes
                  if (registrationButtonText.toLowerCase().includes('closed')) {
                    registrationStatus = 'Closed';
                  } else if (registrationButtonText.toLowerCase().includes('waitlist') || 
                           registrationButtonText.toLowerCase().includes('wait list')) {
                    registrationStatus = 'WaitList';
                  } else if (registrationButtonText.toLowerCase().includes('sign up') || 
                           registrationButtonText.toLowerCase().includes('register')) {
                    registrationStatus = 'Open';
                  } else if (registerButton.disabled || registerButton.classList.contains('disabled')) {
                    registrationStatus = 'Closed';
                  }
                }
                
                // Parse age range
                let ageMin = null, ageMax = null;
                const ageMatch = ageRange.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
                if (ageMatch) {
                  ageMin = parseInt(ageMatch[1]);
                  ageMax = parseInt(ageMatch[2]);
                } else if (ageRange.includes('+')) {
                  const agePlusMatch = ageRange.match(/(\d+)\s*\+?\s*yr?s?/i);
                  if (agePlusMatch) {
                    ageMin = parseInt(agePlusMatch[1]);
                    ageMax = 18;
                  }
                }
                
                // Parse spots
                let spotsAvailable = null;
                let totalSpots = null;
                if (spotsText) {
                  const spotsMatch = spotsText.match(/(\d+)\s*(?:of\s*(\d+))?\s*spot/i);
                  if (spotsMatch) {
                    spotsAvailable = parseInt(spotsMatch[1]);
                    if (spotsMatch[2]) {
                      totalSpots = parseInt(spotsMatch[2]);
                    }
                  }
                }
                
                // Parse cost
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
                
                // Get registration date from the registration button
                let registrationDate = null;
                if (registrationButtonText) {
                  const regMatch = registrationButtonText.match(/(\w+\s+\d+,?\s+\d{4}\s+\d{1,2}:\d{2}[ap]m)/i);
                  if (regMatch) {
                    registrationDate = regMatch[1];
                  }
                }
                
                // Use courseId (barcode) as the primary ID
                const cleanCourseId = courseId.replace('Barcode:', '').trim();
                const uniqueId = cleanCourseId || `NVRC_${categoryName}_${serviceName}_${name}_${dates}`.replace(/\s+/g, '_');
                
                const activity = {
                  id: uniqueId,
                  name: name || serviceName,
                  category: categoryName,
                  subcategory: serviceName,
                  description: alert || null,
                  dates,
                  schedule,
                  ageRange: ageMin !== null ? { min: ageMin, max: ageMax || ageMin } : null,
                  location,
                  cost: costAmount,
                  spotsAvailable,
                  totalSpots,
                  registrationUrl,
                  registrationDate,
                  registrationStatus,
                  registrationButtonText,
                  courseId: cleanCourseId,
                  dateRange,
                  provider: 'NVRC',
                  detailUrl,
                  scrapedAt: new Date().toISOString()
                };
                
                allActivities.push(activity);
              } catch (error) {
                console.error('Error extracting activity:', error);
              }
            });
          });
        });
        
        console.log(`Total activities extracted: ${allActivities.length}`);
        return allActivities;
      });

      console.log(`\n✅ Successfully extracted ${activities.length} activities`);
      
      // Now visit detail pages for additional information (batch process to avoid overwhelming)
      console.log('\n📄 Fetching detailed information for activities...');
      
      const batchSize = 10; // Process 10 activities at a time
      const enhancedActivities = [];
      
      for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(activities.length/batchSize)}`);
        
        const batchPromises = batch.map(async (activity) => {
          if (!activity.detailUrl) {
            return activity;
          }
          
          try {
            // Create new page for each activity to parallelize
            const detailPage = await browser.newPage();
            await detailPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
            
            await detailPage.goto(activity.detailUrl, {
              waitUntil: 'networkidle2',
              timeout: this.detailPageTimeout
            });
            
            // Extract additional details from the detail page
            const additionalDetails = await detailPage.evaluate(() => {
              const details = {};
              
              // Look for detailed description
              const descriptionEl = document.querySelector('.activity-description, .program-description, .course-description, [class*="description"]');
              if (descriptionEl) {
                details.fullDescription = descriptionEl.textContent?.trim();
              }
              
              // Look for instructor information
              const instructorEl = document.querySelector('.instructor, .teacher, [class*="instructor"]');
              if (instructorEl) {
                details.instructor = instructorEl.textContent?.trim();
              }
              
              // Look for prerequisites
              const prereqEl = document.querySelector('.prerequisites, .requirements, [class*="prerequisite"]');
              if (prereqEl) {
                details.prerequisites = prereqEl.textContent?.trim();
              }
              
              // Look for what to bring
              const bringEl = document.querySelector('.what-to-bring, .supplies, [class*="bring"]');
              if (bringEl) {
                details.whatToBring = bringEl.textContent?.trim();
              }
              
              // Look for location details
              const addressEl = document.querySelector('.address, .location-address, [class*="address"]');
              if (addressEl) {
                details.fullAddress = addressEl.textContent?.trim();
              }
              
              // Look for map coordinates
              const mapEl = document.querySelector('[data-lat], [data-lng], .map-container, iframe[src*="maps"]');
              if (mapEl) {
                details.latitude = mapEl.getAttribute('data-lat') || null;
                details.longitude = mapEl.getAttribute('data-lng') || null;
              }
              
              // Look for the actual registration link
              const regLink = document.querySelector('a[href*="register"], a[href*="signup"], a.register-button, button[onclick*="register"]');
              if (regLink) {
                details.directRegistrationUrl = regLink.href || regLink.getAttribute('onclick') || '';
              }
              
              // Look for contact information
              const contactEl = document.querySelector('.contact, .phone, [class*="contact"]');
              if (contactEl) {
                details.contactInfo = contactEl.textContent?.trim();
              }
              
              return details;
            });
            
            await detailPage.close();
            
            // Merge additional details with the activity
            return { ...activity, ...additionalDetails };
            
          } catch (error) {
            console.error(`Error fetching details for ${activity.name}:`, error.message);
            return activity; // Return original activity if detail fetch fails
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        enhancedActivities.push(...batchResults);
        
        // Small delay between batches to be respectful
        if (i + batchSize < activities.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`\n✅ Enhanced ${enhancedActivities.length} activities with detailed information`);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `nvrc_enhanced_activities_${timestamp}.json`;
      
      // Save the results
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'NVRC Enhanced Detail Scraper',
        totalActivities: enhancedActivities.length,
        activities: enhancedActivities
      }, null, 2));
      
      console.log(`\n📁 Results saved to: ${filename}`);
      
      await browser.close();
      
      return {
        success: true,
        count: enhancedActivities.length,
        filename,
        activities: enhancedActivities
      };
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
}

// Export for use as module
module.exports = NVRCEnhancedDetailScraper;

// Run directly if called from command line
if (require.main === module) {
  const scraper = new NVRCEnhancedDetailScraper({
    headless: process.env.HEADLESS !== 'false',
    maxRetries: 3,
    detailPageTimeout: 30000
  });
  
  scraper.scrape()
    .then(result => {
      console.log('\n✨ Scraping completed successfully!');
      console.log(`📊 Total activities: ${result.count}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Scraping failed:', error);
      process.exit(1);
    });
}