const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCWorkingScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Launching NVRC Working Scraper...');
      browser = await puppeteer.launch({
        headless: true, // Set to false for debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1440, height: 900 }
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the find program page
      console.log('📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for checkboxes to load
      await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('✅ Page loaded, selecting options...');

      // Select age groups for kids
      const ageSelectors = [
        '#edit-programs-early-years-on-my-own',           // 0-6 years, On My Own
        '#edit-programs-early-years-parent-participation', // 0-6 years, Parent Participation  
        '#edit-programs-school-age',                       // 5-13 years, School Age
        '#edit-programs-youth'                             // 10-18 years, Youth
      ];

      for (const selector of ageSelectors) {
        try {
          await page.click(selector);
          console.log(`  ✅ Selected: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          console.log(`  ❌ Could not select: ${selector}`);
        }
      }

      // Find and click the submit button
      console.log('\n🔍 Looking for submit button...');
      
      // The form should auto-submit or there should be a submit button
      const submitButton = await page.$('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        console.log('  ✅ Found submit button, clicking...');
        await submitButton.click();
      }

      // Wait for navigation or results
      console.log('\n⏳ Waiting for results...');
      
      try {
        // Wait for either navigation or results to appear
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
          page.waitForSelector('.view-program-search-listing', { timeout: 10000 }),
          page.waitForSelector('.search-results', { timeout: 10000 }),
          page.waitForSelector('.program-listing', { timeout: 10000 })
        ]);
      } catch (e) {
        console.log('  ⚠️ Timeout waiting for results, checking current page...');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Save screenshot and HTML for debugging
      await page.screenshot({ path: 'nvrc-working-results.png', fullPage: true });
      const pageContent = await page.content();
      fs.writeFileSync('nvrc-working-results.html', pageContent);
      console.log('💾 Saved screenshot and HTML for inspection');

      // Extract programs from results
      console.log('\n📊 Extracting program data...');
      
      const programs = await page.evaluate(() => {
        const camps = [];
        
        // Strategy 1: Look for common result containers
        const resultSelectors = [
          '.view-program-search-listing .views-row',
          '.program-listing-item',
          '.search-result-item',
          '.program-item',
          '.course-item',
          'article.program',
          '.views-row'
        ];
        
        let resultElements = [];
        for (const selector of resultSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} results with selector: ${selector}`);
            resultElements = Array.from(elements);
            break;
          }
        }

        // If no specific result containers found, look for any element with program info
        if (resultElements.length === 0) {
          const allElements = Array.from(document.querySelectorAll('div, article, section'));
          resultElements = allElements.filter(el => {
            const text = el.textContent || '';
            return text.includes('Course ID') || 
                   (text.includes('$') && text.includes('Register')) ||
                   (text.includes('Age') && text.includes('Date'));
          }).slice(0, 50); // Limit to first 50 matches
        }

        resultElements.forEach((element, index) => {
          try {
            const text = element.textContent || '';
            
            // Extract program information
            const camp = {
              id: `nvrc-${Date.now()}-${index}`,
              name: '',
              provider: 'NVRC',
              description: '',
              location: { name: '', address: '' },
              cost: 0,
              dateRange: { start: new Date().toISOString(), end: new Date().toISOString() },
              schedule: { days: [], startTime: '', endTime: '' },
              ageRange: { min: 0, max: 18 },
              spotsAvailable: null,
              registrationUrl: 'https://www.nvrc.ca/register',
              activityType: [],
              imageUrl: null,
              scrapedAt: new Date().toISOString()
            };

            // Extract title/name
            const titleElement = element.querySelector('h3, h4, .program-title, .title, .program-name');
            if (titleElement) {
              camp.name = titleElement.textContent.trim();
            } else {
              // Try to extract from first line or bold text
              const firstLine = text.split('\n')[0].trim();
              if (firstLine && firstLine.length < 100) {
                camp.name = firstLine;
              }
            }

            // Extract cost
            const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
            if (costMatch) {
              camp.cost = parseFloat(costMatch[1]);
            }

            // Extract dates
            const datePatterns = [
              /(\w{3}\s+\d{1,2})\s*[-–]\s*(\w{3}\s+\d{1,2})/,  // "Jan 15 - Feb 20"
              /(\d{1,2}\/\d{1,2})\s*[-–]\s*(\d{1,2}\/\d{1,2})/ // "01/15 - 02/20"
            ];
            
            for (const pattern of datePatterns) {
              const dateMatch = text.match(pattern);
              if (dateMatch) {
                const year = new Date().getFullYear();
                try {
                  camp.dateRange.start = new Date(`${dateMatch[1]}, ${year}`).toISOString();
                  camp.dateRange.end = new Date(`${dateMatch[2]}, ${year}`).toISOString();
                } catch (e) {
                  // Date parsing failed, keep defaults
                }
                break;
              }
            }

            // Extract time
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
            if (timeMatch) {
              camp.schedule.startTime = timeMatch[1];
              camp.schedule.endTime = timeMatch[2];
            }

            // Extract days
            const dayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi;
            const dayMatches = text.match(dayPattern);
            if (dayMatches) {
              camp.schedule.days = [...new Set(dayMatches)]; // Remove duplicates
            }

            // Extract age
            const ageMatch = text.match(/(?:Age|Ages)\s*(\d+)\s*[-–]\s*(\d+)/i);
            if (ageMatch) {
              camp.ageRange.min = parseInt(ageMatch[1]);
              camp.ageRange.max = parseInt(ageMatch[2]);
            }

            // Extract location
            const locationPatterns = [
              /(?:at|@|Location:)\s*([^,\n]+)/i,
              /(?:Centre|Center|Facility|Location):\s*([^\n]+)/i
            ];
            
            for (const pattern of locationPatterns) {
              const locationMatch = text.match(pattern);
              if (locationMatch) {
                camp.location.name = locationMatch[1].trim();
                break;
              }
            }

            // Extract Course ID
            const courseIdMatch = text.match(/Course\s*(?:ID|#):\s*(\d+)/i);
            if (courseIdMatch) {
              camp.id = `nvrc-course-${courseIdMatch[1]}`;
            }

            // Determine activity type from name or description
            const fullText = (camp.name + ' ' + text).toLowerCase();
            if (fullText.includes('swim') || fullText.includes('aqua')) {
              camp.activityType.push('swimming');
            } else if (fullText.includes('camp')) {
              camp.activityType.push('camps');
            } else if (fullText.includes('art') || fullText.includes('craft') || fullText.includes('paint')) {
              camp.activityType.push('visual_arts');
            } else if (fullText.includes('dance') || fullText.includes('ballet')) {
              camp.activityType.push('dance');
            } else if (fullText.includes('music') || fullText.includes('piano') || fullText.includes('guitar')) {
              camp.activityType.push('music');
            } else if (fullText.includes('martial') || fullText.includes('karate') || fullText.includes('taekwondo')) {
              camp.activityType.push('martial_arts');
            } else if (fullText.includes('sport') || fullText.includes('soccer') || fullText.includes('basketball')) {
              camp.activityType.push('sports');
            }
            
            if (camp.activityType.length === 0) {
              camp.activityType.push('general');
            }

            // Extract registration link
            const registerLink = element.querySelector('a[href*="register"], a[href*="booking"], a.register-btn');
            if (registerLink) {
              camp.registrationUrl = registerLink.href;
            }

            // Only add if we have meaningful data
            if (camp.name && (camp.cost > 0 || camp.schedule.startTime || courseIdMatch)) {
              camps.push(camp);
            }
          } catch (err) {
            console.error('Error extracting program:', err);
          }
        });

        return camps;
      });

      console.log(`\n✅ Extracted ${programs.length} programs`);
      
      // If we found programs, show a sample
      if (programs.length > 0) {
        console.log('\nSample program:');
        const sample = programs[0];
        console.log(`  Name: ${sample.name}`);
        console.log(`  Cost: $${sample.cost}`);
        console.log(`  Location: ${sample.location.name || 'Not specified'}`);
        console.log(`  Dates: ${new Date(sample.dateRange.start).toLocaleDateString()} - ${new Date(sample.dateRange.end).toLocaleDateString()}`);
      }

      await browser.close();
      return programs;

    } catch (error) {
      console.error('❌ Scraping error:', error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
}

module.exports = NVRCWorkingScraper;