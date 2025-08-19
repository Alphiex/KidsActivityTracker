const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCCorrectScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Correct Scraper - Using the working search process...');
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

      // STEP 1: Select all 4 age groups (EXACT SAME AS WORKING VERSION)
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

      // STEP 2: Select all programs (EXACT SAME AS WORKING VERSION)
      console.log('\n🎯 STEP 2: Selecting all program activities...');
      
      const programsSelected = await page.evaluate(() => {
        let count = 0;
        const programs = [];
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

      // Wait for Step 3 to load
      console.log('\n⏳ Waiting for Step 3 locations to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

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
      }

      // Submit the form
      console.log('\n🔍 Submitting search form...');
      
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

      // Wait for navigation to results page
      console.log('\n⏳ Waiting for search results page...');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Now extract activities from the ActiveCommunities iframe
      console.log('\n📊 Extracting activities from results page...');
      
      // Find ActiveCommunities iframe
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
        console.log('❌ Could not find ActiveCommunities iframe');
        return { activities: [] };
      }

      // Wait for iframe content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get stats from iframe
      const stats = await activeCommunitiesFrame.evaluate(() => {
        const bodyText = document.body.innerText;
        const courseRowsMatch = bodyText.match(/courseRows:\s*(\d+)/);
        return {
          courseCount: courseRowsMatch ? parseInt(courseRowsMatch[1]) : 0,
          bodyText: bodyText.substring(0, 500)
        };
      });
      
      console.log(`\n📊 Found ${stats.courseCount} activities in iframe`);
      
      // Now properly extract activities
      const activities = await this.extractAllActivities(activeCommunitiesFrame);
      
      console.log(`\n✅ Successfully extracted ${activities.length} activities`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_activities_correct_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        expectedCount: stats.courseCount,
        extractedCount: activities.length,
        activities: activities
      }, null, 2));
      console.log(`💾 Results saved to ${filename}`);
      
      return { activities };
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async extractAllActivities(frame) {
    const activities = [];
    
    // Get all category bars (blue bars)
    const categories = await frame.evaluate(() => {
      const cats = [];
      const categoryBars = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
      categoryBars.forEach(bar => {
        const text = bar.textContent.trim();
        if (text && text.match(/\d+$/)) {
          cats.push({
            name: text,
            text: text.replace(/\s*\d+$/, ''), // Remove count
            count: parseInt(text.match(/(\d+)$/)[1])
          });
        }
      });
      return cats;
    });
    
    console.log(`\nFound ${categories.length} categories to expand:`);
    categories.forEach(cat => console.log(`  - ${cat.name} (${cat.count} items)`));
    
    // Process each category
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      console.log(`\n📂 Expanding category ${i + 1}/${categories.length}: ${category.name}`);
      
      // Click category to expand
      await frame.evaluate((categoryName) => {
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.textContent.trim() === categoryName && 
              link.style.backgroundColor === 'rgb(0, 123, 193)') {
            link.click();
            break;
          }
        }
      }, category.name);
      
      // Wait for expansion
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get all subcategory links (these are the actual programs)
      const subcategories = await frame.evaluate(() => {
        const subs = [];
        const links = document.querySelectorAll('a');
        
        links.forEach(link => {
          const text = link.textContent.trim();
          // Subcategories are links that:
          // - Don't end with numbers (not category counts)
          // - Don't have blue background (not category bars)
          // - Have meaningful text
          // - Are not navigation links
          if (!text.match(/\d+$/) && 
              link.style.backgroundColor !== 'rgb(0, 123, 193)' &&
              text.length > 3 &&
              !['Category', 'Back', 'Home', 'Next', 'Previous'].includes(text) &&
              !text.includes('Category:')) {
            subs.push(text);
          }
        });
        
        return [...new Set(subs)]; // Remove duplicates
      });
      
      console.log(`  Found ${subcategories.length} subcategories/programs`);
      
      // Click each subcategory to see activities
      for (let j = 0; j < subcategories.length; j++) {
        const subcategory = subcategories[j];
        console.log(`    📄 Opening ${subcategory}...`);
        
        // Click subcategory
        const clicked = await frame.evaluate((subName) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === subName && 
                link.style.backgroundColor !== 'rgb(0, 123, 193)') {
              link.click();
              return true;
            }
          }
          return false;
        }, subcategory);
        
        if (!clicked) continue;
        
        // Wait for activities to load
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Extract activities from the table/list
        const subActivities = await frame.evaluate((catName, subName) => {
          const activities = [];
          
          // Look for activity rows (usually in tables)
          const rows = document.querySelectorAll('tr');
          rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            // Activity rows have multiple cells and contain cost information
            if (cells.length >= 3 && row.textContent.includes('$')) {
              const activity = {
                category: catName,
                subcategory: subName,
                name: cells[0]?.textContent.trim() || subName,
                dateTime: cells[1]?.textContent.trim() || '',
                cost: cells[2]?.textContent.trim() || '',
                location: cells[3]?.textContent.trim() || '',
                spots: cells[4]?.textContent.trim() || '',
                instructor: cells[5]?.textContent.trim() || '',
                barcode: cells[6]?.textContent.trim() || ''
              };
              
              // Only add if it has meaningful data
              if (activity.cost && activity.name) {
                activities.push(activity);
              }
            }
          });
          
          return activities;
        }, category.text, subcategory);
        
        if (subActivities.length > 0) {
          console.log(`      ✓ Found ${subActivities.length} activities`);
          activities.push(...subActivities);
        }
        
        // Go back to subcategory list
        await frame.evaluate((subName) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === subName) {
              link.click();
              break;
            }
          }
        }, subcategory);
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Collapse category
      await frame.evaluate((categoryName) => {
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.textContent.trim() === categoryName && 
              link.style.backgroundColor === 'rgb(0, 123, 193)') {
            link.click();
            break;
          }
        }
      }, category.name);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log(`  Total activities so far: ${activities.length}`);
    }
    
    // Add IDs and timestamps
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
  const scraper = new NVRCCorrectScraper();
  scraper.scrape()
    .then(result => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Total activities: ${result.activities.length}`);
      
      if (result.activities.length > 0) {
        console.log('\nSample activities:');
        result.activities.slice(0, 5).forEach(act => {
          console.log(`  - ${act.name} (${act.category} > ${act.subcategory}) | ${act.cost}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCCorrectScraper;