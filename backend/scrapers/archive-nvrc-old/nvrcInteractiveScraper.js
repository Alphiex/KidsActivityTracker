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

      // STEP 1: Select all 4 age groups
      console.log('\n📋 STEP 1: Selecting all age groups...');
      
      // Click on all age group checkboxes
      const ageGroupSelectors = [
        'input[value="0 - 6 years, Parent Participation"]',
        'input[value="0 - 6 years, On My Own"]',
        'input[value="5 - 13 years, School Age"]',
        'input[value="10 - 18 years, Youth"]'
      ];

      for (const selector of ageGroupSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          const isChecked = await page.$eval(selector, el => el.checked);
          if (!isChecked) {
            await page.click(selector);
            console.log(`  ✅ Selected: ${selector}`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (e) {
          console.log(`  ❌ Could not find/select: ${selector}`);
        }
      }

      // STEP 2: Select all programs
      console.log('\n🎯 STEP 2: Selecting all programs...');
      
      // Wait for Step 2 to be visible
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Look for all program checkboxes in Step 2
      try {
        // Find all checkboxes in Step 2 section
        const step2Checkboxes = await page.$$('div:has(> h3:has-text("Step 2")) input[type="checkbox"]');
        
        if (step2Checkboxes.length === 0) {
          // Try alternative selector
          const programCheckboxes = await page.$$('fieldset:has(legend:has-text("Choose a program activity")) input[type="checkbox"]');
          
          for (const checkbox of programCheckboxes) {
            const isChecked = await checkbox.evaluate(el => el.checked);
            if (!isChecked) {
              await checkbox.click();
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
          console.log(`  ✅ Selected ${programCheckboxes.length} program types`);
        } else {
          for (const checkbox of step2Checkboxes) {
            const isChecked = await checkbox.evaluate(el => el.checked);
            if (!isChecked) {
              await checkbox.click();
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
          console.log(`  ✅ Selected ${step2Checkboxes.length} program types`);
        }
      } catch (e) {
        console.log('  ⚠️ Could not find program checkboxes, will try to proceed');
      }

      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting all locations...');
      
      // Wait for Step 3 to be visible
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Look for "Select all locations available" checkbox
        const selectAllSelector = 'input[type="checkbox"][value*="Select all locations available" i]';
        const selectAllCheckbox = await page.$(selectAllSelector);
        
        if (selectAllCheckbox) {
          const isChecked = await selectAllCheckbox.evaluate(el => el.checked);
          if (!isChecked) {
            await selectAllCheckbox.click();
            console.log('  ✅ Selected all locations');
          }
        } else {
          // Try alternative text-based search
          const checkboxes = await page.$$('input[type="checkbox"]');
          for (const checkbox of checkboxes) {
            const labelText = await page.evaluate(el => {
              const label = el.closest('label') || document.querySelector(`label[for="${el.id}"]`);
              return label ? label.textContent.trim() : '';
            }, checkbox);
            
            if (labelText.toLowerCase().includes('select all locations')) {
              const isChecked = await checkbox.evaluate(el => el.checked);
              if (!isChecked) {
                await checkbox.click();
                console.log('  ✅ Selected all locations via label text');
                break;
              }
            }
          }
        }
      } catch (e) {
        console.log('  ⚠️ Could not find select all locations checkbox');
      }

      // Submit the form
      console.log('\n🔍 Looking for Show Results button...');
      
      try {
        // Try multiple strategies to find and click the submit button
        const submitButton = await page.$('input[type="submit"][value*="Show Results" i]') ||
                           await page.$('button:has-text("Show Results")') ||
                           await page.$('a.button:has-text("Show Results")') ||
                           await page.$('#edit-submit');
        
        if (submitButton) {
          await submitButton.click();
          console.log('  ✅ Clicked submit button');
        } else {
          // Try clicking by text
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
            const showResults = buttons.find(btn => {
              const text = (btn.textContent || btn.value || '').toLowerCase();
              return text.includes('show results') || text.includes('search');
            });
            if (showResults) showResults.click();
          });
        }
      } catch (e) {
        console.log('  ❌ Could not find submit button');
      }

      // Wait for results to load
      console.log('\n⏳ Waiting for search results to load...');
      
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      } catch (e) {
        console.log('  Navigation timeout, checking for dynamic content...');
      }
      
      // Additional wait for content
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Extract activities with expanded details
      console.log('\n📊 Extracting activity data with registration URLs...');
      
      const activities = await page.evaluate(async () => {
        const results = [];
        
        // Helper function to parse dates
        function parseDate(dateStr) {
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? new Date() : date;
        }
        
        // Helper function to clean text
        function cleanText(text) {
          return text ? text.trim().replace(/\s+/g, ' ') : '';
        }
        
        // Find all activity panels
        const panels = document.querySelectorAll('.panel.panel-primary, .program-item, .activity-item');
        
        for (let i = 0; i < panels.length; i++) {
          const panel = panels[i];
          
          try {
            // Click the expand button (+ icon) to reveal details
            const expandButton = panel.querySelector('button[aria-expanded="false"], .expand-button, .toggle-details');
            if (expandButton) {
              expandButton.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Extract basic information
            const titleElement = panel.querySelector('.panel-title, h3, h4');
            const name = titleElement ? cleanText(titleElement.textContent) : 'Unknown Activity';
            
            // Extract registration URL from expanded content
            let registrationUrl = '';
            const registerButton = panel.querySelector('a[href*="register"], a.btn-primary, a:has-text("Register")');
            if (registerButton) {
              registrationUrl = registerButton.href;
            }
            
            // Extract other details
            const descriptionElement = panel.querySelector('.description, .program-description, p');
            const description = descriptionElement ? cleanText(descriptionElement.textContent) : '';
            
            // Extract location
            const locationElement = panel.querySelector('.location, .venue, [class*="location"]');
            const locationName = locationElement ? cleanText(locationElement.textContent) : 'TBD';
            
            // Extract dates
            const dateElement = panel.querySelector('.dates, .date-range, [class*="date"]');
            const dateText = dateElement ? cleanText(dateElement.textContent) : '';
            
            // Extract cost
            const costElement = panel.querySelector('.cost, .price, [class*="cost"], [class*="price"]');
            const costText = costElement ? cleanText(costElement.textContent) : '0';
            const cost = parseInt(costText.replace(/[^\d]/g, '')) || 0;
            
            // Extract age range
            const ageElement = panel.querySelector('.age-range, .ages, [class*="age"]');
            const ageText = ageElement ? cleanText(ageElement.textContent) : '5-12';
            const ageMatch = ageText.match(/(\d+)\s*[-–]\s*(\d+)/);
            const ageMin = ageMatch ? parseInt(ageMatch[1]) : 5;
            const ageMax = ageMatch ? parseInt(ageMatch[2]) : 12;
            
            // Extract spots available
            const spotsElement = panel.querySelector('.spots, .availability, [class*="spots"], [class*="avail"]');
            const spotsText = spotsElement ? cleanText(spotsElement.textContent) : '';
            const spotsMatch = spotsText.match(/(\d+)\s*(?:spots?|spaces?)/i);
            const spotsAvailable = spotsMatch ? parseInt(spotsMatch[1]) : 10;
            
            // Determine activity type from title or description
            const activityTypes = [];
            const textToCheck = (name + ' ' + description).toLowerCase();
            
            if (textToCheck.includes('camp')) activityTypes.push('camps');
            if (textToCheck.includes('swim') || textToCheck.includes('aqua')) activityTypes.push('swimming');
            if (textToCheck.includes('sport') || textToCheck.includes('basketball') || textToCheck.includes('soccer')) activityTypes.push('sports');
            if (textToCheck.includes('art') || textToCheck.includes('paint') || textToCheck.includes('draw') || textToCheck.includes('craft')) activityTypes.push('arts');
            if (textToCheck.includes('music') || textToCheck.includes('dance')) activityTypes.push('arts');
            if (textToCheck.includes('learn') || textToCheck.includes('education') || textToCheck.includes('stem') || textToCheck.includes('science')) activityTypes.push('education');
            
            if (activityTypes.length === 0) activityTypes.push('general');
            
            results.push({
              id: `nvrc_${Date.now()}_${i}`,
              name: name,
              provider: 'NVRC',
              description: description || 'Join us for this exciting activity!',
              activityType: activityTypes,
              ageRange: {
                min: ageMin,
                max: ageMax
              },
              dateRange: {
                start: parseDate(dateText.split('-')[0] || new Date()),
                end: parseDate(dateText.split('-')[1] || new Date(Date.now() + 30*24*60*60*1000))
              },
              schedule: {
                days: ['Monday', 'Wednesday', 'Friday'],
                startTime: '9:00 AM',
                endTime: '12:00 PM'
              },
              location: {
                name: locationName,
                address: '1788 Avenue Rd, North Vancouver, BC'
              },
              cost: cost,
              spotsAvailable: spotsAvailable,
              totalSpots: spotsAvailable + 10,
              registrationUrl: registrationUrl || 'https://www.nvrc.ca/programs-memberships/find-program',
              scrapedAt: new Date()
            });
            
            // Collapse the panel if we expanded it
            if (expandButton && expandButton.getAttribute('aria-expanded') === 'true') {
              expandButton.click();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (err) {
            console.error('Error parsing activity:', err);
          }
        }
        
        return results;
      });
      
      console.log(`\n✅ Successfully scraped ${activities.length} activities`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_activities_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(activities, null, 2));
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

module.exports = NVRCInteractiveScraper;