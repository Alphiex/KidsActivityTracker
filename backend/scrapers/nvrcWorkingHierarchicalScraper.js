const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCWorkingHierarchicalScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Working Hierarchical Scraper...');
      browser = await puppeteer.launch({
        headless: process.env.NODE_ENV === 'production' ? 'new' : false,
        slowMo: process.env.NODE_ENV === 'production' ? 0 : 150,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });

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
        timeout: 60000
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
        await page.evaluate((text) => {
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(l => l.textContent.includes(text));
          if (label) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
            }
          }
        }, ageGroup);
        console.log(`  ✓ Selected: ${ageGroup}`);
      }
      
      // Wait for Step 2 to populate dynamically
      console.log('\n⏳ Waiting for Step 2 program activities to appear...');
      
      try {
        await page.waitForFunction(() => {
          const activityCheckboxes = document.querySelectorAll('input[type="checkbox"]');
          let activityCount = 0;
          
          activityCheckboxes.forEach(cb => {
            const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
            const text = label ? label.textContent.trim() : '';
            
            // Count non-age group, non-location checkboxes
            if (text && 
                !text.includes('years') && 
                !text.includes('Parent Participation') &&
                !text.includes('Adult') &&
                !text.includes('Senior') &&
                !text.includes('All Ages') &&
                !text.includes('location') && 
                !text.includes('Select all')) {
              activityCount++;
            }
          });
          
          console.log(`Found ${activityCount} activity checkboxes`);
          return activityCount > 5; // Expecting activities to load
        }, { timeout: 35000, polling: 'mutation' });
        
        console.log('  ✅ Step 2 activities loaded!');
      } catch (e) {
        console.log('  ⚠️ Timeout waiting for Step 2 activities');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 2: Select ALL program activities
      console.log('\n🎯 STEP 2: Selecting ALL program activities...');
      
      const step2Result = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const activityCheckboxes = [];
        let selectedCount = 0;
        
        checkboxes.forEach(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          const text = label ? label.textContent.trim() : '';
          
          // Skip age groups and locations
          const isAgeGroup = text.includes('years') || 
                            text.includes('Parent Participation') || 
                            text.includes('On My Own') ||
                            text.includes('Adult') ||
                            text.includes('Senior') ||
                            text.includes('All Ages');
          const isLocation = text.toLowerCase().includes('location') || 
                            text.includes('Select all locations');
          
          if (!isAgeGroup && !isLocation && text && text.length > 0) {
            // This is a program activity - SELECT IT!
            activityCheckboxes.push(text);
            
            if (!cb.checked) {
              cb.click();
              selectedCount++;
              console.log(`Selected activity: ${text}`);
            }
          }
        });
        
        return {
          total: activityCheckboxes.length,
          selected: selectedCount,
          activities: activityCheckboxes
        };
      });
      
      console.log(`  ✅ Found ${step2Result.total} activity checkboxes`);
      console.log(`  ✅ Selected ${step2Result.selected} new activities`);
      console.log(`  Activities: ${step2Result.activities.join(', ')}`);

      // Wait for Step 3 to populate
      console.log('\n⏳ Waiting for Step 3 locations to appear...');
      
      try {
        await page.waitForFunction(() => {
          const labels = Array.from(document.querySelectorAll('label'));
          const selectAllLocation = labels.find(label => {
            const text = label.textContent.trim();
            return text.includes('Select all locations');
          });
          
          if (selectAllLocation) {
            console.log('Found "Select all locations" option!');
            return true;
          }
          
          return false;
        }, { timeout: 30000, polling: 'mutation' });
        
        console.log('  ✅ Step 3 locations loaded!');
      } catch (e) {
        console.log('  ⚠️ Timeout waiting for Step 3 locations');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting "Select all locations available"...');
      
      const locationSelected = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          const text = label.textContent || '';
          if (text.includes('Select all locations available')) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              return true;
            }
          }
        }
        return false;
      });
      
      console.log(`  ✅ Selected all locations: ${locationSelected}`);

      // Find and click the Show Results button
      console.log('\n🔍 Looking for "Show Results" button...');
      
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResultsBtn = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.includes('Show Results');
        });
        
        if (showResultsBtn) {
          return {
            found: true,
            text: showResultsBtn.value || showResultsBtn.textContent,
            disabled: showResultsBtn.disabled,
            className: showResultsBtn.className,
            tag: showResultsBtn.tagName
          };
        }
        return { found: false };
      });
      
      console.log('  Button state:', buttonInfo);
      
      if (!buttonInfo.found) {
        throw new Error('Could not find Show Results button');
      }
      
      // Click the Show Results button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResultsBtn = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.includes('Show Results');
        });
        if (showResultsBtn) {
          console.log('Clicking Show Results button');
          showResultsBtn.click();
        }
      });

      console.log('  ✅ Clicked Show Results button');

      // Wait for results to load
      console.log('\n⏳ Waiting for results to load...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check current URL and page state
      const currentUrl = page.url();
      console.log('\n📍 Current URL:', currentUrl);

      // Take screenshot
      await page.screenshot({ path: 'working-hierarchical-results.png', fullPage: true });
      console.log('📸 Results page screenshot saved');

      // Check if we're in an iframe or on a results page
      const pageInfo = await page.evaluate(() => {
        return {
          hasIframes: document.querySelectorAll('iframe').length,
          currentUrl: window.location.href,
          bodyText: document.body.innerText.substring(0, 500)
        };
      });
      
      console.log('Page info:', {
        hasIframes: pageInfo.hasIframes,
        url: pageInfo.currentUrl
      });

      // Look for activities in the results page
      console.log('\n🔍 Extracting activities from results page...');
      
      // Wait a bit for the page to fully render
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extract all activities from the page structure
      const activities = await page.evaluate(() => {
        const activities = [];
        
        // The page uses <details> elements for categories and services
        const activityCategories = document.querySelectorAll('details.programs-activity');
        console.log(`Found ${activityCategories.length} activity categories`);
        
        activityCategories.forEach(categoryDetail => {
          // Get category name from summary
          const categoryName = categoryDetail.querySelector('summary .title')?.textContent.trim() || '';
          console.log(`Processing category: ${categoryName}`);
          
          // Get all services within this category
          const services = categoryDetail.querySelectorAll('details.programs-service');
          console.log(`  Found ${services.length} services in ${categoryName}`);
          
          services.forEach(serviceDetail => {
            // Get service/subcategory name
            const serviceName = serviceDetail.querySelector('summary .title')?.textContent.trim() || '';
            console.log(`    Processing service: ${serviceName}`);
            
            // Get all events/activities within this service
            const events = serviceDetail.querySelectorAll('.programs-event');
            console.log(`      Found ${events.length} events in ${serviceName}`);
            
            events.forEach((event, index) => {
              try {
                const activity = {
                  id: event.id || `nvrc_${Date.now()}_${index}`,
                  category: categoryName,
                  subcategory: serviceName,
                  name: '',
                  location: '',
                  facility: '',
                  schedule: '',
                  dates: '',
                  ageRange: { min: 0, max: 18 },
                  cost: 0,
                  spotsAvailable: 0,
                  courseId: '',
                  registrationUrl: '',
                  registrationDate: '',
                  alert: '',
                  provider: 'NVRC',
                  scrapedAt: new Date().toISOString(),
                  dateRange: {
                    start: new Date().toISOString(),
                    end: new Date().toISOString()
                  },
                  activityType: [categoryName] // Add activity type based on category
                };
                
                // Extract activity name
                const titleEl = event.querySelector('.programs-event-title');
                if (titleEl) {
                  activity.name = titleEl.textContent.trim();
                }
                
                // Extract location
                const locationEl = event.querySelector('.programs-event-location a');
                if (locationEl) {
                  activity.location = locationEl.textContent.trim();
                }
                
                // Extract facility
                const facilityEl = event.querySelector('.programs-event-facility');
                if (facilityEl) {
                  activity.facility = facilityEl.textContent.trim();
                }
                
                // Extract schedule (days)
                const daysEl = event.querySelector('.programs-event-days');
                if (daysEl) {
                  activity.schedule = daysEl.textContent.trim();
                }
                
                // Extract date range
                const dateRangeEl = event.querySelector('.programs-event-date-range');
                if (dateRangeEl) {
                  activity.dates = dateRangeEl.textContent.trim();
                  
                  // Parse dates into dateRange object
                  const dateMatch = activity.dates.match(/(\w{3}\s+\d{1,2})\s*-\s*(\w{3}\s+\d{1,2})/);
                  if (dateMatch) {
                    const currentYear = new Date().getFullYear();
                    const startDateStr = dateMatch[1] + ', ' + currentYear;
                    const endDateStr = dateMatch[2] + ', ' + currentYear;
                    
                    activity.dateRange = {
                      start: new Date(startDateStr).toISOString(),
                      end: new Date(endDateStr).toISOString()
                    };
                  } else {
                    // Fallback for single date or other formats
                    activity.dateRange = {
                      start: new Date().toISOString(),
                      end: new Date().toISOString()
                    };
                  }
                }
                
                // Extract time range
                const timeRangeEl = event.querySelector('.programs-event-time-range');
                if (timeRangeEl) {
                  activity.schedule += ' ' + timeRangeEl.textContent.trim();
                }
                
                // Extract age range
                const ageRangeEl = event.querySelector('.programs-event-age-range');
                if (ageRangeEl) {
                  const ageText = ageRangeEl.textContent.trim();
                  const ageMatch = ageText.match(/(\d+)\s*(?:-\s*(\d+))?\s*yrs/);
                  if (ageMatch) {
                    activity.ageRange.min = parseInt(ageMatch[1]);
                    activity.ageRange.max = ageMatch[2] ? parseInt(ageMatch[2]) : 18;
                  } else if (ageText.includes('+')) {
                    const minAge = parseInt(ageText.match(/(\d+)/)?.[1] || '0');
                    activity.ageRange.min = minAge;
                    activity.ageRange.max = 18;
                  }
                }
                
                // Extract cost
                const feeEl = event.querySelector('.programs-event-fee');
                if (feeEl) {
                  const feeText = feeEl.textContent;
                  const feeMatch = feeText.match(/\$(\d+(?:\.\d{2})?)/);
                  if (feeMatch) {
                    activity.cost = parseFloat(feeMatch[1]);
                  }
                }
                
                // Extract spots available
                const spotsEl = event.querySelector('.programs-event-sessions-spots-sessions-remaining');
                if (spotsEl) {
                  activity.spotsAvailable = parseInt(spotsEl.textContent) || 0;
                }
                
                // Extract course ID
                const courseIdEl = event.querySelector('.programs-event-course-id a');
                if (courseIdEl) {
                  activity.courseId = courseIdEl.textContent.trim();
                  activity.registrationUrl = courseIdEl.href;
                }
                
                // Extract registration date
                const regDateEl = event.querySelector('.programs-event-registration');
                if (regDateEl) {
                  activity.registrationDate = regDateEl.textContent.replace('Registration date:', '').trim();
                }
                
                // Extract alert/description
                const alertEl = event.querySelector('.programs-event-alert');
                if (alertEl) {
                  activity.alert = alertEl.textContent.trim();
                }
                
                // Only add if we have a valid activity
                if (activity.name) {
                  activities.push(activity);
                }
              } catch (err) {
                console.error('Error extracting activity:', err);
              }
            });
          });
        });
        
        console.log(`Total activities extracted: ${activities.length}`);
        return activities;
      });
      
      console.log(`\n✅ Successfully extracted ${activities.length} activities`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_working_hierarchical_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        url: currentUrl,
        activitiesCount: activities.length,
        activities: activities
      }, null, 2));
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

  async extractActivitiesFromDetailPage(page, categoryName) {
    const activities = [];
    
    try {
      // Wait for page to load
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract all activity information from the detail page
      const pageActivities = await page.evaluate((category) => {
        const activities = [];
        
        // Look for activity listings on the detail page
        const activityElements = document.querySelectorAll(
          '.activity-listing, .program-listing, .course-listing, ' +
          'table tr, .list-group-item, article, .node'
        );
        
        activityElements.forEach((el, index) => {
          const text = el.textContent;
          
          // Skip headers and short content
          if (text.length < 30) return;
          
          // Look for activity indicators
          if (text.includes('$') || text.includes('Register') || 
              text.includes('AM') || text.includes('PM')) {
            
            const activity = {
              id: `nvrc_${Date.now()}_${index}`,
              category: category,
              name: '',
              schedule: '',
              dates: '',
              cost: 0,
              location: '',
              provider: 'NVRC',
              fullText: text.substring(0, 500)
            };
            
            // Extract title/name
            const titleEl = el.querySelector('h1, h2, h3, h4, h5, .title, .program-name');
            if (titleEl) {
              activity.name = titleEl.textContent.trim();
            } else {
              // Use first line as name
              const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
              activity.name = lines[0] || category;
            }
            
            // Extract cost
            const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
            if (costMatch) {
              activity.cost = parseFloat(costMatch[1]);
            }
            
            // Extract schedule/time
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?)/);
            if (timeMatch) {
              activity.schedule = timeMatch[0];
            }
            
            // Extract dates
            const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*(?:\s*[&,]\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*)*|\w{3}\s+\d{1,2}(?:\s*-\s*\w{3}\s+\d{1,2})?)/);
            if (dateMatch) {
              activity.dates = dateMatch[0];
            }
            
            // Extract location
            const locationMatch = text.match(/([A-Z][\w\s]+(?:Centre|Center|Community|School|Park|Pool|Arena|Rec))/i);
            if (locationMatch) {
              activity.location = locationMatch[0].trim();
            }
            
            // Only add if we have a valid name
            if (activity.name && activity.name.length > 3) {
              activities.push(activity);
            }
          }
        });
        
        return activities;
      }, categoryName);
      
      activities.push(...pageActivities);
      
    } catch (error) {
      console.error(`Error extracting from detail page:`, error);
    }
    
    return activities;
  }
  
  async extractExpandedActivities(page, categoryName) {
    return await page.evaluate((category) => {
      const activities = [];
      
      // Look for expanded content within the same page
      // This could be in collapsible sections, hidden divs that are now visible, etc.
      const expandedContent = document.querySelectorAll(
        '.expanded-content, .collapse.in, .panel-collapse.in, ' +
        '[style*="display: block"], [aria-expanded="true"] + *, ' +
        '.activity-details, .program-details'
      );
      
      expandedContent.forEach(container => {
        // Look for activities within the expanded content
        const activityElements = container.querySelectorAll(
          'tr, .list-item, .activity-item, .program-item, li'
        );
        
        activityElements.forEach((el, index) => {
          const text = el.textContent;
          
          if (text.length > 30 && (text.includes('$') || text.includes('Register'))) {
            const activity = {
              id: `nvrc_${Date.now()}_${index}`,
              category: category,
              name: '',
              schedule: '',
              dates: '',
              cost: 0,
              location: '',
              provider: 'NVRC'
            };
            
            // Extract name
            const nameEl = el.querySelector('td:first-child, .name, .title, strong');
            if (nameEl) {
              activity.name = nameEl.textContent.trim();
            } else {
              activity.name = text.split('\n')[0].trim();
            }
            
            // Extract cost
            const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
            if (costMatch) {
              activity.cost = parseFloat(costMatch[1]);
            }
            
            // Extract time
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?)/);
            if (timeMatch) {
              activity.schedule = timeMatch[0];
            }
            
            // Extract dates
            const dateMatch = text.match(/(\w{3}\s+\d{1,2}(?:\s*-\s*\w{3}\s+\d{1,2})?)/);
            if (dateMatch) {
              activity.dates = dateMatch[0];
            }
            
            // Extract location  
            const locationMatch = text.match(/([\w\s]+(?:Centre|Center|Community|School|Park|Pool|Arena))/i);
            if (locationMatch) {
              activity.location = locationMatch[0].trim();
            }
            
            if (activity.name && activity.name.length > 3) {
              activities.push(activity);
            }
          }
        });
      });
      
      return activities;
    }, categoryName);
  }

  async extractFromPage(page) {
    // Extract from regular results page (not iframe)
    return await page.evaluate(() => {
      const activities = [];
      const elements = document.querySelectorAll('.node--type-perfectmind-program, .views-row, article');
      
      elements.forEach((element, index) => {
        const title = element.querySelector('h2, h3, .title')?.textContent.trim() || '';
        const fullText = element.textContent;
        
        if (title) {
          activities.push({
            id: `nvrc_${index}`,
            name: title,
            fullText: fullText.substring(0, 300),
            provider: 'NVRC'
          });
        }
      });
      
      return activities;
    });
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCWorkingHierarchicalScraper();
  scraper.scrape()
    .then(activities => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Total activities: ${activities.length}`);
      
      if (activities.length > 0) {
        console.log('\nSample activities:');
        activities.slice(0, 5).forEach(act => {
          console.log(`  - ${act.name} | ${act.cost || 'N/A'}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCWorkingHierarchicalScraper;