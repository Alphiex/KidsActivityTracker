const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCCloudDebugScraper {
  constructor(options = {}) {
    this.options = options;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Cloud Debug Scraper...');
      console.log('Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
        isProduction: !!process.env.PUPPETEER_EXECUTABLE_PATH
      });
      
      // Use headless mode for production/cloud environments
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
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled'
        ],
        defaultViewport: { width: 1920, height: 1080 },
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
      
      // Log network failures
      page.on('requestfailed', request => {
        console.log('Request failed:', request.url(), request.failure().errorText);
      });
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set extra HTTP headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

      // Navigate to the find program page
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 120000
      });

      // Check if the form loaded
      const hasForm = await page.evaluate(() => {
        const form = document.querySelector('form');
        return {
          hasForm: !!form,
          formId: form?.id,
          formAction: form?.action,
          bodyClasses: document.body.className
        };
      });
      
      console.log('Form check:', hasForm);
      
      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // STEP 1: Select kids age groups
      console.log('\n📋 STEP 1: Selecting kids age groups...');
      
      const ageGroups = [
        '0 - 6 years, Parent Participation',
        '0 - 6 years, On My Own',
        '5 - 13 years, School Age',
        '10 - 18 years, Youth'
      ];
      
      for (const ageGroup of ageGroups) {
        const selected = await page.evaluate((age) => {
          const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            .find(cb => {
              const label = cb.parentElement?.textContent || '';
              return label.includes(age);
            });
          
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return true;
          }
          return false;
        }, ageGroup);
        
        if (selected) {
          console.log(`  ✓ Selected: ${ageGroup}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Wait for Step 2 to load with more debugging
      console.log('\n⏳ Waiting for Step 2 program activities to appear...');
      
      // Try multiple waiting strategies
      try {
        await page.waitForFunction(() => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            .filter(cb => {
              const label = cb.parentElement?.textContent || '';
              return label.match(/(Swim|Camp|Sport|Art|Dance|Music|Gym|Climb|Martial|Cooking|Yoga|Tennis|Basketball|Soccer)/i) &&
                     !label.includes('years');
            });
          console.log(`Found ${checkboxes.length} activity checkboxes`);
          return checkboxes.length > 10;
        }, { timeout: 90000, polling: 2000 });
      } catch (e) {
        console.log('⚠️  Timeout waiting for activities. Checking what we have...');
        
        const pageState = await page.evaluate(() => {
          return {
            checkboxCount: document.querySelectorAll('input[type="checkbox"]').length,
            labels: Array.from(document.querySelectorAll('label')).map(l => l.textContent?.trim()).filter(t => t).slice(0, 20),
            hasFieldsets: document.querySelectorAll('fieldset').length,
            formSections: document.querySelectorAll('.form-type-checkboxes').length
          };
        });
        
        console.log('Page state:', pageState);
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 2: Select ALL activities
      console.log('\n🎯 STEP 2: Selecting ALL program activities...');
      
      const selectedActivities = await page.evaluate(() => {
        const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const activities = [];
        let totalSelected = 0;
        
        const activityKeywords = [
          'Swim', 'Camp', 'Sport', 'Art', 'Dance', 'Music', 'Gym', 'Climb', 
          'Martial', 'Cooking', 'Yoga', 'Tennis', 'Basketball', 'Soccer',
          'Fitness', 'Spin', 'Strength', 'Cardio', 'Aquatic', 'Leadership',
          'Certification', 'Early Years', 'Night Out', 'Learn', 'Play',
          'Skating', 'Multisport', 'Racquet', 'Team', 'Visual', 'Pottery',
          'Movement', 'Badminton', 'Pickleball', 'Squash', 'Table Tennis',
          'Volleyball', 'Guitar', 'Ukulele', 'Drawing', 'Painting', 'Mixed Media'
        ];
        
        allCheckboxes.forEach(cb => {
          const label = cb.parentElement?.textContent?.trim() || '';
          
          const isActivity = activityKeywords.some(keyword => 
            label.includes(keyword) && 
            !label.includes('years') && 
            !label.includes('Age') &&
            !label.includes('Parent Participation')
          );
          
          if (isActivity && !cb.checked) {
            cb.click();
            activities.push(label);
            totalSelected++;
            console.log(`Selected activity: ${label}`);
          }
        });
        
        return { activities, totalSelected };
      });
      
      console.log(`  ✅ Selected ${selectedActivities.totalSelected} activities`);
      
      await new Promise(resolve => setTimeout(resolve, 5000));

      // STEP 3: Select all locations
      console.log('\n⏳ Waiting for Step 3 locations to appear...');
      
      await page.waitForFunction(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const selectAllOption = labels.find(label => {
          const text = label.textContent || '';
          return text.includes('Select all locations') || 
                 text.includes('all locations available') ||
                 text.includes('All locations');
        });
        
        const locationCheckboxes = labels.filter(label => {
          const text = label.textContent || '';
          return text.includes('Centre') || 
                 text.includes('Park') || 
                 text.includes('Arena') ||
                 text.includes('Pool');
        });
        
        console.log(`Found ${labels.length} labels, ${locationCheckboxes.length} location labels`);
        
        return selectAllOption || locationCheckboxes.length > 5;
      }, { timeout: 120000, polling: 3000 });
      
      console.log('\n📍 STEP 3: Selecting all locations...');
      
      const locationSelected = await page.evaluate(() => {
        const selectAllLabel = Array.from(document.querySelectorAll('label'))
          .find(label => {
            const text = label.textContent || '';
            return text.includes('Select all locations') || 
                   text.includes('all locations available') ||
                   text.includes('All locations');
          });
        
        if (selectAllLabel) {
          const checkbox = selectAllLabel.querySelector('input[type="checkbox"]') ||
                          selectAllLabel.previousElementSibling;
          
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            console.log('Clicked "Select all locations" checkbox');
            return { method: 'select-all', count: 1 };
          }
        }
        
        // Select individual locations if no "select all"
        const locationLabels = Array.from(document.querySelectorAll('label'))
          .filter(label => {
            const text = label.textContent || '';
            return (text.includes('Centre') || 
                    text.includes('Park') || 
                    text.includes('Arena') ||
                    text.includes('Pool')) &&
                   !text.includes('years') &&
                   !text.includes('Select all');
          });
        
        let selectedCount = 0;
        locationLabels.forEach(label => {
          const checkbox = label.querySelector('input[type="checkbox"]') ||
                          label.previousElementSibling;
          
          if (checkbox && checkbox.type === 'checkbox' && !checkbox.checked) {
            checkbox.click();
            selectedCount++;
          }
        });
        
        return { method: 'individual', count: selectedCount };
      });
      
      console.log(`  ✅ Location selection: ${locationSelected.method} method, ${locationSelected.count} locations`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Find and click the "Show Results" button
      console.log('\n🔍 Looking for "Show Results" button...');
      
      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('input[type="submit"], button'))
          .find(btn => {
            const text = btn.value || btn.textContent || '';
            return text.includes('Show Results');
          });
        
        if (button) {
          console.log('Clicking Show Results button');
          button.click();
        }
      });

      // Wait for navigation with multiple strategies
      console.log('\n⏳ Waiting for results to load...');
      
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
          page.waitForSelector('.nvrc-activities-category', { timeout: 30000 }),
          new Promise(resolve => setTimeout(resolve, 30000))
        ]);
      } catch (e) {
        console.log('Navigation timeout, checking current state...');
      }
      
      // Extra wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const currentUrl = await page.url();
      console.log('\n📍 Current URL:', currentUrl);
      
      // Debug the results page
      const pageDebug = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyClasses: document.body.className,
          hasCategories: document.querySelectorAll('.nvrc-activities-category').length,
          hasServices: document.querySelectorAll('.nvrc-activities-service').length,
          hasEvents: document.querySelectorAll('.nvrc-activities-events__row').length,
          // Check for alternative selectors
          altCategories: document.querySelectorAll('[class*="activities-category"]').length,
          altServices: document.querySelectorAll('[class*="activities-service"]').length,
          altEvents: document.querySelectorAll('[class*="events-row"]').length,
          // Check for iframes
          iframes: document.querySelectorAll('iframe').length,
          // First 500 chars of body HTML
          bodySnippet: document.body.innerHTML.substring(0, 500)
        };
      });
      
      console.log('\n🔍 Results page debug:', pageDebug);

      // Try alternative extraction if main selectors don't work
      console.log('\n🔍 Attempting activity extraction...');
      
      const activities = await page.evaluate(() => {
        const allActivities = [];
        
        // Try primary selectors
        let categorySections = document.querySelectorAll('.nvrc-activities-category');
        
        // If no categories found, try alternative selectors
        if (categorySections.length === 0) {
          console.log('No categories found with primary selector, trying alternatives...');
          categorySections = document.querySelectorAll('[class*="activities-category"]');
        }
        
        console.log(`Found ${categorySections.length} activity categories`);
        
        if (categorySections.length === 0) {
          // Try to find any activity-like content
          const possibleActivities = Array.from(document.querySelectorAll('a[href*="BookMe4"]'));
          console.log(`Found ${possibleActivities.length} possible activity links`);
          
          possibleActivities.forEach(link => {
            const row = link.closest('tr') || link.closest('div');
            if (row) {
              allActivities.push({
                id: `NVRC_${Date.now()}_${Math.random()}`,
                name: link.textContent?.trim() || 'Unknown Activity',
                category: 'Unknown',
                registrationUrl: link.href,
                provider: 'NVRC',
                scrapedAt: new Date().toISOString()
              });
            }
          });
        } else {
          // Normal extraction logic
          categorySections.forEach(categorySection => {
            const categoryName = categorySection.querySelector('.activities-category__title')?.textContent?.trim() || 
                               categorySection.querySelector('[class*="category__title"]')?.textContent?.trim() || 
                               'Unknown';
            
            const serviceGroups = categorySection.querySelectorAll('.nvrc-activities-service, [class*="activities-service"]');
            
            serviceGroups.forEach(serviceGroup => {
              const serviceName = serviceGroup.querySelector('.activities-service__title, [class*="service__title"]')?.textContent?.trim() || 'Unknown Service';
              
              const eventRows = serviceGroup.querySelectorAll('.nvrc-activities-events__row, [class*="events__row"], [class*="events-row"]');
              
              eventRows.forEach(row => {
                try {
                  const name = row.querySelector('a')?.textContent?.trim() || serviceName;
                  const registrationUrl = row.querySelector('a[href*="BookMe4"]')?.href || '';
                  
                  allActivities.push({
                    id: `NVRC_${categoryName}_${serviceName}_${name}_${Date.now()}`.replace(/\s+/g, '_'),
                    name,
                    category: categoryName,
                    subcategory: serviceName,
                    registrationUrl,
                    provider: 'NVRC',
                    scrapedAt: new Date().toISOString()
                  });
                } catch (error) {
                  console.error('Error extracting activity:', error);
                }
              });
            });
          });
        }
        
        console.log(`Total activities extracted: ${allActivities.length}`);
        return allActivities;
      });

      console.log(`\n✅ Extracted ${activities.length} activities`);
      
      // If we still have 0 activities, try one more strategy
      if (activities.length === 0) {
        console.log('\n🔍 No activities found, trying iframe check...');
        
        const hasIframe = await page.evaluate(() => {
          const iframes = document.querySelectorAll('iframe');
          return {
            count: iframes.length,
            srcs: Array.from(iframes).map(f => f.src).slice(0, 5)
          };
        });
        
        console.log('Iframe check:', hasIframe);
        
        if (hasIframe.count > 0) {
          // Try to access iframe content
          for (let i = 0; i < hasIframe.count; i++) {
            try {
              const frameHandle = await page.frames()[i + 1]; // +1 because [0] is main frame
              if (frameHandle) {
                const frameActivities = await frameHandle.evaluate(() => {
                  return Array.from(document.querySelectorAll('a[href*="BookMe4"]')).map(a => ({
                    name: a.textContent?.trim(),
                    url: a.href
                  }));
                });
                console.log(`Frame ${i} activities:`, frameActivities.length);
              }
            } catch (e) {
              console.log(`Could not access frame ${i}:`, e.message);
            }
          }
        }
      }
      
      return activities;
      
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

module.exports = NVRCCloudDebugScraper;