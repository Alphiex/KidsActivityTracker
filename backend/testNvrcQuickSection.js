const NVRCPerfectMindScraper = require('./scrapers/nvrcDirectScraper.js');

async function testOneSection() {
  console.log('Starting NVRC scraper test for one section...');
  
  const scraper = new NVRCPerfectMindScraper({ 
    headless: true 
  });
  
  // Override the scrape method to only process one section
  const originalScrape = scraper.scrape.bind(scraper);
  
  scraper.scrape = async function() {
    let browser;
    let scrapeJob;
    
    try {
      console.log('🚀 Starting NVRC PerfectMind Direct Scraper (LIMITED TEST)...');
      
      // Get or create provider
      const provider = await this.prisma.provider.upsert({
        where: { name: 'NVRC' },
        update: {},
        create: {
          name: 'NVRC',
          website: 'https://www.nvrc.ca',
          isActive: true
        }
      });
      
      console.log(`📍 Provider: ${provider.name} (${provider.id})`);
      
      // Create scrape job
      scrapeJob = await this.prisma.scrapeJob.create({
        data: {
          providerId: provider.id,
          status: 'RUNNING',
          startedAt: new Date()
        }
      });
      
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
      console.log('\n📍 Navigating to NVRC PerfectMind widget...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });

      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // ONLY process "Early Years: On My Own" section for testing
      const targetSections = ['Early Years: On My Own'];
      
      console.log('\n📋 Processing only ONE section for testing:');
      console.log('  - Early Years: On My Own');

      // Find activity links in this section
      const sectionLinks = await page.evaluate((section) => {
        const links = [];
        const allElements = Array.from(document.querySelectorAll('*'));
        
        // Find the section header
        let sectionElement = null;
        for (const el of allElements) {
          if (el.textContent?.trim() === section) {
            sectionElement = el;
            break;
          }
        }
        
        if (!sectionElement) return links;
        
        // Find container with links
        let currentElement = sectionElement;
        let container = null;
        
        while (currentElement && !container) {
          const nextSibling = currentElement.nextElementSibling;
          if (nextSibling && nextSibling.querySelectorAll('a').length > 0) {
            container = nextSibling;
            break;
          }
          currentElement = currentElement.parentElement;
          if (currentElement && currentElement.nextElementSibling && 
              currentElement.nextElementSibling.querySelectorAll('a').length > 0) {
            container = currentElement.nextElementSibling;
            break;
          }
        }
        
        if (container) {
          const containerLinks = Array.from(container.querySelectorAll('a'));
          
          // Only get first 2 activity links for testing
          const activityLinks = containerLinks.filter(link => {
            const text = link.textContent?.trim() || '';
            return text.includes('(') && text.includes(')') && 
                   !text.includes('Drop-In') && 
                   !text.includes('Book') &&
                   text.length > 5;
          }).slice(0, 2); // LIMIT TO 2 ACTIVITIES
          
          activityLinks.forEach((link, idx) => {
            links.push({
              text: link.textContent?.trim(),
              element: containerLinks.indexOf(link)
            });
          });
        }
        
        return links;
      }, targetSections[0]);
      
      console.log(`\n📊 Found ${sectionLinks.length} activity links to process (limited to 2)`);
      
      // Process each activity link
      for (const linkInfo of sectionLinks) {
        console.log(`\n🔗 Clicking on: ${linkInfo.text}`);
        
        try {
          // Click the activity link
          const clicked = await page.evaluate((section, linkIndex) => {
            const allElements = Array.from(document.querySelectorAll('*'));
            let sectionElement = null;
            
            for (const el of allElements) {
              if (el.textContent?.trim() === section) {
                sectionElement = el;
                break;
              }
            }
            
            if (!sectionElement) return false;
            
            let currentElement = sectionElement;
            let container = null;
            
            while (currentElement && !container) {
              const nextSibling = currentElement.nextElementSibling;
              if (nextSibling && nextSibling.querySelectorAll('a').length > 0) {
                container = nextSibling;
                break;
              }
              currentElement = currentElement.parentElement;
              if (currentElement && currentElement.nextElementSibling && 
                  currentElement.nextElementSibling.querySelectorAll('a').length > 0) {
                container = currentElement.nextElementSibling;
                break;
              }
            }
            
            if (container) {
              const links = Array.from(container.querySelectorAll('a'));
              if (links[linkIndex]) {
                links[linkIndex].click();
                return true;
              }
            }
            
            return false;
          }, targetSections[0], linkInfo.element);
          
          if (clicked) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            await this.extractActivitiesFromSection(page, targetSections[0], linkInfo.text);
            await page.goto(widgetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
        } catch (error) {
          console.error(`❌ Error clicking ${linkInfo.text}:`, error.message);
        }
      }

      console.log(`\n✅ Total activities extracted: ${this.activities.length}`);
      
      // Save activities to database
      console.log('\n💾 Saving activities to database...');
      const stats = await this.saveActivitiesToDatabase(provider.id);
      
      // Update scrape job
      await this.prisma.scrapeJob.update({
        where: { id: scrapeJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          activitiesFound: this.activities.length,
          activitiesCreated: stats.created,
          activitiesUpdated: stats.updated,
          activitiesRemoved: stats.removed
        }
      });
      
      console.log(`\n✅ TEST COMPLETE!`);
      console.log(`   Total activities found: ${this.activities.length}`);
      console.log(`   Activities created: ${stats.created}`);
      console.log(`   Activities updated: ${stats.updated}`);
      console.log(`   Activities removed: ${stats.removed}`);
      
      // Show a sample activity
      if (this.activities.length > 0) {
        console.log('\n📄 Sample activity:');
        console.log(JSON.stringify(this.activities[0], null, 2));
      }
      
      return this.activities;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      
      if (scrapeJob) {
        await this.prisma.scrapeJob.update({
          where: { id: scrapeJob.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error.message,
            errorDetails: { stack: error.stack }
          }
        });
      }
      
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
      await this.prisma.$disconnect();
    }
  };
  
  try {
    await scraper.scrape();
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testOneSection();