const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCHeadlessOptimized {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.seenActivityIds = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Headless Optimized Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities');
      
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Set realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Disable webdriver detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      // Navigate to PerfectMind widget
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });
      
      // Wait for initial content
      await page.waitForSelector('body', { timeout: 30000 });
      await page.waitForTimeout(5000);
      
      console.log('✅ Page loaded successfully');
      
      // First, extract what's visible on the main page
      console.log('\n📊 Extracting activities from main page...');
      await this.extractVisibleActivities(page, 'Main Page');
      
      // Get all clickable program/category links
      console.log('\n🔍 Finding all program categories...');
      
      const allLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const linkData = [];
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          // Filter out non-program links
          if (text && 
              !text.includes('Login') && 
              !text.includes('Reset') && 
              !text.includes('Skip') &&
              !text.includes('Advanced search') &&
              !href.includes('login') &&
              !href.includes('#') &&
              text.length > 3) {
            
            linkData.push({
              text: text,
              href: href,
              isProgram: /schedule|years|adult|youth|family|arts|sports|swimming|fitness|dance|camp|martial|skating|private/i.test(text)
            });
          }
        });
        
        // Sort to prioritize program links
        return linkData.sort((a, b) => b.isProgram - a.isProgram);
      });
      
      console.log(`Found ${allLinks.length} total links`);
      const programLinks = allLinks.filter(l => l.isProgram);
      console.log(`Found ${programLinks.length} program links`);
      
      // Process each program link
      for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        
        // Skip if we've found enough activities
        if (this.activities.length >= 1700) {
          console.log('\n🎉 Found 1700+ activities! Goal achieved!');
          break;
        }
        
        console.log(`\n📂 [${i + 1}/${allLinks.length}] Processing: ${link.text}`);
        
        try {
          // Click on the link
          const clicked = await page.evaluate((linkText) => {
            const links = Array.from(document.querySelectorAll('a'));
            const targetLink = links.find(a => a.textContent?.trim() === linkText);
            if (targetLink) {
              targetLink.click();
              return true;
            }
            return false;
          }, link.text);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not click on ${link.text}`);
            continue;
          }
          
          // Wait for content to load
          await page.waitForTimeout(3000);
          
          // Check if we're on a new page or if content updated
          const currentUrl = page.url();
          if (currentUrl !== widgetUrl) {
            console.log(`  📍 Navigated to new page`);
          }
          
          // Look for and expand any collapsed content
          await this.expandAllContent(page);
          
          // Extract activities from this view
          await this.extractVisibleActivities(page, link.text);
          
          // Check for sub-navigation (like date tabs)
          const hasDateTabs = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements.some(el => {
              const text = el.textContent?.trim() || '';
              return /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d+/.test(text) && text.length < 20;
            });
          });
          
          if (hasDateTabs) {
            console.log('  📅 Found date-based navigation');
            await this.processDateTabs(page, link.text);
          }
          
          // Navigate back to main page
          if (page.url() !== widgetUrl) {
            await page.goto(widgetUrl, {
              waitUntil: 'networkidle0',
              timeout: 60000
            });
            await page.waitForTimeout(3000);
          }
          
          console.log(`  📊 Total unique activities so far: ${this.activities.length}`);
          
        } catch (error) {
          console.error(`  ❌ Error processing ${link.text}:`, error.message);
          
          // Try to recover by going back to main page
          try {
            await page.goto(widgetUrl, {
              waitUntil: 'networkidle0',
              timeout: 60000
            });
            await page.waitForTimeout(3000);
          } catch (e) {
            console.error('  ❌ Could not navigate back to main page');
          }
        }
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities found: ${this.activities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_headless_${timestamp}.json`;
      
      const results = {
        timestamp: new Date().toISOString(),
        url: widgetUrl,
        totalActivities: this.activities.length,
        activities: this.activities
      };
      
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to ${filename}`);
      
      return this.activities;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async expandAllContent(page) {
    try {
      // Click all "Show" buttons
      let showButtonsClicked = 0;
      let hasMore = true;
      
      while (hasMore && showButtonsClicked < 10) {
        const clicked = await page.evaluate(() => {
          const showElements = Array.from(document.querySelectorAll('a, button, span')).filter(el => {
            const text = el.textContent?.trim().toLowerCase();
            return text === 'show' || text === 'show all' || text === 'show more';
          });
          
          if (showElements.length > 0) {
            const el = showElements[0];
            if (el.offsetParent !== null) { // Check if visible
              el.click();
              return true;
            }
          }
          return false;
        });
        
        if (clicked) {
          showButtonsClicked++;
          await page.waitForTimeout(1500);
        } else {
          hasMore = false;
        }
      }
      
      if (showButtonsClicked > 0) {
        console.log(`  ✅ Clicked ${showButtonsClicked} Show buttons`);
      }
    } catch (e) {
      // Continue even if expansion fails
    }
  }

  async processDateTabs(page, category) {
    try {
      // Get all date tabs
      const dateTabs = await page.evaluate(() => {
        const dates = [];
        const elements = Array.from(document.querySelectorAll('*'));
        
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          // Match patterns like "Mon Aug 5th", "Tue Aug 6th"
          if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d+/.test(text) && text.length < 20) {
            // Check if it's clickable
            if (el.tagName === 'A' || el.tagName === 'BUTTON' || 
                el.onclick || el.style.cursor === 'pointer') {
              dates.push(text);
            }
          }
        });
        
        return [...new Set(dates)]; // Remove duplicates
      });
      
      console.log(`  📅 Found ${dateTabs.length} date tabs`);
      
      // Process each date tab
      for (const dateTab of dateTabs.slice(0, 7)) { // Process first week
        console.log(`    📅 Processing ${dateTab}`);
        
        // Click on the date
        const clicked = await page.evaluate((date) => {
          const elements = Array.from(document.querySelectorAll('*'));
          const el = elements.find(e => e.textContent?.trim() === date);
          if (el) {
            el.click();
            return true;
          }
          return false;
        }, dateTab);
        
        if (clicked) {
          await page.waitForTimeout(2000);
          await this.extractVisibleActivities(page, `${category} - ${dateTab}`);
        }
      }
    } catch (e) {
      console.error('    ❌ Error processing date tabs:', e.message);
    }
  }

  async extractVisibleActivities(page, context) {
    try {
      const pageActivities = await page.evaluate(() => {
        const activities = [];
        const processedTexts = new Set();
        
        // Strategy 1: Look for table rows with activity data
        const rows = Array.from(document.querySelectorAll('tr'));
        
        rows.forEach((row, index) => {
          const text = row.textContent || '';
          
          // Skip if already processed or too short
          if (processedTexts.has(text) || text.length < 20) return;
          
          // Look for activity indicators
          if (text.includes('$') || text.includes('Sign Up') || 
              text.includes('Waitlist') || text.includes('Register') ||
              text.includes('#') && /\d{6}/.test(text)) {
            
            processedTexts.add(text);
            
            const cells = Array.from(row.querySelectorAll('td'));
            
            if (cells.length >= 2) {
              // Extract course ID
              let courseId = null;
              const idMatch = text.match(/#(\d{6})/);
              if (idMatch) courseId = idMatch[1];
              
              // Extract name (usually first cell)
              let name = cells[0]?.textContent?.trim() || '';
              name = name.replace(/#\d+/, '').trim();
              
              // Skip if name is too generic
              if (!name || name.length < 3 || name === 'Course') return;
              
              // Extract other details
              const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
              const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
              
              // Find location
              let location = null;
              cells.forEach(cell => {
                const cellText = cell.textContent || '';
                if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library|Room/i)) {
                  location = cellText.trim();
                }
              });
              
              // Determine status
              let status = 'open';
              if (text.includes('Waitlist')) status = 'waitlist';
              else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
              
              activities.push({
                id: courseId || `row_${index}`,
                courseId: courseId,
                name: name,
                time: timeMatch ? timeMatch[1] : null,
                location: location,
                price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null,
                status: status,
                source: 'table_row'
              });
            }
          }
        });
        
        // Strategy 2: Look for activity containers/cards
        const containers = Array.from(document.querySelectorAll('div, section, article, li'));
        
        containers.forEach((container, index) => {
          const text = container.textContent || '';
          
          if (!processedTexts.has(text) && text.length > 30 && text.length < 500) {
            if (text.includes('$') && (text.includes('Register') || text.includes('Sign Up'))) {
              processedTexts.add(text);
              
              const heading = container.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
              const name = heading?.textContent?.trim() || text.split('\n')[0].trim();
              
              const idMatch = text.match(/#(\d{6})/);
              const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
              
              if (name && name.length > 3) {
                activities.push({
                  id: idMatch ? idMatch[1] : `container_${index}`,
                  courseId: idMatch ? idMatch[1] : null,
                  name: name,
                  price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null,
                  source: 'container'
                });
              }
            }
          }
        });
        
        // Strategy 3: Look for elements with specific IDs (6-digit numbers)
        const elementsWithIds = Array.from(document.querySelectorAll('[id]')).filter(el => 
          el.id.match(/^\d{6}$/)
        );
        
        elementsWithIds.forEach(el => {
          const text = el.textContent || '';
          if (!processedTexts.has(text)) {
            processedTexts.add(text);
            
            const name = el.querySelector('h1, h2, h3, h4, h5, h6, a')?.textContent?.trim() || 
                        text.split('\n')[0].trim();
            
            if (name && name.length > 3) {
              activities.push({
                id: el.id,
                courseId: el.id,
                name: name,
                source: 'element_id'
              });
            }
          }
        });
        
        return activities;
      });
      
      // Add unique activities
      let newActivities = 0;
      pageActivities.forEach(activity => {
        const id = activity.courseId || activity.id;
        if (!this.seenActivityIds.has(id)) {
          this.seenActivityIds.add(id);
          this.activities.push({
            ...activity,
            category: context
          });
          newActivities++;
        }
      });
      
      if (newActivities > 0) {
        console.log(`  ✅ Found ${newActivities} new activities in ${context}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error extracting activities:`, error.message);
    }
  }
}

module.exports = NVRCHeadlessOptimized;