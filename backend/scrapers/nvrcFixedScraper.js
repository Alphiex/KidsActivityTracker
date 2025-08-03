const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCFixedScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Fixed Scraper with proper 3-step process...');
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 200, // Slower to ensure form updates properly
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

      // Wait for form to be ready
      console.log('⏳ Waiting for form to be ready...');
      await page.waitForSelector('form#perfectmind-search-block-form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Debug: Check form structure
      const formInfo = await page.evaluate(() => {
        const form = document.querySelector('form#perfectmind-search-block-form');
        const fieldsets = form ? form.querySelectorAll('fieldset').length : 0;
        const checkboxes = form ? form.querySelectorAll('input[type="checkbox"]').length : 0;
        return { hasForm: !!form, fieldsets, checkboxes };
      });
      console.log('Form info:', formInfo);

      // STEP 1: Select age groups using more specific selectors
      console.log('\n📋 STEP 1: Selecting age groups for kids (0-18 years)...');
      
      // Use the specific checkbox IDs if available
      const ageCheckboxes = [
        { id: 'edit-programs-early-years-parent-participation', name: '0-6 years, Parent Participation' },
        { id: 'edit-programs-early-years-on-my-own', name: '0-6 years, On My Own' },
        { id: 'edit-programs-school-age', name: '5-13 years, School Age' },
        { id: 'edit-programs-youth', name: '10-18 years, Youth' }
      ];
      
      let ageCount = 0;
      for (const ageCheckbox of ageCheckboxes) {
        try {
          // Try ID selector first
          const clicked = await page.evaluate((checkboxId) => {
            const checkbox = document.querySelector(`#${checkboxId}`);
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              return true;
            }
            return false;
          }, ageCheckbox.id);
          
          if (clicked) {
            console.log(`  ✓ Selected: ${ageCheckbox.name}`);
            ageCount++;
          } else {
            // Fallback to text-based selection
            const textClicked = await page.evaluate((text) => {
              const labels = Array.from(document.querySelectorAll('label'));
              const label = labels.find(l => l.textContent.includes(text));
              if (label) {
                const checkbox = label.querySelector('input[type="checkbox"]') || 
                               document.getElementById(label.getAttribute('for'));
                if (checkbox && !checkbox.checked) {
                  checkbox.click();
                  return true;
                }
              }
              return false;
            }, ageCheckbox.name);
            
            if (textClicked) {
              console.log(`  ✓ Selected: ${ageCheckbox.name} (via label)`);
              ageCount++;
            }
          }
        } catch (e) {
          console.log(`  ⚠️ Could not select: ${ageCheckbox.name}`);
        }
      }
      
      console.log(`  Selected ${ageCount} age groups`);
      
      // Wait for Step 2 to appear/update
      console.log('\n⏳ Waiting for Step 2 (program activities) to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot after Step 1
      await page.screenshot({ path: 'nvrc-after-step1.png' });
      console.log('📸 Screenshot after Step 1 saved');

      // STEP 2: Select all program activities
      console.log('\n🎯 STEP 2: Selecting all program activities...');
      
      // First, try to find and click "Select all" for activities if it exists
      const selectAllActivities = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const selectAll = labels.find(label => 
          label.textContent.includes('Select all') && 
          !label.textContent.includes('locations')
        );
        if (selectAll) {
          const checkbox = selectAll.querySelector('input[type="checkbox"]') || 
                          document.querySelector(`#${selectAll.getAttribute('for')}`);
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return true;
          }
        }
        return false;
      });
      
      if (selectAllActivities) {
        console.log('  ✓ Clicked "Select all" for activities');
      } else {
        // Manually select activity checkboxes
        const activitiesSelected = await page.evaluate(() => {
          let count = 0;
          const selectedPrograms = [];
          
          // Get all fieldsets
          const fieldsets = document.querySelectorAll('fieldset');
          
          // Find the activities fieldset (usually the second one)
          let activitiesFieldset = null;
          fieldsets.forEach(fieldset => {
            const legend = fieldset.querySelector('legend');
            if (legend && (legend.textContent.includes('Choose a program') || 
                          legend.textContent.includes('Step 2'))) {
              activitiesFieldset = fieldset;
            }
          });
          
          if (activitiesFieldset) {
            // Select all checkboxes within the activities fieldset
            const checkboxes = activitiesFieldset.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
              if (!checkbox.checked) {
                checkbox.click();
                count++;
                const label = checkbox.closest('label') || 
                             document.querySelector(`label[for="${checkbox.id}"]`);
                if (label) {
                  selectedPrograms.push(label.textContent.trim());
                }
              }
            });
          } else {
            // Fallback: select all checkboxes that look like activities
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
              const label = checkbox.closest('label') || 
                           document.querySelector(`label[for="${checkbox.id}"]`);
              if (label) {
                const text = label.textContent.trim();
                // Skip age groups and locations
                if (!text.includes('years') && 
                    !text.includes('Select all locations') &&
                    !text.includes('Adult') && // Skip adult programs
                    !text.includes('Senior') && // Skip senior programs
                    text.length > 2 &&
                    !checkbox.checked) {
                  checkbox.click();
                  count++;
                  selectedPrograms.push(text);
                }
              }
            });
          }
          
          return { count, programs: selectedPrograms };
        });
        
        console.log(`  ✓ Selected ${activitiesSelected.count} program activities`);
        if (activitiesSelected.programs.length > 0) {
          console.log(`  First few: ${activitiesSelected.programs.slice(0, 5).join(', ')}...`);
        }
      }
      
      // Wait for Step 3 to load
      console.log('\n⏳ Waiting for Step 3 (locations) to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot after Step 2
      await page.screenshot({ path: 'nvrc-after-step2.png' });
      console.log('📸 Screenshot after Step 2 saved');

      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting all locations...');
      
      const locationSelected = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        
        // Look for "Select all locations available" checkbox
        for (const label of labels) {
          const text = label.textContent.toLowerCase();
          if (text.includes('select all locations')) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              return true;
            }
          }
        }
        
        // Fallback: select all location checkboxes individually
        const fieldsets = document.querySelectorAll('fieldset');
        let locationsFieldset = null;
        
        fieldsets.forEach(fieldset => {
          const legend = fieldset.querySelector('legend');
          if (legend && (legend.textContent.includes('location') || 
                        legend.textContent.includes('Step 3'))) {
            locationsFieldset = fieldset;
          }
        });
        
        if (locationsFieldset) {
          const checkboxes = locationsFieldset.querySelectorAll('input[type="checkbox"]');
          let count = 0;
          checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
              checkbox.click();
              count++;
            }
          });
          return count > 0;
        }
        
        return false;
      });
      
      if (locationSelected) {
        console.log('  ✓ Selected all locations');
      } else {
        console.log('  ⚠️ Could not find location checkboxes');
      }
      
      // Take screenshot before submit
      await page.screenshot({ path: 'nvrc-before-submit.png' });
      console.log('📸 Screenshot before submit saved');

      // Submit the form
      console.log('\n🔍 Submitting search form...');
      
      // Look for the submit button
      const submitted = await page.evaluate(() => {
        // Try multiple selectors for the submit button
        const selectors = [
          'input[type="submit"][value="Show Results"]',
          'input[type="submit"][value*="Show"]',
          'button[type="submit"]',
          'input[type="submit"]',
          '#edit-submit'
        ];
        
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          if (button) {
            button.click();
            return true;
          }
        }
        
        // Last resort: submit the form directly
        const form = document.querySelector('form#perfectmind-search-block-form');
        if (form) {
          form.submit();
          return true;
        }
        
        return false;
      });
      
      if (submitted) {
        console.log('  ✓ Form submitted');
      } else {
        console.log('  ❌ Could not submit form');
        throw new Error('Failed to submit search form');
      }

      // Wait for results
      console.log('\n⏳ Waiting for results page...');
      
      // Wait for either navigation or iframe to appear
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
          page.waitForSelector('iframe[src*="activecommunities"]', { timeout: 30000 })
        ]);
      } catch (e) {
        console.log('  Navigation timeout, checking for iframe...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot of results
      await page.screenshot({ path: 'nvrc-results-page.png', fullPage: true });
      console.log('📸 Results page screenshot saved');

      // Check if we have the ActiveCommunities iframe
      const iframeInfo = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        const info = {
          count: iframes.length,
          sources: []
        };
        
        iframes.forEach(iframe => {
          info.sources.push(iframe.src);
        });
        
        return info;
      });
      
      console.log(`\n🖼️ Found ${iframeInfo.count} iframes:`);
      iframeInfo.sources.forEach((src, i) => {
        console.log(`  ${i + 1}. ${src.substring(0, 80)}...`);
      });
      
      // Find ActiveCommunities iframe
      const frames = page.frames();
      let activeCommunitiesFrame = null;
      
      for (const frame of frames) {
        const url = frame.url();
        if (url.includes('activecommunities.com')) {
          activeCommunitiesFrame = frame;
          console.log('\n✅ Found ActiveCommunities iframe!');
          console.log(`  URL: ${url.substring(0, 100)}...`);
          break;
        }
      }
      
      if (!activeCommunitiesFrame) {
        console.log('\n❌ Could not find ActiveCommunities iframe');
        console.log('Saving page HTML for debugging...');
        const html = await page.content();
        fs.writeFileSync('nvrc-debug-page.html', html);
        throw new Error('ActiveCommunities iframe not found');
      }

      // Wait for iframe content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get stats from iframe
      const stats = await activeCommunitiesFrame.evaluate(() => {
        const bodyText = document.body.innerText;
        const courseRowsMatch = bodyText.match(/courseRows:\s*(\d+)/);
        return {
          courseCount: courseRowsMatch ? parseInt(courseRowsMatch[1]) : 0,
          hasCategories: bodyText.includes('Swimming') || bodyText.includes('Camps'),
          bodyLength: bodyText.length
        };
      });
      
      console.log('\n📊 ActiveCommunities iframe stats:');
      console.log(`  Activities found: ${stats.courseCount}`);
      console.log(`  Has categories: ${stats.hasCategories}`);
      console.log(`  Content length: ${stats.bodyLength} characters`);
      
      if (stats.courseCount === 0) {
        console.log('\n⚠️ No activities found in iframe');
        console.log('Saving iframe content for debugging...');
        const iframeHtml = await activeCommunitiesFrame.content();
        fs.writeFileSync('nvrc-debug-iframe.html', iframeHtml);
      }
      
      return {
        success: stats.courseCount > 0,
        stats: stats,
        message: stats.courseCount > 0 ? 
          `Successfully reached results page with ${stats.courseCount} activities` :
          'Reached results page but no activities found'
      };
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      
      // Save current page state for debugging
      if (browser) {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const page = pages[pages.length - 1];
          await page.screenshot({ path: 'nvrc-error-state.png', fullPage: true });
          const html = await page.content();
          fs.writeFileSync('nvrc-error-page.html', html);
          console.log('💾 Saved error state for debugging');
        }
      }
      
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCFixedScraper();
  scraper.scrape()
    .then(result => {
      console.log('\n🎉 Test complete!');
      console.log(result.message);
      
      if (result.success) {
        console.log('\n✅ The 3-step process is working correctly!');
        console.log('Next step: Run the full extraction scraper to get all activities.');
      } else {
        console.log('\n⚠️ The 3-step process completed but no activities were found.');
        console.log('Check the debug files for more information.');
      }
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error.message);
      console.log('Check the screenshot and HTML files for debugging.');
      process.exit(1);
    });
}

module.exports = NVRCFixedScraper;