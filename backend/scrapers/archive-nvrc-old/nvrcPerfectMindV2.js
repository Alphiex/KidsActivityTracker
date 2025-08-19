const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCPerfectMindV2 {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedPrograms = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC PerfectMind V2 Scraper...');
      
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

      // First, get all programs from the left sidebar
      const programs = await page.evaluate(() => {
        const programLinks = [];
        
        // Look for links in the sidebar that are clickable program categories
        const links = Array.from(document.querySelectorAll('a'));
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const onclick = link.getAttribute('onclick') || '';
          
          // Skip non-program links
          if (text && 
              !text.includes('Login') && 
              !text.includes('Reset') && 
              !text.includes('Skip') &&
              !text.includes('Show More') &&
              text.length > 3) {
            
            // Check if it's a program category (usually in the left sidebar)
            const parent = link.closest('.widget-facets, .sidebar, .filter-section, ul, li');
            if (parent) {
              programLinks.push({
                text: text,
                onclick: onclick,
                href: link.href || ''
              });
            }
          }
        });
        
        // Also look for program headings in the main content area
        const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
        headings.forEach(heading => {
          const text = heading.textContent?.trim() || '';
          if (text.includes('Years') || text.includes('Age') || text.includes('Adult') || 
              text.includes('Youth') || text.includes('Family')) {
            // Check if there's a nearby link
            const nearbyLink = heading.closest('a') || heading.querySelector('a') || 
                             heading.nextElementSibling?.querySelector('a');
            if (nearbyLink) {
              programLinks.push({
                text: text,
                onclick: nearbyLink.getAttribute('onclick') || '',
                href: nearbyLink.href || ''
              });
            }
          }
        });
        
        // Remove duplicates
        const unique = programLinks.filter((item, index, self) =>
          index === self.findIndex((t) => t.text === item.text)
        );
        
        return unique;
      });

      console.log(`\n📊 Found ${programs.length} program categories`);
      console.log('Programs:', programs.map(p => p.text).join(', '));

      // Process each program category
      for (let i = 0; i < programs.length; i++) {
        const program = programs[i];
        
        if (this.processedPrograms.has(program.text)) {
          continue;
        }
        
        console.log(`\n📂 Processing program ${i + 1}/${programs.length}: ${program.text}`);
        this.processedPrograms.add(program.text);
        
        try {
          // Click on the program link
          const clicked = await page.evaluate((programText) => {
            const links = Array.from(document.querySelectorAll('a'));
            const link = links.find(a => a.textContent?.trim() === programText);
            if (link) {
              link.click();
              return true;
            }
            return false;
          }, program.text);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not click on ${program.text}`);
            continue;
          }
          
          // Wait for the page to update
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Look for and click all "Show" buttons to expand activities
          let showButtonsClicked = 0;
          let hasMoreShows = true;
          
          while (hasMoreShows) {
            const showClicked = await page.evaluate(() => {
              // Find Show links/buttons
              const showElements = Array.from(document.querySelectorAll('a, span, button')).filter(el => {
                const text = el.textContent?.trim();
                return text === 'Show' || text === 'Show All' || text === 'show';
              });
              
              // Click the first visible one
              for (const el of showElements) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  el.click();
                  return true;
                }
              }
              return false;
            });
            
            if (showClicked) {
              showButtonsClicked++;
              console.log(`  ✅ Clicked Show button #${showButtonsClicked}`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              hasMoreShows = false;
            }
          }
          
          // Extract activities from the current view
          const pageActivities = await page.evaluate((categoryName) => {
            const activities = [];
            
            // Strategy 1: Look for table rows with registration buttons
            const rows = Array.from(document.querySelectorAll('tr'));
            
            rows.forEach((row, index) => {
              const text = row.textContent || '';
              
              // Check if this row contains activity information
              if (text.includes('Sign Up') || text.includes('Waitlist') || text.includes('Closed') || 
                  text.includes('Full') || text.includes('Register')) {
                
                const cells = Array.from(row.querySelectorAll('td'));
                
                if (cells.length >= 2) {
                  // Extract course ID
                  let courseId = null;
                  
                  // From row ID
                  if (row.id && row.id.match(/\d{6}/)) {
                    courseId = row.id.match(/\d{6}/)[0];
                  }
                  
                  // From text (#354436 format)
                  const idMatch = text.match(/#(\d{6})/);
                  if (idMatch) courseId = idMatch[1];
                  
                  // From links
                  const links = row.querySelectorAll('a');
                  links.forEach(link => {
                    const href = link.href || '';
                    const courseIdMatch = href.match(/courseId=(\d+)/);
                    if (courseIdMatch) courseId = courseIdMatch[1];
                  });
                  
                  // Extract activity name (usually first cell)
                  let name = cells[0]?.textContent?.trim() || '';
                  
                  // Clean up the name
                  if (name.includes('#')) {
                    name = name.split('#')[0].trim();
                  }
                  
                  // Extract time
                  const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
                  const time = timeMatch ? timeMatch[1] : null;
                  
                  // Extract date
                  const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+(?:st|nd|rd|th)?)/i);
                  const date = dateMatch ? dateMatch[1] : null;
                  
                  // Extract location
                  let location = null;
                  cells.forEach(cell => {
                    const cellText = cell.textContent || '';
                    if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library/i) && 
                        !cellText.includes('Sign Up') && !cellText.includes('Register')) {
                      location = cellText.trim();
                    }
                  });
                  
                  // Extract price
                  const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
                  const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                  
                  // Extract age info
                  let ageInfo = null;
                  const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
                  if (ageMatch) {
                    ageInfo = `${ageMatch[1]}-${ageMatch[2]} yrs`;
                  } else {
                    const gradeMatch = text.match(/Grade[s]?\s*([\d-]+)/i);
                    if (gradeMatch) ageInfo = `Grade ${gradeMatch[1]}`;
                  }
                  
                  // Extract registration URL
                  let registrationUrl = null;
                  const regLink = row.querySelector('a[href*="BookMe4"], a[href*="courseId"], a[href*="Register"]');
                  if (regLink) {
                    registrationUrl = regLink.href;
                  }
                  
                  // Determine status
                  let status = 'open';
                  if (text.includes('Waitlist')) status = 'waitlist';
                  else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
                  
                  if (name && name !== '' && name.length > 3) {
                    activities.push({
                      id: courseId || `${categoryName}_row_${index}`,
                      category: categoryName,
                      name: name,
                      location: location,
                      date: date,
                      time: time,
                      ageInfo: ageInfo,
                      price: price,
                      registrationUrl: registrationUrl,
                      courseId: courseId,
                      status: status
                    });
                  }
                }
              }
            });
            
            // Strategy 2: Look for activity cards/divs if no table rows found
            if (activities.length === 0) {
              const activityContainers = Array.from(document.querySelectorAll('[class*="program"], [class*="activity"], [class*="course"]'));
              
              activityContainers.forEach((container, index) => {
                const text = container.textContent || '';
                
                if (text.includes('Sign Up') || text.includes('Register') || text.includes('More Info')) {
                  const heading = container.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
                  const name = heading?.textContent?.trim() || text.split('\n')[0].trim();
                  
                  const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
                  const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                  
                  const link = container.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                  const registrationUrl = link?.href || null;
                  
                  if (name && name.length > 3) {
                    activities.push({
                      id: `${categoryName}_container_${index}`,
                      category: categoryName,
                      name: name,
                      price: price,
                      registrationUrl: registrationUrl,
                      rawText: text.substring(0, 200)
                    });
                  }
                }
              });
            }
            
            return activities;
          }, program.text);

          console.log(`  ✅ Extracted ${pageActivities.length} activities`);
          this.activities.push(...pageActivities);
          
          // Check if there are date navigation links
          const dateLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
              .filter(link => {
                const text = link.textContent?.trim() || '';
                return text.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/i);
              })
              .map(link => ({
                text: link.textContent?.trim(),
                onclick: link.getAttribute('onclick') || ''
              }));
          });
          
          if (dateLinks.length > 0) {
            console.log(`  📅 Found ${dateLinks.length} date links`);
            
            // Process each date
            for (const dateLink of dateLinks) {
              console.log(`    📅 Processing date: ${dateLink.text}`);
              
              // Click the date link
              await page.evaluate((dateText) => {
                const links = Array.from(document.querySelectorAll('a'));
                const link = links.find(a => a.textContent?.trim() === dateText);
                if (link) link.click();
              }, dateLink.text);
              
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Click Show buttons on the date page
              await page.evaluate(() => {
                const showElements = Array.from(document.querySelectorAll('a, span, button')).filter(el => {
                  const text = el.textContent?.trim();
                  return text === 'Show' || text === 'Show All';
                });
                
                showElements.forEach(el => el.click());
              });
              
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Extract activities from this date
              const dateActivities = await page.evaluate((categoryName, dateText) => {
                const activities = [];
                const rows = Array.from(document.querySelectorAll('tr'));
                
                rows.forEach((row, index) => {
                  const text = row.textContent || '';
                  
                  if (text.includes('Sign Up') || text.includes('Waitlist') || text.includes('Closed')) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    
                    if (cells.length >= 2) {
                      let courseId = null;
                      
                      if (row.id && row.id.match(/\d{6}/)) {
                        courseId = row.id.match(/\d{6}/)[0];
                      }
                      
                      const idMatch = text.match(/#(\d{6})/);
                      if (idMatch) courseId = idMatch[1];
                      
                      const links = row.querySelectorAll('a');
                      links.forEach(link => {
                        const href = link.href || '';
                        const courseIdMatch = href.match(/courseId=(\d+)/);
                        if (courseIdMatch) courseId = courseIdMatch[1];
                      });
                      
                      let name = cells[0]?.textContent?.trim() || '';
                      if (name.includes('#')) {
                        name = name.split('#')[0].trim();
                      }
                      
                      const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
                      const time = timeMatch ? timeMatch[1] : null;
                      
                      let location = null;
                      cells.forEach(cell => {
                        const cellText = cell.textContent || '';
                        if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library/i) && 
                            !cellText.includes('Sign Up') && !cellText.includes('Register')) {
                          location = cellText.trim();
                        }
                      });
                      
                      const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
                      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
                      
                      let registrationUrl = null;
                      const regLink = row.querySelector('a[href*="BookMe4"], a[href*="courseId"]');
                      if (regLink) {
                        registrationUrl = regLink.href;
                      }
                      
                      let status = 'open';
                      if (text.includes('Waitlist')) status = 'waitlist';
                      else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
                      
                      if (name && name !== '' && name.length > 3) {
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
                          status: status
                        });
                      }
                    }
                  }
                });
                
                return activities;
              }, program.text, dateLink.text);
              
              console.log(`      ✅ Extracted ${dateActivities.length} activities`);
              this.activities.push(...dateActivities);
            }
          }
          
          // Navigate back to main page for next program
          await page.goto(widgetUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`  ❌ Error processing program ${program.text}:`, error.message);
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
          uniqueActivities.push(activity);
        }
      });
      
      console.log(`📊 Unique activities (by course ID): ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `nvrc_perfectmind_v2_${timestamp}.json`;
          
          const results = {
            timestamp: new Date().toISOString(),
            url: widgetUrl,
            programsProcessed: programs.length,
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

module.exports = NVRCPerfectMindV2;