const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCInteractiveScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Interactive Scraper...');
      browser = await puppeteer.launch({
        headless: false, // Keep visible to see the process
        slowMo: 50, // Slow down for stability
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE')) {
          console.log('PAGE:', msg.text());
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the find program page
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Wait for page to settle
      console.log('⏳ Waiting for page to fully load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // STEP 1: Select age groups
      console.log('\n📋 STEP 1: Selecting age groups...');
      
      // Click on Step 1 if it's collapsed
      try {
        const step1Collapsed = await page.$('[data-toggle="collapse"][aria-expanded="false"]:has-text("Step 1")');
        if (step1Collapsed) {
          await step1Collapsed.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (e) {
        console.log('  Step 1 already expanded or different structure');
      }

      // Select age groups using the exact selectors from the debug output
      const ageSelectors = [
        '#edit-programs-early-years-on-my-own',
        '#edit-programs-early-years-parent-participation',
        '#edit-programs-school-age',
        '#edit-programs-youth'
      ];

      for (const selector of ageSelectors) {
        try {
          const checkbox = await page.$(selector);
          if (checkbox) {
            const isChecked = await page.$eval(selector, el => el.checked);
            if (!isChecked) {
              await page.click(selector);
              console.log(`  ✅ Selected: ${selector}`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        } catch (e) {
          console.log(`  ❌ Could not select: ${selector}`);
        }
      }

      // STEP 2: Activities (if needed)
      console.log('\n🎯 STEP 2: Checking for activities step...');
      
      // Look for Step 2 and expand if needed
      const hasStep2 = await page.$('*:has-text("Step 2")');
      if (hasStep2) {
        console.log('  Step 2 found, selecting activities...');
        
        // Try to click Step 2 header
        try {
          await page.evaluate(() => {
            const step2Elements = Array.from(document.querySelectorAll('*'));
            const step2 = step2Elements.find(el => 
              el.textContent && el.textContent.includes('Step 2') && 
              (el.hasAttribute('data-toggle') || el.tagName === 'BUTTON' || el.tagName === 'A')
            );
            if (step2) step2.click();
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.log('  Could not click Step 2 header');
        }

        // Select all activity checkboxes
        const activityCheckboxes = await page.$$('input[type="checkbox"][name*="activities"]');
        for (const checkbox of activityCheckboxes) {
          try {
            const isChecked = await checkbox.evaluate(el => el.checked);
            if (!isChecked) {
              await checkbox.click();
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch (e) {
            // Continue
          }
        }
      }

      // STEP 3: Locations
      console.log('\n📍 STEP 3: Selecting locations...');
      
      const hasStep3 = await page.$('*:has-text("Step 3")');
      if (hasStep3) {
        // Try to click Step 3 header
        try {
          await page.evaluate(() => {
            const step3Elements = Array.from(document.querySelectorAll('*'));
            const step3 = step3Elements.find(el => 
              el.textContent && el.textContent.includes('Step 3') && 
              (el.hasAttribute('data-toggle') || el.tagName === 'BUTTON' || el.tagName === 'A')
            );
            if (step3) step3.click();
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.log('  Could not click Step 3 header');
        }

        // Try to select all locations
        try {
          // Look for "Select all locations available" checkbox
          const selectAllLocations = await page.$('input[value*="all locations" i]');
          if (selectAllLocations) {
            await selectAllLocations.click();
            console.log('  ✅ Selected all locations');
          }
        } catch (e) {
          console.log('  Could not find select all locations');
        }
      }

      // Submit the form
      console.log('\n🔍 Looking for Show Results button...');
      
      try {
        // Try multiple strategies to find and click the submit button
        const clicked = await page.evaluate(() => {
          // Strategy 1: By text content
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
          const showResults = buttons.find(btn => {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            return text.includes('show results') || text.includes('search') || text.includes('submit');
          });
          
          if (showResults) {
            showResults.click();
            return true;
          }
          
          // Strategy 2: By ID
          const submitById = document.querySelector('#edit-submit');
          if (submitById) {
            submitById.click();
            return true;
          }
          
          return false;
        });
        
        if (clicked) {
          console.log('  ✅ Clicked submit button');
        }
      } catch (e) {
        console.log('  ❌ Could not find submit button');
      }

      // Wait for results to load
      console.log('\n⏳ Waiting for search results to load with JavaScript...');
      console.log('  This may take 30-60 seconds...');
      
      // Wait for navigation or dynamic content
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
          page.waitForSelector('.search-results', { timeout: 30000 }),
          page.waitForSelector('.view-program-search-listing', { timeout: 30000 }),
          page.waitForSelector('.panel.panel-primary', { timeout: 30000 })
        ]);
      } catch (e) {
        console.log('  Initial wait timed out, waiting longer...');
      }
      
      // Additional wait for JavaScript rendering
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check if we have results
      const hasResults = await page.evaluate(() => {
        return document.querySelectorAll('.panel, .program-item, .search-result, .course-item').length > 0;
      });
      
      console.log(`  Results found: ${hasResults}`);
      
      if (!hasResults) {
        console.log('  No results yet, waiting more...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      // Take screenshot of results
      await page.screenshot({ path: 'nvrc-results-before-expand.png', fullPage: true });

      // Extract programs by clicking + buttons
      console.log('\n📊 Extracting program data by clicking + buttons...');
      
      const programs = [];
      
      // Find all expandable result panels
      const resultPanels = await page.$$('.panel.panel-primary, .panel.panel-default');
      console.log(`  Found ${resultPanels.length} result panels`);

      // First, expand all panels
      console.log('  Expanding all panels...');
      for (let i = 0; i < resultPanels.length; i++) {
        try {
          // Click the panel header to expand
          const panelHeader = await resultPanels[i].$('.panel-heading a[data-toggle="collapse"]');
          if (panelHeader) {
            const isExpanded = await panelHeader.evaluate(el => el.getAttribute('aria-expanded') === 'true');
            if (!isExpanded) {
              await panelHeader.click();
              console.log(`    Expanded panel ${i + 1}`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } catch (e) {
          console.log(`    Could not expand panel ${i + 1}`);
        }
      }

      // Wait for all panels to expand
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Now extract data from each panel
      for (let i = 0; i < resultPanels.length; i++) {
        const panel = resultPanels[i];
        
        try {
          // Get activity name from panel heading
          const activityName = await panel.$eval('.panel-title', el => el.textContent.trim()).catch(() => 'Unknown Activity');
          
          console.log(`\n  Processing: ${activityName}`);
          
          // Find the table with course listings inside this panel
          const courseRows = await panel.$$('table tbody tr');
          console.log(`    Found ${courseRows.length} courses`);
          
          for (let j = 0; j < courseRows.length; j++) {
            const row = courseRows[j];
            
            try {
              // Extract course data from table cells
              const cells = await row.$$('td');
              if (cells.length < 4) continue;
              
              const courseData = {
                id: `nvrc-${Date.now()}-${i}-${j}`,
                name: activityName,
                provider: 'NVRC',
                description: '',
                location: { name: '', address: '' },
                cost: 0,
                dateRange: { start: new Date().toISOString(), end: new Date().toISOString() },
                schedule: { days: [], startTime: '', endTime: '' },
                ageRange: { min: 0, max: 18 },
                spotsAvailable: null,
                registrationUrl: '',
                activityType: [],
                imageUrl: null,
                scrapedAt: new Date().toISOString()
              };

              // Cell 0: Days and time
              const dayTimeText = await cells[0].evaluate(el => el.textContent.trim());
              console.log(`      Schedule: ${dayTimeText}`);
              
              // Extract days
              const dayMatches = dayTimeText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi);
              if (dayMatches) {
                courseData.schedule.days = [...new Set(dayMatches)];
              }
              
              // Extract time
              const timeMatch = dayTimeText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
              if (timeMatch) {
                courseData.schedule.startTime = timeMatch[1];
                courseData.schedule.endTime = timeMatch[2];
              }

              // Cell 1: Dates
              const dateText = await cells[1].evaluate(el => el.textContent.trim());
              const dateMatch = dateText.match(/(\w{3}\s+\d{1,2})\s*-\s*(\w{3}\s+\d{1,2})/);
              if (dateMatch) {
                const year = new Date().getFullYear();
                courseData.dateRange.start = new Date(`${dateMatch[1]}, ${year}`).toISOString();
                courseData.dateRange.end = new Date(`${dateMatch[2]}, ${year}`).toISOString();
              }

              // Cell 2: Course ID and Location
              const infoText = await cells[2].evaluate(el => el.textContent.trim());
              const courseIdMatch = infoText.match(/Course ID:\s*(\d+)/);
              if (courseIdMatch) {
                courseData.id = `nvrc-course-${courseIdMatch[1]}`;
              }
              
              const locationMatch = infoText.match(/at\s+(.+?)(?:\s*Course|$)/);
              if (locationMatch) {
                courseData.location.name = locationMatch[1].trim();
              }

              // Cell 3: Cost
              const costText = await cells[3].evaluate(el => el.textContent.trim());
              const costMatch = costText.match(/\$(\d+(?:\.\d{2})?)/);
              if (costMatch) {
                courseData.cost = parseFloat(costMatch[1]);
              }

              // Cell 4: Plus button for registration
              console.log(`      Looking for + button in row ${j + 1}...`);
              
              // Find the + button in this row
              const plusButton = await row.$('button, a[class*="add"], a[class*="plus"], .btn-add');
              
              if (plusButton) {
                try {
                  // Click the + button
                  await plusButton.click();
                  console.log('        ✅ Clicked + button');
                  
                  // Wait for modal or new content
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  // Look for registration link in modal or new content
                  const registrationLink = await page.evaluate(() => {
                    // Check for modal
                    const modal = document.querySelector('.modal.in, .modal.show, [role="dialog"]');
                    if (modal) {
                      const link = modal.querySelector('a[href*="register"], a[href*="booking"], a.btn-primary');
                      if (link) return link.href;
                    }
                    
                    // Check for any new registration link
                    const links = Array.from(document.querySelectorAll('a'));
                    const regLink = links.find(a => 
                      a.href && (a.href.includes('register') || a.href.includes('booking')) &&
                      a.offsetParent !== null // Is visible
                    );
                    
                    return regLink ? regLink.href : null;
                  });
                  
                  if (registrationLink) {
                    courseData.registrationUrl = registrationLink;
                    console.log(`        📎 Registration URL: ${registrationLink}`);
                  }
                  
                  // Close modal if open
                  await page.evaluate(() => {
                    const closeButton = document.querySelector('.modal .close, .modal button[data-dismiss="modal"]');
                    if (closeButton) closeButton.click();
                  });
                  
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                } catch (e) {
                  console.log('        ❌ Error clicking + button:', e.message);
                }
              } else {
                console.log('        ❌ No + button found');
              }

              // Determine activity type
              const fullText = activityName.toLowerCase();
              if (fullText.includes('swim') || fullText.includes('aqua')) {
                courseData.activityType.push('swimming');
              } else if (fullText.includes('camp')) {
                courseData.activityType.push('camps');
              } else if (fullText.includes('art') || fullText.includes('craft')) {
                courseData.activityType.push('visual_arts');
              } else if (fullText.includes('dance')) {
                courseData.activityType.push('dance');
              } else if (fullText.includes('music')) {
                courseData.activityType.push('music');
              } else if (fullText.includes('martial') || fullText.includes('karate')) {
                courseData.activityType.push('martial_arts');
              } else {
                courseData.activityType.push('general');
              }

              // Extract age from activity name
              const ageMatch = activityName.match(/(\d+)\s*yr/i);
              if (ageMatch) {
                const age = parseInt(ageMatch[1]);
                courseData.ageRange.min = Math.max(0, age - 1);
                courseData.ageRange.max = age + 1;
              }

              programs.push(courseData);
              console.log(`      ✅ Added course: ${courseData.id}`);
              
            } catch (rowError) {
              console.log(`      ❌ Error processing row ${j + 1}:`, rowError.message);
            }
          }
        } catch (panelError) {
          console.log(`  ❌ Error processing panel ${i + 1}:`, panelError.message);
        }
      }

      // Take final screenshot
      await page.screenshot({ path: 'nvrc-results-after-expand.png', fullPage: true });
      
      // Save the extracted data
      fs.writeFileSync('nvrc-extracted-programs.json', JSON.stringify(programs, null, 2));
      console.log('\n💾 Saved extracted programs to nvrc-extracted-programs.json');

      console.log(`\n✅ Successfully extracted ${programs.length} programs`);
      
      // Show summary
      if (programs.length > 0) {
        console.log('\nProgram Summary:');
        console.log('='.repeat(80));
        
        const activityCounts = {};
        programs.forEach(p => {
          p.activityType.forEach(type => {
            activityCounts[type] = (activityCounts[type] || 0) + 1;
          });
        });
        
        Object.entries(activityCounts).forEach(([type, count]) => {
          console.log(`  ${type}: ${count} programs`);
        });
        
        const totalCost = programs.reduce((sum, p) => sum + p.cost, 0);
        console.log(`\n  Total programs: ${programs.length}`);
        console.log(`  Average cost: $${(totalCost / programs.length).toFixed(2)}`);
        console.log(`  Programs with registration URLs: ${programs.filter(p => p.registrationUrl).length}`);
      }

      await browser.close();
      return programs;

    } catch (error) {
      console.error('❌ Scraping error:', error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
}

module.exports = NVRCInteractiveScraper;