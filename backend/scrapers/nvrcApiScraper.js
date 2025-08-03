const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer');

class NVRCApiScraper {
  constructor() {
    this.baseUrl = 'https://www.nvrc.ca';
    this.activities = [];
    this.apiEndpoints = [];
  }

  async scrape() {
    console.log('🚀 Starting NVRC Direct API Scraper...');
    
    try {
      // First, we need to get a valid form_build_id by visiting the page
      const formData = await this.getFormData();
      
      if (!formData) {
        console.log('⚠️ Could not get form data, trying alternative approach...');
        return await this.scrapeWithActiveCommunities();
      }
      
      // Build the API URL with all programs selected
      const apiUrl = this.buildApiUrl(formData.formBuildId);
      console.log('\n📡 API URL:', apiUrl.substring(0, 100) + '...');
      
      // Make the API request
      console.log('\n🔍 Fetching activities from PerfectMind API...');
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.nvrc.ca/programs-memberships/find-program'
        }
      });
      
      console.log('✅ API Response received');
      
      // Parse the response
      const data = response.data?.data || {};
      console.log(`\n📊 Categories found: ${Object.keys(data).length}`);
      
      // Extract activities from each category
      let totalActivities = 0;
      
      for (const [categoryKey, categoryData] of Object.entries(data)) {
        if (categoryData.activities) {
          const categoryActivities = Object.values(categoryData.activities);
          console.log(`\n📁 ${categoryData.group?.name || categoryKey}: ${categoryActivities.length} subcategories`);
          
          for (const activity of categoryActivities) {
            // Count services as individual activities
            const serviceCount = activity.Services?.length || 0;
            totalActivities += serviceCount;
            
            this.activities.push({
              id: activity.id,
              category: activity.group || categoryKey,
              subcategory: activity.name,
              keywords: activity.keywords?.split('\r\n').filter(k => k) || [],
              services: activity.Services || [],
              serviceCount: serviceCount
            });
          }
        }
      }
      
      console.log(`\n✅ Total activities found: ${totalActivities}`);
      
      // Now we need to get the actual activity details
      // The API response only gives us categories and service names
      // We need to visit the ActiveCommunities iframe to get full details
      
      if (totalActivities < 700) {
        console.log('\n⚠️ Less than 700 activities found in API response.');
        console.log('Proceeding to ActiveCommunities scraping for full details...');
        return await this.scrapeWithActiveCommunities();
      }
      
      // Save the results
      const results = {
        timestamp: new Date().toISOString(),
        source: 'PerfectMind API',
        totalActivities: totalActivities,
        categories: Object.keys(data).length,
        activities: this.activities,
        rawData: data
      };
      
      const filename = `nvrc_api_activities_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results saved to ${filename}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ API Scraper error:', error.message);
      console.log('\nFalling back to ActiveCommunities scraping...');
      return await this.scrapeWithActiveCommunities();
    }
  }
  
  async getFormData() {
    let browser;
    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0'
      });
      
      const formData = await page.evaluate(() => {
        const formBuildIdInput = document.querySelector('input[name="form_build_id"]');
        const formIdInput = document.querySelector('input[name="form_id"]');
        
        return {
          formBuildId: formBuildIdInput?.value,
          formId: formIdInput?.value
        };
      });
      
      await browser.close();
      return formData;
      
    } catch (error) {
      if (browser) await browser.close();
      return null;
    }
  }
  
  buildApiUrl(formBuildId) {
    const programs = [
      'Adult',
      'All Ages & Family',
      'Early Years: On My Own',
      'Early Years: Parent Participation',
      'School Age',
      'Senior',
      'Youth'
    ];
    
    const params = new URLSearchParams();
    
    // Add all programs
    programs.forEach(program => {
      params.append(`programs[${program}]`, program);
    });
    
    // Add form data
    params.append('form_build_id', formBuildId);
    params.append('form_id', 'perfectmind_search_block_form');
    
    return `${this.baseUrl}/perfectmind/api/activities?${params.toString()}`;
  }
  
  async scrapeWithActiveCommunities() {
    console.log('\n🔄 Starting ActiveCommunities iframe scraping...');
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });
      
      const page = await browser.newPage();
      
      // Navigate to NVRC
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      // Quick form fill - select everything
      await page.evaluate(() => {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          if (!cb.checked) cb.checked = true;
        });
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Submit form
      await page.evaluate(() => {
        const submitBtn = document.querySelector('input[value="Show Results"]');
        if (submitBtn) submitBtn.click();
      });
      
      // Wait for results
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Find ActiveCommunities iframe
      const iframeElement = await page.$('iframe[src*="activecommunities"]');
      if (!iframeElement) {
        throw new Error('Could not find ActiveCommunities iframe');
      }
      
      const frame = await iframeElement.contentFrame();
      console.log('✅ Found ActiveCommunities iframe');
      
      // Wait for content
      await frame.waitForFunction(
        () => document.body.innerText.includes('courseRows') || 
             document.body.innerText.includes('Swimming'),
        { timeout: 30000 }
      );
      
      // Get the total count
      const stats = await frame.evaluate(() => {
        const bodyText = document.body.innerText;
        const courseRowsMatch = bodyText.match(/courseRows:\s*(\d+)/);
        return {
          courseCount: courseRowsMatch ? parseInt(courseRowsMatch[1]) : 0,
          bodyPreview: bodyText.substring(0, 500)
        };
      });
      
      console.log(`\n📊 ActiveCommunities shows ${stats.courseCount} activities`);
      
      // Strategy: Click each category and then each subsection
      const allActivities = [];
      
      // Find all category bars
      const categories = await frame.evaluate(() => {
        const cats = [];
        const links = document.querySelectorAll('a[style*="background-color: rgb(0, 123, 193)"]');
        links.forEach(link => {
          const text = link.textContent.trim();
          if (text && text.match(/\d+$/)) {
            cats.push(text);
          }
        });
        return cats;
      });
      
      console.log(`\n📂 Found ${categories.length} categories to expand`);
      
      // Process each category
      for (let catIndex = 0; catIndex < categories.length; catIndex++) {
        const categoryName = categories[catIndex];
        console.log(`\n🔷 Processing category ${catIndex + 1}/${categories.length}: ${categoryName}`);
        
        // Click category
        await frame.evaluate((catName) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === catName) {
              link.click();
              break;
            }
          }
        }, categoryName);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Find all subsections in this category
        const subsections = await frame.evaluate(() => {
          const subs = [];
          const links = document.querySelectorAll('a');
          
          links.forEach(link => {
            const text = link.textContent.trim();
            // Subsections don't end with numbers and contain activity names
            if (!text.match(/\d+$/) && 
                !text.includes('Category') &&
                text.length > 3 &&
                (text.includes('Level') || text.includes('Swimmer') || 
                 text.includes('Camp') || text.includes('Program') ||
                 text.includes('Beginner') || text.includes('Advanced') ||
                 text.includes('Introduction') || text.includes('Private'))) {
              subs.push(text);
            }
          });
          
          // Remove duplicates
          return [...new Set(subs)];
        });
        
        console.log(`  Found ${subsections.length} subsections`);
        
        // Click each subsection
        for (let subIndex = 0; subIndex < subsections.length; subIndex++) {
          const subsectionName = subsections[subIndex];
          console.log(`  📄 Subsection ${subIndex + 1}/${subsections.length}: ${subsectionName}`);
          
          // Click subsection
          const clicked = await frame.evaluate((subName) => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (link.textContent.trim() === subName) {
                link.click();
                return true;
              }
            }
            return false;
          }, subsectionName);
          
          if (clicked) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Extract activities from the expanded content
            const activities = await frame.evaluate((catName, subName) => {
              const extracted = [];
              
              // Look for activity rows in tables
              const rows = document.querySelectorAll('tr');
              rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3 && row.textContent.includes('$')) {
                  const activity = {
                    category: catName,
                    subcategory: subName,
                    name: cells[0]?.textContent.trim() || '',
                    schedule: cells[1]?.textContent.trim() || '',
                    cost: cells[2]?.textContent.trim() || '',
                    location: cells[3]?.textContent.trim() || '',
                    spots: cells[4]?.textContent.trim() || '',
                    rawText: row.textContent.trim()
                  };
                  
                  // Only add if it has meaningful data
                  if (activity.name && activity.cost) {
                    extracted.push(activity);
                  }
                }
              });
              
              return extracted;
            }, categoryName, subsectionName);
            
            if (activities.length > 0) {
              console.log(`    ✓ Extracted ${activities.length} activities`);
              allActivities.push(...activities);
            }
            
            // Click subsection again to collapse
            await frame.evaluate((subName) => {
              const links = document.querySelectorAll('a');
              for (const link of links) {
                if (link.textContent.trim() === subName) {
                  link.click();
                  break;
                }
              }
            }, subsectionName);
            
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Collapse category
        await frame.evaluate((catName) => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === catName) {
              link.click();
              break;
            }
          }
        }, categoryName);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`  Total activities so far: ${allActivities.length}`);
      }
      
      // Process and clean activities
      const processedActivities = allActivities.map((activity, index) => ({
        id: `nvrc_${index + 1}`,
        ...activity,
        provider: 'NVRC',
        scrapedAt: new Date().toISOString()
      }));
      
      console.log(`\n✅ Scraping complete! Total activities extracted: ${processedActivities.length}`);
      
      // Save results
      const results = {
        timestamp: new Date().toISOString(),
        source: 'ActiveCommunities iframe',
        totalActivities: processedActivities.length,
        expectedActivities: stats.courseCount,
        completeness: `${Math.round((processedActivities.length / stats.courseCount) * 100)}%`,
        activities: processedActivities
      };
      
      const filename = `nvrc_complete_activities_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results saved to ${filename}`);
      
      // Take screenshot
      await page.screenshot({ 
        path: `nvrc_complete_${new Date().toISOString().replace(/[:.]/g, '-')}.png`, 
        fullPage: true 
      });
      
      await browser.close();
      return results;
      
    } catch (error) {
      console.error('❌ ActiveCommunities scraper error:', error);
      if (browser) await browser.close();
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCApiScraper();
  scraper.scrape()
    .then(results => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Total activities: ${results.totalActivities}`);
      if (results.completeness) {
        console.log(`Completeness: ${results.completeness}`);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCApiScraper;