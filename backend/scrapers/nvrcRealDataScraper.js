const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCRealDataScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Real Data Scraper - NO SAMPLE DATA!');
      browser = await puppeteer.launch({
        headless: false, // Keep visible to debug
        slowMo: 150, // Slow down to ensure form loads
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
        defaultViewport: null
      });

      const page = await browser.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        if (!msg.text().includes('JQMIGRATE') && !msg.text().includes('Slow network')) {
          console.log('PAGE LOG:', msg.text());
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      // Navigate directly to the NVRC find program page
      console.log('\n📍 Navigating to NVRC Find Program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if we're redirected to an external search system
      const currentUrl = page.url();
      console.log('  Current URL:', currentUrl);
      
      // If we're on the Active Communities platform
      if (currentUrl.includes('activecommunities.com')) {
        console.log('  ✓ Redirected to Active Communities search platform');
      }

      // Wait for the form to load
      console.log('\n⏳ Waiting for search form to load...');
      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot of the form page
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/form-page.png' });
      console.log('📸 Form page screenshot saved');

      // Debug: Print all checkboxes on the page
      const checkboxInfo = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        return checkboxes.map(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          return {
            id: cb.id,
            name: cb.name,
            value: cb.value,
            checked: cb.checked,
            labelText: label ? label.textContent.trim() : 'No label'
          };
        });
      });
      
      console.log('\n📋 Found checkboxes:', checkboxInfo);

      // STEP 1: Select ONLY kids age groups (not Adult, Senior, or All Ages)
      console.log('\n📋 STEP 1: Selecting ONLY kids age groups...');
      
      // First, get current state of all checkboxes
      const initialState = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        return checkboxes.map(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          return {
            text: label ? label.textContent.trim() : '',
            checked: cb.checked
          };
        });
      });
      
      console.log('  Initial checkbox states:', initialState);
      
      // UNCHECK ALL age groups first
      console.log('  🔄 Unchecking ALL age groups...');
      const uncheckedCount = await page.evaluate(() => {
        let count = 0;
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        
        checkboxes.forEach(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          const labelText = label ? label.textContent.trim() : '';
          
          // Uncheck ALL checkboxes in Step 1 (all age-related ones)
          if (cb.checked && (
              labelText.includes('years') || 
              labelText.includes('Adult') || 
              labelText.includes('Senior') || 
              labelText.includes('All Ages') ||
              labelText.includes('Parent Participation') ||
              labelText.includes('On My Own') ||
              labelText.includes('School Age') ||
              labelText.includes('Youth')
          )) {
            cb.click(); // Uncheck it
            count++;
            console.log(`Unchecked: ${labelText}`);
          }
        });
        
        return count;
      });
      
      console.log(`  ✓ Unchecked ${uncheckedCount} checkboxes`);
      
      // Wait for form to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Now select ONLY the kids age groups
      const kidsAgeGroups = [
        '0 - 6 years, Parent Participation',
        '0 - 6 years, On My Own', 
        '5 - 13 years, School Age',
        '10 - 18 years, Youth'
      ];
      
      let ageGroupsSelected = 0;
      for (const ageText of kidsAgeGroups) {
        const selected = await page.evaluate((text) => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          for (const cb of checkboxes) {
            const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
            const labelText = label ? label.textContent : cb.value;
            if (labelText && labelText.includes(text)) {
              if (!cb.checked) {
                cb.click();
                return true;
              }
              return 'already checked';
            }
          }
          return false;
        }, ageText);
        
        if (selected === true) {
          console.log(`  ✓ Selected: ${ageText}`);
          ageGroupsSelected++;
        } else if (selected === 'already checked') {
          console.log(`  ✓ Already selected: ${ageText}`);
          ageGroupsSelected++;
        } else {
          console.log(`  ✗ Could not find: ${ageText}`);
        }
      }
      
      console.log(`  Total kids age groups selected: ${ageGroupsSelected}/4`);
      
      // Verify that Adult, Senior, and All Ages are NOT selected
      const verifyUnwanted = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const unwantedChecked = [];
        
        checkboxes.forEach(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          const labelText = label ? label.textContent.trim() : '';
          
          if (cb.checked && (
              labelText.includes('Adult') || 
              labelText.includes('Senior') || 
              labelText.includes('All Ages')
          )) {
            unwantedChecked.push(labelText);
          }
        });
        
        return unwantedChecked;
      });
      
      if (verifyUnwanted.length > 0) {
        console.log(`  ❌ ERROR: These unwanted groups are still selected:`, verifyUnwanted);
        // Uncheck them again
        await page.evaluate(() => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          checkboxes.forEach(cb => {
            const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
            const labelText = label ? label.textContent.trim() : '';
            
            if (cb.checked && (
                labelText.includes('Adult') || 
                labelText.includes('Senior') || 
                labelText.includes('All Ages')
            )) {
              cb.click(); // Uncheck it
              console.log(`Unchecked again: ${labelText}`);
            }
          });
        });
      } else {
        console.log(`  ✅ Verified: No Adult, Senior, or All Ages selected`);
      }

      // Wait for Step 2 to populate
      console.log('\n⏳ Waiting for Step 2 program activities to appear...');
      
      // Wait up to 30 seconds for Step 2 to fully load
      console.log('  ⏳ Waiting up to 30 seconds for Step 2 to load...');
      
      try {
        await page.waitForFunction(() => {
          // Look for any element that indicates loading
          const loadingIndicators = document.querySelectorAll('.spinner, .loading, [class*="load"], .fa-spin, .fa-spinner');
          const isLoading = Array.from(loadingIndicators).some(el => 
            el.offsetParent !== null && // visible
            !el.classList.contains('hidden') && 
            el.style.display !== 'none'
          );
          
          if (isLoading) {
            console.log('Still loading...');
            return false;
          }
          
          // Check if activity checkboxes have appeared in Step 2 area
          const step2Section = document.querySelector('[class*="step-2"], #step2, .step2');
          const activityCheckboxes = document.querySelectorAll('input[type="checkbox"]');
          let activityCount = 0;
          
          activityCheckboxes.forEach(cb => {
            const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
            const text = label ? label.textContent.trim() : '';
            
            // Count non-age group, non-location checkboxes
            if (text && 
                !text.includes('years') && 
                !text.includes('Parent Participation') &&
                !text.includes('Adult') &&
                !text.includes('Senior') &&
                !text.includes('All Ages') &&
                !text.includes('location') && 
                !text.includes('Select all')) {
              activityCount++;
            }
          });
          
          console.log(`Found ${activityCount} activity checkboxes`);
          
          // We expect at least some activities after loading
          return activityCount > 5; // Expecting more than 5 activities
        }, { timeout: 35000, polling: 'mutation' }); // Poll for DOM changes
        
        console.log('  ✅ Step 2 activities fully loaded!');
      } catch (e) {
        console.log('  ⚠️ Timeout waiting for Step 2 activities after 35 seconds');
        console.log('  Continuing anyway to see what we have...');
      }
      
      // Extra wait to ensure everything settles
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot after Step 1 and waiting
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/after-step1-wait.png' });
      console.log('📸 Screenshot saved: after-step1-wait.png');

      // STEP 2: Select ALL program activities
      console.log('\n🎯 STEP 2: Selecting ALL program activities...');
      
      // First, expand all collapsible sections
      console.log('  📂 Expanding all activity sections...');
      const sectionsExpanded = await page.evaluate(() => {
        // Look for section headers that can be expanded
        const headers = Array.from(document.querySelectorAll('h4, h5, .panel-heading, [data-toggle="collapse"], button[aria-expanded]'));
        let expandedCount = 0;
        
        headers.forEach(header => {
          // Check if it's a collapsible section
          const isCollapsed = header.getAttribute('aria-expanded') === 'false' || 
                             header.classList.contains('collapsed');
          
          if (isCollapsed || header.getAttribute('data-toggle') === 'collapse') {
            header.click();
            expandedCount++;
          }
        });
        
        return expandedCount;
      });
      
      console.log(`  ✓ Expanded ${sectionsExpanded} sections`);
      
      // Wait for sections to expand
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Now select ALL activity checkboxes in Step 2
      console.log('  ✅ Selecting ALL program activities...');
      
      const step2Result = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const activityCheckboxes = [];
        let selectedCount = 0;
        let skippedCount = 0;
        
        checkboxes.forEach(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          const text = label ? label.textContent.trim() : '';
          
          // Skip age groups and locations
          const isAgeGroup = text.includes('years') || 
                            text.includes('Parent Participation') || 
                            text.includes('On My Own') ||
                            text.includes('Adult') ||
                            text.includes('Senior') ||
                            text.includes('All Ages');
          const isLocation = text.toLowerCase().includes('location') || 
                            text.includes('Select all locations');
          
          if (!isAgeGroup && !isLocation && text && text.length > 0) {
            // This is a program activity - SELECT IT!
            activityCheckboxes.push({
              text: text,
              wasChecked: cb.checked
            });
            
            if (!cb.checked) {
              cb.click(); // CLICK TO SELECT!
              selectedCount++;
              console.log(`Selected activity: ${text}`);
            }
          } else if (text) {
            skippedCount++;
          }
        });
        
        return {
          total: activityCheckboxes.length,
          selected: selectedCount,
          skipped: skippedCount,
          activities: activityCheckboxes.slice(0, 15) // First 15 for logging
        };
      });
      
      console.log(`  ✅ Found ${step2Result.total} activity checkboxes`);
      console.log(`  ✅ Selected ${step2Result.selected} new activities`);
      console.log(`  ℹ️ Skipped ${step2Result.skipped} non-activity checkboxes`);
      if (step2Result.activities.length > 0) {
        console.log(`  Sample activities selected:`, step2Result.activities.map(a => a.text).slice(0, 10));
      }
      
      // Take screenshot after Step 2
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/after-step2-selection.png' });
      console.log('📸 Screenshot saved: after-step2-selection.png');

      // Wait for Step 3 to populate - this might take longer
      console.log('\n⏳ Waiting for Step 3 locations to appear (this may take up to 30 seconds)...');
      
      // Wait for locations to load by checking for the checkbox
      try {
        await page.waitForFunction(() => {
          // Look for the "Select all locations available" checkbox
          const labels = Array.from(document.querySelectorAll('label'));
          const selectAllLocation = labels.find(label => {
            const text = label.textContent.trim();
            return text.includes('Select all locations');
          });
          
          if (selectAllLocation) {
            console.log('Found "Select all locations" option!');
            return true;
          }
          
          // Also check if individual location checkboxes have appeared
          const locationCheckboxes = labels.filter(label => {
            const text = label.textContent.trim();
            return (text.includes('Centre') || 
                   text.includes('Community') || 
                   text.includes('School') || 
                   text.includes('Park') ||
                   text.includes('Pool') ||
                   text.includes('Arena')) &&
                   !text.includes('years') &&
                   !text.includes('Activity');
          });
          
          console.log(`Found ${locationCheckboxes.length} location checkboxes`);
          return locationCheckboxes.length > 0;
        }, { timeout: 30000, polling: 'mutation' });
        
        console.log('  ✅ Step 3 locations loaded!');
      } catch (e) {
        console.log('  ⚠️ Timeout waiting for Step 3 locations after 30 seconds');
      }
      
      // Additional wait to ensure everything settles
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting all locations...');
      console.log('  🔍 Looking for "Select all locations available" checkbox...');
      
      const locationSelected = await page.evaluate(() => {
        // Look for the "Select all locations available" checkbox specifically
        const labels = Array.from(document.querySelectorAll('label'));
        
        for (const label of labels) {
          const text = label.textContent.trim();
          if (text === 'Select all locations available' || text.includes('Select all locations')) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.querySelector(`#${label.getAttribute('for')}`);
            
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              return 'clicked "Select all locations available"';
            } else if (checkbox && checkbox.checked) {
              return 'already selected all locations';
            }
          }
        }
        
        // If no "select all", look for location checkboxes
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        let selectedCount = 0;
        
        checkboxes.forEach(cb => {
          const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
          const text = label ? label.textContent.trim() : '';
          
          // Skip age groups and activities
          const isAgeGroup = text.includes('years') || text.includes('Parent Participation');
          const isActivity = text.includes('Aquatic') || text.includes('Camp') || 
                           text.includes('Sport') || text.includes('Art');
          
          // Select if it looks like a location
          if (!isAgeGroup && !isActivity && 
              (text.includes('Centre') || text.includes('Community') || 
               text.includes('School') || text.includes('Park') ||
               text.includes('Pool') || text.includes('Arena'))) {
            if (!cb.checked) {
              cb.click();
              selectedCount++;
            }
          }
        });
        
        return selectedCount > 0 ? `selected ${selectedCount} locations` : 'no location checkboxes found';
      });
      
      console.log(`  Result: ${locationSelected}`);
      
      // Take screenshot after Step 3
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/after-step3-selection.png' });
      console.log('📸 Screenshot saved: after-step3-selection.png');

      // Take screenshot before submit
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/ready-to-submit.png', fullPage: true });

      // Wait a bit for the button to become enabled
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Submit the form - look for the "Show Results" button
      console.log('\n🔍 Looking for "Show Results" button...');
      
      // Check if the button is now enabled
      const buttonState = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
        const showResultsBtn = buttons.find(btn => {
          const text = (btn.textContent || btn.value || '');
          return text.includes('Show Results') || text.includes('Show Programs');
        });
        
        if (showResultsBtn) {
          return {
            found: true,
            text: showResultsBtn.textContent || showResultsBtn.value,
            disabled: showResultsBtn.disabled,
            className: showResultsBtn.className,
            tag: showResultsBtn.tagName
          };
        }
        return { found: false };
      });
      
      console.log('  Button state:', buttonState);
      
      // Click the Show Results button
      const submitResult = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
        const showResultsBtn = buttons.find(btn => {
          const text = (btn.textContent || btn.value || '');
          return text.includes('Show Results') || text.includes('Show Programs');
        });
        
        if (showResultsBtn && !showResultsBtn.disabled) {
          console.log('Clicking Show Results button');
          showResultsBtn.click();
          return 'clicked Show Results button';
        } else if (showResultsBtn && showResultsBtn.disabled) {
          return 'Show Results button is still disabled';
        }
        
        return 'Show Results button not found';
      });
      
      console.log(`  Submit result: ${submitResult}`);

      // Wait for results page
      console.log('\n⏳ Waiting for results to load...');
      
      // Handle both navigation and dynamic content loading
      const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => null);
      const contentPromise = page.waitForSelector('.activity-results, .search-results, .program-list, table', { timeout: 30000 }).catch(() => null);
      
      await Promise.race([navigationPromise, contentPromise]);
      
      // Additional wait to ensure dynamic content is loaded
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check current URL
      const resultsUrl = page.url();
      console.log('  Results page URL:', resultsUrl);

      // Take screenshot of results
      await page.screenshot({ path: '/Users/mike/Development/KidsActivityTracker/backend/results-page.png', fullPage: true });
      console.log('📸 Results page screenshot saved');

      // Extract activities from results
      console.log('\n📊 Extracting REAL activities from results...');
      
      const activities = await this.extractRealActivities(page);
      
      console.log(`\n✅ Successfully scraped ${activities.length} REAL activities`);
      
      if (activities.length === 0) {
        console.log('\n❌ NO ACTIVITIES FOUND! Check screenshots to debug.');
      }
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `/Users/mike/Development/KidsActivityTracker/backend/nvrc_real_activities_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(activities, null, 2));
      console.log(`💾 Results saved to ${filename}`);
      
      return activities;
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    } finally {
      if (browser) {
        console.log('\n🔚 Closing browser...');
        await browser.close();
      }
    }
  }

  async extractRealActivities(page) {
    const activities = [];
    
    try {
      // Wait for results to load - look for activity containers
      console.log('\n🔍 Waiting for activity results to load...');
      
      try {
        await page.waitForSelector('.activity-group-container, .list-group, .k-grid, table.activities', { 
          timeout: 15000 
        });
        console.log('  ✓ Found activity containers');
      } catch (e) {
        console.log('  ⚠️ Standard selectors not found, checking for any results...');
      }

      // Debug page structure
      const pageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          hasActivities: document.body.innerText.includes('activity') || 
                        document.body.innerText.includes('program'),
          // Look for various possible container classes
          activityGroups: document.querySelectorAll('.activity-group-container, .activity-group').length,
          listGroups: document.querySelectorAll('.list-group').length,
          panels: document.querySelectorAll('.panel').length,
          tables: document.querySelectorAll('table').length,
          // Check for specific ActiveCommunities elements
          courseRows: document.querySelectorAll('[id*="course"], [class*="course"]').length,
          activityCards: document.querySelectorAll('.activity-card, .program-card').length,
          // Kendo grid specific elements
          masterRows: document.querySelectorAll('tr.k-master-row').length,
          detailRows: document.querySelectorAll('tr.k-detail-row').length,
          expandedRows: document.querySelectorAll('tr.k-state-expanded').length
        };
      });
      
      console.log('\n📊 Results page structure:', pageInfo);

      // Check if we're on a category listing page
      const pageType = await page.evaluate(() => {
        // Check for category links on the left sidebar
        const categoryLinks = document.querySelectorAll('a[href*="Activities/ActivitiesAdvSearch"]');
        const hasDetailedActivities = document.querySelectorAll('.list-group-item, table tr').length > 20;
        
        return {
          hasCategoryLinks: categoryLinks.length > 0,
          categoryCount: categoryLinks.length,
          hasDetailedActivities: hasDetailedActivities,
          categories: Array.from(categoryLinks).map(link => link.textContent.trim())
        };
      });
      
      console.log('\n📋 Page type analysis:', pageType);
      
      if (pageType.hasCategoryLinks && !pageType.hasDetailedActivities) {
        console.log('\n🔗 Found category listing page with categories:', pageType.categories);
        console.log('ℹ️ This appears to be a category selection page, not detailed results.');
        console.log('ℹ️ You may need to click on individual categories to see activities.');
        
        // For now, try to extract what we can from this page
        // In a future update, we could navigate to each category
      }
      
      // First, expand all sections to reveal all activities
      console.log('\n📂 Expanding all activity sections hierarchically...');
      await this.expandAllSections(page);
      
      // Extract activities from current page
      const extractedActivities = await this.extractActivitiesFromPage(page);
      
      console.log(`\n✅ Extracted ${extractedActivities.length} activities from results page`);
      
      if (extractedActivities.length > 0) {
        console.log('Sample activities found:', extractedActivities.slice(0, 5).map(a => ({
          name: a.name,
          cost: a.cost,
          location: a.location
        })));
      }
      
      // Transform activities to match frontend expected format
      const transformedActivities = extractedActivities.map(activity => {
        // Parse dates to create dateRange
        const dateRange = this.parseDateRange(activity.dates || activity.schedule);
        
        // Transform location string to object
        const location = {
          name: activity.location || 'North Vancouver',
          address: activity.location || 'North Vancouver, BC'
        };
        
        // Parse schedule to match expected format
        const schedule = this.parseSchedule(activity.schedule);
        
        return {
          id: activity.id,
          name: activity.name,
          provider: 'North Vancouver Recreation & Culture',
          description: activity.description,
          activityType: this.determineActivityType(activity.name + ' ' + activity.description),
          ageRange: activity.ageRange,
          dateRange: dateRange,
          schedule: schedule,
          location: location,
          cost: activity.cost,
          spotsAvailable: parseInt(activity.spotsAvailable) || 10, // Default to 10 if not specified
          totalSpots: 20, // Default total spots
          registrationUrl: activity.registrationUrl || '',
          scrapedAt: new Date()
        };
      });
      
      return transformedActivities;
      
    } catch (error) {
      console.error('Error extracting activities:', error);
    }
    
    return activities;
  }
  
  async expandAllSections(page) {
    try {
      // Keep expanding until no more sections can be expanded
      let totalExpanded = 0;
      let expansionRound = 0;
      
      while (true) {
        expansionRound++;
        console.log(`  📁 Expansion round ${expansionRound}...`);
        
        const expandedCount = await page.evaluate(() => {
          let count = 0;
          
          // Find all expandable elements - look for various patterns
          const expandableSelectors = [
            // Common patterns for expandable headers
            '.k-icon.k-i-arrow-60-right',
            '.k-icon.k-plus',
            '.expand-icon',
            '.collapsed',
            'a[aria-expanded="false"]',
            'button[aria-expanded="false"]',
            '[data-toggle="collapse"]:not(.in)',
            '.accordion-toggle.collapsed',
            // Specific to NVRC/ActiveCommunities
            '.k-master-row .k-hierarchy-cell .k-icon',
            'tr.k-master-row:not(.k-state-expanded) .k-icon',
            '.activity-group-header:not(.expanded)',
            '.category-header:not(.expanded)'
          ];
          
          const elementsToClick = [];
          
          expandableSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              // Check if element is visible
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                elementsToClick.push(el);
              }
            });
          });
          
          // Also check for table rows that might be expandable
          const tableRows = document.querySelectorAll('tr.k-master-row');
          tableRows.forEach(row => {
            if (!row.classList.contains('k-state-expanded')) {
              const expandIcon = row.querySelector('.k-icon');
              if (expandIcon) {
                elementsToClick.push(expandIcon);
              }
            }
          });
          
          // Click all expandable elements
          elementsToClick.forEach(el => {
            try {
              el.click();
              count++;
            } catch (e) {
              console.error('Failed to click element:', e);
            }
          });
          
          return count;
        });
        
        totalExpanded += expandedCount;
        console.log(`    ✓ Expanded ${expandedCount} sections`);
        
        // If nothing was expanded, we're done
        if (expandedCount === 0) {
          break;
        }
        
        // Wait for content to load after expansion
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Safety check - don't run more than 10 rounds
        if (expansionRound > 10) {
          console.log('    ⚠️ Reached maximum expansion rounds');
          break;
        }
      }
      
      console.log(`  ✅ Total sections expanded: ${totalExpanded}`);
      
      // Take a screenshot after all expansions
      await page.screenshot({ 
        path: '/Users/mike/Development/KidsActivityTracker/backend/results-expanded.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved: results-expanded.png - showing all expanded sections');
      
    } catch (error) {
      console.error('Error expanding sections:', error);
    }
  }
  
  async extractActivitiesFromPage(page) {
    const extractedActivities = await page.evaluate(() => {
      const activities = [];
      
      // First try to find detail rows in the expanded table structure
      const detailRows = document.querySelectorAll('tr.k-detail-row, tr[class*="detail"]');
      console.log(`Found ${detailRows.length} detail rows`);
      
      detailRows.forEach((detailRow, index) => {
        try {
          // Look for activity tables within detail rows
          const activityTables = detailRow.querySelectorAll('table');
          
          activityTables.forEach(table => {
            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach((row, rowIndex) => {
              const cells = Array.from(row.querySelectorAll('td'));
              if (cells.length >= 3) {
                const activity = {
                  id: `nvrc-${Date.now()}-${index}-${rowIndex}`,
                  name: '',
                  description: '',
                  ageRange: { min: 0, max: 18 },
                  cost: 0,
                  location: '',
                  schedule: '',
                  dates: '',
                  registrationUrl: '',
                  spotsAvailable: ''
                };
                
                // Parse the row data - typical format has activity info, dates, times, location, cost
                const fullText = row.textContent;
                
                // Extract activity name (usually first cell or contains the program name)
                activity.name = cells[0]?.textContent.trim() || '';
                
                // Extract dates (look for date patterns)
                const dateMatch = fullText.match(/([A-Z][a-z]{2}\s+\d{1,2}(?:\s*-\s*[A-Z][a-z]{2}\s+\d{1,2})?)/);
                if (dateMatch) {
                  activity.dates = dateMatch[0];
                }
                
                // Extract times
                const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?)/);
                if (timeMatch) {
                  activity.schedule = timeMatch[0];
                }
                
                // Extract location
                const locationMatch = fullText.match(/([\w\s]+(?:Centre|Center|Community|School|Park|Pool|Arena|Gym|Room))/i);
                if (locationMatch) {
                  activity.location = locationMatch[0].trim();
                }
                
                // Extract cost
                const costMatch = fullText.match(/\$(\d+(?:\.\d{2})?)/);
                if (costMatch) {
                  activity.cost = parseFloat(costMatch[1]);
                }
                
                // Extract age from name or description
                const ageMatch = fullText.match(/(\d+)\s*-\s*(\d+)\s*(?:years|yrs|yr)/i);
                if (ageMatch) {
                  activity.ageRange.min = parseInt(ageMatch[1]);
                  activity.ageRange.max = parseInt(ageMatch[2]);
                } else {
                  // Check for single age patterns
                  const singleAgeMatch = fullText.match(/(\d+)\s*(?:years|yrs|yr)\+?/i);
                  if (singleAgeMatch) {
                    activity.ageRange.min = parseInt(singleAgeMatch[1]);
                    activity.ageRange.max = 18;
                  }
                }
                
                // Look for registration links
                const regLink = row.querySelector('a[href*="register"], a[href*="enroll"], button');
                if (regLink && regLink.href) {
                  activity.registrationUrl = regLink.href;
                }
                
                // Only add if we have a valid activity name
                if (activity.name && activity.name.length > 3) {
                  activities.push(activity);
                }
              }
            });
          });
        } catch (err) {
          console.error('Error parsing detail row:', err);
        }
      });
      
      // If no detail rows, try regular activity items
      if (activities.length === 0) {
        const activityItems = document.querySelectorAll('.list-group-item, .activity-item, .program-item, .course-item');
        console.log(`Found ${activityItems.length} activity items`);
        
        activityItems.forEach((item, index) => {
          try {
          const activity = {
            id: `nvrc-${Date.now()}-${index}`,
            name: '',
            description: '',
            ageRange: { min: 0, max: 18 },
            cost: 0,
            location: '',
            schedule: '',
            dates: '',
            registrationUrl: '',
            spotsAvailable: ''
          };
          
          // Extract activity name/title
          const titleEl = item.querySelector('h4, h5, .activity-name, .program-name, strong, a');
          if (titleEl) {
            activity.name = titleEl.textContent.trim();
          }
          
          // Extract all text content
          const fullText = item.textContent;
          
          // Extract cost
          const costMatch = fullText.match(/\$(\d+(?:\.\d{2})?)/);
          if (costMatch) {
            activity.cost = parseFloat(costMatch[1]);
          }
          
          // Extract dates/schedule
          const dateMatch = fullText.match(/(\w{3} \d{1,2}(?:\s*-\s*\w{3} \d{1,2})?)/);
          if (dateMatch) {
            activity.dates = dateMatch[0];
          }
          
          // Extract time
          const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?)/);
          if (timeMatch) {
            activity.schedule = timeMatch[0];
          }
          
          // Extract location
          const locationMatch = fullText.match(/([\w\s]+(?:Centre|Center|Community|School|Park|Pool|Arena))/i);
          if (locationMatch) {
            activity.location = locationMatch[0].trim();
          }
          
          // Extract age range
          const ageMatch = fullText.match(/(\d+)\s*-\s*(\d+)\s*(?:years|yrs|yr)/i);
          if (ageMatch) {
            activity.ageRange.min = parseInt(ageMatch[1]);
            activity.ageRange.max = parseInt(ageMatch[2]);
          }
          
          // Extract spots available
          const spotsMatch = fullText.match(/(\d+)\s*(?:spots?|spaces?)\s*(?:available|left)/i);
          if (spotsMatch) {
            activity.spotsAvailable = spotsMatch[1];
          }
          
          // Look for registration link
          const regLink = item.querySelector('a[href*="register"], a[href*="enroll"], button');
          if (regLink && regLink.href) {
            activity.registrationUrl = regLink.href;
          }
          
          // Set description from remaining text
          activity.description = fullText.substring(0, 200).replace(/\s+/g, ' ').trim();
          
          if (activity.name) {
            activities.push(activity);
          }
        } catch (err) {
          console.error('Error parsing activity item:', err);
        }
        });
      }
      
      // Strategy 2: Look for table rows if no list items found
      if (activities.length === 0) {
        const tableRows = document.querySelectorAll('tr[class*="activity"], tr[class*="course"], tbody tr');
        console.log(`Found ${tableRows.length} table rows`);
        
        tableRows.forEach((row, index) => {
          if (row.querySelector('th')) return; // Skip header rows
          
          try {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 2) {
              const activity = {
                id: `nvrc-${Date.now()}-${index}`,
                name: cells[0]?.textContent.trim() || '',
                dates: cells[1]?.textContent.trim() || '',
                schedule: cells[2]?.textContent.trim() || '',
                location: cells[3]?.textContent.trim() || '',
                cost: 0,
                ageRange: { min: 0, max: 18 },
                description: '',
                registrationUrl: ''
              };
              
              // Extract cost from any cell
              cells.forEach(cell => {
                const text = cell.textContent;
                const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
                if (costMatch) {
                  activity.cost = parseFloat(costMatch[1]);
                }
              });
              
              // Get registration link
              const regLink = row.querySelector('a[href*="register"], a[href*="enroll"]');
              if (regLink) {
                activity.registrationUrl = regLink.href;
              }
              
              if (activity.name) {
                activities.push(activity);
              }
            }
          } catch (err) {
            console.error('Error parsing table row:', err);
          }
        });
      }
      
      // Strategy 3: Look for any element with activity/program keywords
      if (activities.length === 0) {
        console.log('Trying alternative extraction...');
        
        // Look for any divs or sections that might contain activities
        const allElements = document.querySelectorAll('div, section, article, li');
        
        allElements.forEach((el, index) => {
          const text = el.textContent;
          
          // Check if this element contains activity-like content
          if (text && 
              text.length > 50 && 
              text.length < 1000 &&
              (text.includes('$') || text.includes('Register')) &&
              (text.includes('AM') || text.includes('PM') || text.includes('Centre') || text.includes('School'))) {
            
            // Avoid duplicates by checking if parent was already processed
            if (el.parentElement && activities.some(a => el.parentElement.textContent.includes(a.name))) {
              return;
            }
            
            try {
              const activity = {
                id: `nvrc-${Date.now()}-${index}`,
                name: '',
                description: text.substring(0, 200).trim(),
                ageRange: { min: 0, max: 18 },
                cost: 0,
                location: '',
                schedule: '',
                dates: '',
                registrationUrl: ''
              };
              
              // Try to extract a title
              const headingEl = el.querySelector('h1, h2, h3, h4, h5, h6, strong, b, a');
              if (headingEl) {
                activity.name = headingEl.textContent.trim();
              } else {
                // Use first line as name
                activity.name = text.split('\n')[0].substring(0, 100).trim();
              }
              
              // Extract cost
              const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
              if (costMatch) {
                activity.cost = parseFloat(costMatch[1]);
              }
              
              // Extract location
              const locationMatch = text.match(/([\w\s]+(?:Centre|Center|Community|School|Park|Pool|Arena))/i);
              if (locationMatch) {
                activity.location = locationMatch[0].trim();
              }
              
              // Extract time
              const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/);
              if (timeMatch) {
                activity.schedule = timeMatch[0];
              }
              
              if (activity.name && activity.name.length > 3) {
                activities.push(activity);
              }
            } catch (err) {
              console.error('Error in alternative extraction:', err);
            }
          }
        });
        
        // Remove obvious duplicates
        const uniqueActivities = [];
        const seenNames = new Set();
        
        activities.forEach(activity => {
          if (!seenNames.has(activity.name)) {
            seenNames.add(activity.name);
            uniqueActivities.push(activity);
          }
        });
        
        return uniqueActivities;
      }
      
      return activities;
    });
    
    return extractedActivities;
  }
  
  determineActivityType(text) {
    const types = [];
    const lowerText = text.toLowerCase();
    
    // Map to frontend ActivityType enum values
    if (lowerText.includes('swim') || lowerText.includes('aqua')) types.push('swimming');
    if (lowerText.includes('camp')) types.push('camps');
    if (lowerText.includes('sport') || lowerText.includes('soccer') || lowerText.includes('basketball') || 
        lowerText.includes('tennis') || lowerText.includes('martial')) types.push('sports');
    if (lowerText.includes('art') || lowerText.includes('craft') || lowerText.includes('paint')) types.push('arts');
    if (lowerText.includes('education') || lowerText.includes('learn') || lowerText.includes('tutor')) types.push('education');
    
    return types.length > 0 ? types : ['general'];
  }
  
  parseDateRange(dateStr) {
    // Default date range if no dates found
    const defaultStart = new Date();
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultEnd.getMonth() + 2); // 2 months from now
    
    if (!dateStr) {
      return { start: defaultStart, end: defaultEnd };
    }
    
    // Try to parse various date formats
    // Example: "Jan 6 - Feb 28" or "July 15 - August 30"
    const rangeMatch = dateStr.match(/(\w+\s+\d+)\s*-\s*(\w+\s+\d+)/);
    if (rangeMatch) {
      const currentYear = new Date().getFullYear();
      const start = new Date(`${rangeMatch[1]}, ${currentYear}`);
      const end = new Date(`${rangeMatch[2]}, ${currentYear}`);
      
      // If end date is before start, it's probably next year
      if (end < start) {
        end.setFullYear(currentYear + 1);
      }
      
      return { start, end };
    }
    
    return { start: defaultStart, end: defaultEnd };
  }
  
  parseSchedule(scheduleStr) {
    // Default schedule
    const defaultSchedule = {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '9:00 AM',
      endTime: '5:00 PM'
    };
    
    if (!scheduleStr) {
      return defaultSchedule;
    }
    
    // Parse time from schedule string
    const timeMatch = scheduleStr.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*-?\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?/);
    if (timeMatch) {
      defaultSchedule.startTime = timeMatch[1];
      defaultSchedule.endTime = timeMatch[2] || timeMatch[1];
    }
    
    // Parse days if mentioned
    const dayPatterns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const foundDays = [];
    dayPatterns.forEach(day => {
      if (scheduleStr.includes(day)) {
        foundDays.push(day);
      }
    });
    
    if (foundDays.length > 0) {
      defaultSchedule.days = foundDays;
    }
    
    return defaultSchedule;
  }
}

module.exports = NVRCRealDataScraper;