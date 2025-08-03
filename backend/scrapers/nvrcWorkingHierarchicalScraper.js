const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCWorkingHierarchicalScraper {
  constructor(options = {}) {
    this.options = options;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Working Hierarchical Scraper...');
      
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
      this.lastUrl = '';
      
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
        timeout: 90000 // Increased timeout for slow cloud network
      });

      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 1: Select kids age groups (EXACTLY like the working version)
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
            // Look for activity-related labels
            return label.match(/(Swim|Camp|Sport|Art|Dance|Music|Gym|Climb|Martial|Cooking|Yoga|Tennis|Basketball|Soccer)/i) &&
                   !label.includes('years');
          });
        console.log(`Found ${checkboxes.length} activity checkboxes`);
        return checkboxes.length > 10;
      }, { timeout: 60000, polling: 1000 }); // Increased timeout to 60 seconds
      
      console.log('  ✅ Step 2 activities loaded!');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 2: Select ALL activities using the parent section approach
      console.log('\n🎯 STEP 2: Selecting ALL program activities...');
      
      const selectedActivities = await page.evaluate(() => {
        // Find all checkboxes that look like activities
        const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const activities = [];
        let totalSelected = 0;
        
        // Define activity keywords to look for
        const activityKeywords = [
          'Swim', 'Camp', 'Sport', 'Art', 'Dance', 'Music', 'Gym', 'Climb', 
          'Martial', 'Cooking', 'Yoga', 'Tennis', 'Basketball', 'Soccer',
          'Fitness', 'Spin', 'Strength', 'Cardio', 'Aquatic', 'Leadership',
          'Certification', 'Early Years', 'Night Out', 'Learn', 'Play',
          'Skating', 'Multisport', 'Racquet', 'Team', 'Visual', 'Pottery',
          'Movement', 'Badminton', 'Pickleball', 'Squash', 'Table Tennis',
          'Volleyball', 'Guitar', 'Ukulele', 'Drawing', 'Painting', 'Mixed Media'
        ];
        
        allCheckboxes.forEach(cb => {
          const label = cb.parentElement?.textContent?.trim() || '';
          
          // Check if this is an activity checkbox
          const isActivity = activityKeywords.some(keyword => 
            label.includes(keyword) && 
            !label.includes('years') && 
            !label.includes('Age') &&
            !label.includes('Parent Participation')
          );
          
          if (isActivity && !cb.checked) {
            cb.click();
            activities.push(label);
            totalSelected++;
            console.log(`Selected activity: ${label}`);
          }
        });
        
        // If we didn't find many activities, try another approach
        if (totalSelected < 10) {
          console.log('Trying alternative approach...');
          
          // Find all section headers and their checkboxes
          const sections = Array.from(document.querySelectorAll('.form-type-checkboxes'));
          
          sections.forEach(section => {
            // Skip the age groups section
            const sectionTitle = section.querySelector('.fieldset-legend')?.textContent || '';
            if (sectionTitle.includes('age') || sectionTitle.includes('Age')) {
              return;
            }
            
            // Get all checkboxes in this section
            const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]'));
            
            checkboxes.forEach(cb => {
              const label = cb.parentElement?.textContent?.trim() || '';
              
              // Skip if already checked or if it's an age-related checkbox
              if (!cb.checked && label && !label.includes('years') && !label.includes('Age')) {
                cb.click();
                if (!activities.includes(label)) {
                  activities.push(label);
                  totalSelected++;
                  console.log(`Selected activity (alt): ${label}`);
                }
              }
            });
          });
        }
        
        return { activities, totalSelected };
      });
      
      console.log(`  ✅ Found ${selectedActivities.totalSelected} activity checkboxes`);
      console.log(`  ✅ Selected ${selectedActivities.totalSelected} new activities`);
      if (selectedActivities.activities.length > 0) {
        console.log(`  Activities: ${selectedActivities.activities.slice(0, 10).join(', ')}${selectedActivities.activities.length > 10 ? '...' : ''}`);
      }
      
      // If we didn't select enough activities, log a warning but continue
      if (selectedActivities.totalSelected < 20) {
        console.log('  ⚠️  Warning: Selected fewer activities than expected. Continuing anyway...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Give more time for form to update

      // STEP 3: Select all locations
      console.log('\n⏳ Waiting for Step 3 locations to appear...');
      
      // Wait longer and add more debugging
      await page.waitForFunction(() => {
        // Check for various possible location selectors
        const labels = Array.from(document.querySelectorAll('label'));
        const selectAllOption = labels.find(label => {
          const text = label.textContent || '';
          return text.includes('Select all locations') || 
                 text.includes('all locations available') ||
                 text.includes('All locations');
        });
        
        // Also check if there are individual location checkboxes
        const locationCheckboxes = labels.filter(label => {
          const text = label.textContent || '';
          return text.includes('Centre') || 
                 text.includes('Park') || 
                 text.includes('Arena') ||
                 text.includes('Pool');
        });
        
        console.log(`Found ${labels.length} labels, ${locationCheckboxes.length} location labels`);
        
        if (selectAllOption) {
          console.log('Found "Select all locations" option!');
          return true;
        }
        
        // If we find individual locations but no "select all", that's also OK
        if (locationCheckboxes.length > 5) {
          console.log('Found individual location checkboxes');
          return true;
        }
        
        return false;
      }, { timeout: 90000, polling: 2000 }); // Increased timeout to 90 seconds with slower polling
      
      console.log('  ✅ Step 3 locations loaded!');
      
      console.log('\n📍 STEP 3: Selecting all locations...');
      
      const locationSelected = await page.evaluate(() => {
        // First try to find "Select all locations" option
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
            console.log('Clicked "Select all locations" checkbox');
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
            console.log(`Selected location: ${label.textContent?.trim()}`);
          }
        });
        
        return { method: 'individual', count: selectedCount };
      });
      
      console.log(`  ✅ Location selection: ${locationSelected.method} method, ${locationSelected.count} locations`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find and click the "Show Results" button
      console.log('\n🔍 Looking for "Show Results" button...');
      
      const buttonInfo = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('input[type="submit"], button'))
          .find(btn => {
            const text = btn.value || btn.textContent || '';
            return text.includes('Show Results');
          });
        
        if (button) {
          return {
            found: true,
            text: button.value || button.textContent,
            disabled: button.disabled,
            className: button.className,
            tag: button.tagName
          };
        }
        
        return { found: false };
      });
      
      console.log('  Button state:', buttonInfo);
      
      if (buttonInfo.found) {
        await page.evaluate(() => {
          const button = Array.from(document.querySelectorAll('input[type="submit"], button'))
            .find(btn => {
              const text = btn.value || btn.textContent || '';
              return text.includes('Show Results');
            });
          
          if (button) {
            console.log('Clicking Show Results button');
            button.click();
          }
        });
        
        console.log('  ✅ Clicked Show Results button');
      }

      // Wait for results page to load
      console.log('\n⏳ Waiting for results to load...');
      
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        new Promise(resolve => setTimeout(resolve, 15000))
      ]);
      
      // Wait for results content
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Log current page info
      const pageInfo = await page.evaluate(() => ({
        hasIframes: document.querySelectorAll('iframe').length,
        url: window.location.href
      }));
      
      console.log('\n📍 Current URL:', pageInfo.url);
      
      // Take screenshot for debugging
      if (process.env.NODE_ENV !== 'production') {
        await page.screenshot({ path: 'nvrc-results-page.png', fullPage: true });
        console.log('📸 Results page screenshot saved');
      }
      
      console.log('Page info:', pageInfo);

      // Extract activities from the results page
      console.log('\n🔍 Extracting activities from results page...');
      
      const activities = await page.evaluate(() => {
        const allActivities = [];
        
        // Find all category sections
        const categorySections = document.querySelectorAll('.nvrc-activities-category');
        console.log(`Found ${categorySections.length} activity categories`);
        
        categorySections.forEach(categorySection => {
          const categoryName = categorySection.querySelector('.activities-category__title')?.textContent?.trim() || 'Unknown';
          console.log(`Processing category: ${categoryName}`);
          
          // Find all service groups within this category
          const serviceGroups = categorySection.querySelectorAll('.nvrc-activities-service');
          console.log(`  Found ${serviceGroups.length} services in ${categoryName}`);
          
          serviceGroups.forEach(serviceGroup => {
            const serviceName = serviceGroup.querySelector('.activities-service__title')?.textContent?.trim() || 'Unknown Service';
            console.log(`    Processing service: ${serviceName}`);
            
            // Find all events/activities within this service
            const eventRows = serviceGroup.querySelectorAll('.nvrc-activities-events__row');
            console.log(`      Found ${eventRows.length} events in ${serviceName}`);
            
            eventRows.forEach((row, index) => {
              try {
                // Extract activity details
                const name = row.querySelector('.events-row__title a')?.textContent?.trim() || serviceName;
                const dates = row.querySelector('.events-row__dates')?.textContent?.trim() || '';
                const schedule = row.querySelector('.events-row__schedule')?.textContent?.trim() || '';
                const ageRange = row.querySelector('.events-row__ages')?.textContent?.trim() || '';
                const location = row.querySelector('.events-row__location')?.textContent?.trim() || '';
                const cost = row.querySelector('.events-row__cost')?.textContent?.trim() || '';
                const spotsText = row.querySelector('.events-row__spots')?.textContent?.trim() || '';
                const registrationUrl = row.querySelector('.events-row__register a')?.href || '';
                const courseId = row.querySelector('.events-row__barcode')?.textContent?.trim() || '';
                const alert = row.querySelector('.events-row__alert')?.textContent?.trim() || '';
                
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
                if (spotsText) {
                  const spotsMatch = spotsText.match(/(\d+)\s*spot/i);
                  if (spotsMatch) {
                    spotsAvailable = parseInt(spotsMatch[1]);
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
                const regButton = row.querySelector('.events-row__register a');
                if (regButton) {
                  const regText = regButton.textContent?.trim() || '';
                  const regMatch = regText.match(/(\w+\s+\d+,?\s+\d{4}\s+\d{1,2}:\d{2}[ap]m)/i);
                  if (regMatch) {
                    registrationDate = regMatch[1];
                  }
                }
                
                const activity = {
                  id: `${categoryName}_${serviceName}_${name}_${index}`.replace(/\s+/g, '_'),
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
                  registrationUrl,
                  registrationDate,
                  courseId: courseId.replace('Barcode:', '').trim(),
                  dateRange,
                  provider: 'NVRC',
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
      
      // Save results with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_working_hierarchical_${timestamp}.json`;
      
      const results = {
        timestamp: new Date().toISOString(),
        url: await page.url(),
        activitiesCount: activities.length,
        activities
      };
      
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to ${filename}`);
      
      return activities;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = NVRCWorkingHierarchicalScraper;