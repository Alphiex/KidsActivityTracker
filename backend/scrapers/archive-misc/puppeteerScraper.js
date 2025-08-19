const puppeteer = require('puppeteer');

class PuppeteerScraper {
  async scrapeNVRCWithPuppeteer(queryParams) {
    let browser;
    
    try {
      console.log('Launching Puppeteer browser...');
      browser = await puppeteer.launch({
        headless: false, // Set to true for production
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1920, height: 1080 }
      });

      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the main find program page
      const url = 'https://www.nvrc.ca/programs-memberships/find-program';
      console.log('Navigating to:', url);
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for the form to load
      await page.waitForTimeout(3000);

      // Step 1: Select Programs and Age Groups
      console.log('Step 1: Selecting age groups...');
      
      // Click on "Programs" radio button if not already selected
      const programsRadio = await page.$('input[value="Programs"]');
      if (programsRadio) {
        await programsRadio.click();
        await page.waitForTimeout(500);
      }

      // Select age groups for kids
      const ageGroups = [
        '0 - 6 years, Parent Participation',
        '0 - 6 years, On My Own',
        '5 - 13 years, School Age',
        '10 - 18 years, Youth'
      ];

      for (const ageGroup of ageGroups) {
        const checkbox = await page.$(`input[type="checkbox"][value="${ageGroup}"]`);
        if (checkbox) {
          const isChecked = await page.$eval(`input[type="checkbox"][value="${ageGroup}"]`, el => el.checked);
          if (!isChecked) {
            await checkbox.click();
            console.log(`  Selected: ${ageGroup}`);
            await page.waitForTimeout(200);
          }
        }
      }

      // Step 2: Choose program activities
      console.log('Step 2: Selecting activities...');
      
      // Click to go to step 2 (might need to click a "Next" button)
      const step2Button = await page.$('button:contains("Next"), a:contains("Next"), div.step-2');
      if (step2Button) {
        await step2Button.click();
        await page.waitForTimeout(2000);
      }

      // Select activities
      const activities = [
        'Camps',
        'Swimming',
        'Martial Arts',
        'Learn and Play',
        'Dance',
        'Music',
        'Visual Arts'
      ];

      for (const activity of activities) {
        try {
          // Try different selectors for activity checkboxes
          const activityCheckbox = await page.$(
            `input[type="checkbox"][value="${activity}"], ` +
            `label:contains("${activity}") input[type="checkbox"], ` +
            `span:contains("${activity}") input[type="checkbox"]`
          );
          
          if (activityCheckbox) {
            const isChecked = await activityCheckbox.evaluate(el => el.checked);
            if (!isChecked) {
              await activityCheckbox.click();
              console.log(`  Selected activity: ${activity}`);
              await page.waitForTimeout(200);
            }
          }
        } catch (e) {
          console.log(`  Could not select ${activity}`);
        }
      }

      // Step 3: Select locations
      console.log('Step 3: Selecting locations...');
      
      // Click to go to step 3
      const step3Button = await page.$('button:contains("Next"), a:contains("Next"), div.step-3');
      if (step3Button) {
        await step3Button.click();
        await page.waitForTimeout(2000);
      }

      // Select all locations
      const selectAllLocations = await page.$('input[type="checkbox"][value="Select all locations available"]');
      if (selectAllLocations) {
        await selectAllLocations.click();
        console.log('  Selected all locations');
        await page.waitForTimeout(500);
      }

      // Click Show Results button
      console.log('Clicking Show Results...');
      
      // Try different selectors for the submit button
      const submitSelectors = [
        'button:contains("Show Results")',
        'input[type="submit"][value="Show Results"]',
        'a:contains("Show Results")',
        '.show-results-button',
        'button.submit'
      ];

      let clicked = false;
      for (const selector of submitSelectors) {
        try {
          const submitButton = await page.$(selector);
          if (submitButton) {
            await submitButton.click();
            clicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!clicked) {
        // Try clicking by text
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
          const showResultsButton = buttons.find(btn => 
            btn.textContent.toLowerCase().includes('show results') ||
            btn.value?.toLowerCase().includes('show results')
          );
          if (showResultsButton) showResultsButton.click();
        });
      }

      // Wait for results to load
      console.log('Waiting for results to load...');
      await page.waitForTimeout(5000);

      // Now extract the programs from the results page
      console.log('Extracting program data...');
      
      // Wait for results to appear
      try {
        await page.waitForSelector('.program-item, .course-item, .pm-program, .results-item', { 
          timeout: 10000 
        });
      } catch (e) {
        console.log('No results selector found, checking page content...');
      }

      // Extract programs
      const programs = await page.evaluate(() => {
        const camps = [];
        
        // Function to extract text safely
        const getText = (element, selector) => {
          const el = element.querySelector(selector);
          return el ? el.textContent.trim() : '';
        };

        // Try to find programs with various selectors
        const programElements = document.querySelectorAll(
          '.program-item, .course-item, .activity-item, [data-program-id], .pm-program'
        );

        programElements.forEach((element) => {
          const camp = {
            id: element.getAttribute('data-program-id') || 
                element.getAttribute('data-course-id') || 
                Date.now().toString() + Math.random(),
            name: getText(element, '.program-name, .course-name, h3, h4, .title'),
            provider: 'NVRC',
            description: getText(element, '.description, .program-description, p'),
            location: {
              name: getText(element, '.location, .facility, .venue'),
              address: getText(element, '.address')
            },
            cost: 0,
            scrapedAt: new Date().toISOString()
          };

          // Extract cost
          const costText = element.textContent;
          const costMatch = costText.match(/\$(\d+(?:\.\d{2})?)/);
          if (costMatch) {
            camp.cost = parseFloat(costMatch[1]);
          }

          // Extract dates
          const dateText = getText(element, '.dates, .schedule, .when');
          const dateMatch = dateText.match(/(\w+\s+\d+)\s*-\s*(\w+\s+\d+)/);
          if (dateMatch) {
            camp.dateRange = {
              start: new Date(dateMatch[1] + ', 2024').toISOString(),
              end: new Date(dateMatch[2] + ', 2024').toISOString()
            };
          } else {
            camp.dateRange = {
              start: new Date().toISOString(),
              end: new Date().toISOString()
            };
          }

          // Extract age range
          const ageMatch = element.textContent.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)/i);
          if (ageMatch) {
            camp.ageRange = {
              min: parseInt(ageMatch[1]),
              max: parseInt(ageMatch[2])
            };
          } else {
            camp.ageRange = { min: 4, max: 18 };
          }

          // Extract schedule
          camp.schedule = {
            days: [],
            startTime: '',
            endTime: ''
          };

          const timeMatch = element.textContent.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
          if (timeMatch) {
            camp.schedule.startTime = timeMatch[1];
            camp.schedule.endTime = timeMatch[2];
          }

          // Extract activity types
          camp.activityType = [];
          const text = element.textContent.toLowerCase();
          if (text.includes('camp')) camp.activityType.push('camps');
          if (text.includes('swim')) camp.activityType.push('swimming');
          if (text.includes('art')) camp.activityType.push('visual_arts');
          if (text.includes('dance')) camp.activityType.push('dance');
          if (text.includes('sport')) camp.activityType.push('sports');
          
          if (camp.activityType.length === 0) {
            camp.activityType = ['camps'];
          }

          // Only add if we have a name
          if (camp.name) {
            camps.push(camp);
          }
        });

        return camps;
      });

      console.log(`Scraped ${programs.length} programs with Puppeteer`);
      return programs;

    } catch (error) {
      console.error('Puppeteer scraping error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = PuppeteerScraper;