const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCTargetedScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedUrls = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Targeted Scraper...');
      console.log('📝 This scraper targets the exact flow shown in the screenshots');
      
      const launchOptions = {
        headless: this.options.headless !== undefined ? this.options.headless : true,
        slowMo: 50, // Slow down to ensure page loads
        args: this.options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // Important for containers
          '--disable-extensions',
          '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Set user agent to match desktop Chrome
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Enable request interception to log network activity
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('perfectmind')) {
          console.log('🌐 Request:', request.method(), request.url().substring(0, 100));
        }
        request.continue();
      });

      // Navigate to the exact URL from the screenshot
      const targetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind booking system...');
      
      const response = await page.goto(targetUrl, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 120000
      });
      
      console.log('📄 Page loaded with status:', response.status());
      console.log('📄 Page URL:', page.url());
      
      // Wait for the page to fully render
      console.log('⏳ Waiting for page to fully render...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check if we're on the right page
      const pageTitle = await page.title();
      console.log('📄 Page title:', pageTitle);
      
      // Take screenshot for debugging
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        await page.screenshot({ path: 'targeted-initial.png', fullPage: true });
        console.log('📸 Screenshot saved as targeted-initial.png');
      }
      
      // Look for the main content area
      const hasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return {
          hasPrograms: bodyText.includes('Programs') || bodyText.includes('All Programs'),
          hasYouth: bodyText.includes('Youth'),
          hasAdult: bodyText.includes('Adult'),
          hasFamily: bodyText.includes('Family'),
          hasSchedules: bodyText.includes('Schedule'),
          bodyLength: bodyText.length,
          linkCount: document.querySelectorAll('a').length,
          firstFewLinks: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => a.textContent?.trim() || '')
        };
      });
      
      console.log('📊 Page content check:', hasContent);
      
      // Strategy 1: Look for activity listings in the main content
      console.log('\n🔍 Looking for activity listings...');
      
      const activities = await page.evaluate(() => {
        const results = [];
        const processedTexts = new Set();
        
        // Look for any container that might have activity information
        const allElements = Array.from(document.querySelectorAll('*'));
        
        allElements.forEach((element, index) => {
          const text = element.textContent || '';
          
          // Skip if already processed or too short
          if (processedTexts.has(text) || text.length < 50) return;
          
          // Check if this element contains activity indicators
          const hasPrice = text.includes('$');
          const hasTime = text.match(/\d{1,2}:\d{2}\s*[ap]\.?m\.?/i);
          const hasRegister = text.includes('Register') || text.includes('Sign Up');
          const hasCourseId = text.match(/#\d{5,6}/);
          
          if ((hasPrice || hasTime) && (hasRegister || hasCourseId)) {
            processedTexts.add(text);
            
            // Extract course ID
            let courseId = null;
            if (element.id && element.id.match(/^\d{5,6}$/)) {
              courseId = element.id;
            }
            const idMatch = text.match(/#(\d{5,6})/);
            if (idMatch) courseId = idMatch[1];
            
            // Extract activity name
            let name = 'Unknown Activity';
            const heading = element.querySelector('h1, h2, h3, h4, h5, h6, strong, b, a');
            if (heading) {
              name = heading.textContent?.trim() || name;
            } else {
              const lines = text.split('\n').filter(l => l.trim());
              if (lines.length > 0) {
                name = lines[0].trim();
                // Remove course ID from name
                name = name.replace(/#\d+/, '').trim();
              }
            }
            
            // Extract other details
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const time = timeMatch ? timeMatch[1] : null;
            
            const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+)/i);
            const date = dateMatch ? dateMatch[1] : null;
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
            
            const locationMatch = text.match(/(?:at\s+)?([^,\n]*(?:Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library|Community)[^,\n]*)/i);
            const location = locationMatch ? locationMatch[1].trim() : null;
            
            results.push({
              id: courseId || `activity_${index}`,
              courseId: courseId,
              name: name,
              time: time,
              date: date,
              price: price,
              location: location,
              rawText: text.substring(0, 200)
            });
          }
        });
        
        return results;
      });
      
      console.log(`✅ Found ${activities.length} activities on the page`);
      
      // Strategy 2: Click on program categories if we didn't find many activities
      if (activities.length < 100) {
        console.log('\n🔍 Looking for program categories to click...');
        
        const programLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links
            .filter(link => {
              const text = link.textContent?.trim() || '';
              return (text.includes('Years') || text.includes('Adult') || 
                     text.includes('Youth') || text.includes('Family') ||
                     text.includes('Swimming') || text.includes('Arts') ||
                     text.includes('Sports') || text.includes('Fitness')) &&
                     !text.includes('Login') && !text.includes('Reset');
            })
            .map(link => link.textContent?.trim())
            .filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
        });
        
        console.log(`Found ${programLinks.length} program categories:`, programLinks.slice(0, 10));
        
        // Process first few categories
        for (let i = 0; i < Math.min(programLinks.length, 5); i++) {
          const programName = programLinks[i];
          console.log(`\n📂 Clicking on category: ${programName}`);
          
          try {
            // Click the category
            await page.evaluate((name) => {
              const links = Array.from(document.querySelectorAll('a'));
              const link = links.find(a => a.textContent?.trim() === name);
              if (link) link.click();
            }, programName);
            
            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Extract activities from this category
            const categoryActivities = await page.evaluate((category) => {
              const results = [];
              const containers = Array.from(document.querySelectorAll('tr, div, section, article'));
              
              containers.forEach((container, index) => {
                const text = container.textContent || '';
                
                if (text.includes('$') || text.includes('Register') || text.includes('Sign Up')) {
                  // Extract details similar to above
                  let courseId = null;
                  const idMatch = text.match(/#(\d{5,6})/);
                  if (idMatch) courseId = idMatch[1];
                  
                  const lines = text.split('\n').filter(l => l.trim());
                  const name = lines[0]?.trim().replace(/#\d+/, '').trim() || 'Unknown';
                  
                  const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
                  const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
                  
                  if (name && name !== 'Unknown' && (courseId || priceMatch)) {
                    results.push({
                      id: courseId || `${category}_${index}`,
                      courseId: courseId,
                      category: category,
                      name: name,
                      time: timeMatch ? timeMatch[1] : null,
                      price: priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null
                    });
                  }
                }
              });
              
              return results;
            }, programName);
            
            console.log(`  ✅ Found ${categoryActivities.length} activities in ${programName}`);
            activities.push(...categoryActivities);
            
            // Go back to main page
            await page.goto(targetUrl, {
              waitUntil: 'networkidle0',
              timeout: 60000
            });
            await new Promise(resolve => setTimeout(resolve, 5000));
            
          } catch (error) {
            console.error(`  ❌ Error processing category: ${error.message}`);
          }
        }
      }
      
      // Remove duplicates based on courseId
      const uniqueActivities = [];
      const seenIds = new Set();
      
      activities.forEach(activity => {
        const key = activity.courseId || `${activity.name}_${activity.time}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          uniqueActivities.push(activity);
        }
      });
      
      console.log(`\n✅ Total unique activities found: ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nvrc_targeted_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify({
          timestamp: new Date().toISOString(),
          url: targetUrl,
          totalActivities: uniqueActivities.length,
          activities: uniqueActivities
        }, null, 2));
        
        console.log(`💾 Results saved to ${filename}`);
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

module.exports = NVRCTargetedScraper;