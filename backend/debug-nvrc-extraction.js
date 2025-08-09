const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCExtractionDebugger {
  constructor() {
    this.debugInfo = {
      pageStructure: {},
      extractionAttempts: [],
      screenshots: []
    };
  }

  async debug() {
    let browser;
    
    try {
      console.log('🔍 Starting NVRC Extraction Debugger...');
      
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        console.log('PAGE LOG:', msg.text());
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the PerfectMind widget
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });

      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Take initial screenshot
      await page.screenshot({ path: 'debug-1-initial-page.png', fullPage: true });
      console.log('📸 Screenshot saved: debug-1-initial-page.png');

      // Navigate to a specific section for testing (e.g., Early Years)
      console.log('\n🔗 Clicking on Early Years: On My Own...');
      
      const clicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const targetLink = links.find(link => 
          link.textContent?.includes('Early Years: On My Own')
        );
        if (targetLink) {
          targetLink.click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        console.log('❌ Could not find Early Years link');
        return;
      }

      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Take screenshot before expanding
      await page.screenshot({ path: 'debug-2-before-expand.png', fullPage: true });
      console.log('📸 Screenshot saved: debug-2-before-expand.png');

      // Count Show links before expanding
      const showLinksCount = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, span'));
        return links.filter(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'show' || text.includes('Show');
        }).length;
      });

      console.log(`\n📊 Found ${showLinksCount} "Show" links to expand`);

      // Click all Show links to expand content
      if (showLinksCount > 0) {
        console.log('📁 Expanding all activity groups...');
        
        for (let i = 0; i < showLinksCount; i++) {
          const expanded = await page.evaluate((index) => {
            const links = Array.from(document.querySelectorAll('a, button, span'));
            const showLinks = links.filter(el => {
              const text = el.textContent?.trim() || '';
              return text.toLowerCase() === 'show' || text.includes('Show');
            });
            
            if (showLinks[index]) {
              showLinks[index].click();
              return true;
            }
            return false;
          }, i);
          
          if (expanded) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log(`  ✓ Expanded group ${i + 1}/${showLinksCount}`);
          }
        }
      }

      // Wait for all content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot after expanding
      await page.screenshot({ path: 'debug-3-after-expand.png', fullPage: true });
      console.log('📸 Screenshot saved: debug-3-after-expand.png');

      // Analyze page structure in detail
      console.log('\n🔬 Analyzing page structure...');
      
      const pageAnalysis = await page.evaluate(() => {
        const analysis = {
          groupTitles: [],
          groupItems: [],
          unmatchedItems: [],
          structure: {}
        };

        // Find all group titles
        const titleElements = document.querySelectorAll('.bm-group-title-row');
        titleElements.forEach((el, idx) => {
          const text = el.textContent?.trim() || '';
          analysis.groupTitles.push({
            index: idx,
            text: text,
            html: el.outerHTML.substring(0, 200),
            nextSibling: el.nextElementSibling?.className || 'none',
            parent: el.parentElement?.className || 'none'
          });
        });

        // Find all group items
        const itemElements = document.querySelectorAll('.bm-group-item-row');
        itemElements.forEach((el, idx) => {
          const text = el.textContent?.trim() || '';
          
          // Try to find the parent title
          let parentTitle = null;
          let searchEl = el.previousElementSibling;
          let distance = 0;
          
          while (searchEl && distance < 20) {
            if (searchEl.classList.contains('bm-group-title-row')) {
              parentTitle = searchEl.textContent?.trim();
              break;
            }
            searchEl = searchEl.previousElementSibling;
            distance++;
          }

          // Also try parent container approach
          if (!parentTitle) {
            let parentEl = el.parentElement;
            let levels = 0;
            while (parentEl && levels < 5) {
              const titleInParent = parentEl.querySelector('.bm-group-title-row');
              if (titleInParent && titleInParent !== el) {
                const titleText = titleInParent.textContent?.trim();
                // Check if this title comes before our item
                const titlePos = Array.from(parentEl.children).indexOf(titleInParent);
                const itemPos = Array.from(parentEl.children).indexOf(el);
                if (titlePos < itemPos) {
                  parentTitle = titleText;
                  break;
                }
              }
              parentEl = parentEl.parentElement;
              levels++;
            }
          }

          const itemData = {
            index: idx,
            text: text.substring(0, 200),
            hasSignUp: text.includes('Sign Up'),
            hasWaitlist: text.includes('Waitlist'),
            hasClosed: text.includes('Closed'),
            parentTitle: parentTitle,
            searchDistance: distance,
            html: el.outerHTML.substring(0, 200)
          };

          analysis.groupItems.push(itemData);

          if (!parentTitle) {
            analysis.unmatchedItems.push(itemData);
          }
        });

        // Analyze DOM structure
        const containers = document.querySelectorAll('.bm-group-container, .activity-group, [class*="group"]');
        analysis.structure.containers = containers.length;
        analysis.structure.containerClasses = Array.from(containers).map(c => c.className).slice(0, 10);

        // Check for alternative structures
        const tables = document.querySelectorAll('table');
        analysis.structure.tables = tables.length;
        
        const divGroups = document.querySelectorAll('div[class*="activity"], div[class*="program"]');
        analysis.structure.activityDivs = divGroups.length;

        return analysis;
      });

      console.log('\n📊 Page Analysis Results:');
      console.log(`- Group Titles Found: ${pageAnalysis.groupTitles.length}`);
      console.log(`- Group Items Found: ${pageAnalysis.groupItems.length}`);
      console.log(`- Unmatched Items: ${pageAnalysis.unmatchedItems.length}`);
      console.log(`- Container Elements: ${pageAnalysis.structure.containers}`);
      
      console.log('\n📋 Group Titles:');
      pageAnalysis.groupTitles.forEach((title, idx) => {
        console.log(`  ${idx + 1}. "${title.text}"`);
        console.log(`     Next sibling: ${title.nextSibling}`);
      });

      console.log('\n📋 Sample Group Items (first 10):');
      pageAnalysis.groupItems.slice(0, 10).forEach((item, idx) => {
        console.log(`  ${idx + 1}. Parent: "${item.parentTitle || 'NOT FOUND'}" | Sign Up: ${item.hasSignUp}`);
        console.log(`     Text: "${item.text.substring(0, 100)}..."`);
      });

      console.log('\n❌ Unmatched Items:');
      pageAnalysis.unmatchedItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. "${item.text.substring(0, 100)}..." (searched ${item.searchDistance} elements)`);
      });

      // Try alternative extraction method
      console.log('\n🔄 Trying alternative extraction method...');
      
      const alternativeExtraction = await page.evaluate(() => {
        const activities = [];
        
        // Method 1: Look for any container that has both title and items
        const allElements = Array.from(document.querySelectorAll('*'));
        
        allElements.forEach(container => {
          const titles = container.querySelectorAll('.bm-group-title-row');
          const items = container.querySelectorAll('.bm-group-item-row');
          
          if (titles.length === 1 && items.length > 0) {
            // This container has exactly one title and some items
            const title = titles[0].textContent?.trim();
            items.forEach(item => {
              if (item.textContent?.includes('Sign Up') || 
                  item.textContent?.includes('Waitlist') || 
                  item.textContent?.includes('Closed')) {
                activities.push({
                  title: title,
                  itemText: item.textContent?.trim().substring(0, 100),
                  method: 'container-based'
                });
              }
            });
          }
        });

        // Method 2: Sequential parsing
        const titleRows = Array.from(document.querySelectorAll('.bm-group-title-row'));
        
        titleRows.forEach((titleRow, idx) => {
          const title = titleRow.textContent?.trim();
          let nextEl = titleRow.nextElementSibling;
          let itemCount = 0;
          
          // Collect all items until we hit another title or run out of siblings
          while (nextEl && !nextEl.classList.contains('bm-group-title-row')) {
            if (nextEl.classList.contains('bm-group-item-row')) {
              if (nextEl.textContent?.includes('Sign Up') || 
                  nextEl.textContent?.includes('Waitlist') || 
                  nextEl.textContent?.includes('Closed')) {
                activities.push({
                  title: title,
                  itemText: nextEl.textContent?.trim().substring(0, 100),
                  method: 'sequential',
                  titleIndex: idx,
                  itemIndex: itemCount++
                });
              }
            }
            nextEl = nextEl.nextElementSibling;
          }
        });

        return {
          containerBased: activities.filter(a => a.method === 'container-based').length,
          sequentialBased: activities.filter(a => a.method === 'sequential').length,
          uniqueActivities: [...new Set(activities.map(a => a.title))],
          totalActivities: activities.length,
          sampleActivities: activities.slice(0, 10)
        };
      });

      console.log('\n📊 Alternative Extraction Results:');
      console.log(`- Container-based method found: ${alternativeExtraction.containerBased} activities`);
      console.log(`- Sequential method found: ${alternativeExtraction.sequentialBased} activities`);
      console.log(`- Unique activity names: ${alternativeExtraction.uniqueActivities.length}`);
      console.log(`- Total activities found: ${alternativeExtraction.totalActivities}`);
      
      console.log('\n📋 Sample Activities Found:');
      alternativeExtraction.sampleActivities.forEach((act, idx) => {
        console.log(`  ${idx + 1}. ${act.title} (${act.method})`);
        console.log(`     "${act.itemText}..."`);
      });

      // Save debug info to file
      const debugData = {
        timestamp: new Date().toISOString(),
        url: widgetUrl,
        showLinksCount,
        pageAnalysis,
        alternativeExtraction,
        recommendations: [
          'The issue appears to be in matching group items to their parent titles.',
          `Found ${pageAnalysis.groupTitles.length} titles but ${pageAnalysis.unmatchedItems.length} items couldn\'t find their parent.`,
          'The sequential parsing method seems more reliable than the current previousElementSibling approach.',
          'Consider using the container-based approach or sequential parsing to ensure all items are captured.'
        ]
      };

      fs.writeFileSync('nvrc-extraction-debug.json', JSON.stringify(debugData, null, 2));
      console.log('\n💾 Debug data saved to nvrc-extraction-debug.json');

      // Take final screenshot with annotations
      await page.evaluate(() => {
        // Highlight group titles in green
        document.querySelectorAll('.bm-group-title-row').forEach(el => {
          el.style.border = '3px solid green';
          el.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
        });
        
        // Highlight group items in blue
        document.querySelectorAll('.bm-group-item-row').forEach(el => {
          el.style.border = '2px solid blue';
          el.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
        });
      });

      await page.screenshot({ path: 'debug-4-annotated.png', fullPage: true });
      console.log('📸 Screenshot saved: debug-4-annotated.png (with highlights)');

      return debugData;

    } catch (error) {
      console.error('❌ Debug error:', error);
      throw error;
    } finally {
      if (browser) {
        console.log('\n🔚 Closing browser...');
        await browser.close();
      }
    }
  }
}

// Run the debugger
if (require.main === module) {
  const debugger = new NVRCExtractionDebugger();
  debugger.debug()
    .then(results => {
      console.log('\n✅ Debug session complete!');
      console.log('Check the following files:');
      console.log('  - debug-1-initial-page.png');
      console.log('  - debug-2-before-expand.png');
      console.log('  - debug-3-after-expand.png');
      console.log('  - debug-4-annotated.png');
      console.log('  - nvrc-extraction-debug.json');
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCExtractionDebugger;