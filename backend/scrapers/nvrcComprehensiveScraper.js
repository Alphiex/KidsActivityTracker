const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCComprehensiveScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.processedCategories = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Comprehensive Scraper...');
      console.log('🎯 Goal: Extract ALL 1700+ activities from NVRC');
      
      const launchOptions = {
        headless: this.options.headless !== undefined ? this.options.headless : true,
        slowMo: 20,
        args: this.options.args || [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to the PerfectMind widget
      const targetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      console.log('\n📍 Navigating to NVRC PerfectMind booking system...');
      
      await page.goto(targetUrl, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 120000
      });
      
      // Wait for page to fully render
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      console.log('📄 Page loaded successfully');
      
      // Get ALL program categories
      console.log('\n🔍 Finding all program categories...');
      
      const allCategories = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const categories = [];
        const seenTexts = new Set();
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          // Skip non-program links and duplicates
          if (text && 
              !seenTexts.has(text) &&
              !text.includes('Login') && 
              !text.includes('Reset') && 
              !text.includes('Skip') &&
              !text.includes('Show More') &&
              !text.includes('Advanced search') &&
              text.length > 3 &&
              text !== 'Register') {
            
            seenTexts.add(text);
            categories.push({
              text: text,
              href: href,
              isProgramCategory: text.includes('Years') || text.includes('Adult') || 
                               text.includes('Youth') || text.includes('Family') ||
                               text.includes('Schedule') || text.includes('Swimming') || 
                               text.includes('Arts') || text.includes('Sports') || 
                               text.includes('Fitness') || text.includes('Dance') ||
                               text.includes('Martial') || text.includes('Camp') ||
                               text.includes('Learn') || text.includes('School') ||
                               text.includes('Private') || text.includes('Birthday')
            });
          }
        });
        
        // Sort to prioritize program categories
        return categories.sort((a, b) => {
          if (a.isProgramCategory && !b.isProgramCategory) return -1;
          if (!a.isProgramCategory && b.isProgramCategory) return 1;
          return 0;
        });
      });
      
      console.log(`📊 Found ${allCategories.length} total links`);
      const programCategories = allCategories.filter(c => c.isProgramCategory);
      console.log(`📊 Found ${programCategories.length} program categories`);
      
      // Process each category
      const categoriesToProcess = programCategories.length > 0 ? programCategories : allCategories;
      console.log(`\n🎯 Processing ${categoriesToProcess.length} categories...`);
      
      for (let i = 0; i < categoriesToProcess.length; i++) {
        const category = categoriesToProcess[i];
        
        // Skip if already processed
        if (this.processedCategories.has(category.text)) {
          continue;
        }
        
        console.log(`\n📂 [${i + 1}/${categoriesToProcess.length}] Processing: ${category.text}`);
        this.processedCategories.add(category.text);
        
        try {
          // Click on the category
          const clicked = await page.evaluate((categoryText) => {
            const links = Array.from(document.querySelectorAll('a'));
            const link = links.find(a => a.textContent?.trim() === categoryText);
            if (link) {
              link.click();
              return true;
            }
            return false;
          }, category.text);
          
          if (!clicked) {
            console.log(`  ⚠️ Could not click on ${category.text}`);
            continue;
          }
          
          // Wait for content to load
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          // Look for and click "Show" buttons to expand content
          let showButtonsClicked = 0;
          let hasMoreShows = true;
          
          while (hasMoreShows && showButtonsClicked < 5) {
            const showClicked = await page.evaluate(() => {
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
            
            if (showClicked) {
              showButtonsClicked++;
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              hasMoreShows = false;
            }
          }
          
          // Extract activities from this category
          const categoryActivities = await this.extractActivitiesFromPage(page, category.text);
          console.log(`  ✅ Found ${categoryActivities.length} activities`);
          
          if (categoryActivities.length > 0) {
            this.activities.push(...categoryActivities);
          }
          
          // Check for date-based sub-navigation
          const dateLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
              .filter(link => {
                const text = link.textContent?.trim() || '';
                return text.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/i);
              })
              .map(link => link.textContent?.trim())
              .filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
          });
          
          if (dateLinks.length > 0) {
            console.log(`  📅 Found ${dateLinks.length} date links`);
            
            // Process first few dates
            for (let j = 0; j < Math.min(dateLinks.length, 3); j++) {
              const dateText = dateLinks[j];
              console.log(`    📅 Processing date: ${dateText}`);
              
              await page.evaluate((date) => {
                const links = Array.from(document.querySelectorAll('a'));
                const link = links.find(a => a.textContent?.trim() === date);
                if (link) link.click();
              }, dateText);
              
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const dateActivities = await this.extractActivitiesFromPage(page, `${category.text} - ${dateText}`);
              console.log(`      ✅ Found ${dateActivities.length} activities`);
              this.activities.push(...dateActivities);
            }
          }
          
          // Navigate back to main page
          await page.goto(targetUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Log progress
          const uniqueCount = new Set(this.activities.map(a => a.courseId || a.id)).size;
          console.log(`  📊 Total unique activities so far: ${uniqueCount}`);
          
          // If we've found enough activities, we can stop
          if (uniqueCount >= 1700) {
            console.log('\n🎉 Found 1700+ activities! Goal achieved!');
            break;
          }
          
        } catch (error) {
          console.error(`  ❌ Error processing category ${category.text}:`, error.message);
        }
      }
      
      // Deduplicate activities
      const uniqueActivities = this.deduplicateActivities();
      console.log(`\n✅ Scraping complete!`);
      console.log(`📊 Total activities found: ${this.activities.length}`);
      console.log(`📊 Unique activities: ${uniqueActivities.length}`);
      
      // Save results
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nvrc_comprehensive_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify({
          timestamp: new Date().toISOString(),
          url: targetUrl,
          categoriesProcessed: this.processedCategories.size,
          totalActivities: this.activities.length,
          uniqueActivities: uniqueActivities.length,
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

  async extractActivitiesFromPage(page, category) {
    return await page.evaluate((categoryName) => {
      const activities = [];
      const processedTexts = new Set();
      
      // Strategy 1: Look for table rows with activity data
      const rows = Array.from(document.querySelectorAll('tr'));
      
      rows.forEach((row, index) => {
        const text = row.textContent || '';
        
        if (!processedTexts.has(text) && 
            (text.includes('Sign Up') || text.includes('Waitlist') || 
             text.includes('Closed') || text.includes('Register') ||
             text.includes('$'))) {
          
          processedTexts.add(text);
          
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 2) {
            // Extract course ID
            let courseId = null;
            
            if (row.id && row.id.match(/\d{5,6}/)) {
              courseId = row.id;
            }
            
            const idMatch = text.match(/#(\d{5,6})/);
            if (idMatch) courseId = idMatch[1];
            
            const links = row.querySelectorAll('a');
            links.forEach(link => {
              const href = link.href || '';
              const courseIdMatch = href.match(/courseId=(\d+)/);
              if (courseIdMatch) courseId = courseIdMatch[1];
            });
            
            // Extract name (usually first cell)
            let name = cells[0]?.textContent?.trim() || '';
            name = name.replace(/#\d+/, '').trim();
            
            // Extract other details
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const time = timeMatch ? timeMatch[1] : null;
            
            const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+)/i);
            const date = dateMatch ? dateMatch[1] : null;
            
            let location = null;
            cells.forEach(cell => {
              const cellText = cell.textContent || '';
              if (cellText.match(/Centre|Center|Park|Arena|Pool|Field|Gym|Studio|Library|Community|Room/i) && 
                  !cellText.includes('Sign Up') && !cellText.includes('Register')) {
                location = cellText.trim();
              }
            });
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
            
            const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
            const ageInfo = ageMatch ? `${ageMatch[1]}-${ageMatch[2]} yrs` : null;
            
            let status = 'open';
            if (text.includes('Waitlist')) status = 'waitlist';
            else if (text.includes('Closed') || text.includes('Full')) status = 'closed';
            
            if (name && name.length > 3) {
              activities.push({
                id: courseId || `${categoryName}_row_${index}`,
                courseId: courseId,
                category: categoryName,
                name: name,
                location: location,
                date: date,
                time: time,
                ageInfo: ageInfo,
                price: price,
                status: status
              });
            }
          }
        }
      });
      
      // Strategy 2: Look for activity containers/divs
      if (activities.length === 0) {
        const containers = Array.from(document.querySelectorAll('div, section, article, li'));
        
        containers.forEach((container, index) => {
          const text = container.textContent || '';
          
          if (!processedTexts.has(text) && text.includes('$') && 
              (text.includes('Register') || text.includes('Sign Up') || text.includes('More Info'))) {
            
            processedTexts.add(text);
            
            const heading = container.querySelector('h1, h2, h3, h4, h5, h6, strong, b, a');
            const name = heading?.textContent?.trim() || text.split('\n')[0].trim();
            
            let courseId = null;
            if (container.id && container.id.match(/\d{5,6}/)) {
              courseId = container.id;
            }
            const idMatch = text.match(/#(\d{5,6})/);
            if (idMatch) courseId = idMatch[1];
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
            
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const time = timeMatch ? timeMatch[1] : null;
            
            if (name && name.length > 3 && price) {
              activities.push({
                id: courseId || `${categoryName}_container_${index}`,
                courseId: courseId,
                category: categoryName,
                name: name,
                time: time,
                price: price,
                status: 'open'
              });
            }
          }
        });
      }
      
      return activities;
    }, category);
  }

  deduplicateActivities() {
    const uniqueMap = new Map();
    
    this.activities.forEach(activity => {
      // Use courseId as primary key if available
      if (activity.courseId) {
        // If we already have this courseId, merge the information
        if (uniqueMap.has(activity.courseId)) {
          const existing = uniqueMap.get(activity.courseId);
          // Keep the most complete record
          if (!existing.location && activity.location) existing.location = activity.location;
          if (!existing.time && activity.time) existing.time = activity.time;
          if (!existing.date && activity.date) existing.date = activity.date;
          if (!existing.price && activity.price) existing.price = activity.price;
        } else {
          uniqueMap.set(activity.courseId, activity);
        }
      } else {
        // For activities without courseId, use combination of fields
        const key = `${activity.name}_${activity.time}_${activity.location}_${activity.price}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, activity);
        }
      }
    });
    
    return Array.from(uniqueMap.values());
  }
}

module.exports = NVRCComprehensiveScraper;