const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCPuppeteerScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Puppeteer Scraper...');
      browser = await puppeteer.launch({
        headless: false, // Keep visible to see the process
        slowMo: 100, // Slow down for stability
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
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
      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 1: Select all 4 age groups
      console.log('\n📋 STEP 1: Selecting all age groups...');
      
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
      
      // Wait for Step 2 to load after Step 1 selection
      console.log('\n⏳ Waiting for Step 2 program activities to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot after Step 1
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/after-step1.png' });
      console.log('📸 Screenshot after Step 1 saved');

      // STEP 2: Select all programs
      console.log('\n🎯 STEP 2: Selecting all program activities...');
      
      // Find and click all program checkboxes
      const programsSelected = await page.evaluate(() => {
        let count = 0;
        const programs = [];
        
        // Find all checkboxes on the page
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        
        // Filter for program checkboxes (not age or location)
        for (const checkbox of checkboxes) {
          const label = checkbox.closest('label') || 
                       document.querySelector(`label[for="${checkbox.id}"]`);
          
          if (label) {
            const text = label.textContent || '';
            
            // Skip age groups and locations
            if (!text.includes('years') && 
                !text.includes('Select all locations') &&
                text.trim() !== '' &&
                !checkbox.checked) {
              
              // Check if this might be a program activity
              const parent = checkbox.closest('.form-item, .form-checkboxes, fieldset');
              if (parent) {
                const parentText = parent.textContent || '';
                // Look for indicators this is in Step 2
                if (parentText.includes('Choose a program') || 
                    parentText.includes('program activity') ||
                    !parentText.includes('Step 1') && 
                    !parentText.includes('Step 3')) {
                  checkbox.click();
                  programs.push(text.trim());
                  count++;
                }
              }
            }
          }
        }
        
        return { count, programs };
      });
      
      console.log(`  ✅ Selected ${programsSelected.count} program activities`);
      if (programsSelected.programs.length > 0) {
        console.log(`  Programs: ${programsSelected.programs.slice(0, 5).join(', ')}...`);
      }
      
      // Wait for Step 3 to load
      console.log('\n⏳ Waiting for Step 3 locations to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot after Step 2
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/after-step2.png' });
      console.log('📸 Screenshot after Step 2 saved');

      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting "Select all locations available"...');
      
      const locationSelected = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        
        for (const label of labels) {
          const text = label.textContent || '';
          if (text.toLowerCase().includes('select all locations available')) {
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
      
      if (locationSelected) {
        console.log('  ✅ Selected all locations');
      } else {
        console.log('  ⚠️ Could not find "Select all locations available" checkbox');
      }
      
      // Take screenshot before submit
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/before-submit.png' });
      console.log('📸 Screenshot before submit saved');

      // Submit the form
      console.log('\n🔍 Submitting search form...');
      
      // Click the Show Results button
      const submitted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResults = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.toLowerCase().includes('show results');
        });
        
        if (showResults) {
          showResults.click();
          return true;
        }
        return false;
      });
      
      if (!submitted) {
        console.log('  ⚠️ Could not find Show Results button, submitting form directly');
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.submit();
        });
      }

      // Wait for navigation to results page
      console.log('\n⏳ Waiting for search results page...');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot of results
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/search-results-final.png', fullPage: true });
      console.log('📸 Final results screenshot saved');

      // Now extract activities from the results page
      console.log('\n📊 Extracting activities from results page...');
      
      const activities = await this.extractActivitiesFromResults(page);
      
      console.log(`\n✅ Successfully scraped ${activities.length} activities`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_activities_puppeteer_${timestamp}.json`;
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

  async extractActivitiesFromResults(page) {
    const activities = [];
    
    try {
      // Look for activity sections on the results page
      // Based on NVRC structure, activities are grouped in collapsible panels
      
      // Debug page structure
      const pageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          hasActivities: document.body.textContent.includes('activities found'),
          panelCount: document.querySelectorAll('.panel').length,
          accordionCount: document.querySelectorAll('.accordion, [data-toggle="collapse"]').length,
          h3Count: document.querySelectorAll('h3').length,
          linkCount: document.querySelectorAll('a[href*="register"]').length
        };
      });
      
      console.log('Page info:', pageInfo);
      
      // Find all expandable sections (activity categories)
      const sections = await page.$$('.panel-group .panel, .accordion-item, [data-parent="#accordion"]');
      console.log(`Found ${sections.length} activity sections`);
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        try {
          // Get section title
          const sectionTitle = await section.$eval('.panel-heading, .accordion-header, h3', el => el.textContent.trim()).catch(() => 'Unknown Section');
          console.log(`\nProcessing section: ${sectionTitle}`);
          
          // Expand the section
          const expandButton = await section.$('[data-toggle="collapse"], .panel-heading a, button[aria-expanded]');
          if (expandButton) {
            await expandButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Find subsections or activities within this section
          const activityElements = await section.$$('.activity-item, .program-item, .course-item, tr, .list-group-item');
          console.log(`  Found ${activityElements.length} items in ${sectionTitle}`);
          
          for (const activityEl of activityElements) {
            try {
              // Extract activity details
              const activity = await page.evaluate((el) => {
                const getText = (selector) => {
                  const elem = el.querySelector(selector);
                  return elem ? elem.textContent.trim() : '';
                };
                
                // Extract basic info
                const name = getText('.activity-name, .program-name, .title, h4, h5') || 'Unknown Activity';
                const description = getText('.description, .activity-description, p');
                const location = getText('.location, .venue, .facility');
                const dates = getText('.dates, .date-range, .schedule');
                const cost = getText('.cost, .price, .fee');
                const ages = getText('.ages, .age-range');
                const spots = getText('.spots, .availability');
                
                // Find registration link
                const registerLink = el.querySelector('a[href*="register"], .register-button');
                const registrationUrl = registerLink ? registerLink.href : '';
                
                return {
                  name,
                  description,
                  location,
                  dates,
                  cost,
                  ages,
                  spots,
                  registrationUrl
                };
              }, activityEl);
              
              // Only add if we have meaningful data
              if (activity.name && activity.name !== 'Unknown Activity') {
                activities.push({
                  id: `nvrc_${Date.now()}_${activities.length}`,
                  ...activity,
                  provider: 'NVRC',
                  section: sectionTitle,
                  scrapedAt: new Date()
                });
                console.log(`    ✓ ${activity.name}`);
              }
            } catch (err) {
              console.error('    ✗ Error extracting activity:', err.message);
            }
          }
          
          // Collapse the section
          if (expandButton) {
            await expandButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
        } catch (err) {
          console.error(`Error processing section ${i}:`, err.message);
        }
      }
      
    } catch (error) {
      console.error('Error extracting activities:', error);
    }
    
    return activities;
  }
}

module.exports = NVRCPuppeteerScraper;