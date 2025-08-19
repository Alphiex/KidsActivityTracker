const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCFullScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedUrls = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Full Scraper...');
      
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

      // Get all age group links from the main page
      const ageGroupLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const ageGroups = [];
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          // Look for age-related keywords
          if ((text.includes('Years') || text.includes('Age') || text.includes('Adult') || 
               text.includes('Youth') || text.includes('Early') || text.includes('Family')) &&
              href.includes('perfectmind.com') && 
              !href.includes('#') && 
              text.length > 3) {
            ageGroups.push({
              text: text,
              href: href
            });
          }
        });
        
        // Remove duplicates
        const unique = ageGroups.filter((item, index, self) =>
          index === self.findIndex((t) => t.href === item.href)
        );
        
        return unique;
      });

      console.log(`\n📊 Found ${ageGroupLinks.length} age group links to process`);
      console.log('Age groups:', ageGroupLinks.map(ag => ag.text).join(', '));

      // Process each age group
      for (let i = 0; i < ageGroupLinks.length; i++) {
        const ageGroup = ageGroupLinks[i];
        
        console.log(`\n📂 Processing age group ${i + 1}/${ageGroupLinks.length}: ${ageGroup.text}`);
        
        try {
          // Navigate to age group page
          await page.goto(ageGroup.href, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Look for "Show" buttons/links and click them all
          let showButtonsClicked = 0;
          let hasMoreShows = true;
          
          while (hasMoreShows) {
            const clicked = await page.evaluate(() => {
              const showElements = Array.from(document.querySelectorAll('a, span, button')).filter(el => {
                const text = el.textContent?.trim().toLowerCase();
                return text === 'show' || text === 'show all';
              });
              
              if (showElements.length > 0) {
                showElements[0].click();
                return true;
              }
              return false;
            });
            
            if (clicked) {
              showButtonsClicked++;
              console.log(`  ✅ Clicked Show button #${showButtonsClicked}`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              hasMoreShows = false;
            }
          }
          
          // Extract activities from the expanded page
          const pageActivities = await page.evaluate((categoryName) => {
            const activities = [];
            
            // Look for rows with Sign Up/Waitlist/Closed buttons
            const rows = Array.from(document.querySelectorAll('tr'));
            
            rows.forEach((row, index) => {
              const text = row.textContent || '';
              
              // Check if this row contains activity information
              if (text.includes('Sign Up') || text.includes('Waitlist') || text.includes('Closed')) {
                // Get all cells in the row
                const cells = Array.from(row.querySelectorAll('td'));
                
                if (cells.length >= 3) {
                  // Extract course ID from various sources
                  let courseId = null;
                  
                  // Try to find course ID in row ID
                  if (row.id && row.id.match(/\d{6}/)) {
                    courseId = row.id.match(/\d{6}/)[0];
                  }
                  
                  // Try to find in text (like #354436)
                  const idMatch = text.match(/#(\d{6})/);
                  if (idMatch) courseId = idMatch[1];
                  
                  // Try to find in links
                  const links = row.querySelectorAll('a[href*="courseId"]');
                  if (links.length > 0) {
                    const hrefMatch = links[0].href.match(/courseId=([^&]+)/);
                    if (hrefMatch) courseId = hrefMatch[1];
                  }
                  
                  // Extract activity details
                  const name = cells[0]?.textContent?.trim() || 'Unknown Activity';
                  const timeCell = cells.find(cell => cell.textContent?.match(/\d{1,2}:\d{2}\s*[ap]\.?m\.?/i));
                  const time = timeCell?.textContent?.trim() || null;
                  
                  // Extract location
                  let location = null;
                  cells.forEach(cell => {
                    const cellText = cell.textContent || '';
                    if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio/i)) {
                      location = cellText.trim();
                    }
                  });
                  
                  // Extract price
                  const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
                  const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                  
                  // Extract registration URL
                  const regLink = row.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                  const registrationUrl = regLink?.href || null;
                  
                  // Extract age info
                  let ageInfo = null;
                  const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
                  if (ageMatch) {
                    ageInfo = `${ageMatch[1]}-${ageMatch[2]} yrs`;
                  } else {
                    const gradeMatch = text.match(/Grade[s]?\s*([\d-]+)/i);
                    if (gradeMatch) ageInfo = `Grade ${gradeMatch[1]}`;
                  }
                  
                  activities.push({
                    id: courseId || `${categoryName}_row_${index}`,
                    category: categoryName,
                    name: name,
                    location: location,
                    time: time,
                    ageInfo: ageInfo,
                    price: price,
                    registrationUrl: registrationUrl,
                    courseId: courseId,
                    status: text.includes('Waitlist') ? 'waitlist' : (text.includes('Closed') ? 'closed' : 'open')
                  });
                }
              }
            });
            
            return activities;
          }, ageGroup.text);

          console.log(`  ✅ Extracted ${pageActivities.length} activities from ${ageGroup.text}`);
          
          // Add to total activities
          this.activities.push(...pageActivities);
          
          // Also check for date-based navigation within this age group
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
          
          if (dateLinks.length > 0) {
            console.log(`  📅 Found ${dateLinks.length} date-based sub-pages`);
            
            for (const dateLink of dateLinks) {
              if (!this.processedUrls.has(dateLink.href)) {
                console.log(`    📅 Processing date: ${dateLink.text}`);
                this.processedUrls.add(dateLink.href);
                
                await page.goto(dateLink.href, {
                  waitUntil: 'networkidle0',
                  timeout: 60000
                });
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Click any Show buttons on date page
                await page.evaluate(() => {
                  const showElements = Array.from(document.querySelectorAll('a, span, button')).filter(el => {
                    const text = el.textContent?.trim().toLowerCase();
                    return text === 'show' || text === 'show all';
                  });
                  
                  showElements.forEach(el => el.click());
                });
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Extract activities from date page
                const dateActivities = await page.evaluate((categoryName, dateText) => {
                  const activities = [];
                  const rows = Array.from(document.querySelectorAll('tr'));
                  
                  rows.forEach((row, index) => {
                    const text = row.textContent || '';
                    
                    if (text.includes('Sign Up') || text.includes('Waitlist') || text.includes('Closed')) {
                      const cells = Array.from(row.querySelectorAll('td'));
                      
                      if (cells.length >= 3) {
                        let courseId = null;
                        
                        if (row.id && row.id.match(/\d{6}/)) {
                          courseId = row.id.match(/\d{6}/)[0];
                        }
                        
                        const idMatch = text.match(/#(\d{6})/);
                        if (idMatch) courseId = idMatch[1];
                        
                        const links = row.querySelectorAll('a[href*="courseId"]');
                        if (links.length > 0) {
                          const hrefMatch = links[0].href.match(/courseId=([^&]+)/);
                          if (hrefMatch) courseId = hrefMatch[1];
                        }
                        
                        const name = cells[0]?.textContent?.trim() || 'Unknown Activity';
                        const timeCell = cells.find(cell => cell.textContent?.match(/\d{1,2}:\d{2}\s*[ap]\.?m\.?/i));
                        const time = timeCell?.textContent?.trim() || null;
                        
                        let location = null;
                        cells.forEach(cell => {
                          const cellText = cell.textContent || '';
                          if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio/i)) {
                            location = cellText.trim();
                          }
                        });
                        
                        const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
                        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                        
                        const regLink = row.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                        const registrationUrl = regLink?.href || null;
                        
                        activities.push({
                          id: courseId || `${categoryName}_${dateText}_row_${index}`,
                          category: categoryName,
                          name: name,
                          location: location,
                          date: dateText,
                          time: time,
                          price: price,
                          registrationUrl: registrationUrl,
                          courseId: courseId,
                          status: text.includes('Waitlist') ? 'waitlist' : (text.includes('Closed') ? 'closed' : 'open')
                        });
                      }
                    }
                  });
                  
                  return activities;
                }, ageGroup.text, dateLink.text);
                
                console.log(`      ✅ Extracted ${dateActivities.length} activities`);
                this.activities.push(...dateActivities);
              }
            }
          }
          
        } catch (error) {
          console.error(`  ❌ Error processing age group ${ageGroup.text}:`, error.message);
        }
      }

      console.log(`\n✅ Total activities extracted: ${this.activities.length}`);
      
      // Remove duplicates based on courseId
      const uniqueActivities = [];
      const seenCourseIds = new Set();
      
      this.activities.forEach(activity => {
        if (activity.courseId && !seenCourseIds.has(activity.courseId)) {
          seenCourseIds.add(activity.courseId);
          uniqueActivities.push(activity);
        } else if (!activity.courseId) {
          // Include activities without course IDs (but they might be duplicates)
          uniqueActivities.push(activity);
        }
      });
      
      console.log(`📊 Unique activities (by course ID): ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `nvrc_full_${timestamp}.json`;
          
          const results = {
            timestamp: new Date().toISOString(),
            url: widgetUrl,
            ageGroupsProcessed: ageGroupLinks.length,
            totalActivities: this.activities.length,
            uniqueActivities: uniqueActivities.length,
            activities: uniqueActivities
          };
          
          fs.writeFileSync(filename, JSON.stringify(results, null, 2));
          console.log(`💾 Results saved to ${filename}`);
        } catch (err) {
          console.log('💾 Could not save results file');
        }
      }
      
      return uniqueActivities;
      
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

module.exports = NVRCFullScraper;