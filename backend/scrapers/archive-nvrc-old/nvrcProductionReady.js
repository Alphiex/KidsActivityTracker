const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCProductionReady {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedIds = new Set();
    this.debug = options.debug || false;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Production Ready Scraper...');
      console.log('🎯 Target: Extract ALL 1700+ activities');
      
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
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to PerfectMind widget
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });
      
      // Wait for content
      await page.waitForSelector('body', { timeout: 30000 });
      await this.wait(5000);
      
      console.log('✅ Page loaded');
      
      // Step 1: Clear all filters to show maximum activities
      console.log('\n📍 Step 1: Clearing all filters...');
      await this.clearAllFilters(page);
      
      // Step 2: Extract all visible activities on main page
      console.log('\n📍 Step 2: Extracting activities from main view...');
      await this.extractVisibleActivities(page, 'Main Page - All Programs');
      
      // Step 3: Get all navigable links
      console.log('\n📍 Step 3: Finding all program categories...');
      const allLinks = await this.getAllProgramLinks(page);
      console.log(`Found ${allLinks.length} program links to process`);
      
      // Step 4: Process each link systematically
      for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        
        // Check if we have enough activities
        if (this.activities.length >= 1700) {
          console.log('\n🎉 Success! Found 1700+ activities!');
          break;
        }
        
        console.log(`\n📂 [${i + 1}/${allLinks.length}] Processing: ${link.text}`);
        
        try {
          // Click the link
          const clicked = await this.clickLink(page, link.text);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not click ${link.text}`);
            continue;
          }
          
          // Wait for content to load
          await this.wait(3000);
          
          // Expand all content
          await this.expandAllContent(page);
          
          // Extract activities
          await this.extractVisibleActivities(page, link.text);
          
          // Process sub-navigation (dates, sessions, etc.)
          await this.processSubNavigation(page, link.text);
          
          // Return to main page
          await page.goto(widgetUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          await this.wait(2000);
          
          console.log(`  📊 Total activities so far: ${this.activities.length}`);
          
        } catch (error) {
          console.error(`  ❌ Error processing ${link.text}:`, error.message);
          
          // Try to recover
          try {
            await page.goto(widgetUrl, {
              waitUntil: 'networkidle0',
              timeout: 60000
            });
            await this.wait(2000);
          } catch (e) {
            console.error('  ❌ Failed to recover');
          }
        }
      }
      
      // Step 5: If still not enough, try alternative methods
      if (this.activities.length < 1700) {
        console.log('\n📍 Step 5: Trying alternative extraction methods...');
        await this.tryAlternativeMethods(page);
      }
      
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total unique activities found: ${this.activities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_production_${timestamp}.json`;
      
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

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clearAllFilters(page) {
    try {
      // Click all "Reset" buttons
      const resetClicked = await page.evaluate(() => {
        let clicked = 0;
        const resetButtons = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim().toLowerCase();
          return text === 'reset' || text === 'clear' || text === 'clear all';
        });
        
        resetButtons.forEach(btn => {
          if (btn.offsetParent !== null) { // Is visible
            btn.click();
            clicked++;
          }
        });
        
        return clicked;
      });
      
      if (resetClicked > 0) {
        console.log(`  ✅ Clicked ${resetClicked} reset buttons`);
        await this.wait(2000);
      }
      
      // Also try to remove date range filters
      const dateFiltersCleared = await page.evaluate(() => {
        // Look for date inputs and clear them
        const dateInputs = Array.from(document.querySelectorAll('input[type="date"], input[type="text"]')).filter(input => {
          const placeholder = input.placeholder?.toLowerCase() || '';
          const name = input.name?.toLowerCase() || '';
          return placeholder.includes('date') || name.includes('date');
        });
        
        dateInputs.forEach(input => {
          input.value = '';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        return dateInputs.length;
      });
      
      if (dateFiltersCleared > 0) {
        console.log(`  ✅ Cleared ${dateFiltersCleared} date filters`);
      }
      
    } catch (e) {
      console.log('  ⚠️ Could not clear filters:', e.message);
    }
  }

  async getAllProgramLinks(page) {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const programLinks = [];
      const seen = new Set();
      
      links.forEach(link => {
        const text = link.textContent?.trim() || '';
        const href = link.href || '';
        
        // Skip duplicates and non-program links
        if (!seen.has(text) && 
            text && 
            text.length > 2 &&
            !text.toLowerCase().includes('login') &&
            !text.toLowerCase().includes('reset') &&
            !text.toLowerCase().includes('skip') &&
            !text.toLowerCase().includes('advanced search') &&
            !href.includes('#')) {
          
          seen.add(text);
          
          // Prioritize likely program links
          const priority = 
            (text.includes('Schedule') ? 10 : 0) +
            (text.includes('Years') ? 9 : 0) +
            (text.includes('Adult') ? 8 : 0) +
            (text.includes('Youth') ? 8 : 0) +
            (text.includes('Family') ? 8 : 0) +
            (text.includes('Arts') ? 7 : 0) +
            (text.includes('Sports') ? 7 : 0) +
            (text.includes('Swimming') ? 7 : 0) +
            (text.includes('Fitness') ? 7 : 0) +
            (text.includes('Dance') ? 6 : 0) +
            (text.includes('Camp') ? 6 : 0);
          
          programLinks.push({
            text: text,
            href: href,
            priority: priority
          });
        }
      });
      
      // Sort by priority
      return programLinks.sort((a, b) => b.priority - a.priority);
    });
  }

  async clickLink(page, linkText) {
    return await page.evaluate((text) => {
      const links = Array.from(document.querySelectorAll('a'));
      const link = links.find(a => a.textContent?.trim() === text);
      
      if (link) {
        // Try multiple click methods
        try {
          link.click();
          return true;
        } catch (e1) {
          try {
            link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return true;
          } catch (e2) {
            try {
              window.location.href = link.href;
              return true;
            } catch (e3) {
              return false;
            }
          }
        }
      }
      return false;
    }, linkText);
  }

  async expandAllContent(page) {
    try {
      let totalExpanded = 0;
      let hasMore = true;
      let iterations = 0;
      
      while (hasMore && iterations < 20) {
        iterations++;
        
        const expanded = await page.evaluate(() => {
          let clicked = 0;
          
          // Find all expandable elements
          const expandElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent?.trim().toLowerCase();
            return (text === 'show' || 
                   text === 'show all' || 
                   text === 'show more' ||
                   text === 'view all' ||
                   text === 'load more') &&
                   el.offsetParent !== null; // Is visible
          });
          
          expandElements.forEach(el => {
            try {
              el.click();
              clicked++;
            } catch (e) {
              // Continue with next element
            }
          });
          
          return clicked;
        });
        
        if (expanded > 0) {
          totalExpanded += expanded;
          await this.wait(1500);
        } else {
          hasMore = false;
        }
      }
      
      if (totalExpanded > 0) {
        console.log(`  ✅ Expanded ${totalExpanded} sections`);
      }
    } catch (e) {
      console.log('  ⚠️ Error expanding content:', e.message);
    }
  }

  async processSubNavigation(page, category) {
    try {
      // Look for date tabs
      const dateTabs = await page.evaluate(() => {
        const dates = [];
        const elements = Array.from(document.querySelectorAll('*'));
        
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          
          // Match date patterns
          if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d+/.test(text) && 
              text.length < 20 &&
              (el.tagName === 'A' || 
               el.tagName === 'BUTTON' || 
               el.onclick || 
               el.style.cursor === 'pointer' ||
               el.classList.contains('clickable'))) {
            dates.push(text);
          }
        });
        
        return [...new Set(dates)];
      });
      
      if (dateTabs.length > 0) {
        console.log(`  📅 Found ${dateTabs.length} date tabs`);
        
        // Process each date
        for (let i = 0; i < Math.min(dateTabs.length, 14); i++) { // Two weeks
          const date = dateTabs[i];
          console.log(`    📅 Processing ${date}`);
          
          const clicked = await page.evaluate((d) => {
            const el = Array.from(document.querySelectorAll('*'))
              .find(e => e.textContent?.trim() === d);
            if (el) {
              el.click();
              return true;
            }
            return false;
          }, date);
          
          if (clicked) {
            await this.wait(2000);
            await this.extractVisibleActivities(page, `${category} - ${date}`);
          }
        }
      }
      
      // Also look for session/term navigation
      const sessionLinks = await page.evaluate(() => {
        const sessions = [];
        const links = Array.from(document.querySelectorAll('a'));
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          if ((text.includes('Session') || 
               text.includes('Term') || 
               text.includes('Week')) &&
              text.length < 30) {
            sessions.push(text);
          }
        });
        
        return [...new Set(sessions)];
      });
      
      if (sessionLinks.length > 0) {
        console.log(`  📅 Found ${sessionLinks.length} session links`);
        
        for (const session of sessionLinks.slice(0, 5)) {
          console.log(`    📅 Processing ${session}`);
          const clicked = await this.clickLink(page, session);
          
          if (clicked) {
            await this.wait(2000);
            await this.extractVisibleActivities(page, `${category} - ${session}`);
          }
        }
      }
      
    } catch (e) {
      console.log('  ⚠️ Error processing sub-navigation:', e.message);
    }
  }

  async extractVisibleActivities(page, context) {
    try {
      const activities = await page.evaluate(() => {
        const results = [];
        const processedTexts = new Set();
        
        // Strategy 1: Find table rows with activity data
        const rows = Array.from(document.querySelectorAll('tr'));
        
        rows.forEach((row, index) => {
          const text = row.textContent || '';
          
          if (!processedTexts.has(text) && text.length > 20) {
            // Look for activity indicators
            const hasPrice = text.includes('$');
            const hasRegistration = /sign up|register|waitlist|closed|full|available/i.test(text);
            const hasCourseId = /#\d{6}/.test(text);
            const hasTime = /\d{1,2}:\d{2}\s*[ap]\.?m\.?/i.test(text);
            
            if (hasPrice || hasRegistration || hasCourseId || hasTime) {
              processedTexts.add(text);
              
              const cells = Array.from(row.querySelectorAll('td'));
              
              if (cells.length >= 2) {
                // Extract course ID
                const idMatch = text.match(/#(\d{6})/);
                const courseId = idMatch ? idMatch[1] : null;
                
                // Extract name (usually first cell)
                let name = cells[0]?.textContent?.trim() || '';
                name = name.replace(/#\d+/, '').trim();
                
                if (!name || name.length < 3) {
                  // Try to get name from row
                  const lines = text.split('\n').filter(l => l.trim());
                  name = lines[0]?.replace(/#\d+/, '').trim() || '';
                }
                
                if (name && name.length > 3 && name !== 'Course') {
                  // Extract other details
                  const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
                  const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
                  
                  // Find location
                  let location = null;
                  cells.forEach(cell => {
                    const cellText = cell.textContent || '';
                    if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library|Community|Room/i) &&
                        !cellText.includes('Sign Up') && 
                        !cellText.includes('Register')) {
                      location = cellText.trim();
                    }
                  });
                  
                  // Determine status
                  let status = 'open';
                  if (/waitlist/i.test(text)) status = 'waitlist';
                  else if (/closed|full/i.test(text)) status = 'closed';
                  
                  results.push({
                    id: courseId || `row_${index}`,
                    courseId: courseId,
                    name: name,
                    price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null,
                    time: timeMatch ? timeMatch[1] : null,
                    location: location,
                    status: status,
                    source: 'table_row'
                  });
                }
              }
            }
          }
        });
        
        // Strategy 2: Find elements with course IDs
        const elementsWithIds = Array.from(document.querySelectorAll('[id]')).filter(el =>
          el.id.match(/^\d{6}$/)
        );
        
        elementsWithIds.forEach(el => {
          const text = el.textContent || '';
          if (!processedTexts.has(text) && text.length > 20) {
            processedTexts.add(text);
            
            const name = el.querySelector('a, h1, h2, h3, h4, h5, h6')?.textContent?.trim() ||
                        text.split('\n')[0].trim();
            
            if (name && name.length > 3) {
              const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
              
              results.push({
                id: el.id,
                courseId: el.id,
                name: name,
                price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null,
                source: 'element_id'
              });
            }
          }
        });
        
        // Strategy 3: Find activity containers
        const containers = Array.from(document.querySelectorAll('div, section, article, li'));
        
        containers.forEach((container, index) => {
          const text = container.textContent || '';
          
          if (!processedTexts.has(text) && 
              text.length > 50 && 
              text.length < 500) {
            
            // Count indicators
            const indicators = {
              hasPrice: text.includes('$'),
              hasTime: /\d{1,2}:\d{2}\s*[ap]\.?m\.?/i.test(text),
              hasLocation: /(Centre|Center|Park|Arena|Pool|Gym|Studio)/i.test(text),
              hasAge: /(years|yrs|age|grade)/i.test(text),
              hasRegistration: /(register|sign up|enroll|spots|waitlist)/i.test(text),
              hasCourseId: /#\d{6}/.test(text),
              hasDays: /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(text)
            };
            
            const score = Object.values(indicators).filter(v => v).length;
            
            if (score >= 3) {
              processedTexts.add(text);
              
              const lines = text.split('\n').filter(l => l.trim());
              const name = lines[0]?.replace(/#\d+/, '').trim() || '';
              
              const idMatch = text.match(/#(\d{6})/);
              const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
              
              if (name && name.length > 3) {
                results.push({
                  id: idMatch ? idMatch[1] : `container_${index}`,
                  courseId: idMatch ? idMatch[1] : null,
                  name: name,
                  price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null,
                  score: score,
                  source: 'container'
                });
              }
            }
          }
        });
        
        return results;
      });
      
      // Add unique activities only
      let newCount = 0;
      activities.forEach(activity => {
        const id = activity.courseId || activity.id;
        if (!this.processedIds.has(id)) {
          this.processedIds.add(id);
          this.activities.push({
            ...activity,
            category: context
          });
          newCount++;
        }
      });
      
      if (newCount > 0) {
        console.log(`  ✅ Found ${newCount} new activities in ${context}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error extracting activities:`, error.message);
    }
  }

  async tryAlternativeMethods(page) {
    try {
      // Method 1: Search for all activities
      console.log('  🔍 Method 1: Searching for all activities...');
      
      const searchInput = await page.$('input[type="search"], input[type="text"], input[placeholder*="search"]');
      if (searchInput) {
        await searchInput.click({ clickCount: 3 });
        await searchInput.type('');
        await page.keyboard.press('Enter');
        await this.wait(3000);
        
        await this.expandAllContent(page);
        await this.extractVisibleActivities(page, 'Search Results - All');
      }
      
      // Method 2: Navigate by program type
      console.log('  🔍 Method 2: Navigating by program type...');
      
      const programTypes = ['Swimming', 'Dance', 'Arts', 'Sports', 'Fitness', 'Camps', 'Music'];
      
      for (const programType of programTypes) {
        if (this.activities.length >= 1700) break;
        
        console.log(`    Searching for ${programType}...`);
        
        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await searchInput.type(programType);
          await page.keyboard.press('Enter');
          await this.wait(3000);
          
          await this.expandAllContent(page);
          await this.extractVisibleActivities(page, `Search - ${programType}`);
        }
      }
      
      // Method 3: Direct URL manipulation
      console.log('  🔍 Method 3: Trying direct URL access...');
      
      const searchUrls = [
        'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&calendarId=-1',
        'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&showAll=true',
        'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&categoryId=all'
      ];
      
      for (const url of searchUrls) {
        if (this.activities.length >= 1700) break;
        
        console.log(`    Trying URL: ${url.substring(0, 80)}...`);
        
        try {
          await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          await this.wait(3000);
          
          await this.expandAllContent(page);
          await this.extractVisibleActivities(page, 'Direct URL Access');
        } catch (e) {
          console.log('    ⚠️ URL failed:', e.message);
        }
      }
      
    } catch (e) {
      console.error('  ❌ Alternative methods failed:', e.message);
    }
  }
}

module.exports = NVRCProductionReady;