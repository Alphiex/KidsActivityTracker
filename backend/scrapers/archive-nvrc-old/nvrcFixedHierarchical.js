const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCFixedHierarchical {
  constructor(options = {}) {
    this.options = options;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Fixed Hierarchical Scraper...');
      console.log('📝 This version is optimized for headless mode in cloud environments');
      
      const launchOptions = {
        headless: true,
        slowMo: 50, // Slow down actions for reliability
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
          '--window-size=1920,1080',
          // Additional args for better rendering
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--allow-running-insecure-content',
          '--disable-accelerated-2d-canvas',
          '--disable-accelerated-jpeg-decoding',
          '--disable-accelerated-mjpeg-decode',
          '--disable-accelerated-video-decode',
          '--disable-app-list-dismiss-on-blur',
          '--disable-canvas-aa',
          '--disable-composited-antialiasing',
          '--disable-gl-extensions',
          '--disable-gpu-sandbox',
          '--disable-histogram-customizer',
          '--disable-in-process-stack-traces',
          '--disable-site-isolation-trials'
        ],
        defaultViewport: null,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Set comprehensive user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Disable webdriver detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });

      // Navigate to NVRC find program page
      console.log('\n📍 Step 1: Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 120000
      });

      // Wait for initial content
      await page.waitForTimeout(5000);
      
      // Take screenshot for debugging
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        await page.screenshot({ path: 'nvrc-find-program.png', fullPage: true });
        console.log('📸 Screenshot saved: nvrc-find-program.png');
      }

      // Check if we need to handle cookie consent
      try {
        const cookieButton = await page.$('button[id*="cookie"], button[class*="cookie"], a[class*="accept"]');
        if (cookieButton) {
          await cookieButton.click();
          console.log('🍪 Accepted cookies');
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        // No cookie banner
      }

      // Look for the iframe or widget container
      console.log('\n📍 Step 2: Looking for program search widget...');
      
      // Check if there's an iframe with PerfectMind
      const hasIframe = await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        return iframes.some(iframe => 
          iframe.src && iframe.src.includes('perfectmind')
        );
      });

      if (hasIframe) {
        console.log('✅ Found PerfectMind iframe');
        
        // Get iframe URL
        const iframeUrl = await page.evaluate(() => {
          const iframe = Array.from(document.querySelectorAll('iframe'))
            .find(f => f.src && f.src.includes('perfectmind'));
          return iframe ? iframe.src : null;
        });
        
        if (iframeUrl) {
          console.log('📍 Navigating directly to iframe URL:', iframeUrl);
          await page.goto(iframeUrl, {
            waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
            timeout: 120000
          });
          await page.waitForTimeout(5000);
        }
      }

      // Now we should be on the PerfectMind page
      console.log('\n📍 Step 3: Interacting with program filters...');
      
      // Click on dropdowns to open them
      const dropdownSelectors = [
        'select[name*="program"], select[id*="program"]',
        'select[name*="category"], select[id*="category"]',
        'select[name*="location"], select[id*="location"]',
        'input[placeholder*="program"], input[placeholder*="search"]',
        'button[aria-label*="program"], button[aria-label*="category"]'
      ];

      for (const selector of dropdownSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            console.log(`✅ Clicked on ${selector}`);
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          // Continue with next selector
        }
      }

      // Alternative approach: Go directly to search results
      console.log('\n📍 Step 4: Navigating to all programs view...');
      
      // Build URL with all filters to show maximum activities
      const searchParams = new URLSearchParams({
        programs: 'all',
        activities: 'all',
        locations: 'all',
        days: 'all',
        times: 'all'
      });
      
      const allProgramsUrl = `https://www.nvrc.ca/programs-memberships/find-program/results?${searchParams}`;
      
      await page.goto(allProgramsUrl, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 120000
      });
      
      await page.waitForTimeout(10000); // Give it time to load all content
      
      console.log('\n📍 Step 5: Extracting activities...');
      
      // Extract all activities
      const activities = await page.evaluate(() => {
        const results = [];
        const processedTexts = new Set();
        
        // Look for any element that could contain activity data
        const allElements = Array.from(document.querySelectorAll('*'));
        
        allElements.forEach((element, index) => {
          const text = element.textContent || '';
          
          // Skip if too short or already processed
          if (text.length < 50 || text.length > 1000 || processedTexts.has(text)) return;
          
          // Look for activity patterns
          const hasPrice = text.includes('$');
          const hasTime = /\d{1,2}:\d{2}\s*[ap]\.?m\.?/i.test(text);
          const hasDate = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(text);
          const hasLocation = /(Centre|Center|Park|Arena|Pool|Gym|Studio|Library)/i.test(text);
          const hasAge = /(years|yrs|age|grade)/i.test(text);
          const hasRegistration = /(register|sign up|enroll|spots|waitlist)/i.test(text);
          
          // If it looks like an activity (has at least 3 indicators)
          let indicators = 0;
          if (hasPrice) indicators++;
          if (hasTime) indicators++;
          if (hasDate) indicators++;
          if (hasLocation) indicators++;
          if (hasAge) indicators++;
          if (hasRegistration) indicators++;
          
          if (indicators >= 3) {
            processedTexts.add(text);
            
            // Extract details
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            const name = lines[0] || 'Unknown Activity';
            
            const priceMatch = text.match(/\$([0-9,]+(?:\.\d{2})?)/);
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*-\s*\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
            const locationMatch = text.match(/(?:at\s+)?([^,\n]*(?:Centre|Center|Park|Arena|Pool|Gym|Studio|Library)[^,\n]*)/i);
            const ageMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
            const spotsMatch = text.match(/(\d+)\s+spots?\s+remaining/i);
            
            // Generate a unique ID
            const idBase = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
            const id = `NVRC_${idBase}_${index}`;
            
            results.push({
              id: id,
              name: name,
              price: priceMatch ? priceMatch[1] : null,
              times: timeMatch ? timeMatch[1] : null,
              location: locationMatch ? locationMatch[1].trim() : null,
              ageRange: ageMatch ? `${ageMatch[1]}-${ageMatch[2]} yrs` : null,
              spotsRemaining: spotsMatch ? spotsMatch[1] : null,
              dates: hasDate ? 'See schedule' : null,
              rawText: text.substring(0, 300)
            });
          }
        });
        
        return results;
      });
      
      console.log(`✅ Found ${activities.length} activities`);
      
      // If we didn't find many activities, try alternative extraction
      if (activities.length < 100) {
        console.log('\n📍 Trying alternative extraction method...');
        
        // Look specifically in iframes
        const iframeActivities = await page.evaluate(() => {
          const results = [];
          const iframes = Array.from(document.querySelectorAll('iframe'));
          
          iframes.forEach(iframe => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              const iframeElements = Array.from(iframeDoc.querySelectorAll('*'));
              
              iframeElements.forEach((element, index) => {
                const text = element.textContent || '';
                if (text.includes('$') && text.length > 50 && text.length < 500) {
                  const lines = text.split('\n').filter(l => l.trim());
                  results.push({
                    id: `IFRAME_${index}`,
                    name: lines[0] || 'Unknown',
                    source: 'iframe',
                    text: text.substring(0, 200)
                  });
                }
              });
            } catch (e) {
              // Cross-origin iframe, can't access
            }
          });
          
          return results;
        });
        
        console.log(`Found ${iframeActivities.length} additional activities in iframes`);
        activities.push(...iframeActivities);
      }
      
      // Remove duplicates based on name similarity
      const uniqueActivities = [];
      const seenNames = new Set();
      
      activities.forEach(activity => {
        const normalizedName = activity.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueActivities.push(activity);
        }
      });
      
      console.log(`\n✅ Total unique activities: ${uniqueActivities.length}`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_fixed_hierarchical_${timestamp}.json`;
      
      const results = {
        timestamp: new Date().toISOString(),
        url: page.url(),
        totalActivities: uniqueActivities.length,
        activities: uniqueActivities
      };
      
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to ${filename}`);
      
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

module.exports = NVRCFixedHierarchical;