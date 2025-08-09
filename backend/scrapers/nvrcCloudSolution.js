const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCCloudSolution {
  constructor(options = {}) {
    this.options = options;
  }

  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Cloud Solution Scraper...');
      console.log('🎯 Using the working search form approach to get ALL 1700+ activities');
      
      // Cloud-optimized launch options
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to the NVRC find program page - this is the KEY difference!
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      await page.waitForSelector('form', { timeout: 30000 });
      await this.wait(3000);

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
          await this.wait(500);
        }
      }

      // Wait for Step 2 to load
      console.log('\n⏳ Waiting for Step 2 program activities to appear...');
      
      await page.waitForFunction(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .filter(cb => {
            const label = cb.parentElement?.textContent || '';
            return label.match(/(Swim|Camp|Sport|Art|Dance|Music|Gym|Climb|Martial|Cooking|Yoga|Tennis|Basketball|Soccer)/i) &&
                   !label.includes('years');
          });
        return checkboxes.length > 10;
      }, { timeout: 60000, polling: 1000 });
      
      console.log('  ✅ Step 2 activities loaded!');
      await this.wait(2000);

      // STEP 2: Select ALL activities
      console.log('\n🎯 STEP 2: Selecting ALL program activities...');
      
      const selectedActivities = await page.evaluate(() => {
        const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const activities = [];
        let totalSelected = 0;
        
        // Activity keywords to match
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
          }
        });
        
        return { activities, totalSelected };
      });
      
      console.log(`  ✅ Selected ${selectedActivities.totalSelected} activities`);
      await this.wait(3000);

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
        
        return selectAllOption || locationCheckboxes.length > 5;
      }, { timeout: 60000, polling: 2000 });
      
      console.log('  ✅ Step 3 locations loaded!');
      
      console.log('\n📍 STEP 3: Selecting all locations...');
      
      const locationSelected = await page.evaluate(() => {
        // Try "Select all locations" first
        const selectAllLabel = Array.from(document.querySelectorAll('label'))
          .find(label => {
            const text = label.textContent || '';
            return text.includes('Select all locations') || 
                   text.includes('all locations available');
          });
        
        if (selectAllLabel) {
          const checkbox = selectAllLabel.querySelector('input[type="checkbox"]') ||
                          selectAllLabel.previousElementSibling;
          
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return { method: 'select-all', count: 1 };
          }
        }
        
        // Otherwise select individual locations
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
      await this.wait(2000);

      // Find and click the "Show Results" button
      console.log('\n🔍 Looking for "Show Results" button...');
      
      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('input[type="submit"], button'))
          .find(btn => {
            const text = btn.value || btn.textContent || '';
            return text.includes('Show Results');
          });
        
        if (button) {
          button.click();
        }
      });
      
      console.log('  ✅ Clicked Show Results button');

      // Wait for results page to load
      console.log('\n⏳ Waiting for results to load...');
      
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        new Promise(resolve => setTimeout(resolve, 15000))
      ]);
      
      await this.wait(5000);

      // Extract activities from the results page
      console.log('\n🔍 Extracting activities from results page...');
      
      // Wait for activities to load
      await page.waitForFunction(() => {
        const categories = document.querySelectorAll('.nvrc-activities-category');
        const hasContent = categories.length > 0 || 
                          document.querySelector('.nvrc-activities-service') !== null ||
                          document.querySelector('.activities-category__title') !== null;
        return hasContent;
      }, { timeout: 60000, polling: 3000 }).catch(() => {
        console.log('⚠️  Warning: Activities may not have loaded fully');
      });
      
      await this.wait(5000);
      
      const activities = await page.evaluate(() => {
        const allActivities = [];
        
        // Find all category sections
        const categorySections = document.querySelectorAll('.nvrc-activities-category');
        
        categorySections.forEach(categorySection => {
          const categoryName = categorySection.querySelector('.activities-category__title')?.textContent?.trim() || 'Unknown';
          
          // Find all service groups within this category
          const serviceGroups = categorySection.querySelectorAll('.nvrc-activities-service');
          
          serviceGroups.forEach(serviceGroup => {
            const serviceName = serviceGroup.querySelector('.activities-service__title')?.textContent?.trim() || 'Unknown Service';
            
            // Find all events/activities within this service
            const eventRows = serviceGroup.querySelectorAll('.nvrc-activities-events__row');
            
            eventRows.forEach((row) => {
              try {
                // Extract activity details
                const name = row.querySelector('.events-row__title a')?.textContent?.trim() || serviceName;
                const dates = row.querySelector('.events-row__dates')?.textContent?.trim() || '';
                const schedule = row.querySelector('.events-row__schedule')?.textContent?.trim() || '';
                const ageRange = row.querySelector('.events-row__ages')?.textContent?.trim() || '';
                const location = row.querySelector('.events-row__location')?.textContent?.trim() || '';
                const cost = row.querySelector('.events-row__cost')?.textContent?.trim() || '';
                const spotsText = row.querySelector('.events-row__spots')?.textContent?.trim() || '';
                const registrationUrl = row.querySelector('.events-row__register a')?.href || '';
                const courseId = row.querySelector('.events-row__barcode')?.textContent?.trim() || '';
                
                // Parse age range
                let ageMin = null, ageMax = null;
                const ageMatch = ageRange.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
                if (ageMatch) {
                  ageMin = parseInt(ageMatch[1]);
                  ageMax = parseInt(ageMatch[2]);
                }
                
                // Parse cost
                let costAmount = 0;
                if (cost) {
                  const costMatch = cost.match(/\$?([\d,]+(?:\.\d{2})?)/);
                  if (costMatch) {
                    costAmount = parseFloat(costMatch[1].replace(',', ''));
                  }
                }
                
                // Clean course ID
                const cleanCourseId = courseId.replace('Barcode:', '').trim();
                const uniqueId = cleanCourseId || `NVRC_${categoryName}_${serviceName}_${name}_${dates}`.replace(/\s+/g, '_');
                
                const activity = {
                  id: uniqueId,
                  name: name || serviceName,
                  category: categoryName,
                  subcategory: serviceName,
                  dates,
                  schedule,
                  ageRange: ageMin !== null ? { min: ageMin, max: ageMax || ageMin } : null,
                  location,
                  cost: costAmount,
                  registrationUrl,
                  courseId: cleanCourseId,
                  provider: 'NVRC',
                  scrapedAt: new Date().toISOString()
                };
                
                allActivities.push(activity);
              } catch (error) {
                console.error('Error extracting activity:', error);
              }
            });
          });
        });
        
        return allActivities;
      });

      console.log(`\n✅ Successfully extracted ${activities.length} activities`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_cloud_solution_${timestamp}.json`;
      
      const results = {
        timestamp: new Date().toISOString(),
        activitiesCount: activities.length,
        activities
      };
      
      fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to ${filename}`);
      
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

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCCloudSolution({ headless: true });
  scraper.scrape()
    .then(activities => {
      console.log(`\n✅ Done! Found ${activities.length} activities`);
      if (activities.length > 0) {
        console.log('\nFirst 5 activities:');
        activities.slice(0, 5).forEach((a, i) => {
          console.log(`${i+1}. ${a.name} (${a.category} - ${a.subcategory})`);
          console.log(`   Location: ${a.location}`);
          console.log(`   Course ID: ${a.courseId}`);
        });
      }
    })
    .catch(console.error);
}

module.exports = NVRCCloudSolution;