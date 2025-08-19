const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCCompleteScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedUrls = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Complete Scraper...');
      
      const launchOptions = {
        headless: this.options.headless !== undefined ? this.options.headless : true,
        slowMo: 0,
        args: this.options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--window-size=1920,1080'
        ],
        defaultViewport: null,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('JQMIGRATE') && !text.includes('Slow network') && !text.includes('Failed to load resource')) {
          console.log('PAGE LOG:', text);
        }
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

      // Get all category links from the main page
      const categoryLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const categories = [];
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          // Skip external links and non-category links
          if (href.includes('perfectmind.com') && 
              !href.includes('#') && 
              text.length > 3 &&
              !text.includes('Login') &&
              !text.includes('Reset')) {
            categories.push({
              text: text,
              href: href
            });
          }
        });
        
        // Remove duplicates
        const unique = categories.filter((item, index, self) =>
          index === self.findIndex((t) => t.href === item.href)
        );
        
        return unique;
      });

      console.log(`\n📊 Found ${categoryLinks.length} category links to process`);

      // Process each category link
      for (let i = 0; i < categoryLinks.length; i++) {
        const category = categoryLinks[i];
        
        // Skip if we've already processed this URL
        if (this.processedUrls.has(category.href)) {
          continue;
        }
        
        console.log(`\n📂 Processing category ${i + 1}/${categoryLinks.length}: ${category.text}`);
        this.processedUrls.add(category.href);
        
        try {
          // Navigate to category page
          await page.goto(category.href, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Extract activities from this page
          await this.extractActivitiesFromPage(page, category.text);
          
          // Check if there are sub-categories (like individual dates)
          const hasMoreLinks = await page.evaluate(() => {
            // Look for date-based navigation or pagination
            const links = Array.from(document.querySelectorAll('a'));
            return links.some(link => {
              const text = link.textContent?.trim() || '';
              return text.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/i);
            });
          });
          
          if (hasMoreLinks) {
            console.log('  📅 Found date-based sub-categories');
            // Get all date links
            const dateLinks = await page.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a'));
              return links
                .filter(link => {
                  const text = link.textContent?.trim() || '';
                  return text.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/i);
                })
                .map(link => ({
                  text: link.textContent?.trim(),
                  href: link.href
                }));
            });
            
            // Process each date
            for (const dateLink of dateLinks) {
              if (!this.processedUrls.has(dateLink.href)) {
                console.log(`    📅 Processing date: ${dateLink.text}`);
                this.processedUrls.add(dateLink.href);
                
                await page.goto(dateLink.href, {
                  waitUntil: 'networkidle0',
                  timeout: 60000
                });
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.extractActivitiesFromPage(page, `${category.text} - ${dateLink.text}`);
              }
            }
          }
          
        } catch (error) {
          console.error(`  ❌ Error processing category ${category.text}:`, error.message);
        }
      }

      console.log(`\n✅ Total activities extracted: ${this.activities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `nvrc_complete_${timestamp}.json`;
          
          const results = {
            timestamp: new Date().toISOString(),
            url: widgetUrl,
            categoriesProcessed: categoryLinks.length,
            urlsProcessed: this.processedUrls.size,
            activitiesCount: this.activities.length,
            activities: this.activities
          };
          
          fs.writeFileSync(filename, JSON.stringify(results, null, 2));
          console.log(`💾 Results saved to ${filename}`);
        } catch (err) {
          console.log('💾 Could not save results file');
        }
      }
      
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

  async extractActivitiesFromPage(page, categoryName) {
    try {
      const pageActivities = await page.evaluate((category) => {
        const activities = [];
        
        // Look for activity containers - these often have course IDs
        const activityElements = Array.from(document.querySelectorAll('[id*="354"], [id*="370"], [id*="365"], [class*="course"], [class*="program"], [class*="activity"]'));
        
        // Also look for any element containing price information (good indicator of an activity)
        const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.match(/\$\d+/) && (text.includes('More Info') || text.includes('Register'));
        });
        
        // Combine both approaches
        const allElements = [...activityElements, ...priceElements];
        
        // Process each potential activity element
        allElements.forEach((element, index) => {
          try {
            const text = element.textContent || '';
            
            // Skip if too short or doesn't look like an activity
            if (text.length < 20) return;
            
            // Extract course ID from various sources
            const courseId = (() => {
              // From element ID
              if (element.id && element.id.match(/\d{6}/)) {
                return element.id;
              }
              // From text (like #354436)
              const idMatch = text.match(/#(\d{6})/);
              if (idMatch) return idMatch[1];
              // From href
              const link = element.querySelector('a[href*="courseId"]');
              if (link) {
                const hrefMatch = link.href.match(/courseId=([^&]+)/);
                if (hrefMatch) return hrefMatch[1];
              }
              return null;
            })();
            
            // Extract activity name (usually the first line or in a heading)
            const name = (() => {
              const heading = element.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
              if (heading) return heading.textContent?.trim();
              
              // Try first line of text
              const lines = text.split('\n').filter(line => line.trim());
              if (lines.length > 0) {
                // Skip if first line is just a day name
                if (!lines[0].match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)) {
                  return lines[0].trim();
                }
                return lines.length > 1 ? lines[1].trim() : lines[0].trim();
              }
              return 'Unknown Activity';
            })();
            
            // Extract location
            const location = (() => {
              const locationPatterns = [
                /at\s+([^,\n]+(?:Centre|Center|Park|Arena|Pool|Field|Gym|Studio)[^,\n]*)/i,
                /Location:\s*([^\n]+)/i,
                /([^,\n]*(?:Centre|Center|Park|Arena|Pool|Field|Gym|Studio)[^,\n]*)/i
              ];
              
              for (const pattern of locationPatterns) {
                const match = text.match(pattern);
                if (match) return match[1].trim();
              }
              return null;
            })();
            
            // Extract time
            const time = (() => {
              const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
              return timeMatch ? timeMatch[1] : null;
            })();
            
            // Extract date
            const date = (() => {
              const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+(?:st|nd|rd|th)?(?:,?\s*\d{4})?)/i);
              return dateMatch ? dateMatch[1] : null;
            })();
            
            // Extract days of week (for recurring activities)
            const daysOfWeek = (() => {
              const days = [];
              const dayPatterns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
              dayPatterns.forEach(day => {
                if (text.includes(day) || text.includes(day.substring(0, 3))) {
                  days.push(day.substring(0, 3));
                }
              });
              return [...new Set(days)];
            })();
            
            // Extract age/grade information
            const ageInfo = (() => {
              // Grade patterns
              const gradeMatch = text.match(/Grade[s]?\s*([\d-]+)/i);
              if (gradeMatch) return `Grade ${gradeMatch[1]}`;
              
              // Age patterns
              const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
              if (ageMatch) return `${ageMatch[1]}-${ageMatch[2]} yrs`;
              
              const agePlusMatch = text.match(/(\d+)\+?\s*yr?s?/i);
              if (agePlusMatch) return `${agePlusMatch[1]}+ yrs`;
              
              return null;
            })();
            
            // Extract price
            const price = (() => {
              const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
              return priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
            })();
            
            // Extract registration URL
            const registrationUrl = (() => {
              const link = element.querySelector('a[href*="BookMe4"], a[href*="courseId"], a:contains("More Info"), a:contains("Register")');
              return link?.href || null;
            })();
            
            // Only add if we have meaningful data
            if (name && name !== 'Unknown Activity' && (courseId || price || time || location)) {
              activities.push({
                id: courseId || `${category}_${index}`,
                category: category,
                name: name,
                location: location,
                date: date,
                time: time,
                daysOfWeek: daysOfWeek,
                ageInfo: ageInfo,
                price: price,
                registrationUrl: registrationUrl,
                courseId: courseId,
                rawText: text.substring(0, 500)
              });
            }
          } catch (error) {
            console.error('Error extracting activity:', error);
          }
        });
        
        // If no activities found with structured approach, try a simpler one
        if (activities.length === 0) {
          // Look for "More Info" buttons as indicators of activities
          const moreInfoElements = Array.from(document.querySelectorAll('a')).filter(a => 
            a.textContent?.includes('More Info')
          );
          
          moreInfoElements.forEach((link, index) => {
            const parent = link.closest('div, tr, li, section, article') || link.parentElement;
            if (parent) {
              const text = parent.textContent || '';
              const lines = text.split('\n').map(l => l.trim()).filter(l => l);
              
              if (lines.length >= 2) {
                activities.push({
                  id: `${category}_moreinfo_${index}`,
                  category: category,
                  name: lines[0],
                  registrationUrl: link.href,
                  rawText: text.substring(0, 500)
                });
              }
            }
          });
        }
        
        return activities;
      }, categoryName);

      console.log(`  ✅ Extracted ${pageActivities.length} activities from this page`);
      
      // Add to total activities
      this.activities.push(...pageActivities);
      
    } catch (error) {
      console.error(`Error extracting activities:`, error);
    }
  }
}

module.exports = NVRCCompleteScraper;