const puppeteer = require('puppeteer');

class NVRCDirectScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Launching Puppeteer browser for direct scraping...');
      browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        defaultViewport: { width: 1440, height: 900 }
      });

      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Build the direct search URL with parameters
      const searchParams = new URLSearchParams({
        'programs': '0 - 6 years, Parent Participation,0 - 6 years, On My Own,6 - 13 years, School Age,13 - 18 years, Youth',
        'activities': 'Aquatic Leadership,Arts & Culture - Dance,Arts & Culture - Music,Arts & Culture - Visual Arts,Camps,Learn and Play,Martial Arts,Swimming',
        'locations': 'all'
      });
      
      const searchUrl = `https://www.nvrc.ca/programs-memberships/find-program/search-results?${searchParams.toString()}`;
      
      console.log('📍 Navigating directly to search results...');
      console.log('URL:', searchUrl);
      
      try {
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } catch (navError) {
        console.log('⚠️ Navigation timeout, continuing anyway...');
      }

      // Wait for results to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot
      await page.screenshot({ path: 'nvrc-direct-results.png' });
      
      // Save HTML for debugging
      const pageContent = await page.content();
      const fs = require('fs');
      fs.writeFileSync('nvrc-direct-results.html', pageContent);
      console.log('💾 Saved page HTML to nvrc-direct-results.html');

      // Extract programs from the results
      console.log('\n📊 Extracting program data...');
      
      const programs = await page.evaluate(() => {
        const camps = [];
        
        // Look for panels with results
        const panels = document.querySelectorAll('.panel.panel-primary, .panel-default');
        
        panels.forEach((panel, panelIndex) => {
          try {
            // Get panel heading/title
            const heading = panel.querySelector('.panel-heading, .panel-title, h3, h4');
            const activityName = heading ? heading.textContent.trim() : '';
            
            // Check if panel is expanded, if not, click to expand
            const collapseToggle = panel.querySelector('a[data-toggle="collapse"]');
            if (collapseToggle && collapseToggle.getAttribute('aria-expanded') === 'false') {
              collapseToggle.click();
            }
            
            // Find the table with course details
            const table = panel.querySelector('table');
            if (!table) return;
            
            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach((row, rowIndex) => {
              const cells = row.querySelectorAll('td');
              if (cells.length < 4) return;
              
              const camp = {
                id: `nvrc-${panelIndex}-${rowIndex}`,
                name: activityName,
                provider: 'NVRC',
                description: '',
                location: { name: '', address: '' },
                cost: 0,
                dateRange: { start: '', end: '' },
                schedule: { days: [], startTime: '', endTime: '' },
                ageRange: { min: 0, max: 18 },
                spotsAvailable: null,
                registrationUrl: 'https://www.nvrc.ca/register',
                activityType: [],
                imageUrl: null,
                scrapedAt: new Date().toISOString()
              };
              
              // Cell 0: Days and Time
              const dayTimeText = cells[0].textContent.trim();
              // Extract days
              const days = [];
              if (dayTimeText.includes('Mon')) days.push('Monday');
              if (dayTimeText.includes('Tue')) days.push('Tuesday');
              if (dayTimeText.includes('Wed')) days.push('Wednesday');
              if (dayTimeText.includes('Thu')) days.push('Thursday');
              if (dayTimeText.includes('Fri')) days.push('Friday');
              if (dayTimeText.includes('Sat')) days.push('Saturday');
              if (dayTimeText.includes('Sun')) days.push('Sunday');
              camp.schedule.days = days;
              
              // Extract time
              const timeMatch = dayTimeText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
              if (timeMatch) {
                camp.schedule.startTime = timeMatch[1];
                camp.schedule.endTime = timeMatch[2];
              }
              
              // Cell 1: Dates
              const dateText = cells[1].textContent.trim();
              const dateMatch = dateText.match(/(\w{3}\s+\d{1,2})\s*-\s*(\w{3}\s+\d{1,2})/);
              if (dateMatch) {
                const year = new Date().getFullYear();
                camp.dateRange.start = new Date(`${dateMatch[1]}, ${year}`).toISOString();
                camp.dateRange.end = new Date(`${dateMatch[2]}, ${year}`).toISOString();
              }
              
              // Cell 2: Course ID and Location
              const infoText = cells[2].textContent.trim();
              const courseIdMatch = infoText.match(/Course ID:\s*(\d+)/);
              if (courseIdMatch) {
                camp.id = `nvrc-course-${courseIdMatch[1]}`;
              }
              
              const locationMatch = infoText.match(/at\s+(.+?)(?:\s*Course|$)/);
              if (locationMatch) {
                camp.location.name = locationMatch[1].trim();
              }
              
              // Cell 3: Cost
              const costText = cells[3].textContent.trim();
              const costMatch = costText.match(/\$(\d+(?:\.\d{2})?)/);
              if (costMatch) {
                camp.cost = parseFloat(costMatch[1]);
              }
              
              // Determine activity type from name
              const nameLower = activityName.toLowerCase();
              if (nameLower.includes('swim') || nameLower.includes('aqua')) {
                camp.activityType.push('swimming');
              } else if (nameLower.includes('camp')) {
                camp.activityType.push('camps');
              } else if (nameLower.includes('art')) {
                camp.activityType.push('visual_arts');
              } else if (nameLower.includes('dance')) {
                camp.activityType.push('dance');
              } else if (nameLower.includes('music')) {
                camp.activityType.push('music');
              } else if (nameLower.includes('martial')) {
                camp.activityType.push('martial_arts');
              } else {
                camp.activityType.push('general');
              }
              
              // Extract age from activity name
              const ageMatch = activityName.match(/(\d+)\s*yr/i);
              if (ageMatch) {
                const age = parseInt(ageMatch[1]);
                camp.ageRange.min = Math.max(0, age - 1);
                camp.ageRange.max = age + 1;
              }
              
              // Add registration button info if available
              const addButton = row.querySelector('button, a[href*="register"]');
              if (addButton) {
                const href = addButton.getAttribute('href') || addButton.getAttribute('onclick');
                if (href) {
                  camp.registrationUrl = href;
                }
              }
              
              camps.push(camp);
            });
          } catch (err) {
            console.error('Error processing panel:', err);
          }
        });
        
        return camps;
      });

      console.log(`\n✅ Scraped ${programs.length} programs successfully!`);
      
      // Close browser
      await browser.close();
      
      return programs;

    } catch (error) {
      console.error('❌ Direct scraping error:', error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
}

module.exports = NVRCDirectScraper;