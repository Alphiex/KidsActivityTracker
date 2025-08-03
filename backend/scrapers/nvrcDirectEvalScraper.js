const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCDirectEvalScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Direct JavaScript Evaluation Scraper...');
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Enable console logging from the page
      page.on('console', msg => {
        if (msg.type() === 'log') {
          console.log('PAGE:', msg.text());
        }
      });

      // Navigate and fill form
      console.log('\n📍 Navigating to NVRC...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Quick form fill
      console.log('\n📝 Filling search form...');
      await page.evaluate(() => {
        // Select all checkboxes for a comprehensive search
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          if (!cb.checked) cb.checked = true;
        });
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Submit form
      await page.evaluate(() => {
        const submitBtn = document.querySelector('input[value="Show Results"]');
        if (submitBtn) submitBtn.click();
      });

      // Wait for results page
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get iframe and inject helper functions
      console.log('\n🔧 Injecting helper functions into iframe...');
      
      // Find ActiveCommunities iframe
      const iframeElement = await page.$('iframe[src*="activecommunities"]');
      if (!iframeElement) {
        throw new Error('Could not find ActiveCommunities iframe');
      }

      const frame = await iframeElement.contentFrame();
      
      // Inject jQuery-like functionality and helper functions into iframe
      await frame.evaluate(() => {
        // Helper function to expand all categories
        window.expandAllCategories = function() {
          console.log('Expanding all categories...');
          const links = Array.from(document.querySelectorAll('a'));
          const categoryLinks = links.filter(link => {
            const text = link.textContent;
            return text.match(/\d+$/) && // Ends with number
                   (text.includes('Swimming') || text.includes('Camps') || 
                    text.includes('Dance') || text.includes('Martial Arts') ||
                    text.includes('Fitness') || text.includes('Sports'));
          });
          
          categoryLinks.forEach(link => {
            console.log('Clicking category:', link.textContent);
            link.click();
          });
          
          return categoryLinks.length;
        };
        
        // Helper function to find all subsections
        window.findAllSubsections = function() {
          const subsections = [];
          const links = Array.from(document.querySelectorAll('a'));
          
          links.forEach(link => {
            const text = link.textContent.trim();
            // Look for program names (don't end with numbers)
            if (!text.match(/\d+$/) && 
                (text.includes('Swimmer') || text.includes('Level') ||
                 text.includes('Camp') || text.includes('Program') ||
                 text.includes('Beginner') || text.includes('Advanced')) &&
                text.length > 3) {
              subsections.push({
                text: text,
                element: link
              });
            }
          });
          
          return subsections;
        };
        
        // Helper function to extract all visible activities
        window.extractAllActivities = function() {
          const activities = [];
          
          // Method 1: Look for table rows
          document.querySelectorAll('tr').forEach((row, index) => {
            const text = row.textContent;
            if (text.includes('$') && !text.includes('Price') && !text.includes('Category')) {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 2) {
                activities.push({
                  id: `table_${index}`,
                  type: 'table-row',
                  cellData: Array.from(cells).map(c => c.textContent.trim()),
                  fullText: text
                });
              }
            }
          });
          
          // Method 2: Look for list items with activity info
          document.querySelectorAll('li').forEach((item, index) => {
            const text = item.textContent;
            if (text.includes('$') && text.length > 30) {
              activities.push({
                id: `list_${index}`,
                type: 'list-item',
                text: text
              });
            }
          });
          
          // Method 3: Look for divs with activity patterns
          document.querySelectorAll('div').forEach((div, index) => {
            const text = div.textContent;
            if (text.includes('$') && 
                (text.includes('Register') || text.includes('Add to Cart')) &&
                text.length > 50 && text.length < 500) {
              activities.push({
                id: `div_${index}`,
                type: 'div-block',
                text: text.substring(0, 300)
              });
            }
          });
          
          return activities;
        };
        
        // Log that helpers are ready
        console.log('Helper functions injected successfully');
      });

      // Execute extraction strategy
      console.log('\n📊 Executing extraction strategy...');
      
      // Step 1: Expand all categories
      const categoriesExpanded = await frame.evaluate(() => {
        return window.expandAllCategories();
      });
      console.log(`✓ Expanded ${categoriesExpanded} categories`);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step 2: Find and click subsections
      console.log('\n🔍 Finding subsections...');
      const subsections = await frame.evaluate(() => {
        return window.findAllSubsections();
      });
      console.log(`✓ Found ${subsections.length} subsections`);
      
      // Click each subsection and extract
      const allActivities = [];
      
      for (let i = 0; i < Math.min(subsections.length, 10); i++) {
        const subsection = subsections[i];
        console.log(`\nProcessing subsection ${i + 1}: ${subsection.text}`);
        
        // Click subsection
        await frame.evaluate((subText) => {
          const links = Array.from(document.querySelectorAll('a'));
          const link = links.find(l => l.textContent.trim() === subText);
          if (link) link.click();
        }, subsection.text);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Extract activities
        const activities = await frame.evaluate(() => {
          return window.extractAllActivities();
        });
        
        console.log(`  ✓ Found ${activities.length} activities`);
        
        // Add subsection info to activities
        activities.forEach(activity => {
          activity.subsection = subsection.text;
        });
        
        allActivities.push(...activities);
      }
      
      // Also do a general extraction
      console.log('\n🔍 Performing general extraction...');
      const generalActivities = await frame.evaluate(() => {
        return window.extractAllActivities();
      });
      
      // Merge and deduplicate
      generalActivities.forEach(activity => {
        if (!allActivities.some(a => a.fullText === activity.fullText)) {
          allActivities.push(activity);
        }
      });
      
      console.log(`\n✅ Total unique activities found: ${allActivities.length}`);
      
      // Process and clean activities
      const processedActivities = allActivities.map((activity, index) => {
        let name = 'Unknown Activity';
        let schedule = '';
        let cost = '';
        let location = '';
        
        if (activity.cellData && activity.cellData.length >= 3) {
          name = activity.cellData[0] || name;
          schedule = activity.cellData[1] || '';
          cost = activity.cellData[2] || '';
          location = activity.cellData[3] || '';
        } else if (activity.text || activity.fullText) {
          const text = activity.text || activity.fullText;
          
          // Try to extract cost
          const costMatch = text.match(/\$[\d,]+\.?\d*/);
          if (costMatch) cost = costMatch[0];
          
          // Try to extract name (first substantial text before cost)
          const beforeCost = text.split('$')[0];
          const lines = beforeCost.split(/\n|\r/);
          name = lines.find(line => line.trim().length > 10) || name;
        }
        
        return {
          id: `nvrc_${index}`,
          name: name.trim(),
          schedule: schedule.trim(),
          cost: cost.trim(),
          location: location.trim(),
          subsection: activity.subsection || '',
          type: activity.type,
          provider: 'NVRC',
          scrapedAt: new Date().toISOString()
        };
      });
      
      // Filter out activities without meaningful data
      const validActivities = processedActivities.filter(activity => 
        activity.name !== 'Unknown Activity' && 
        activity.name.length > 3 &&
        activity.cost
      );
      
      console.log(`\n✅ Valid activities after processing: ${validActivities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = {
        timestamp: new Date().toISOString(),
        totalFound: allActivities.length,
        validActivities: validActivities.length,
        activities: validActivities,
        rawActivities: allActivities.slice(0, 10) // Sample of raw data
      };
      
      fs.writeFileSync(`nvrc_direct_eval_${timestamp}.json`, JSON.stringify(results, null, 2));
      
      // Take screenshot
      await page.screenshot({ 
        path: `nvrc_direct_eval_${timestamp}.png`, 
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
  const scraper = new NVRCDirectEvalScraper();
  scraper.scrape()
    .then(results => {
      console.log('\n🎉 Direct evaluation scraping complete!');
      console.log(`Total activities found: ${results.totalFound}`);
      console.log(`Valid activities: ${results.validActivities}`);
      
      if (results.activities.length > 0) {
        console.log('\nSample activities:');
        results.activities.slice(0, 5).forEach(activity => {
          console.log(`  - ${activity.name} | ${activity.cost} | ${activity.schedule}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCDirectEvalScraper;