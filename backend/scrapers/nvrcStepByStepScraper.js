const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCStepByStepScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Step-by-Step Scraper...');
      browser = await puppeteer.launch({
        headless: false, // Keep visible for debugging
        slowMo: 100, // Slow down to see actions
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1440, height: 900 }
      });

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => console.log('PAGE:', msg.text()));
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the find program page
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for JavaScript to fully load
      console.log('⏳ Waiting for JavaScript to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take initial screenshot
      await page.screenshot({ path: 'nvrc-0-initial.png' });

      // STEP 1: Open Step 1 section and select age groups
      console.log('\n📋 STEP 1: Opening Step 1 section...');
      
      // Look for Step 1 accordion/section header
      const step1Selectors = [
        'button:has-text("Step 1")',
        'a:has-text("Step 1")',
        '[data-toggle="collapse"]:has-text("Step 1")',
        '.accordion-toggle:has-text("Step 1")',
        'h3:has-text("Step 1")',
        'h4:has-text("Step 1")',
        '[aria-controls*="step1"]',
        '[data-target*="step1"]'
      ];

      let step1Clicked = false;
      for (const selector of step1Selectors) {
        try {
          await page.click(selector);
          console.log(`  ✅ Clicked Step 1 using: ${selector}`);
          step1Clicked = true;
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!step1Clicked) {
        // Try text-based click
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const step1 = elements.find(el => 
            el.textContent && el.textContent.includes('Step 1') && 
            (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'H3' || el.tagName === 'H4')
          );
          if (step1) step1.click();
        });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('  Selecting age groups...');
      
      // Select the specific age groups
      const ageGroups = [
        { selector: 'input[value="Early Years: On My Own"]', label: '0-6 years, On My Own' },
        { selector: 'input[value="Early Years: Parent Participation"]', label: '0-6 years, Parent Participation' },
        { selector: 'input[value="School Age"]', label: '5-13 years, School Age' },
        { selector: 'input[value="Youth"]', label: '10-18 years, Youth' }
      ];

      for (const age of ageGroups) {
        try {
          await page.click(age.selector);
          console.log(`  ✅ Selected: ${age.label}`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
          // Try by ID
          try {
            const id = age.selector.replace('input[value="', '#edit-programs-').replace('"]', '').toLowerCase().replace(/[\s:]/g, '-');
            await page.click(id);
            console.log(`  ✅ Selected: ${age.label} (by ID)`);
          } catch (e2) {
            console.log(`  ❌ Could not select: ${age.label}`);
          }
        }
      }

      await page.screenshot({ path: 'nvrc-1-step1-complete.png' });

      // STEP 2: Open Step 2 and select all programs
      console.log('\n🎯 STEP 2: Opening Step 2 section...');
      
      const step2Selectors = [
        'button:has-text("Step 2")',
        'a:has-text("Step 2")',
        '[data-toggle="collapse"]:has-text("Step 2")',
        '.accordion-toggle:has-text("Step 2")',
        'h3:has-text("Step 2")',
        'h4:has-text("Step 2")'
      ];

      for (const selector of step2Selectors) {
        try {
          await page.click(selector);
          console.log(`  ✅ Clicked Step 2 using: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('  Selecting all programs...');
      
      // Try to find and click "Select all" for programs
      try {
        await page.click('input[type="checkbox"][value*="select all" i]');
        console.log('  ✅ Clicked "Select all programs"');
      } catch (e) {
        // If no "select all", click individual program checkboxes
        const programCheckboxes = await page.$$('input[type="checkbox"][name*="activities"]');
        console.log(`  Found ${programCheckboxes.length} program checkboxes`);
        for (const checkbox of programCheckboxes) {
          await checkbox.click();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      await page.screenshot({ path: 'nvrc-2-step2-complete.png' });

      // STEP 3: Open Step 3 and select all locations
      console.log('\n📍 STEP 3: Opening Step 3 section...');
      
      const step3Selectors = [
        'button:has-text("Step 3")',
        'a:has-text("Step 3")',
        '[data-toggle="collapse"]:has-text("Step 3")',
        '.accordion-toggle:has-text("Step 3")',
        'h3:has-text("Step 3")',
        'h4:has-text("Step 3")'
      ];

      for (const selector of step3Selectors) {
        try {
          await page.click(selector);
          console.log(`  ✅ Clicked Step 3 using: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('  Selecting all locations...');
      
      // Look for "Select all locations" checkbox
      try {
        await page.click('input[type="checkbox"][value*="all locations" i]');
        console.log('  ✅ Selected all locations');
      } catch (e) {
        // Try alternative selectors
        try {
          await page.click('input#edit-locations-select-all-locations-available');
          console.log('  ✅ Selected all locations (by ID)');
        } catch (e2) {
          console.log('  ❌ Could not find "Select all locations" checkbox');
        }
      }

      await page.screenshot({ path: 'nvrc-3-step3-complete.png' });

      // Click Show Results button
      console.log('\n🔍 Looking for Show Results button...');
      
      const showResultsSelectors = [
        'button:has-text("Show Results")',
        'input[type="submit"][value="Show Results"]',
        'a:has-text("Show Results")',
        'button[type="submit"]:has-text("Show")',
        '#edit-submit',
        'button.form-submit'
      ];

      let resultsClicked = false;
      for (const selector of showResultsSelectors) {
        try {
          await page.click(selector);
          console.log(`  ✅ Clicked Show Results using: ${selector}`);
          resultsClicked = true;
          break;
        } catch (e) {
          // Try next
        }
      }

      if (!resultsClicked) {
        // Try clicking by text
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const showResults = buttons.find(btn => 
            btn.textContent?.toLowerCase().includes('show results') ||
            btn.value?.toLowerCase().includes('show results')
          );
          if (showResults) showResults.click();
        });
      }

      // Wait for results
      console.log('\n⏳ Waiting for results to load...');
      
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
      } catch (e) {
        console.log('  Navigation timeout, checking for results on same page...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot of results
      await page.screenshot({ path: 'nvrc-4-results.png', fullPage: true });
      
      // Save HTML for analysis
      const resultsHtml = await page.content();
      fs.writeFileSync('nvrc-results-content.html', resultsHtml);
      console.log('💾 Saved results HTML to nvrc-results-content.html');

      // Extract programs from results
      console.log('\n📊 Extracting program data...');
      
      const programs = await page.evaluate(() => {
        const camps = [];
        
        // Look for result containers
        const resultSelectors = [
          '.view-program-search-listing .views-row',
          '.search-results .result-item',
          '.program-listing-item',
          '.course-listing-item',
          'article.program',
          '.panel.panel-primary',
          '.panel.panel-default',
          '.accordion-group'
        ];
        
        let resultElements = [];
        for (const selector of resultSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            resultElements = Array.from(elements);
            console.log(`Found ${elements.length} results with selector: ${selector}`);
            break;
          }
        }

        // Process each result
        resultElements.forEach((element, index) => {
          try {
            const text = element.textContent || '';
            
            const camp = {
              id: `nvrc-${Date.now()}-${index}`,
              name: '',
              provider: 'NVRC',
              description: '',
              location: { name: '', address: '' },
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

            // Extract name from heading
            const heading = element.querySelector('h3, h4, .panel-title, .program-title');
            if (heading) {
              camp.name = heading.textContent.trim();
            }

            // Extract from table if present
            const table = element.querySelector('table');
            if (table) {
              const rows = table.querySelectorAll('tbody tr');
              rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 4) {
                  // Clone camp data for each session
                  const sessionCamp = { ...camp };
                  sessionCamp.id = `nvrc-${Date.now()}-${index}-${rowIndex}`;
                  
                  // Cell 0: Days and time
                  const dayTimeText = cells[0].textContent.trim();
                  const timeMatch = dayTimeText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
                  if (timeMatch) {
                    sessionCamp.schedule.startTime = timeMatch[1];
                    sessionCamp.schedule.endTime = timeMatch[2];
                  }
                  
                  // Cell 1: Dates
                  const dateText = cells[1].textContent.trim();
                  const dateMatch = dateText.match(/(\w{3}\s+\d{1,2})\s*-\s*(\w{3}\s+\d{1,2})/);
                  if (dateMatch) {
                    const year = new Date().getFullYear();
                    sessionCamp.dateRange.start = new Date(`${dateMatch[1]}, ${year}`).toISOString();
                    sessionCamp.dateRange.end = new Date(`${dateMatch[2]}, ${year}`).toISOString();
                  }
                  
                  // Cell 2: Course info
                  const courseText = cells[2].textContent.trim();
                  const courseIdMatch = courseText.match(/Course ID:\s*(\d+)/);
                  if (courseIdMatch) {
                    sessionCamp.id = `nvrc-course-${courseIdMatch[1]}`;
                  }
                  const locationMatch = courseText.match(/at\s+(.+?)(?:\s*Course|$)/);
                  if (locationMatch) {
                    sessionCamp.location.name = locationMatch[1].trim();
                  }
                  
                  // Cell 3: Cost
                  const costText = cells[3].textContent.trim();
                  const costMatch = costText.match(/\$(\d+(?:\.\d{2})?)/);
                  if (costMatch) {
                    sessionCamp.cost = parseFloat(costMatch[1]);
                  }
                  
                  camps.push(sessionCamp);
                }
              });
            } else {
              // No table, extract from text
              const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
              if (costMatch) {
                camp.cost = parseFloat(costMatch[1]);
              }
              
              if (camp.name || camp.cost > 0) {
                camps.push(camp);
              }
            }
          } catch (err) {
            console.error('Error processing result:', err);
          }
        });

        return camps;
      });

      console.log(`\n✅ Extracted ${programs.length} programs`);
      
      if (programs.length > 0) {
        console.log('\nFirst 3 programs:');
        programs.slice(0, 3).forEach((p, i) => {
          console.log(`${i + 1}. ${p.name} - $${p.cost} at ${p.location.name}`);
        });
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

module.exports = NVRCStepByStepScraper;