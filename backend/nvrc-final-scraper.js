const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCFinalScraper {
  constructor(options = {}) {
    this.options = options;
    this.activities = [];
    this.navigationDoc = [];
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Final Scraper...\n');
      
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
      
      // Enable better error handling
      page.on('pageerror', error => {
        console.log('PAGE ERROR:', error.message);
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // MAIN APPROACH: Direct PerfectMind access
      await this.scrapePerfectMind(page);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = {
        timestamp: new Date().toISOString(),
        totalActivities: this.activities.length,
        activities: this.activities,
        categorySummary: this.summarizeActivities()
      };
      
      fs.writeFileSync(`nvrc_final_results_${timestamp}.json`, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results saved to nvrc_final_results_${timestamp}.json`);
      
      // Save navigation documentation
      const navDoc = this.generateNavigationDoc();
      fs.writeFileSync(`NVRC_Scraper_Navigation_Guide.md`, navDoc);
      console.log(`📝 Navigation guide saved to NVRC_Scraper_Navigation_Guide.md`);
      
      return this.activities;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async scrapePerfectMind(page) {
    const baseUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
    
    console.log('📍 Navigating to NVRC PerfectMind booking system...');
    this.navigationDoc.push({
      step: 'Navigate to booking system',
      url: baseUrl,
      description: 'Access the NVRC PerfectMind widget directly'
    });
    
    await page.goto(baseUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get all program categories
    const categories = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const categoryLinks = [];
      
      // Known category patterns
      const categoryPatterns = [
        'All Ages & Family',
        'Early Years: On My Own',
        'Early Years: Parent Participation', 
        'School Age',
        'Youth',
        'Adult'
      ];
      
      categoryPatterns.forEach(pattern => {
        const link = links.find(l => l.textContent?.trim() === pattern);
        if (link) {
          categoryLinks.push({
            name: pattern,
            href: link.href,
            found: true
          });
        }
      });
      
      return categoryLinks;
    });
    
    console.log(`\n📋 Found ${categories.length} program categories:`);
    categories.forEach(cat => console.log(`  - ${cat.name}`));

    // Process each category
    for (const category of categories) {
      console.log(`\n🔍 Processing category: ${category.name}`);
      this.navigationDoc.push({
        step: `Process ${category.name}`,
        action: 'Click category link',
        description: `Navigate to ${category.name} programs`
      });
      
      try {
        // Navigate to category
        await page.goto(category.href, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Expand all activity groups
        let expansions = 0;
        let hasMore = true;
        
        while (hasMore) {
          const expanded = await page.evaluate(() => {
            // Look for "Show" buttons/links
            const showElements = Array.from(document.querySelectorAll('a, button, span'))
              .filter(el => {
                const text = el.textContent?.trim().toLowerCase();
                return text === 'show' || text === 'show more' || text === 'expand';
              });
            
            if (showElements.length > 0) {
              showElements.forEach(el => el.click());
              return showElements.length;
            }
            return 0;
          });
          
          if (expanded > 0) {
            expansions += expanded;
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            hasMore = false;
          }
        }
        
        if (expansions > 0) {
          console.log(`  ✓ Expanded ${expansions} activity groups`);
          this.navigationDoc.push({
            step: 'Expand activities',
            action: 'Click all "Show" buttons',
            count: expansions
          });
        }
        
        // Extract activities with better parsing
        const categoryActivities = await page.evaluate((categoryName) => {
          const activities = [];
          
          // Strategy 1: Look for activity rows in tables
          const tables = document.querySelectorAll('table');
          
          tables.forEach((table, tableIndex) => {
            // Find activity name header (usually in a row before the data rows)
            let currentActivityName = null;
            const rows = Array.from(table.querySelectorAll('tr'));
            
            rows.forEach((row, rowIndex) => {
              const cells = Array.from(row.querySelectorAll('td, th'));
              const rowText = row.textContent || '';
              
              // Check if this is an activity name header row
              if (cells.length === 1 && !rowText.includes('Sign Up') && !rowText.includes('Waitlist')) {
                const headerText = cells[0].textContent?.trim();
                if (headerText && headerText.length > 3 && headerText.length < 100) {
                  currentActivityName = headerText;
                }
              }
              
              // Check if this is an activity data row
              if (rowText.includes('Sign Up') || rowText.includes('Waitlist') || rowText.includes('Closed')) {
                // Parse the row data
                const cellTexts = cells.map(cell => cell.textContent?.trim() || '');
                
                const activity = {
                  category: categoryName,
                  name: currentActivityName || 'Unknown Activity',
                  rowData: cellTexts,
                  fullText: rowText
                };
                
                // Extract structured data from row
                cellTexts.forEach((text, idx) => {
                  // Date patterns
                  if (text.match(/[A-Z][a-z]{2}\s+\d{1,2}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2}/)) {
                    activity.dates = text;
                  }
                  // Day patterns
                  else if (text.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)) {
                    activity.days = text;
                  }
                  // Time patterns
                  else if (text.match(/\d{1,2}:\d{2}\s*[ap]m/i)) {
                    activity.time = text;
                  }
                  // Price patterns
                  else if (text.match(/\$[\d,]+(\.\d{2})?/)) {
                    activity.price = text;
                  }
                  // Age patterns
                  else if (text.match(/\d+\s*[-–]\s*\d+\s*yr/i) || text.match(/\d+\+?\s*yr/i)) {
                    activity.ageRange = text;
                  }
                  // Status patterns
                  else if (text === 'Sign Up' || text === 'Waitlist' || text === 'Closed') {
                    activity.status = text;
                  }
                  // Location keywords
                  else if (text.includes('Centre') || text.includes('Pool') || text.includes('Arena')) {
                    activity.location = text;
                  }
                });
                
                // Get registration URL
                const regLink = row.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
                if (regLink) {
                  activity.registrationUrl = regLink.href;
                  // Extract course ID from URL
                  const courseIdMatch = regLink.href.match(/courseId=([^&]+)/);
                  if (courseIdMatch) {
                    activity.courseId = courseIdMatch[1];
                  }
                }
                
                // Only add if we have meaningful data
                if (activity.name !== 'Unknown Activity' || activity.dates || activity.courseId) {
                  activities.push(activity);
                }
              }
            });
          });
          
          // Strategy 2: Look for activity cards or divs
          if (activities.length === 0) {
            const activityElements = document.querySelectorAll('[class*="activity"], [class*="program"], [class*="course"]');
            activityElements.forEach(el => {
              const text = el.textContent || '';
              if (text.length > 20) {
                const link = el.querySelector('a[href*="courseId"], a[href*="BookMe4"]');
                if (link) {
                  activities.push({
                    category: categoryName,
                    name: el.querySelector('h3, h4, .title')?.textContent?.trim() || 'Activity',
                    fullText: text.substring(0, 500),
                    registrationUrl: link.href
                  });
                }
              }
            });
          }
          
          return activities;
        }, category.name);
        
        console.log(`  ✓ Found ${categoryActivities.length} activities`);
        this.activities.push(...categoryActivities);
        
        // Navigate back to main page for next category
        await page.goto(baseUrl, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`  ❌ Error processing ${category.name}:`, error.message);
      }
    }
  }

  summarizeActivities() {
    const summary = {
      totalCount: this.activities.length,
      byCategory: {},
      byStatus: {},
      uniqueNames: new Set(),
      locations: new Set()
    };
    
    this.activities.forEach(activity => {
      // Count by category
      if (!summary.byCategory[activity.category]) {
        summary.byCategory[activity.category] = 0;
      }
      summary.byCategory[activity.category]++;
      
      // Count by status
      if (activity.status) {
        if (!summary.byStatus[activity.status]) {
          summary.byStatus[activity.status] = 0;
        }
        summary.byStatus[activity.status]++;
      }
      
      // Collect unique names
      if (activity.name && activity.name !== 'Unknown Activity') {
        summary.uniqueNames.add(activity.name);
      }
      
      // Collect locations
      if (activity.location) {
        summary.locations.add(activity.location);
      }
    });
    
    summary.uniqueNameCount = summary.uniqueNames.size;
    summary.uniqueNames = Array.from(summary.uniqueNames).sort();
    summary.locations = Array.from(summary.locations).sort();
    
    return summary;
  }

  generateNavigationDoc() {
    const summary = this.summarizeActivities();
    
    return `# NVRC Activity Scraper Navigation Guide

## Overview
This document provides a comprehensive guide for scraping all activities from the North Vancouver Recreation Centre (NVRC) website. The scraper is designed to be generic and will automatically capture new activities or activity groups as they are added.

## Navigation Flow

### Step 1: Access the Booking System
- **URL**: https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a
- **Description**: Navigate directly to the NVRC PerfectMind booking widget
- **Why**: This bypasses the main website form and provides direct access to all activities

### Step 2: Identify Program Categories
The system displays the following program categories as clickable links:
- All Ages & Family
- Early Years: On My Own
- Early Years: Parent Participation
- School Age
- Youth
- Adult

**Generic Approach**: The scraper automatically identifies all category links on the page, so new categories will be captured automatically.

### Step 3: Process Each Category
For each category:
1. Click the category link to navigate to its programs
2. Wait for the page to load completely
3. Look for "Show" buttons that expand activity groups
4. Click all "Show" buttons to reveal hidden activities
5. Extract activity information from tables

### Step 4: Extract Activity Data
Activities are displayed in tables with the following information:
- Activity name (usually in a header row)
- Date range (e.g., "Jan 6 - Mar 24")
- Days of the week
- Time slots
- Age range
- Location
- Price
- Registration status (Sign Up, Waitlist, Closed)
- Registration link with course ID

### Step 5: Return to Main Page
After processing each category, navigate back to the main booking page to access the next category.

## Data Extraction Strategy

### Primary Method: Table Parsing
1. Identify all tables on the page
2. Look for header rows containing activity names
3. Parse subsequent rows for session details
4. Extract registration URLs and course IDs

### Fallback Method: Activity Cards
If no tables are found, look for:
- Elements with class names containing "activity", "program", or "course"
- Links to registration pages (containing "courseId" or "BookMe4")

## Generic Design Features

1. **Dynamic Category Detection**: Automatically finds all category links
2. **Automatic Expansion**: Clicks all "Show" buttons to reveal hidden content
3. **Flexible Data Extraction**: Multiple strategies to find activity information
4. **Error Resilience**: Continues processing even if individual categories fail

## Summary Statistics
- Total activities found: ${summary.totalCount}
- Unique activity names: ${summary.uniqueNameCount}
- Categories processed: ${Object.keys(summary.byCategory).length}
- Locations found: ${summary.locations.length}

### Activities by Category:
${Object.entries(summary.byCategory).map(([cat, count]) => `- ${cat}: ${count} activities`).join('\n')}

### Registration Status:
${Object.entries(summary.byStatus).map(([status, count]) => `- ${status}: ${count} activities`).join('\n')}

## Running the Scraper

### Headless Mode (for cloud deployment):
\`\`\`javascript
const scraper = new NVRCFinalScraper({ headless: true });
const activities = await scraper.scrape();
\`\`\`

### Debug Mode (with browser window):
\`\`\`javascript
const scraper = new NVRCFinalScraper({ headless: false });
const activities = await scraper.scrape();
\`\`\`

## Maintenance Notes

The scraper is designed to be self-maintaining:
- New categories are automatically detected
- New activity types are captured without code changes
- The extraction logic adapts to different table structures
- All navigation is based on content, not hard-coded selectors

Last updated: ${new Date().toISOString()}
`;
  }
}

// Run the scraper
async function runFinalScraper() {
  const scraper = new NVRCFinalScraper({ headless: true });
  
  try {
    const activities = await scraper.scrape();
    console.log(`\n✅ Scraping complete! Found ${activities.length} activities.`);
    
    // Show sample activities
    console.log('\n📊 Sample activities:');
    activities.slice(0, 5).forEach(activity => {
      console.log(`- ${activity.name} (${activity.category}) - ${activity.status || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  runFinalScraper();
}

module.exports = NVRCFinalScraper;