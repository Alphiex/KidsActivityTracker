const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCFinalScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Final Scraper - Extracting all 700+ activities...');
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
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
      
      // Wait for Step 2 to load
      console.log('\n⏳ Waiting for Step 2 program activities to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // STEP 2: Select all programs
      console.log('\n🎯 STEP 2: Selecting all program activities...');
      
      const programsSelected = await page.evaluate(() => {
        let count = 0;
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        
        for (const checkbox of checkboxes) {
          const label = checkbox.closest('label') || 
                       document.querySelector(`label[for="${checkbox.id}"]`);
          
          if (label) {
            const text = label.textContent || '';
            if (!text.includes('years') && 
                !text.includes('Select all locations') &&
                text.trim() !== '' &&
                !checkbox.checked) {
              const parent = checkbox.closest('.form-item, .form-checkboxes, fieldset');
              if (parent) {
                const parentText = parent.textContent || '';
                if (!parentText.includes('Step 1') && !parentText.includes('Step 3')) {
                  checkbox.click();
                  count++;
                }
              }
            }
          }
        }
        return count;
      });
      
      console.log(`  ✅ Selected ${programsSelected} program activities`);
      
      // Wait for Step 3 to load
      console.log('\n⏳ Waiting for Step 3 locations to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting all locations...');
      
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          const text = label.textContent || '';
          if (text.toLowerCase().includes('select all locations available')) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
            }
          }
        }
      });

      // Submit the form
      console.log('\n🔍 Submitting search form...');
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResults = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.toLowerCase().includes('show results');
        });
        if (showResults) {
          showResults.click();
        }
      });

      // Wait for navigation to results page
      console.log('\n⏳ Waiting for search results page...');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Now find and switch to ActiveCommunities iframe
      console.log('\n🖼️ Looking for ActiveCommunities iframe...');
      
      const frames = page.frames();
      let activeCommunitiesFrame = null;
      
      for (const frame of frames) {
        const url = frame.url();
        if (url.includes('activecommunities.com')) {
          activeCommunitiesFrame = frame;
          console.log('✅ Found ActiveCommunities iframe!');
          break;
        }
      }
      
      if (!activeCommunitiesFrame) {
        throw new Error('Could not find ActiveCommunities iframe');
      }

      // Wait for iframe content to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get course count
      const stats = await activeCommunitiesFrame.evaluate(() => {
        const bodyText = document.body.innerText;
        const courseRowsMatch = bodyText.match(/courseRows:\s*(\d+)/);
        return {
          courseCount: courseRowsMatch ? parseInt(courseRowsMatch[1]) : 0,
          bodyPreview: bodyText.substring(0, 200)
        };
      });
      
      console.log(`\n📊 Found ${stats.courseCount} activities to extract`);

      // Extract all activities by systematically clicking categories and subcategories
      const activities = [];
      
      // Get all category bars
      const categories = await activeCommunitiesFrame.evaluate(() => {
        const cats = [];
        const links = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
        links.forEach(link => {
          const text = link.textContent.trim();
          if (text && text.match(/\d+$/)) {
            cats.push(text);
          }
        });
        return cats;
      });
      
      console.log(`\n📂 Found ${categories.length} categories to process`);

      // Process each category
      for (let catIdx = 0; catIdx < categories.length; catIdx++) {
        const categoryName = categories[catIdx];
        console.log(`\n🔷 Processing category ${catIdx + 1}/${categories.length}: ${categoryName}`);
        
        // Click the category to expand it
        await activeCommunitiesFrame.evaluate((catName) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === catName) {
              link.click();
              break;
            }
          }
        }, categoryName);
        
        // Wait for expansion
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get all subcategories/programs in this category
        const subcategories = await activeCommunitiesFrame.evaluate(() => {
          const subs = [];
          const links = document.querySelectorAll('a');
          
          links.forEach(link => {
            const text = link.textContent.trim();
            // Subcategories don't end with numbers
            if (!text.match(/\d+$/) && text.length > 3) {
              // Skip navigation and category links
              if (!['Category', 'Back', 'Next', 'Previous', 'Home'].includes(text) &&
                  !text.includes('Category:')) {
                subs.push(text);
              }
            }
          });
          
          return [...new Set(subs)]; // Remove duplicates
        });
        
        console.log(`  Found ${subcategories.length} subcategories`);
        
        // Click each subcategory to reveal activities
        for (let subIdx = 0; subIdx < subcategories.length; subIdx++) {
          const subcategoryName = subcategories[subIdx];
          console.log(`    📄 Subcategory ${subIdx + 1}/${subcategories.length}: ${subcategoryName}`);
          
          // Click subcategory
          const clicked = await activeCommunitiesFrame.evaluate((subName) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.trim() === subName) {
                link.click();
                return true;
              }
            }
            return false;
          }, subcategoryName);
          
          if (!clicked) {
            console.log(`      ⚠️ Could not click subcategory`);
            continue;
          }
          
          // Wait for activities to load
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Extract activities from this subcategory
          const subActivities = await activeCommunitiesFrame.evaluate((catName, subName) => {
            const extracted = [];
            
            // Look for activity rows in tables
            const rows = document.querySelectorAll('tr');
            rows.forEach((row, index) => {
              const text = row.textContent;
              // Skip header rows and empty rows
              if (text.includes('$') && !text.includes('Price') && !text.includes('Cost')) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                  const activity = {
                    category: catName,
                    subcategory: subName,
                    cells: Array.from(cells).map(c => c.textContent.trim()),
                    fullText: text.trim()
                  };
                  extracted.push(activity);
                }
              }
            });
            
            return extracted;
          }, categoryName, subcategoryName);
          
          if (subActivities.length > 0) {
            console.log(`      ✓ Extracted ${subActivities.length} activities`);
            activities.push(...subActivities);
          }
          
          // Click subcategory again to collapse it
          await activeCommunitiesFrame.evaluate((subName) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.trim() === subName) {
                link.click();
                break;
              }
            }
          }, subcategoryName);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Collapse the category
        await activeCommunitiesFrame.evaluate((catName) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === catName) {
              link.click();
              break;
            }
          }
        }, categoryName);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log(`  Running total: ${activities.length} activities`);
        
        // Save progress periodically
        if (catIdx % 3 === 0 || catIdx === categories.length - 1) {
          const progressFile = `nvrc_progress_${catIdx + 1}_of_${categories.length}.json`;
          fs.writeFileSync(progressFile, JSON.stringify({
            progress: `${catIdx + 1}/${categories.length}`,
            activitiesCount: activities.length,
            activities: activities
          }, null, 2));
          console.log(`  💾 Progress saved to ${progressFile}`);
        }
      }
      
      // Process and clean the activities
      console.log('\n🔄 Processing extracted activities...');
      
      const processedActivities = activities.map((activity, index) => {
        const cells = activity.cells || [];
        
        return {
          id: `nvrc_${index + 1}`,
          category: activity.category,
          subcategory: activity.subcategory,
          name: cells[0] || 'Unknown Activity',
          schedule: cells[1] || '',
          cost: cells[2] || '',
          location: cells[3] || '',
          spotsAvailable: cells[4] || '',
          instructor: cells[5] || '',
          provider: 'NVRC',
          scrapedAt: new Date().toISOString()
        };
      });
      
      // Filter out invalid activities
      const validActivities = processedActivities.filter(act => 
        act.name !== 'Unknown Activity' && 
        act.name.length > 3 &&
        act.cost
      );
      
      console.log(`\n✅ Successfully extracted ${validActivities.length} valid activities out of ${stats.courseCount} total`);
      
      // Save final results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = {
        timestamp: new Date().toISOString(),
        stats: {
          expectedCount: stats.courseCount,
          extractedCount: activities.length,
          validCount: validActivities.length,
          completeness: `${Math.round((validActivities.length / stats.courseCount) * 100)}%`
        },
        activities: validActivities
      };
      
      const filename = `nvrc_all_activities_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 All activities saved to ${filename}`);
      
      // Take final screenshot
      await page.screenshot({ 
        path: `nvrc_final_${timestamp}.png`, 
        fullPage: true 
      });
      
      return results;
      
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

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCFinalScraper();
  scraper.scrape()
    .then(results => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Expected: ${results.stats.expectedCount} activities`);
      console.log(`Extracted: ${results.stats.extractedCount} activities`);
      console.log(`Valid: ${results.stats.validCount} activities`);
      console.log(`Completeness: ${results.stats.completeness}`);
      
      if (results.activities.length > 0) {
        console.log('\nSample activities:');
        results.activities.slice(0, 5).forEach(act => {
          console.log(`  - ${act.name} (${act.category} > ${act.subcategory}) | ${act.cost}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCFinalScraper;