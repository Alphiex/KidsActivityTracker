const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCPerfectMindScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC PerfectMind Direct Scraper...');
      
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
      
      console.log('Browser launch options:', { ...launchOptions, executablePath: '...' });
      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
          console.log('PAGE LOG:', msg.text());
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the PerfectMind widget directly
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });

      // Wait for the page to load
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Define the sections we need to click
      const sections = [
        'All Ages & Family',
        'Early Years: On My Own',
        'Early Years: Parent Participation',
        'School Age',
        'Youth',
        'Adult' // Adding Adult as it might have activities too
      ];

      for (const section of sections) {
        console.log(`\n📂 Processing section: ${section}`);
        
        try {
          // Navigate back to main page if needed
          const currentUrl = await page.url();
          if (!currentUrl.includes('BookMe4?widgetId')) {
            await page.goto(widgetUrl, {
              waitUntil: 'networkidle0',
              timeout: 60000
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Click on the section link
          const sectionClicked = await page.evaluate((sectionName) => {
            // First try exact match
            let links = Array.from(document.querySelectorAll('a'));
            let sectionLink = links.find(link => {
              const text = link.textContent?.trim() || '';
              return text === sectionName;
            });
            
            // If not found, try partial match
            if (!sectionLink) {
              sectionLink = links.find(link => {
                const text = link.textContent?.trim() || '';
                return text.includes(sectionName) && link.href && 
                       (link.href.includes('BookMe4') || link.href.includes('perfectmind'));
              });
            }
            
            // If still not found, try navigation menu items
            if (!sectionLink) {
              const navItems = document.querySelectorAll('.nav-item, .menu-item, [class*="navigation"]');
              for (const item of navItems) {
                if (item.textContent?.includes(sectionName)) {
                  const link = item.querySelector('a') || item;
                  if (link.click) {
                    link.click();
                    return true;
                  }
                }
              }
            }
            
            if (sectionLink) {
              sectionLink.click();
              return true;
            }
            return false;
          }, section);

          if (!sectionClicked) {
            console.log(`  ⚠️  Could not find link for section: ${section}`);
            continue;
          }

          // Wait for navigation
          await new Promise(resolve => setTimeout(resolve, 5000));

          // Extract activities from this section
          await this.extractActivitiesFromSection(page, section);
          
        } catch (error) {
          console.error(`  ❌ Error processing section ${section}:`, error.message);
        }
      }

      console.log(`\n✅ Total activities extracted: ${this.activities.length}`);
      
      // Save results locally if not in production
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `nvrc_perfectmind_${timestamp}.json`;
          
          const results = {
            timestamp: new Date().toISOString(),
            url: widgetUrl,
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

  async extractActivitiesFromSection(page, sectionName) {
    try {
      // First wait for the page to load
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Look for "Show" links that expand activity groups
      const showLinks = await page.evaluate(() => {
        // Find all elements with "Show" text that are likely expand buttons
        const links = Array.from(document.querySelectorAll('a, button, span'));
        const showLinks = links.filter(el => {
          const text = el.textContent?.trim() || '';
          return text.toLowerCase() === 'show' || text.includes('Show');
        });
        return showLinks.length;
      });

      if (showLinks > 0) {
        console.log(`  📁 Found ${showLinks} activity groups to expand...`);
        
        // Click each "Show" link one by one
        for (let i = 0; i < showLinks; i++) {
          const clicked = await page.evaluate((index) => {
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
          
          if (clicked) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
        
        console.log(`  ✅ Expanded all activity groups`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Extract all activities from the page
      const pageActivities = await page.evaluate((section) => {
        const activities = [];
        
        // Look for activity rows in tables (common in PerfectMind)
        const tables = document.querySelectorAll('table');
        
        tables.forEach(table => {
          // Skip header rows
          const rows = Array.from(table.querySelectorAll('tr')).slice(1);
          
          rows.forEach((row, index) => {
            // Check if this row contains activity information
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return; // Skip rows with too few cells
            
            const rowText = row.textContent || '';
            
            // Skip if it's not an activity row
            if (!rowText.includes('Sign Up') && !rowText.includes('Waitlist') && !rowText.includes('Closed')) {
              return;
            }
            
            try {
              // Extract activity name (usually in first cell or as a link)
              const nameElement = row.querySelector('a') || cells[0];
              const name = nameElement?.textContent?.trim() || '';
              
              // Skip empty names
              if (!name || name.length < 3) return;
              
              // Extract all cell texts for parsing
              const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
              const fullText = cellTexts.join(' ');
              
              const activity = {
                id: `${section}_${table.id || index}_${row.rowIndex || index}`,
                section: section,
                name: name,
                
                // Extract dates (looking for patterns like "Jan 6 - Mar 24")
                dates: (() => {
                  const dateMatch = fullText.match(/([A-Z][a-z]{2}\s+\d{1,2}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2})/);
                  return dateMatch ? dateMatch[1] : null;
                })(),
                
                // Extract days of week
                daysOfWeek: (() => {
                  const days = [];
                  const dayPatterns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 
                                      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  dayPatterns.forEach(day => {
                    if (fullText.includes(day)) {
                      days.push(day.substring(0, 3)); // Normalize to 3-letter format
                    }
                  });
                  return [...new Set(days)]; // Remove duplicates
                })(),
                
                // Extract time
                time: (() => {
                  const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
                  return timeMatch ? timeMatch[1] : null;
                })(),
                
                // Extract age range
                ageRange: (() => {
                  // Look for patterns like "5-12 yrs" or "6+" 
                  const ageMatch = fullText.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
                  if (ageMatch) {
                    return {
                      min: parseInt(ageMatch[1]),
                      max: parseInt(ageMatch[2])
                    };
                  }
                  const agePlusMatch = fullText.match(/(\d+)\+?\s*yr?s?/i);
                  if (agePlusMatch) {
                    return {
                      min: parseInt(agePlusMatch[1]),
                      max: 18
                    };
                  }
                  return null;
                })(),
                
                // Extract location
                location: (() => {
                  // Look for location patterns
                  const locationKeywords = ['Centre', 'Center', 'Park', 'Arena', 'Pool', 'Field', 'Gym', 'Studio'];
                  for (const keyword of locationKeywords) {
                    const match = fullText.match(new RegExp(`([^,\\n]*${keyword}[^,\\n]*)`, 'i'));
                    if (match) {
                      const loc = match[1].trim();
                      // Clean up location
                      return loc.replace(/\s+/g, ' ').substring(0, 100);
                    }
                  }
                  return null;
                })(),
                
                // Extract price
                price: (() => {
                  const priceMatch = fullText.match(/\$([0-9,]+(?:\.\d{2})?)/);
                  return priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                })(),
                
                // Extract availability status and spots
                availability: (() => {
                  if (fullText.includes('Closed')) return 'Closed';
                  if (fullText.includes('Waitlist')) return 'Waitlist';
                  if (fullText.includes('Sign Up')) return 'Open';
                  return 'Unknown';
                })(),
                
                spotsAvailable: (() => {
                  const spotsMatch = fullText.match(/(\d+)\s*spot/i);
                  if (spotsMatch) return parseInt(spotsMatch[1]);
                  
                  // If it says "Sign Up" with a number in parentheses
                  const signUpMatch = fullText.match(/Sign Up\s*\((\d+)\)/i);
                  if (signUpMatch) return parseInt(signUpMatch[1]);
                  
                  return null;
                })(),
                
                // Extract registration URL
                registrationUrl: (() => {
                  const signUpLink = row.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                  return signUpLink?.href || null;
                })(),
                
                // Store raw text for debugging
                rawText: fullText.substring(0, 500)
              };
              
              activities.push(activity);
              console.log(`Extracted activity: ${activity.name}`);
              
            } catch (error) {
              console.error('Error extracting activity from row:', error);
            }
          });
        });
        
        // If no activities found in tables, try other structures
        if (activities.length === 0) {
          console.log('No activities found in tables, trying alternative extraction...');
          
          // Look for any clickable elements with activity information
          const links = Array.from(document.querySelectorAll('a[href*="courseId"], a[href*="BookMe4"]'));
          links.forEach((link, index) => {
            const parent = link.closest('div, li, tr');
            if (parent) {
              const text = parent.textContent || '';
              if (text.length > 20) { // Skip very short texts
                activities.push({
                  id: `${section}_link_${index}`,
                  section: section,
                  name: link.textContent?.trim() || 'Unknown Activity',
                  registrationUrl: link.href,
                  rawText: text.substring(0, 500),
                  availability: 'Open'
                });
              }
            }
          });
        }
        
        return activities;
      }, sectionName);

      console.log(`  ✅ Extracted ${pageActivities.length} activities from ${sectionName}`);
      
      // Add section activities to total
      this.activities.push(...pageActivities);
      
    } catch (error) {
      console.error(`Error extracting activities from section:`, error);
    }
  }
}

module.exports = NVRCPerfectMindScraper;