const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCComprehensiveScraper {
  constructor(options = {}) {
    this.options = options;
    this.navigationLog = [];
    this.activities = [];
  }

  log(message, data = null) {
    console.log(message);
    this.navigationLog.push({
      timestamp: new Date().toISOString(),
      message,
      data
    });
  }

  async scrape() {
    let browser;
    
    try {
      this.log('🚀 Starting NVRC Comprehensive Scraper...');
      
      const launchOptions = {
        headless: this.options.headless !== undefined ? this.options.headless : true,
        slowMo: 0,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ],
        defaultViewport: null
      };
      
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
          this.log(`PAGE LOG: ${msg.text()}`);
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // APPROACH 1: Try the main website form first
      this.log('\n📍 APPROACH 1: Using NVRC main website form');
      await this.scrapeMainWebsite(page);

      // APPROACH 2: Try direct PerfectMind widget access
      this.log('\n📍 APPROACH 2: Using PerfectMind widget directly');
      await this.scrapePerfectMindWidget(page);

      // Save comprehensive results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = {
        timestamp: new Date().toISOString(),
        totalActivities: this.activities.length,
        navigationLog: this.navigationLog,
        activities: this.activities,
        activitySummary: this.summarizeActivities()
      };
      
      const filename = `nvrc_comprehensive_results_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      this.log(`\n💾 Results saved to ${filename}`);
      
      // Save navigation documentation
      const docFilename = `nvrc_navigation_documentation_${timestamp}.md`;
      fs.writeFileSync(docFilename, this.generateNavigationDoc());
      this.log(`📝 Navigation documentation saved to ${docFilename}`);
      
      return this.activities;
      
    } catch (error) {
      this.log('❌ Scraper error:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async scrapeMainWebsite(page) {
    try {
      this.log('Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      this.log('Waiting for form to load...');
      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot of initial form
      await page.screenshot({ path: 'nvrc-01-initial-form.png', fullPage: true });

      // STEP 1: Select age groups
      this.log('\n📋 STEP 1: Selecting age groups');
      const ageGroups = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const ageCheckboxes = checkboxes.filter(cb => {
          const label = cb.parentElement?.textContent || '';
          return label.includes('years') || label.includes('Youth') || label.includes('Adult');
        });
        
        const selected = [];
        ageCheckboxes.forEach(cb => {
          if (!cb.checked) {
            cb.click();
            selected.push(cb.parentElement?.textContent?.trim() || 'Unknown');
          }
        });
        
        return selected;
      });
      
      this.log(`Selected ${ageGroups.length} age groups:`, ageGroups);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 2: Wait for and select activities
      this.log('\n🎯 STEP 2: Waiting for activities to appear');
      
      // Wait for activities with multiple strategies
      const activitiesAppeared = await page.waitForFunction(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const activityCheckboxes = checkboxes.filter(cb => {
          const label = cb.parentElement?.textContent || '';
          return !label.includes('years') && !label.includes('Youth') && !label.includes('Adult') &&
                 (label.includes('Swim') || label.includes('Camp') || label.includes('Sport') || 
                  label.includes('Art') || label.includes('Dance') || label.includes('Music'));
        });
        return activityCheckboxes.length > 0;
      }, { timeout: 30000, polling: 1000 }).catch(() => false);

      if (activitiesAppeared) {
        const selectedActivities = await page.evaluate(() => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          const activities = [];
          
          checkboxes.forEach(cb => {
            const label = cb.parentElement?.textContent?.trim() || '';
            // Select all non-age checkboxes
            if (!label.includes('years') && !label.includes('Youth') && !label.includes('Adult') && 
                label.length > 3 && !cb.checked) {
              cb.click();
              activities.push(label);
            }
          });
          
          return activities;
        });
        
        this.log(`Selected ${selectedActivities.length} activities:`, selectedActivities);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.screenshot({ path: 'nvrc-02-activities-selected.png', fullPage: true });

      // STEP 3: Select locations
      this.log('\n📍 STEP 3: Selecting locations');
      
      const locationInfo = await page.evaluate(() => {
        // Try multiple strategies to find location checkboxes
        const allLabels = Array.from(document.querySelectorAll('label'));
        
        // Strategy 1: Look for "Select all locations"
        const selectAllLabel = allLabels.find(label => 
          label.textContent?.includes('Select all locations') ||
          label.textContent?.includes('all locations available')
        );
        
        if (selectAllLabel) {
          const checkbox = selectAllLabel.querySelector('input[type="checkbox"]') ||
                          selectAllLabel.previousElementSibling;
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return { method: 'select-all', count: 1 };
          }
        }
        
        // Strategy 2: Select individual locations
        const locationLabels = allLabels.filter(label => {
          const text = label.textContent || '';
          return (text.includes('Centre') || text.includes('Park') || 
                  text.includes('Arena') || text.includes('Pool')) &&
                 !text.includes('years');
        });
        
        let selected = 0;
        locationLabels.forEach(label => {
          const checkbox = label.querySelector('input[type="checkbox"]') ||
                          label.previousElementSibling;
          if (checkbox && checkbox.type === 'checkbox' && !checkbox.checked) {
            checkbox.click();
            selected++;
          }
        });
        
        return { method: 'individual', count: selected };
      });
      
      this.log('Location selection:', locationInfo);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click Show Results
      this.log('\n🔍 Clicking Show Results button');
      const resultsClicked = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('input[type="submit"], button'))
          .find(btn => {
            const text = btn.value || btn.textContent || '';
            return text.includes('Show Results');
          });
        
        if (button) {
          button.click();
          return true;
        }
        return false;
      });

      if (resultsClicked) {
        this.log('Show Results clicked, waiting for navigation...');
        
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle0' }),
          new Promise(resolve => setTimeout(resolve, 15000))
        ]);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const currentUrl = await page.url();
        this.log('Results page URL:', currentUrl);
        
        await page.screenshot({ path: 'nvrc-03-results-page.png', fullPage: true });

        // Check for iframes
        const iframeInfo = await page.evaluate(() => {
          const iframes = document.querySelectorAll('iframe');
          return {
            count: iframes.length,
            sources: Array.from(iframes).map(iframe => iframe.src || 'no-src')
          };
        });
        
        this.log('Iframe information:', iframeInfo);

        // If there are iframes, try to extract their content
        if (iframeInfo.count > 0) {
          await this.extractFromIframes(page);
        }

        // Try to extract activities from the main page
        await this.extractActivitiesFromPage(page, 'Main Website');
      }
      
    } catch (error) {
      this.log('Error in main website scraping:', error.message);
    }
  }

  async scrapePerfectMindWidget(page) {
    try {
      const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
      
      this.log('Navigating to PerfectMind widget directly...');
      await page.goto(widgetUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      await new Promise(resolve => setTimeout(resolve, 5000));
      await page.screenshot({ path: 'nvrc-04-perfectmind-main.png', fullPage: true });

      // Find and click on each program section
      const sections = [
        'All Ages & Family',
        'Early Years: On My Own',
        'Early Years: Parent Participation',
        'School Age',
        'Youth',
        'Adult'
      ];

      for (const section of sections) {
        this.log(`\n📂 Processing section: ${section}`);
        
        try {
          // Navigate back to main if needed
          const currentUrl = await page.url();
          if (!currentUrl.includes('BookMe4?widgetId')) {
            await page.goto(widgetUrl, {
              waitUntil: 'networkidle0',
              timeout: 60000
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Click on section
          const sectionClicked = await page.evaluate((sectionName) => {
            const links = Array.from(document.querySelectorAll('a'));
            const sectionLink = links.find(link => 
              link.textContent?.trim() === sectionName ||
              link.textContent?.includes(sectionName)
            );
            
            if (sectionLink) {
              sectionLink.click();
              return true;
            }
            return false;
          }, section);

          if (sectionClicked) {
            this.log(`Clicked on ${section}, waiting for content...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Expand all activity groups
            await this.expandActivityGroups(page);
            
            // Extract activities
            await this.extractActivitiesFromPage(page, section);
          }
          
        } catch (error) {
          this.log(`Error processing section ${section}:`, error.message);
        }
      }
      
    } catch (error) {
      this.log('Error in PerfectMind widget scraping:', error.message);
    }
  }

  async expandActivityGroups(page) {
    try {
      const expandCount = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, span'));
        const showLinks = links.filter(el => {
          const text = el.textContent?.trim()?.toLowerCase() || '';
          return text === 'show' || text.includes('show more') || text.includes('expand');
        });
        
        showLinks.forEach(link => link.click());
        return showLinks.length;
      });
      
      if (expandCount > 0) {
        this.log(`Expanded ${expandCount} activity groups`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      this.log('Error expanding activity groups:', error.message);
    }
  }

  async extractFromIframes(page) {
    try {
      const frames = page.frames();
      this.log(`Found ${frames.length} frames (including main frame)`);
      
      for (let i = 1; i < frames.length; i++) {
        try {
          const frame = frames[i];
          const frameUrl = frame.url();
          this.log(`\nChecking frame ${i}: ${frameUrl}`);
          
          // Wait for frame content
          await frame.waitForSelector('body', { timeout: 5000 }).catch(() => {});
          
          // Extract activities from frame
          await this.extractActivitiesFromPage(frame, `Iframe ${i}`);
          
        } catch (error) {
          this.log(`Could not access frame ${i}:`, error.message);
        }
      }
    } catch (error) {
      this.log('Error extracting from iframes:', error.message);
    }
  }

  async extractActivitiesFromPage(pageOrFrame, source) {
    try {
      const activities = await pageOrFrame.evaluate((src) => {
        const extractedActivities = [];
        
        // Strategy 1: Look for NVRC activity rows
        const activityRows = document.querySelectorAll('.nvrc-activities-events__row, .events-row');
        activityRows.forEach((row, index) => {
          const activity = {
            source: src,
            name: row.querySelector('.events-row__title, [class*="title"]')?.textContent?.trim(),
            dates: row.querySelector('.events-row__dates, [class*="dates"]')?.textContent?.trim(),
            schedule: row.querySelector('.events-row__schedule, [class*="schedule"]')?.textContent?.trim(),
            ageRange: row.querySelector('.events-row__ages, [class*="ages"]')?.textContent?.trim(),
            location: row.querySelector('.events-row__location, [class*="location"]')?.textContent?.trim(),
            cost: row.querySelector('.events-row__cost, [class*="cost"]')?.textContent?.trim(),
            spots: row.querySelector('.events-row__spots, [class*="spots"]')?.textContent?.trim(),
            registrationUrl: row.querySelector('a[href*="BookMe4"], a[href*="courseId"]')?.href,
            courseId: row.querySelector('.events-row__barcode, [class*="barcode"]')?.textContent?.trim()
          };
          
          if (activity.name) {
            extractedActivities.push(activity);
          }
        });
        
        // Strategy 2: Look for PerfectMind table rows
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const rows = Array.from(table.querySelectorAll('tr')).slice(1); // Skip header
          
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              const rowText = row.textContent || '';
              
              if (rowText.includes('Sign Up') || rowText.includes('Waitlist') || rowText.includes('Closed')) {
                const activity = {
                  source: src,
                  name: row.querySelector('a')?.textContent?.trim() || cells[0]?.textContent?.trim(),
                  rawText: rowText,
                  registrationUrl: row.querySelector('a[href*="BookMe4"], a[href*="courseId"]')?.href,
                  availability: rowText.includes('Closed') ? 'Closed' : 
                               rowText.includes('Waitlist') ? 'Waitlist' : 'Open'
                };
                
                if (activity.name && activity.name.length > 3) {
                  extractedActivities.push(activity);
                }
              }
            }
          });
        });
        
        // Strategy 3: Look for any links to activities
        if (extractedActivities.length === 0) {
          const activityLinks = document.querySelectorAll('a[href*="courseId"], a[href*="BookMe4"]');
          activityLinks.forEach(link => {
            const activity = {
              source: src,
              name: link.textContent?.trim(),
              registrationUrl: link.href,
              rawText: link.parentElement?.textContent?.trim()
            };
            
            if (activity.name && activity.name.length > 3) {
              extractedActivities.push(activity);
            }
          });
        }
        
        return extractedActivities;
      }, source);
      
      this.log(`Extracted ${activities.length} activities from ${source}`);
      this.activities.push(...activities);
      
    } catch (error) {
      this.log(`Error extracting activities from ${source}:`, error.message);
    }
  }

  summarizeActivities() {
    const summary = {
      totalCount: this.activities.length,
      bySources: {},
      uniqueActivities: new Set()
    };
    
    this.activities.forEach(activity => {
      // Count by source
      if (!summary.bySources[activity.source]) {
        summary.bySources[activity.source] = 0;
      }
      summary.bySources[activity.source]++;
      
      // Track unique activities
      if (activity.name) {
        summary.uniqueActivities.add(activity.name);
      }
    });
    
    summary.uniqueCount = summary.uniqueActivities.size;
    summary.uniqueActivities = Array.from(summary.uniqueActivities).sort();
    
    return summary;
  }

  generateNavigationDoc() {
    let doc = `# NVRC Scraper Navigation Documentation

Generated: ${new Date().toISOString()}

## Overview
This document describes how the NVRC scraper navigates the website to capture all activities.

## Navigation Flow

### Approach 1: Main Website Form
1. **Starting URL**: https://www.nvrc.ca/programs-memberships/find-program
2. **Step 1 - Age Group Selection**:
   - Select checkboxes for age groups:
     - "0 - 6 years, Parent Participation"
     - "0 - 6 years, On My Own"  
     - "5 - 13 years, School Age"
     - "10 - 18 years, Youth"
     - "Adult" (if activities for adults are needed)
   
3. **Step 2 - Activity Selection** (appears dynamically after Step 1):
   - The form dynamically loads activity checkboxes
   - Select all activity types that appear, including:
     - Movement & Fitness: Dance, Spin, Strength & Cardio, Yoga
     - Activities: Aquatic Leadership, Camps, Certifications, Cooking, etc.
     - Sports: Climbing, Gymnastics, Multisport, Racquet Sports, Team Sports
     - Arts & Culture: Dance, Music, Pottery, Visual Arts
   
4. **Step 3 - Location Selection** (appears after Step 2):
   - Click "Select all locations" checkbox if available
   - Otherwise select individual locations
   
5. **Submit Form**:
   - Click "Show Results" button
   - Results page loads with activities in iframes

### Approach 2: Direct PerfectMind Widget Access
1. **Direct URL**: https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a
2. **Navigation**:
   - Click on each program category link:
     - "All Ages & Family"
     - "Early Years: On My Own"
     - "Early Years: Parent Participation"
     - "School Age"
     - "Youth"
     - "Adult"
3. **Expand Activities**:
   - Click "Show" links to expand activity groups
   - Activities are displayed in tables with registration links

## Key Findings
`;

    // Add activity summary
    const summary = this.summarizeActivities();
    doc += `
### Activity Summary
- Total activities found: ${summary.totalCount}
- Unique activities: ${summary.uniqueCount}
- Activities by source:
`;
    
    Object.entries(summary.bySources).forEach(([source, count]) => {
      doc += `  - ${source}: ${count} activities\n`;
    });

    // Add navigation log
    doc += `
## Detailed Navigation Log

\`\`\`json
${JSON.stringify(this.navigationLog, null, 2)}
\`\`\`
`;

    return doc;
  }
}

// Run the scraper
async function runComprehensiveScraper() {
  const scraper = new NVRCComprehensiveScraper({ headless: true });
  
  try {
    const activities = await scraper.scrape();
    console.log(`\n✅ Scraping complete! Found ${activities.length} total activities.`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  runComprehensiveScraper();
}

module.exports = NVRCComprehensiveScraper;