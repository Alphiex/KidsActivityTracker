const puppeteer = require('puppeteer');

class NVRCScraper {
  constructor() {
    this.baseUrl = 'https://www.nvrc.ca/programs-memberships/find-program/results';
  }

  async scrape(queryParams) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Build URL with query parameters
      const url = `${this.baseUrl}?${queryParams}`;
      console.log('Navigating to:', url);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for the programs to load (jQuery template rendering)
      await page.waitForSelector('.programs-display-content', { timeout: 10000 });
      
      // Additional wait for dynamic content
      await page.waitForTimeout(3000);

      // Extract program data
      const programs = await page.evaluate(() => {
        const items = [];
        
        document.querySelectorAll('.programs-display-content .program-item').forEach(item => {
          try {
            const program = {
              id: item.getAttribute('data-program-id') || '',
              name: item.querySelector('.program-title')?.textContent?.trim() || '',
              description: item.querySelector('.program-description')?.textContent?.trim() || '',
              location: item.querySelector('.program-location')?.textContent?.trim() || '',
              facility: item.querySelector('.program-facility')?.textContent?.trim() || '',
              dateRange: {
                start: item.querySelector('.program-date-start')?.textContent?.trim() || '',
                end: item.querySelector('.program-date-end')?.textContent?.trim() || ''
              },
              schedule: {
                days: item.querySelector('.program-days')?.textContent?.trim() || '',
                time: item.querySelector('.program-time')?.textContent?.trim() || ''
              },
              ageRange: item.querySelector('.program-age')?.textContent?.trim() || '',
              price: item.querySelector('.program-price')?.textContent?.trim() || '',
              spotsAvailable: item.querySelector('.program-spots')?.textContent?.trim() || '',
              registrationDates: {
                start: item.querySelector('.registration-start')?.textContent?.trim() || '',
                end: item.querySelector('.registration-end')?.textContent?.trim() || ''
              },
              courseId: item.querySelector('.program-course-id')?.textContent?.trim() || '',
              registrationUrl: item.querySelector('a.register-button')?.getAttribute('href') || ''
            };
            
            items.push(program);
          } catch (error) {
            console.error('Error parsing program item:', error);
          }
        });
        
        return items;
      });

      console.log(`Found ${programs.length} programs`);
      return programs;

    } catch (error) {
      console.error('Scraping error:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async scrapeWithDetails(queryParams) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Log console messages from the page
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('Page error:', msg.text());
        }
      });

      const url = `${this.baseUrl}?${queryParams}`;
      console.log('Navigating to:', url);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for any of these selectors that might contain program data
      const selectors = [
        '.program-list',
        '.programs-results',
        '.program-item',
        '[data-program-id]',
        '.course-list',
        '.activity-item'
      ];

      let foundSelector = null;
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          foundSelector = selector;
          console.log(`Found content with selector: ${selector}`);
          break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!foundSelector) {
        console.log('No program selectors found. Capturing page structure...');
        
        // Get the entire page HTML to analyze structure
        const pageContent = await page.content();
        require('fs').writeFileSync('page-content.html', pageContent);
        console.log('Page content saved to page-content.html for analysis');
      }

      // Try to extract any structured data
      const pageData = await page.evaluate(() => {
        // Look for common patterns in the page
        const data = {
          title: document.title,
          hasJQuery: typeof jQuery !== 'undefined',
          programContainers: [],
          dataAttributes: []
        };

        // Find any elements with data attributes that might contain program info
        document.querySelectorAll('[data-program-id], [data-course-id], [data-activity-id]').forEach(el => {
          data.dataAttributes.push({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            dataAttrs: Array.from(el.attributes)
              .filter(attr => attr.name.startsWith('data-'))
              .map(attr => ({ name: attr.name, value: attr.value }))
          });
        });

        // Look for any containers that might have programs
        const possibleContainers = [
          '.program', '.course', '.activity', '.session', 
          '.card', '.item', '.result', '.listing'
        ];
        
        possibleContainers.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            data.programContainers.push({
              selector: selector,
              count: elements.length,
              sample: elements[0].outerHTML.substring(0, 200) + '...'
            });
          }
        });

        return data;
      });

      console.log('Page data analysis:', JSON.stringify(pageData, null, 2));

      return pageData;

    } catch (error) {
      console.error('Detailed scraping error:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }
}

module.exports = NVRCScraper;