const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCDirectWidgetScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Direct Widget Scraper...');
      
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
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate directly to the PerfectMind widget URL
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating directly to NVRC PerfectMind widget...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });

      // Wait for content to load
      await page.waitForSelector('body', { timeout: 30000 });
      
      // Additional wait to ensure dynamic content loads
      console.log('⏳ Waiting for dynamic content to load...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Take a screenshot for debugging
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        await page.screenshot({ path: 'widget-loaded.png', fullPage: true });
        console.log('📸 Screenshot saved as widget-loaded.png');
      }

      // Strategy: Look for all links that might lead to activities
      console.log('\n🔍 Extracting all activity links...');
      
      const activityLinks = await page.evaluate(() => {
        const links = [];
        const processedHrefs = new Set();
        
        // Get all anchor tags
        const anchors = Array.from(document.querySelectorAll('a'));
        
        anchors.forEach(anchor => {
          const href = anchor.href || '';
          const text = anchor.textContent?.trim() || '';
          const onclick = anchor.getAttribute('onclick') || '';
          
          // Skip if we've already processed this href
          if (processedHrefs.has(href)) return;
          processedHrefs.add(href);
          
          // Look for links that might be programs/activities
          if (text && 
              !text.includes('Login') && 
              !text.includes('Reset') && 
              !text.includes('Skip') &&
              !text.includes('Show More') &&
              text.length > 3 &&
              (href.includes('BookMe4') || onclick.includes('BookMe4') || 
               text.includes('Years') || text.includes('Age') || 
               text.includes('Adult') || text.includes('Youth') ||
               text.includes('Register') || text.includes('Sign Up'))) {
            
            links.push({
              text: text,
              href: href,
              onclick: onclick
            });
          }
        });
        
        return links;
      });

      console.log(`Found ${activityLinks.length} potential activity links`);
      
      // Process each link
      for (let i = 0; i < Math.min(activityLinks.length, 50); i++) {
        const link = activityLinks[i];
        console.log(`\n📂 Processing link ${i + 1}/${Math.min(activityLinks.length, 50)}: ${link.text}`);
        
        try {
          // If it has onclick, execute it
          if (link.onclick && link.onclick.includes('BookMe4')) {
            await page.evaluate((onclick) => {
              eval(onclick);
            }, link.onclick);
          } else if (link.href && link.href !== 'javascript:;' && link.href !== '#') {
            // Navigate to the link
            await page.goto(link.href, {
              waitUntil: 'networkidle2',
              timeout: 60000
            });
          } else {
            // Try clicking the link
            const clicked = await page.evaluate((linkText) => {
              const links = Array.from(document.querySelectorAll('a'));
              const targetLink = links.find(a => a.textContent?.trim() === linkText);
              if (targetLink) {
                targetLink.click();
                return true;
              }
              return false;
            }, link.text);
            
            if (!clicked) continue;
          }
          
          // Wait for content to load
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Extract activities from the current page
          const pageActivities = await this.extractActivitiesFromCurrentPage(page, link.text);
          console.log(`  ✅ Found ${pageActivities.length} activities`);
          
          this.activities.push(...pageActivities);
          
          // Navigate back to the main widget
          if (page.url() !== widgetUrl) {
            await page.goto(widgetUrl, {
              waitUntil: 'networkidle2',
              timeout: 60000
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
        } catch (error) {
          console.error(`  ❌ Error processing link: ${error.message}`);
        }
      }

      // Remove duplicates
      const uniqueActivities = this.deduplicateActivities(this.activities);
      console.log(`\n✅ Total unique activities extracted: ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nvrc_widget_${timestamp}.json`;
        
        const results = {
          timestamp: new Date().toISOString(),
          url: widgetUrl,
          linksProcessed: Math.min(activityLinks.length, 50),
          totalActivities: this.activities.length,
          uniqueActivities: uniqueActivities.length,
          activities: uniqueActivities
        };
        
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
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

  async extractActivitiesFromCurrentPage(page, category) {
    return await page.evaluate((categoryName) => {
      const activities = [];
      
      // Look for any element that might contain activity information
      const potentialActivities = [];
      
      // Strategy 1: Find elements with course IDs
      const elementsWithIds = Array.from(document.querySelectorAll('*')).filter(el => 
        el.id && el.id.match(/^\d{5,6}$/)
      );
      potentialActivities.push(...elementsWithIds);
      
      // Strategy 2: Find table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      potentialActivities.push(...rows);
      
      // Strategy 3: Find divs/sections with activity-like content
      const containers = Array.from(document.querySelectorAll('div, section, article, li'));
      const activityContainers = containers.filter(el => {
        const text = el.textContent || '';
        return text.includes('$') || text.includes('Register') || text.includes('Sign Up');
      });
      potentialActivities.push(...activityContainers);
      
      // Process each potential activity
      const processedTexts = new Set();
      
      potentialActivities.forEach((element, index) => {
        const text = element.textContent || '';
        
        // Skip if we've already processed this text
        if (processedTexts.has(text) || text.length < 20) return;
        processedTexts.add(text);
        
        // Check if this looks like an activity
        if (text.includes('$') || text.includes('Register') || text.includes('Sign Up') || 
            text.includes('Waitlist') || text.includes('Closed')) {
          
          // Extract details
          let courseId = null;
          
          // From element ID
          if (element.id && element.id.match(/\d{5,6}/)) {
            courseId = element.id;
          }
          
          // From text (#354436 format)
          const idMatch = text.match(/#(\d{5,6})/);
          if (idMatch) courseId = idMatch[1];
          
          // From href
          const links = element.querySelectorAll('a');
          links.forEach(link => {
            const href = link.href || '';
            const courseIdMatch = href.match(/courseId=(\d+)/);
            if (courseIdMatch) courseId = courseIdMatch[1];
          });
          
          // Extract name
          const name = (() => {
            const heading = element.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
            if (heading) return heading.textContent?.trim();
            
            // For table rows, usually first cell
            const firstCell = element.querySelector('td');
            if (firstCell) return firstCell.textContent?.trim().replace(/#\d+/, '').trim();
            
            // Otherwise, first line of text
            const lines = text.split('\n').filter(l => l.trim());
            return lines[0]?.trim() || 'Unknown Activity';
          })();
          
          // Extract time
          const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
          const time = timeMatch ? timeMatch[1] : null;
          
          // Extract date
          const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+)/i);
          const date = dateMatch ? dateMatch[1] : null;
          
          // Extract location
          const locationMatch = text.match(/(?:at\s+)?([^,\n]*(?:Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library|Room)[^,\n]*)/i);
          const location = locationMatch ? locationMatch[1].trim() : null;
          
          // Extract price
          const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
          const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
          
          // Extract age info
          const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
          const ageInfo = ageMatch ? `${ageMatch[1]}-${ageMatch[2]} yrs` : null;
          
          // Determine status
          let status = 'open';
          if (text.includes('Waitlist')) status = 'waitlist';
          else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
          
          // Extract registration URL
          const regLink = element.querySelector('a[href*="BookMe4"], a[href*="courseId"], a[href*="register"]');
          const registrationUrl = regLink?.href || null;
          
          // Only add if we have meaningful data
          if (name && name !== 'Unknown Activity' && name.length > 3 && 
              (courseId || price || time || date || location)) {
            activities.push({
              id: courseId || `${categoryName}_${index}`,
              courseId: courseId,
              category: categoryName,
              name: name,
              location: location,
              date: date,
              time: time,
              ageInfo: ageInfo,
              price: price,
              status: status,
              registrationUrl: registrationUrl
            });
          }
        }
      });
      
      return activities;
    }, category);
  }

  deduplicateActivities(activities) {
    const uniqueMap = new Map();
    
    activities.forEach(activity => {
      // Use courseId as primary key if available
      if (activity.courseId) {
        uniqueMap.set(activity.courseId, activity);
      } else {
        // Otherwise use combination of name, time, location
        const key = `${activity.name}_${activity.time}_${activity.location}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, activity);
        }
      }
    });
    
    return Array.from(uniqueMap.values());
  }
}

module.exports = NVRCDirectWidgetScraper;