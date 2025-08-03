const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCHierarchicalScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Hierarchical Scraper...');
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

      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 1: Select age groups
      console.log('\n📋 STEP 1: Selecting age groups...');
      
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
      console.log('\n⏳ Waiting 20 seconds for Step 2 to load...');
      await new Promise(resolve => setTimeout(resolve, 20000));

      // STEP 2: Select all programs
      console.log('\n🎯 STEP 2: Selecting all program activities...');
      
      const programsSelected = await page.evaluate(() => {
        let count = 0;
        const programs = [];
        
        // Program activities we want to select
        const programNames = [
          'Spin', 'Strength & Cardio', 'Yoga',
          'Aquatic Leadership', 'Camps', 'Certifications and Leadership',
          'Learn and Play', 'Martial Arts', 'Swimming',
          'Racquet Sports', 'Team Sports', 'Dance', 'Visual Arts'
        ];
        
        // Find and click each program checkbox
        programNames.forEach(programName => {
          const labels = document.querySelectorAll('label');
          for (const label of labels) {
            if (label.textContent.trim() === programName) {
              const checkbox = label.querySelector('input[type="checkbox"]') || 
                             document.getElementById(label.getAttribute('for'));
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                programs.push(programName);
                count++;
              }
              break;
            }
          }
        });
        
        return { count, programs };
      });
      
      console.log(`  ✅ Selected ${programsSelected.count} programs`);
      console.log(`  Programs: ${programsSelected.programs.join(', ')}`);
      
      // Wait for Step 3 to load
      console.log('\n⏳ Waiting 20 seconds for Step 3 to load...');
      await new Promise(resolve => setTimeout(resolve, 20000));

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
      
      console.log(`  ✅ Selected all locations: ${locationSelected}`);

      // Submit the form
      console.log('\n🔍 Clicking "Show Results" button...');
      
      const submitted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResults = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.includes('Show Results');
        });
        if (showResults) {
          showResults.click();
          return true;
        }
        return false;
      });

      if (!submitted) {
        throw new Error('Could not find Show Results button');
      }

      // Wait for results
      console.log('\n⏳ Waiting for results page...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check current URL and page state
      const currentUrl = page.url();
      console.log('\n📍 Current URL:', currentUrl);

      // Take screenshot
      await page.screenshot({ path: 'hierarchical-results.png', fullPage: true });
      console.log('📸 Results page screenshot saved');

      // Now extract activities from the hierarchical structure
      console.log('\n📊 Extracting activities from hierarchical structure...');
      
      const activities = await this.extractHierarchicalActivities(page);
      
      console.log(`\n✅ Successfully extracted ${activities.length} activities`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_hierarchical_${timestamp}.json`;
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

  async extractHierarchicalActivities(page) {
    const activities = [];
    
    try {
      // First, check if we have the blue activity bars
      const activityBars = await page.evaluate(() => {
        // Look for elements that are styled as blue bars with counts
        const bars = [];
        const links = document.querySelectorAll('a');
        
        links.forEach(link => {
          const style = window.getComputedStyle(link);
          const text = link.textContent.trim();
          
          // Check if this looks like an activity bar (has background color and number)
          if (style.backgroundColor === 'rgb(0, 123, 193)' || // Blue color
              (text.match(/\d+$/) && style.display === 'block')) {
            bars.push({
              text: text,
              hasNumber: !!text.match(/\d+$/),
              backgroundColor: style.backgroundColor,
              element: link.outerHTML.substring(0, 200)
            });
          }
        });
        
        return bars;
      });
      
      console.log(`\n📊 Found ${activityBars.length} activity bars`);
      activityBars.forEach(bar => {
        console.log(`  - ${bar.text}`);
      });
      
      // Process each activity bar
      for (let i = 0; i < activityBars.length; i++) {
        const bar = activityBars[i];
        const categoryName = bar.text.replace(/\s*\d+$/, ''); // Remove count
        const count = parseInt(bar.text.match(/(\d+)$/)?.[1] || '0');
        
        console.log(`\n📂 Expanding category ${i + 1}/${activityBars.length}: ${bar.text}`);
        
        // Click the + button or the bar itself to expand
        const expanded = await page.evaluate((barText) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === barText) {
              // Look for + button next to it
              const plusBtn = link.parentElement.querySelector('[class*="expand"], [class*="plus"], .fa-plus');
              if (plusBtn) {
                plusBtn.click();
                return 'plus';
              } else {
                // Click the bar itself
                link.click();
                return 'bar';
              }
            }
          }
          return false;
        }, bar.text);
        
        if (!expanded) {
          console.log(`  ⚠️ Could not expand ${bar.text}`);
          continue;
        }
        
        console.log(`  ✓ Clicked ${expanded} for ${bar.text}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now look for sub-activities
        const subActivities = await page.evaluate((categoryName) => {
          const subs = [];
          
          // Look for expanded content
          const links = document.querySelectorAll('a');
          links.forEach(link => {
            const text = link.textContent.trim();
            const style = window.getComputedStyle(link);
            
            // Sub-activities typically don't have the blue background
            // and don't end with numbers
            if (text && 
                style.backgroundColor !== 'rgb(0, 123, 193)' &&
                !text.match(/\d+$/) &&
                text.length > 3) {
              
              // Check if it's likely a sub-activity
              const parent = link.parentElement;
              const isIndented = style.paddingLeft !== '0px' || 
                               parent.style.paddingLeft !== '0px';
              
              if (isIndented || parent.classList.contains('sub') || 
                  parent.classList.contains('child')) {
                subs.push({
                  name: text,
                  category: categoryName
                });
              }
            }
          });
          
          return subs;
        }, categoryName);
        
        console.log(`  Found ${subActivities.length} sub-activities`);
        
        // For each sub-activity, click to expand and get actual activities
        for (let j = 0; j < subActivities.length; j++) {
          const subActivity = subActivities[j];
          console.log(`    📄 Expanding sub-activity ${j + 1}/${subActivities.length}: ${subActivity.name}`);
          
          // Click the sub-activity
          const subExpanded = await page.evaluate((subName) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.trim() === subName) {
                // Look for + button
                const plusBtn = link.parentElement.querySelector('[class*="expand"], [class*="plus"], .fa-plus');
                if (plusBtn) {
                  plusBtn.click();
                  return 'plus';
                } else {
                  link.click();
                  return 'link';
                }
              }
            }
            return false;
          }, subActivity.name);
          
          if (!subExpanded) {
            console.log(`      ⚠️ Could not expand ${subActivity.name}`);
            continue;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Extract actual activities
          const extractedActivities = await page.evaluate((cat, subCat) => {
            const activities = [];
            
            // Look for activity rows (usually in tables or lists)
            const rows = document.querySelectorAll('tr, .activity-row, .program-item');
            
            rows.forEach(row => {
              const text = row.textContent;
              
              // Activities typically have cost information
              if (text.includes('$')) {
                const cells = row.querySelectorAll('td');
                
                if (cells.length >= 3) {
                  activities.push({
                    category: cat,
                    subcategory: subCat,
                    name: cells[0]?.textContent.trim() || subCat,
                    schedule: cells[1]?.textContent.trim() || '',
                    cost: cells[2]?.textContent.trim() || '',
                    location: cells[3]?.textContent.trim() || '',
                    spots: cells[4]?.textContent.trim() || '',
                    barcode: cells[5]?.textContent.trim() || ''
                  });
                } else {
                  // Try to parse from text
                  const costMatch = text.match(/\$[\d,]+\.?\d*/);
                  if (costMatch) {
                    activities.push({
                      category: cat,
                      subcategory: subCat,
                      name: text.split('$')[0].trim(),
                      cost: costMatch[0],
                      fullText: text
                    });
                  }
                }
              }
            });
            
            return activities;
          }, categoryName, subActivity.name);
          
          if (extractedActivities.length > 0) {
            console.log(`      ✓ Found ${extractedActivities.length} activities`);
            activities.push(...extractedActivities);
          }
          
          // Collapse sub-activity
          await page.evaluate((subName) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.trim() === subName) {
                const minusBtn = link.parentElement.querySelector('[class*="collapse"], [class*="minus"], .fa-minus');
                if (minusBtn) {
                  minusBtn.click();
                } else {
                  link.click();
                }
                break;
              }
            }
          }, subActivity.name);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Collapse category
        await page.evaluate((barText) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === barText) {
              const minusBtn = link.parentElement.querySelector('[class*="collapse"], [class*="minus"], .fa-minus');
              if (minusBtn) {
                minusBtn.click();
              } else {
                link.click();
              }
              break;
            }
          }
        }, bar.text);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log(`  Total activities extracted so far: ${activities.length}`);
      }
      
    } catch (error) {
      console.error('Error extracting hierarchical activities:', error);
    }
    
    // Add IDs and metadata
    return activities.map((activity, index) => ({
      id: `nvrc_${index + 1}`,
      ...activity,
      provider: 'NVRC',
      scrapedAt: new Date().toISOString()
    }));
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCHierarchicalScraper();
  scraper.scrape()
    .then(activities => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Total activities: ${activities.length}`);
      
      if (activities.length > 0) {
        console.log('\nSample activities:');
        activities.slice(0, 5).forEach(act => {
          console.log(`  - ${act.name} (${act.category} > ${act.subcategory}) | ${act.cost}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCHierarchicalScraper;