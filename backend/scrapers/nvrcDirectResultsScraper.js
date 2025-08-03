const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCDirectResultsScraper {
  constructor() {
    this.activities = [];
    this.processedUrls = new Set();
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Direct Results Scraper...');
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
          console.log('PAGE:', msg.text());
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate to the find program page
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Wait for form to be ready
      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Select kids age groups only
      console.log('\n📋 Selecting kids age groups...');
      
      const ageCheckboxes = [
        '#edit-programs-early-years-parent-participation',
        '#edit-programs-early-years-on-my-own',
        '#edit-programs-school-age',
        '#edit-programs-youth'
      ];
      
      for (const selector of ageCheckboxes) {
        try {
          await page.click(selector);
          console.log(`  ✓ Selected: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          // Try by label text
          const labelText = selector.includes('parent') ? '0 - 6 years, Parent Participation' :
                           selector.includes('on-my-own') ? '0 - 6 years, On My Own' :
                           selector.includes('school') ? '5 - 13 years, School Age' :
                           '10 - 18 years, Youth';
          
          await page.evaluate((text) => {
            const labels = Array.from(document.querySelectorAll('label'));
            const label = labels.find(l => l.textContent.includes(text));
            if (label) {
              const checkbox = label.querySelector('input[type="checkbox"]') || 
                             document.getElementById(label.getAttribute('for'));
              if (checkbox && !checkbox.checked) checkbox.click();
            }
          }, labelText);
          console.log(`  ✓ Selected: ${labelText} (via label)`);
        }
      }

      // Don't select any specific programs to get all
      console.log('\n📋 Not selecting specific programs to get all activities...');
      
      // Submit the form
      console.log('\n🔍 Submitting search form...');
      
      // Click submit
      await page.evaluate(() => {
        const submitButton = document.querySelector('input[type="submit"][value="Show Results"]') ||
                           document.querySelector('input[type="submit"]') ||
                           document.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.click();
        } else {
          const form = document.querySelector('form');
          if (form) form.submit();
        }
      });

      // Wait for navigation or results to appear (form might submit via AJAX)
      console.log('\n⏳ Waiting for search results...');
      
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
          page.waitForSelector('.search-results, .view-content, .views-row', { timeout: 15000 })
        ]);
      } catch (e) {
        console.log('  Navigation timeout - checking if results loaded via AJAX...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get total results count
      const resultsInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/(\d+)\s+of\s+(\d+)\s+total\s+results/i);
        if (match) {
          return {
            showing: parseInt(match[1]),
            total: parseInt(match[2])
          };
        }
        return { showing: 0, total: 0 };
      });

      console.log(`\n📊 Found ${resultsInfo.total} total activities (showing ${resultsInfo.showing} per page)`);

      // Extract activities from all pages
      let currentPage = 1;
      const maxPages = Math.ceil(resultsInfo.total / resultsInfo.showing);
      
      console.log(`📄 Need to process ${maxPages} pages`);

      while (currentPage <= maxPages && currentPage <= 100) { // Limit to 100 pages for safety
        console.log(`\n📄 Processing page ${currentPage}/${maxPages}...`);
        
        // Extract activities from current page
        const pageActivities = await this.extractActivitiesFromPage(page);
        console.log(`  ✓ Extracted ${pageActivities.length} activities from page ${currentPage}`);
        
        this.activities.push(...pageActivities);
        
        // Go to next page
        if (currentPage < maxPages) {
          const hasNextPage = await page.evaluate(() => {
            // Try multiple selectors for next page link
            const selectors = [
              'a[rel="next"]',
              '.pager__item--next a',
              '.pager .next a',
              'a[title="Go to next page"]',
              '.pagination .next a'
            ];
            
            for (const selector of selectors) {
              const nextLink = document.querySelector(selector);
              if (nextLink) {
                nextLink.click();
                return true;
              }
            }
            
            // Also try finding by text content
            const links = Array.from(document.querySelectorAll('a'));
            const nextTextLink = links.find(link => 
              link.textContent.toLowerCase().includes('next') &&
              !link.classList.contains('disabled')
            );
            
            if (nextTextLink) {
              nextTextLink.click();
              return true;
            }
            
            return false;
          });
          
          if (!hasNextPage) {
            console.log('  ⚠️ No next page link found');
            break;
          }
          
          // Wait for new results to load
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        currentPage++;
        
        // Save progress periodically
        if (currentPage % 10 === 0) {
          this.saveProgress(currentPage, maxPages);
        }
      }

      // Process and save final results
      console.log(`\n✅ Extraction complete! Total activities: ${this.activities.length}`);
      
      const results = {
        timestamp: new Date().toISOString(),
        stats: {
          totalExpected: resultsInfo.total,
          totalExtracted: this.activities.length,
          pagesProcessed: currentPage - 1,
          completeness: `${Math.round((this.activities.length / resultsInfo.total) * 100)}%`
        },
        activities: this.activities
      };
      
      const filename = `nvrc_all_kids_activities_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 All activities saved to ${filename}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      
      // Save what we have so far
      if (this.activities.length > 0) {
        const errorFile = `nvrc_partial_activities_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        fs.writeFileSync(errorFile, JSON.stringify({
          error: error.message,
          activitiesExtracted: this.activities.length,
          activities: this.activities
        }, null, 2));
        console.log(`💾 Partial results saved to ${errorFile}`);
      }
      
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async extractActivitiesFromPage(page) {
    return await page.evaluate(() => {
      const activities = [];
      
      // Multiple possible selectors for activity items
      const selectors = [
        '.node--type-perfectmind-program',
        '.views-row',
        '.search-result',
        '.program-item',
        'article.node'
      ];
      
      let activityElements = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          activityElements = elements;
          break;
        }
      }
      
      activityElements.forEach((element, index) => {
        try {
          // Extract title
          const titleElement = element.querySelector('h2, h3, .node__title, .title');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          // Extract link
          const linkElement = element.querySelector('a');
          const link = linkElement ? linkElement.href : '';
          
          // Extract description/details
          const descElement = element.querySelector('.field--name-body, .description, p');
          const description = descElement ? descElement.textContent.trim() : '';
          
          // Extract course code
          const codeMatch = title.match(/^([A-Z0-9-]+)\s+(.+)/);
          const courseCode = codeMatch ? codeMatch[1] : '';
          const courseName = codeMatch ? codeMatch[2] : title;
          
          // Extract other details from the text
          const fullText = element.textContent;
          
          // Extract age range
          const ageMatch = fullText.match(/(\d+)\s*-\s*(\d+)\s*yrs?|(\d+)\s*yrs?\+/i);
          const ageRange = ageMatch ? {
            min: parseInt(ageMatch[1] || ageMatch[3]) || 0,
            max: parseInt(ageMatch[2]) || (ageMatch[3] ? 18 : 0)
          } : null;
          
          // Extract location
          const locationMatch = fullText.match(/at\s+([^,\n]+(?:Recreation|Centre|Center|Pool|Arena))/i);
          const location = locationMatch ? locationMatch[1].trim() : '';
          
          // Extract dates
          const dateMatch = fullText.match(/([A-Z][a-z]{2})\s+\d+\s*-\s*([A-Z][a-z]{2})\s+\d+/);
          const dates = dateMatch ? `${dateMatch[1]} - ${dateMatch[2]}` : '';
          
          // Extract time
          const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
          const time = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : '';
          
          // Extract cost
          const costMatch = fullText.match(/\$(\d+(?:\.\d{2})?)/);
          const cost = costMatch ? `$${costMatch[1]}` : '';
          
          // Extract instructor
          const instructorMatch = fullText.match(/Instructor:\s*([^\n]+)/i);
          const instructor = instructorMatch ? instructorMatch[1].trim() : '';
          
          if (title && title.length > 0) {
            activities.push({
              id: `nvrc_page_${index}`,
              courseCode,
              name: courseName,
              title: title,
              description,
              location,
              dates,
              time,
              cost,
              instructor,
              ageRange,
              url: link,
              fullText: fullText.substring(0, 500)
            });
          }
        } catch (e) {
          console.error('Error extracting activity:', e);
        }
      });
      
      return activities;
    });
  }

  saveProgress(currentPage, totalPages) {
    const progressFile = `nvrc_progress_page_${currentPage}_of_${totalPages}.json`;
    fs.writeFileSync(progressFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      progress: `${currentPage}/${totalPages}`,
      activitiesExtracted: this.activities.length,
      activities: this.activities
    }, null, 2));
    console.log(`  💾 Progress saved (${this.activities.length} activities so far)`);
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCDirectResultsScraper();
  scraper.scrape()
    .then(results => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Expected: ${results.stats.totalExpected} activities`);
      console.log(`Extracted: ${results.stats.totalExtracted} activities`);
      console.log(`Pages processed: ${results.stats.pagesProcessed}`);
      console.log(`Completeness: ${results.stats.completeness}`);
      
      if (results.activities.length > 0) {
        console.log('\nSample activities:');
        results.activities.slice(0, 5).forEach(act => {
          console.log(`  - ${act.title} | ${act.cost || 'N/A'} | ${act.location || 'N/A'}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCDirectResultsScraper;