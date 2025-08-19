const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCEnhancedScraper {
  constructor() {
    this.activities = [];
    this.debugInfo = {
      apiCalls: [],
      expansionAttempts: [],
      extractionAttempts: []
    };
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Enhanced Scraper with improved iframe handling...');
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Monitor network activity
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('activecommunities') || url.includes('api')) {
          this.debugInfo.apiCalls.push({
            url: url.substring(0, 150),
            method: request.method(),
            timestamp: new Date().toISOString()
          });
        }
        request.continue();
      });
      
      // Enable console logging
      page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('JQMIGRATE') && !text.includes('Slow network')) {
          console.log('PAGE LOG:', text);
        }
      });

      // Navigate and fill form
      console.log('\n📍 Step 1: Navigate and fill search form...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Fill the form completely
      await this.fillSearchForm(page);
      
      // Submit form
      console.log('\n🔍 Step 2: Submit search...');
      await page.evaluate(() => {
        const submitBtn = document.querySelector('input[value="Show Results"]');
        if (submitBtn) submitBtn.click();
      });

      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Find and handle ActiveCommunities iframe
      console.log('\n🖼️ Step 3: Finding ActiveCommunities iframe...');
      
      const iframeHandle = await this.waitForIframe(page);
      if (!iframeHandle) {
        throw new Error('Could not find ActiveCommunities iframe');
      }

      const frame = await iframeHandle.contentFrame();
      console.log('✅ Got iframe handle');

      // Wait for iframe content to stabilize
      await this.waitForIframeContent(frame);

      // Extract initial statistics
      const stats = await this.getIframeStats(frame);
      console.log('\n📊 Initial iframe statistics:', stats);

      // Expand categories and extract activities
      console.log('\n🔷 Step 4: Expanding categories and extracting activities...');
      
      const categories = await this.findCategories(frame);
      console.log(`Found ${categories.length} categories to expand`);

      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        console.log(`\n📂 Processing category ${i + 1}/${categories.length}: ${category.name}`);
        
        try {
          // Click category to expand
          const expanded = await this.expandCategory(frame, category);
          
          if (expanded) {
            // Wait for content to load
            await this.waitForCategoryContent(frame);
            
            // Extract activities from this category
            const categoryActivities = await this.extractCategoryActivities(frame, category);
            console.log(`  ✓ Extracted ${categoryActivities.length} activities`);
            
            this.activities.push(...categoryActivities);
            
            // Collapse category to keep DOM manageable
            await this.collapseCategory(frame, category);
          }
        } catch (error) {
          console.error(`  ✗ Error processing category: ${error.message}`);
          this.debugInfo.expansionAttempts.push({
            category: category.name,
            error: error.message
          });
        }
      }

      // Alternative extraction if categories didn't work
      if (this.activities.length === 0) {
        console.log('\n🔄 Attempting alternative extraction methods...');
        this.activities = await this.alternativeExtraction(frame);
      }

      // Save results
      console.log(`\n✅ Extraction complete! Found ${this.activities.length} activities`);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = {
        timestamp: new Date().toISOString(),
        activitiesCount: this.activities.length,
        activities: this.activities,
        debugInfo: this.debugInfo
      };
      
      fs.writeFileSync(`nvrc_enhanced_${timestamp}.json`, JSON.stringify(results, null, 2));
      
      // Take final screenshot
      await page.screenshot({ 
        path: `nvrc_enhanced_${timestamp}.png`, 
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

  async fillSearchForm(page) {
    // Select age groups
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
          if (checkbox && !checkbox.checked) checkbox.click();
        }
      }, ageGroup);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Select all activities
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      checkboxes.forEach(cb => {
        const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
        if (label) {
          const text = label.textContent || '';
          if (!text.includes('years') && !text.includes('Select all locations') && 
              text.trim() !== '' && !cb.checked) {
            const parent = cb.closest('.form-item, .form-checkboxes, fieldset');
            if (parent && !parent.textContent.includes('Step 1') && 
                !parent.textContent.includes('Step 3')) {
              cb.click();
            }
          }
        }
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Select all locations
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const selectAllLabel = labels.find(label => 
        label.textContent.toLowerCase().includes('select all locations')
      );
      if (selectAllLabel) {
        const checkbox = selectAllLabel.querySelector('input[type="checkbox"]') || 
                        document.querySelector(`#${selectAllLabel.getAttribute('for')}`);
        if (checkbox && !checkbox.checked) checkbox.click();
      }
    });
  }

  async waitForIframe(page, maxAttempts = 10) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const iframes = await page.$$('iframe');
      
      for (const iframe of iframes) {
        const src = await iframe.evaluate(el => el.src);
        if (src.includes('activecommunities')) {
          return iframe;
        }
      }
      
      console.log(`  Waiting for iframe... attempt ${attempt + 1}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return null;
  }

  async waitForIframeContent(frame) {
    await frame.waitForFunction(
      () => {
        const body = document.body.innerText;
        return body.includes('Swimming') || body.includes('Camps') || 
               body.includes('courseRows') || body.includes('activities');
      },
      { timeout: 30000 }
    );
  }

  async getIframeStats(frame) {
    return await frame.evaluate(() => {
      const bodyText = document.body.innerText;
      const courseRowsMatch = bodyText.match(/courseRows:\s*(\d+)/);
      
      return {
        hasCourseRows: !!courseRowsMatch,
        courseCount: courseRowsMatch ? parseInt(courseRowsMatch[1]) : 0,
        hasCategories: bodyText.includes('Swimming') || bodyText.includes('Camps'),
        linkCount: document.querySelectorAll('a').length,
        categoryBarCount: document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]').length
      };
    });
  }

  async findCategories(frame) {
    return await frame.evaluate(() => {
      const categories = [];
      
      // Primary selector for category bars
      const categoryBars = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
      
      categoryBars.forEach(bar => {
        const text = bar.textContent.trim();
        if (text && text.match(/\d+$/)) { // Has number at end
          categories.push({
            name: text,
            selector: `a:contains("${text}")`,
            element: bar.outerHTML.substring(0, 200)
          });
        }
      });
      
      // Backup: find by known category names
      const knownCategories = ['Swimming', 'Camps', 'Dance', 'Martial Arts', 'Fitness'];
      knownCategories.forEach(catName => {
        const links = Array.from(document.querySelectorAll('a'));
        links.forEach(link => {
          const text = link.textContent.trim();
          if (text.includes(catName) && text.match(/\d+$/) && 
              !categories.some(c => c.name === text)) {
            categories.push({
              name: text,
              selector: `a:contains("${text}")`,
              element: link.outerHTML.substring(0, 200)
            });
          }
        });
      });
      
      return categories;
    });
  }

  async expandCategory(frame, category) {
    try {
      // Try to click using evaluate
      const clicked = await frame.evaluate((categoryName) => {
        const links = Array.from(document.querySelectorAll('a'));
        const categoryLink = links.find(link => 
          link.textContent.trim() === categoryName
        );
        
        if (categoryLink) {
          categoryLink.click();
          return true;
        }
        return false;
      }, category.name);
      
      if (clicked) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error expanding category ${category.name}:`, error.message);
      return false;
    }
  }

  async waitForCategoryContent(frame) {
    try {
      // Wait for new content to appear
      await frame.waitForFunction(
        () => {
          // Check if subsections or activities appeared
          const links = document.querySelectorAll('a');
          const hasSubsections = Array.from(links).some(link => {
            const text = link.textContent;
            return text.includes('Swimmer') || text.includes('Level') || 
                   text.includes('Program') || text.includes('Camp');
          });
          return hasSubsections || document.querySelectorAll('tr').length > 10;
        },
        { timeout: 5000 }
      );
    } catch (e) {
      // Timeout is okay, we'll try to extract anyway
    }
  }

  async extractCategoryActivities(frame, category) {
    const activities = [];
    
    try {
      // Look for subsections first
      const subsections = await frame.evaluate(() => {
        const subs = [];
        const links = Array.from(document.querySelectorAll('a'));
        
        links.forEach(link => {
          const text = link.textContent.trim();
          // Look for activity-like names
          if ((text.includes('Swimmer') || text.includes('Level') || 
               text.includes('Program') || text.includes('Camp')) &&
              !text.match(/\d+$/) && // Doesn't end with count
              text.length > 3) {
            subs.push({
              name: text,
              element: link.outerHTML
            });
          }
        });
        
        return subs;
      });
      
      console.log(`  Found ${subsections.length} subsections`);
      
      // Click each subsection
      for (const subsection of subsections) {
        try {
          const subClicked = await frame.evaluate((subName) => {
            const links = Array.from(document.querySelectorAll('a'));
            const subLink = links.find(link => 
              link.textContent.trim() === subName
            );
            if (subLink) {
              subLink.click();
              return true;
            }
            return false;
          }, subsection.name);
          
          if (subClicked) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Extract activities from expanded subsection
            const subActivities = await frame.evaluate((catName, subName) => {
              const activities = [];
              
              // Look for activity rows
              const rows = document.querySelectorAll('tr');
              rows.forEach(row => {
                const text = row.textContent;
                if (text.includes('$') && !text.includes('Category')) {
                  const cells = row.querySelectorAll('td');
                  if (cells.length >= 3) {
                    activities.push({
                      category: catName,
                      subcategory: subName,
                      name: cells[0]?.textContent.trim() || 'Unknown',
                      schedule: cells[1]?.textContent.trim() || '',
                      cost: cells[2]?.textContent.trim() || '',
                      rawText: text.substring(0, 200)
                    });
                  }
                }
              });
              
              return activities;
            }, category.name, subsection.name);
            
            activities.push(...subActivities);
          }
        } catch (e) {
          console.error(`    Error with subsection ${subsection.name}:`, e.message);
        }
      }
      
    } catch (error) {
      console.error(`  Error extracting from category:`, error.message);
    }
    
    return activities;
  }

  async collapseCategory(frame, category) {
    try {
      await frame.evaluate((categoryName) => {
        const links = Array.from(document.querySelectorAll('a'));
        const categoryLink = links.find(link => 
          link.textContent.trim() === categoryName
        );
        if (categoryLink) {
          categoryLink.click();
        }
      }, category.name);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      // Ignore collapse errors
    }
  }

  async alternativeExtraction(frame) {
    console.log('  Trying direct table extraction...');
    
    return await frame.evaluate(() => {
      const activities = [];
      
      // Look for any table rows with activity data
      const rows = document.querySelectorAll('tr');
      rows.forEach((row, index) => {
        const text = row.textContent;
        if (text.includes('$') && !text.includes('Category') && 
            !text.includes('Price') && !text.includes('Cost')) {
          const cells = row.querySelectorAll('td');
          
          activities.push({
            id: `nvrc_alt_${index}`,
            rowText: text.substring(0, 300),
            cellCount: cells.length,
            possibleName: cells[0]?.textContent.trim() || '',
            possibleCost: Array.from(cells).find(c => c.textContent.includes('$'))?.textContent || ''
          });
        }
      });
      
      // Also look for list items
      const listItems = document.querySelectorAll('li');
      listItems.forEach((item, index) => {
        const text = item.textContent;
        if (text.includes('$') && text.length > 20) {
          activities.push({
            id: `nvrc_list_${index}`,
            itemText: text.substring(0, 300),
            type: 'list-item'
          });
        }
      });
      
      return activities;
    });
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCEnhancedScraper();
  scraper.scrape()
    .then(results => {
      console.log('\n🎉 Enhanced scraping complete!');
      console.log(`Activities found: ${results.activitiesCount}`);
      console.log(`API calls captured: ${results.debugInfo.apiCalls.length}`);
      
      if (results.activities.length > 0) {
        console.log('\nSample activities:');
        results.activities.slice(0, 3).forEach(activity => {
          console.log(`  - ${activity.name || activity.possibleName || 'Unknown'}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCEnhancedScraper;