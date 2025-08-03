const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCNetworkScraper {
  constructor() {
    this.apiCalls = [];
    this.activities = [];
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Network Analysis Scraper...');
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null,
        devtools: true // Enable DevTools for debugging
      });

      const page = await browser.newPage();
      
      // Enable request interception to capture network traffic
      await page.setRequestInterception(true);
      
      // Track all network requests
      page.on('request', (request) => {
        const url = request.url();
        const resourceType = request.resourceType();
        
        // Log API calls and data requests
        if (url.includes('api') || 
            url.includes('activities') || 
            url.includes('programs') ||
            url.includes('courses') ||
            url.includes('search') ||
            url.includes('activecommunities') ||
            resourceType === 'xhr' || 
            resourceType === 'fetch') {
          
          const apiCall = {
            url: url,
            method: request.method(),
            resourceType: resourceType,
            headers: request.headers(),
            postData: request.postData(),
            timestamp: new Date().toISOString()
          };
          
          this.apiCalls.push(apiCall);
          console.log(`📡 API Call: ${request.method()} ${url.substring(0, 100)}...`);
        }
        
        request.continue();
      });
      
      // Track responses
      page.on('response', async (response) => {
        const url = response.url();
        
        // Capture responses from potential activity data endpoints
        if ((url.includes('api') || 
             url.includes('activities') || 
             url.includes('programs') ||
             url.includes('courses') ||
             url.includes('search') ||
             url.includes('activecommunities')) &&
            response.ok()) {
          
          try {
            const contentType = response.headers()['content-type'] || '';
            
            if (contentType.includes('json')) {
              const json = await response.json();
              console.log(`📥 JSON Response from ${url.substring(0, 60)}...`);
              console.log(`   Data preview:`, JSON.stringify(json).substring(0, 200));
              
              // Save interesting responses
              if (JSON.stringify(json).length > 100) {
                const filename = `api_response_${Date.now()}.json`;
                fs.writeFileSync(filename, JSON.stringify({
                  url: url,
                  data: json,
                  timestamp: new Date().toISOString()
                }, null, 2));
              }
            }
          } catch (e) {
            // Not JSON or couldn't parse
          }
        }
      });
      
      // Enable console logging
      page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('JQMIGRATE') && !text.includes('Slow network')) {
          console.log('🖥️ PAGE:', text);
        }
      });
      
      // Navigate to the find program page
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Wait for initial page load
      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Fill out the form
      console.log('\n📋 Filling out search form...');
      
      // Step 1: Select age groups
      const ageGroups = [
        '0 - 6 years, Parent Participation',
        '0 - 6 years, On My Own',
        '5 - 13 years, School Age',
        '10 - 18 years, Youth'
      ];
      
      for (const ageGroup of ageGroups) {
        await page.evaluate((text) => {
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(l => l.textContent.includes(text));
          if (label) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
            }
          }
        }, ageGroup);
      }
      
      console.log('⏳ Waiting for activities to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 2: Select all activities
      await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        checkboxes.forEach(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          if (label) {
            const text = label.textContent || '';
            if (!text.includes('years') && 
                !text.includes('Select all locations') &&
                text.trim() !== '' &&
                !cb.checked) {
              const parent = cb.closest('.form-item, .form-checkboxes, fieldset');
              if (parent && !parent.textContent.includes('Step 1') && 
                  !parent.textContent.includes('Step 3')) {
                cb.click();
              }
            }
          }
        });
      });
      
      console.log('⏳ Waiting for locations to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 3: Select all locations
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          const text = label.textContent || '';
          if (text.toLowerCase().includes('select all locations available')) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              break;
            }
          }
        }
      });
      
      // Log API calls before submitting
      console.log(`\n📊 API calls captured so far: ${this.apiCalls.length}`);
      
      // Submit the form
      console.log('\n🔍 Submitting search form...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResults = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.toLowerCase().includes('show results');
        });
        if (showResults) {
          showResults.click();
        }
      });

      // Wait for navigation and capture network traffic
      console.log('\n⏳ Waiting for results and monitoring network traffic...');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      
      // Give extra time for all network requests to complete
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Analyze captured API calls
      console.log(`\n📊 Total API calls captured: ${this.apiCalls.length}`);
      
      // Save all API calls for analysis
      fs.writeFileSync('nvrc_api_calls.json', JSON.stringify(this.apiCalls, null, 2));
      console.log('💾 API calls saved to nvrc_api_calls.json');
      
      // Group API calls by domain
      const apiDomains = {};
      this.apiCalls.forEach(call => {
        const url = new URL(call.url);
        const domain = url.hostname;
        if (!apiDomains[domain]) {
          apiDomains[domain] = [];
        }
        apiDomains[domain].push(call);
      });
      
      console.log('\n📊 API calls by domain:');
      Object.entries(apiDomains).forEach(([domain, calls]) => {
        console.log(`  ${domain}: ${calls.length} calls`);
      });
      
      // Try to extract activities from the page
      console.log('\n🔍 Attempting to extract activities from page...');
      
      // Check for iframes
      const frames = page.frames();
      console.log(`Found ${frames.length} frames on the page`);
      
      for (const frame of frames) {
        const frameUrl = frame.url();
        console.log(`  Frame: ${frameUrl}`);
        
        if (frameUrl.includes('activecommunities')) {
          console.log('✅ Found ActiveCommunities iframe!');
          
          // Wait for iframe content
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Try to extract from iframe
          try {
            const iframeData = await frame.evaluate(() => {
              return {
                url: window.location.href,
                title: document.title,
                hasActivities: document.body.innerText.includes('Swimming') || 
                              document.body.innerText.includes('Camps'),
                courseRows: document.body.innerText.match(/courseRows:\s*(\d+)/)?.[1],
                bodyPreview: document.body.innerText.substring(0, 500)
              };
            });
            
            console.log('Iframe data:', iframeData);
            
            // Try to click on category bars
            const categoryClicked = await frame.evaluate(() => {
              const categoryBars = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
              if (categoryBars.length > 0) {
                categoryBars[0].click();
                return true;
              }
              return false;
            });
            
            if (categoryClicked) {
              console.log('✅ Clicked category bar in iframe');
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Monitor network traffic after clicking
              console.log(`API calls after category click: ${this.apiCalls.length}`);
            }
            
          } catch (e) {
            console.error('Error working with iframe:', e.message);
          }
        }
      }
      
      // Take final screenshot
      await page.screenshot({ 
        path: 'nvrc_network_scraper_final.png', 
        fullPage: true 
      });
      
      // Save final state
      const results = {
        timestamp: new Date().toISOString(),
        apiCallsCount: this.apiCalls.length,
        apiDomains: Object.keys(apiDomains),
        activities: this.activities,
        apiCalls: this.apiCalls
      };
      
      fs.writeFileSync('nvrc_network_analysis.json', JSON.stringify(results, null, 2));
      console.log('💾 Network analysis saved to nvrc_network_analysis.json');
      
      return results;
      
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

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCNetworkScraper();
  scraper.scrape()
    .then(results => {
      console.log('\n✅ Network analysis complete!');
      console.log(`Total API calls captured: ${results.apiCallsCount}`);
      console.log(`API domains found: ${results.apiDomains.join(', ')}`);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCNetworkScraper;