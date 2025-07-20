const puppeteer = require('puppeteer');

class NVRCPuppeteerScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Launching Puppeteer browser...');
      browser = await puppeteer.launch({
        headless: false, // Set to true for production
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        defaultViewport: { width: 1440, height: 900 }
      });

      const page = await browser.newPage();
      
      // Set user agent and extra headers
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });

      // Navigate to the find program page
      console.log('📍 Navigating to NVRC find program page...');
      
      try {
        await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } catch (navError) {
        console.log('⚠️ Navigation timeout, trying to continue anyway...');
        // Sometimes the page loads but navigation doesn't complete properly
      }

      // Wait for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take a screenshot for debugging
      await page.screenshot({ path: 'nvrc-step0.png' });

      // STEP 1: Select Programs and Age Groups
      console.log('\n📋 STEP 1: Selecting Programs and Age Groups...');
      
      // First, make sure we're on the Programs tab
      try {
        // Click on Programs radio if visible
        await page.evaluate(() => {
          const programsRadio = document.querySelector('input[type="radio"][value="Programs"]');
          if (programsRadio && !programsRadio.checked) {
            programsRadio.click();
          }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.log('Programs radio might already be selected');
      }

      // Select the specific age groups from Step 1
      const ageGroups = [
        { selector: 'input[type="checkbox"][value="0 - 6 years, Parent Participation"]', label: '0 - 6 years, Parent Participation' },
        { selector: 'input[type="checkbox"][value="0 - 6 years, On My Own"]', label: '0 - 6 years, On My Own' },
        { selector: 'input[type="checkbox"][value="6 - 13 years, School Age"]', label: '6 - 13 years, School Age' },
        { selector: 'input[type="checkbox"][value="13 - 18 years, Youth"]', label: '13 - 18 years, Youth' }
      ];

      // Try to check the age group checkboxes
      for (const ageGroup of ageGroups) {
        try {
          await page.evaluate((selector) => {
            const checkbox = document.querySelector(selector);
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              // Trigger change event
              checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, ageGroup.selector);
          console.log(`  ✅ Selected: ${ageGroup.label}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          // Try alternative approach
          try {
            await page.evaluate((label) => {
              const labels = Array.from(document.querySelectorAll('label'));
              const targetLabel = labels.find(l => l.textContent.includes(label));
              if (targetLabel) {
                const checkbox = targetLabel.querySelector('input[type="checkbox"]') || 
                                targetLabel.previousElementSibling || 
                                targetLabel.nextElementSibling;
                if (checkbox && checkbox.type === 'checkbox' && !checkbox.checked) {
                  checkbox.click();
                }
              }
            }, ageGroup.label);
            console.log(`  ✅ Selected: ${ageGroup.label}`);
          } catch (e2) {
            console.log(`  ❌ Could not select: ${ageGroup.label}`);
          }
        }
      }

      await page.screenshot({ path: 'nvrc-step1.png' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 2: Select Activities
      console.log('\n🎯 STEP 2: Selecting Activities...');
      
      // Activities to select - these are the actual checkbox values on NVRC site
      const activities = [
        'Aquatic Leadership',
        'Arts & Culture - Dance', 
        'Arts & Culture - Music',
        'Arts & Culture - Visual Arts',
        'Camps',
        'Learn and Play',
        'Martial Arts',
        'Swimming'
      ];

      for (const activity of activities) {
        try {
          await page.evaluate((activityName) => {
            // Find checkbox by label text
            const labels = Array.from(document.querySelectorAll('label'));
            const activityLabel = labels.find(label => 
              label.textContent.trim() === activityName || 
              label.textContent.includes(activityName)
            );
            
            if (activityLabel) {
              const checkbox = activityLabel.querySelector('input[type="checkbox"]') ||
                              activityLabel.previousElementSibling ||
                              document.querySelector(`input[type="checkbox"][value="${activityName}"]`);
              
              if (checkbox && checkbox.type === 'checkbox' && !checkbox.checked) {
                checkbox.click();
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }, activity);
          console.log(`  ✅ Selected activity: ${activity}`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
          console.log(`  ❌ Could not select activity: ${activity}`);
        }
      }

      await page.screenshot({ path: 'nvrc-step2.png' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 3: Select Locations
      console.log('\n📍 STEP 3: Selecting Locations...');
      
      // Try to select all locations
      try {
        await page.evaluate(() => {
          // Look for "Select all locations" checkbox
          const selectAllCheckbox = document.querySelector('input[type="checkbox"][value="Select all locations available"]') ||
                                   document.querySelector('input[type="checkbox"][name*="select_all"]');
          
          if (selectAllCheckbox && !selectAllCheckbox.checked) {
            selectAllCheckbox.click();
            selectAllCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            // If no select all, try to check all location checkboxes
            const locationCheckboxes = document.querySelectorAll('input[type="checkbox"][name*="location"], input[type="checkbox"][value*="Centre"]');
            locationCheckboxes.forEach(cb => {
              if (!cb.checked) {
                cb.click();
              }
            });
          }
        });
        console.log('  ✅ Selected all locations');
      } catch (e) {
        console.log('  ❌ Could not select locations automatically');
      }

      await page.screenshot({ path: 'nvrc-step3.png' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click Show Results
      console.log('\n🔍 Clicking Show Results...');
      
      let resultsClicked = false;
      
      // Try multiple strategies to find and click the button
      const buttonStrategies = [
        // Strategy 1: Click by button text
        () => page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
          const showResultsBtn = buttons.find(btn => 
            btn.textContent.toLowerCase().includes('show results') ||
            btn.value?.toLowerCase().includes('show results')
          );
          if (showResultsBtn) {
            showResultsBtn.click();
            return true;
          }
          return false;
        }),
        
        // Strategy 2: Click by class or ID
        () => page.click('.show-results, #show-results, .submit-form, button[type="submit"]'),
        
        // Strategy 3: Submit the form
        () => page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) {
            form.submit();
            return true;
          }
          return false;
        })
      ];

      for (const strategy of buttonStrategies) {
        try {
          const result = await strategy();
          if (result !== false) {
            resultsClicked = true;
            console.log('  ✅ Show Results clicked!');
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!resultsClicked) {
        console.log('  ❌ Could not click Show Results button');
        await page.screenshot({ path: 'nvrc-no-button.png' });
      }

      // Wait for navigation or results to load
      console.log('\n⏳ Waiting for results to load...');
      
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
          page.waitForSelector('.program-item, .course-item, .search-results, .results-container', { timeout: 30000 })
        ]);
      } catch (e) {
        console.log('Navigation timeout, checking current page...');
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      await page.screenshot({ path: 'nvrc-results.png' });
      
      // Save page HTML for debugging
      const pageContent = await page.content();
      const fs = require('fs');
      fs.writeFileSync('nvrc-results.html', pageContent);
      console.log('💾 Saved page HTML to nvrc-results.html');

      // Extract the results - handle expandable panels
      console.log('\n📊 Extracting program data from expandable panels...');
      
      // First, let's expand all collapsible panels
      await page.evaluate(() => {
        // Look for expandable panels/accordions - specific to NVRC's Bootstrap accordions
        const expandButtons = document.querySelectorAll('[aria-expanded="false"], .panel-heading a.collapsed, .accordion-toggle, button[data-toggle="collapse"], a[data-toggle="collapse"]');
        expandButtons.forEach(button => {
          if (button) {
            button.click();
            console.log('Clicked expand button:', button.textContent);
          }
        });
        
        // Also try clicking panel headings directly
        const panelHeadings = document.querySelectorAll('.panel-heading');
        panelHeadings.forEach(heading => {
          const link = heading.querySelector('a[data-toggle="collapse"]');
          if (link && link.getAttribute('aria-expanded') === 'false') {
            link.click();
            console.log('Clicked panel heading:', heading.textContent);
          }
        });
      });
      
      // Wait for panels to expand
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Now extract the programs
      const programs = await page.evaluate(() => {
        const camps = [];
        
        // Helper function to extract text
        const getText = (element, selectors) => {
          if (!element) return '';
          for (const selector of selectors) {
            const el = element.querySelector(selector);
            if (el && el.textContent) {
              return el.textContent.trim();
            }
          }
          return '';
        };

        // Look for program containers - Bootstrap panels with panel-primary class
        const programPanels = document.querySelectorAll('.panel.panel-primary, .panel.panel-default');
        
        programPanels.forEach((panel, index) => {
          try {
            const text = panel.textContent || '';
            
            // Extract program name from heading
            const heading = panel.querySelector('h3, h4, .panel-title, .program-title, .activity-title');
            const name = heading ? heading.textContent.trim() : '';
            
            // Look for the course table inside the expanded panel
            const courseTable = panel.querySelector('table');
            const courseRows = courseTable ? courseTable.querySelectorAll('tbody tr') : [];
            
            if (courseRows.length > 0) {
              // Each row might be a different session/time
              courseRows.forEach((row, rowIndex) => {
                // Get table cells
                const cells = row.querySelectorAll('td');
                if (cells.length < 4) return; // Skip if not enough cells
                
                const camp = {
                  id: `nvrc-${Date.now()}-${index}-${rowIndex}`,
                  name: name || 'NVRC Program',
                  provider: 'NVRC',
                  description: '',
                  location: {
                    name: '',
                    address: ''
                  },
                  cost: 0,
                  dateRange: { start: new Date().toISOString(), end: new Date().toISOString() },
                  schedule: { days: [], startTime: '', endTime: '' },
                  ageRange: { min: 0, max: 18 },
                  spotsAvailable: null,
                  registrationUrl: 'https://www.nvrc.ca/register',
                  activityType: [],
                  imageUrl: null,
                  scrapedAt: new Date().toISOString()
                };
                
                // Extract data from table cells
                // Cell 0: Days and times
                const dayTimeText = cells[0] ? cells[0].textContent.trim() : '';
                const dayMatch = dayTimeText.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z,\s&]*/gi);
                if (dayMatch) {
                  camp.schedule.days = dayMatch[0].split(/[,&]/).map(d => d.trim());
                }
                
                const timeMatch = dayTimeText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
                if (timeMatch) {
                  camp.schedule.startTime = timeMatch[1];
                  camp.schedule.endTime = timeMatch[2];
                }
                
                // Cell 1: Dates (e.g., "Jul 21 - Aug 16")
                const dateText = cells[1] ? cells[1].textContent.trim() : '';
                const dateMatch = dateText.match(/(\w{3}\s+\d{1,2})\s*-\s*(\w{3}\s+\d{1,2})/);
                if (dateMatch) {
                  const currentYear = new Date().getFullYear();
                  camp.dateRange.start = new Date(`${dateMatch[1]}, ${currentYear}`).toISOString();
                  camp.dateRange.end = new Date(`${dateMatch[2]}, ${currentYear}`).toISOString();
                }
                
                // Cell 2: Course ID and Location
                const courseIdCell = cells[2];
                if (courseIdCell) {
                  const courseIdText = courseIdCell.textContent.trim();
                  const courseIdMatch = courseIdText.match(/Course ID:\s*(\d+)/);
                  if (courseIdMatch) {
                    camp.id = `nvrc-course-${courseIdMatch[1]}`;
                  }
                  
                  // Extract location (after "at")
                  const locationMatch = courseIdText.match(/at\s+(.+)/);
                  if (locationMatch) {
                    camp.location.name = locationMatch[1].trim();
                  }
                }
                
                // Cell 3: Cost
                const costCell = cells[3];
                if (costCell) {
                  const costMatch = costCell.textContent.match(/\$(\d+(?:\.\d{2})?)/);
                  if (costMatch) {
                    camp.cost = parseFloat(costMatch[1]);
                  }
                }
                
                // Extract age
                const ageMatch = text.match(/(\d+)yr/i);
                if (ageMatch) {
                  const age = parseInt(ageMatch[1]);
                  camp.ageRange.min = Math.max(0, age - 1);
                  camp.ageRange.max = age + 1;
                }
                
                // Determine activity type from name
                const nameLower = name.toLowerCase();
                if (nameLower.includes('swim')) camp.activityType.push('swimming');
                else if (nameLower.includes('camp')) camp.activityType.push('camps');
                else if (nameLower.includes('art')) camp.activityType.push('visual_arts');
                else if (nameLower.includes('dance')) camp.activityType.push('dance');
                else if (nameLower.includes('music')) camp.activityType.push('music');
                else if (nameLower.includes('martial')) camp.activityType.push('martial_arts');
                else camp.activityType.push('general');
                
                // Extract location
                const locationMatch = rowText.match(/at\s+([^,]+)/i);
                if (locationMatch) {
                  camp.location.name = locationMatch[1].trim();
                }
                
                // Look for the + button which would have registration link
                const addButton = row.querySelector('button[class*="add"], button[class*="plus"], a[href*="register"]');
                if (addButton && addButton.getAttribute('href')) {
                  camp.registrationUrl = addButton.getAttribute('href');
                }
                
                // Only add if we have meaningful data
                if (camp.cost > 0 || camp.schedule.startTime) {
                  camps.push(camp);
                }
              });
            } else {
              // Single program without sub-rows
              const camp = {
                id: `nvrc-${Date.now()}-${index}`,
                name: name || getText(panel, ['.program-name', '.activity-name']),
                provider: 'NVRC',
                description: getText(panel, ['.description', 'p']),
                location: {
                  name: getText(panel, ['.location', '.venue']),
                  address: ''
                },
                cost: 0,
                dateRange: { start: new Date().toISOString(), end: new Date().toISOString() },
                schedule: { days: [], startTime: '', endTime: '' },
                ageRange: { min: 0, max: 18 },
                spotsAvailable: null,
                registrationUrl: 'https://www.nvrc.ca/register',
                activityType: ['camps'],
                imageUrl: null,
                scrapedAt: new Date().toISOString()
              };
              
              // Extract cost
              const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
              if (costMatch) {
                camp.cost = parseFloat(costMatch[1]);
              }
              
              // Only add if we have a name
              if (camp.name) {
                camps.push(camp);
              }
            }
          } catch (err) {
            console.error('Error extracting program:', err);
          }
        });

        return camps;
      });

      console.log(`\n✅ Scraped ${programs.length} programs successfully!`);
      
      // Close browser
      await browser.close();
      
      return programs;

    } catch (error) {
      console.error('❌ Puppeteer scraping error:', error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
}

module.exports = NVRCPuppeteerScraper;