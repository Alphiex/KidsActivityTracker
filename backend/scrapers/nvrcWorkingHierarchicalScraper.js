const puppeteer = require('puppeteer');
const fs = require('fs');

class NVRCWorkingHierarchicalScraper {
  async scrape() {
    let browser;
    
    try {
      console.log('🚀 Starting NVRC Working Hierarchical Scraper...');
      browser = await puppeteer.launch({
        headless: false,
        slowMo: 150,
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

      // Navigate to the find program page
      console.log('\n📍 Navigating to NVRC find program page...');
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      await page.waitForSelector('form', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 1: Select kids age groups (EXACTLY like the working version)
      console.log('\n📋 STEP 1: Selecting kids age groups...');
      
      const ageGroups = [
        '0 - 6 years, Parent Participation',
        '0 - 6 years, On My Own',
        '5 - 13 years, School Age',
        '10 - 18 years, Youth'
      ];
      
      for (const ageGroup of ageGroups) {
        await page.evaluate((text) => {
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(l => l.textContent.includes(text));
          if (label) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
            }
          }
        }, ageGroup);
        console.log(`  ✓ Selected: ${ageGroup}`);
      }
      
      // Wait for Step 2 to populate dynamically
      console.log('\n⏳ Waiting for Step 2 program activities to appear...');
      
      try {
        await page.waitForFunction(() => {
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
          return activityCount > 5; // Expecting activities to load
        }, { timeout: 35000, polling: 'mutation' });
        
        console.log('  ✅ Step 2 activities loaded!');
      } catch (e) {
        console.log('  ⚠️ Timeout waiting for Step 2 activities');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      // STEP 2: Select ALL program activities
      console.log('\n🎯 STEP 2: Selecting ALL program activities...');
      
      const step2Result = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const activityCheckboxes = [];
        let selectedCount = 0;
        
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
            activityCheckboxes.push(text);
            
            if (!cb.checked) {
              cb.click();
              selectedCount++;
              console.log(`Selected activity: ${text}`);
            }
          }
        });
        
        return {
          total: activityCheckboxes.length,
          selected: selectedCount,
          activities: activityCheckboxes
        };
      });
      
      console.log(`  ✅ Found ${step2Result.total} activity checkboxes`);
      console.log(`  ✅ Selected ${step2Result.selected} new activities`);
      console.log(`  Activities: ${step2Result.activities.join(', ')}`);

      // Wait for Step 3 to populate
      console.log('\n⏳ Waiting for Step 3 locations to appear...');
      
      try {
        await page.waitForFunction(() => {
          const labels = Array.from(document.querySelectorAll('label'));
          const selectAllLocation = labels.find(label => {
            const text = label.textContent.trim();
            return text.includes('Select all locations');
          });
          
          if (selectAllLocation) {
            console.log('Found "Select all locations" option!');
            return true;
          }
          
          return false;
        }, { timeout: 30000, polling: 'mutation' });
        
        console.log('  ✅ Step 3 locations loaded!');
      } catch (e) {
        console.log('  ⚠️ Timeout waiting for Step 3 locations');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 3: Select all locations
      console.log('\n📍 STEP 3: Selecting "Select all locations available"...');
      
      const locationSelected = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          const text = label.textContent || '';
          if (text.includes('Select all locations available')) {
            const checkbox = label.querySelector('input[type="checkbox"]') || 
                           document.getElementById(label.getAttribute('for'));
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              return true;
            }
          }
        }
        return false;
      });
      
      console.log(`  ✅ Selected all locations: ${locationSelected}`);

      // Find and click the Show Results button
      console.log('\n🔍 Looking for "Show Results" button...');
      
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResultsBtn = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.includes('Show Results');
        });
        
        if (showResultsBtn) {
          return {
            found: true,
            text: showResultsBtn.value || showResultsBtn.textContent,
            disabled: showResultsBtn.disabled,
            className: showResultsBtn.className,
            tag: showResultsBtn.tagName
          };
        }
        return { found: false };
      });
      
      console.log('  Button state:', buttonInfo);
      
      if (!buttonInfo.found) {
        throw new Error('Could not find Show Results button');
      }
      
      // Click the Show Results button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
        const showResultsBtn = buttons.find(btn => {
          const text = btn.value || btn.textContent || '';
          return text.includes('Show Results');
        });
        if (showResultsBtn) {
          console.log('Clicking Show Results button');
          showResultsBtn.click();
        }
      });

      console.log('  ✅ Clicked Show Results button');

      // Wait for results to load
      console.log('\n⏳ Waiting for results to load...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check current URL and page state
      const currentUrl = page.url();
      console.log('\n📍 Current URL:', currentUrl);

      // Take screenshot
      await page.screenshot({ path: 'working-hierarchical-results.png', fullPage: true });
      console.log('📸 Results page screenshot saved');

      // Check if we're in an iframe or on a results page
      const pageInfo = await page.evaluate(() => {
        return {
          hasIframes: document.querySelectorAll('iframe').length,
          currentUrl: window.location.href,
          bodyText: document.body.innerText.substring(0, 500)
        };
      });
      
      console.log('Page info:', {
        hasIframes: pageInfo.hasIframes,
        url: pageInfo.currentUrl
      });

      // Look for blue activity bars that need to be expanded
      console.log('\n🔍 Looking for blue activity bars to expand...');
      
      // Wait a bit for the page to fully render
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // First, let's identify all the blue activity bars
      const activityBars = await page.evaluate(() => {
        const bars = [];
        
        // Look for the activity result headers - they have a specific structure
        const activityHeaders = document.querySelectorAll('.field--name-name, h3.field--name-name');
        
        activityHeaders.forEach(header => {
          const text = header.textContent.trim();
          if (text && !text.includes('construction') && !text.includes('Updates')) {
            // Check if this header has a sibling or parent with the count
            const parent = header.closest('.views-row, .node, article');
            if (parent) {
              // Look for the count in the same row
              const countElement = parent.querySelector('.field--name-field-activity-spaces-available, .activity-count, [class*="count"]');
              const count = countElement ? parseInt(countElement.textContent) || 0 : 0;
              
              bars.push({
                text: text,
                name: text,
                count: count,
                element: header,
                hasExpandButton: parent.querySelector('.fa-angle-down, .expand-icon, [class*="expand"]') !== null
              });
            }
          }
        });
        
        // If no headers found, try alternative selectors
        if (bars.length === 0) {
          // Look for elements with blue background
          const blueElements = document.querySelectorAll('[style*="background-color: rgb(0, 114, 198)"], [style*="background-color: #0072c6"], .activity-category-header');
          blueElements.forEach(el => {
            const text = el.textContent.trim();
            if (text && !text.includes('construction')) {
              bars.push({
                text: text,
                name: text.replace(/\s*\d+$/, ''),
                count: parseInt(text.match(/\d+$/)?.[0] || '0'),
                element: el,
                hasExpandButton: el.querySelector('.fa-angle-down, [class*="expand"]') !== null
              });
            }
          });
        }
        
        console.log('Found potential activity bars:', bars.map(b => b.text));
        return bars;
      });
      
      console.log(`\n✅ Found ${activityBars.length} activity category bars:`);
      activityBars.forEach(bar => {
        console.log(`  - ${bar.text} (${bar.count} activities)`);
      });
      
      let activities = [];
      
      // Process each category bar
      for (const bar of activityBars) {
        console.log(`\n📂 Expanding category: ${bar.text}`);
        
        // Click the + button or the bar itself to expand
        const expanded = await page.evaluate((barText) => {
          // Find the element with this exact text
          const elements = Array.from(document.querySelectorAll('div, a, button, span'));
          for (const el of elements) {
            if (el.textContent.trim() === barText) {
              // Look for a + button nearby
              const plusButton = el.querySelector('.expand-button, .plus-button, [class*="expand"], [class*="plus"]') ||
                               el.parentElement.querySelector('.expand-button, .plus-button, [class*="expand"], [class*="plus"]');
              
              if (plusButton) {
                plusButton.click();
                return 'clicked plus button';
              } else {
                // Click the element itself
                el.click();
                return 'clicked bar';
              }
            }
          }
          return 'not found';
        }, bar.text);
        
        console.log(`  ${expanded}`);
        
        // Wait for expansion
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now look for sub-activities within this category
        const subActivities = await page.evaluate((categoryName) => {
          const activities = [];
          
          // Look for expanded content - could be in various formats
          // Try to find elements that appeared after expansion
          const possibleContainers = document.querySelectorAll(
            '.sub-activities, .activity-list, .expanded-content, ' +
            '[class*="expand"], [class*="collapse"], .panel-collapse.in'
          );
          
          possibleContainers.forEach(container => {
            // Look for sub-activity bars (similar blue bars with counts)
            const subBars = container.querySelectorAll('div, a');
            subBars.forEach(subBar => {
              const text = subBar.textContent.trim();
              const match = text.match(/^([A-Za-z\s&\-]+)\s+(\d+)$/);
              
              if (match && !text.includes(categoryName)) {
                activities.push({
                  category: categoryName,
                  subcategory: match[1].trim(),
                  count: parseInt(match[2]),
                  needsExpansion: true
                });
              }
            });
          });
          
          return activities;
        }, bar.name);
        
        console.log(`  Found ${subActivities.length} sub-activities`);
        
        // Expand each sub-activity
        for (const subActivity of subActivities) {
          console.log(`    📁 Expanding sub-activity: ${subActivity.subcategory} (${subActivity.count})`);
          
          // Click to expand the sub-activity
          await page.evaluate((subText) => {
            const elements = Array.from(document.querySelectorAll('div, a, button, span'));
            for (const el of elements) {
              if (el.textContent.trim().includes(subText)) {
                const plusButton = el.querySelector('[class*="expand"], [class*="plus"]') ||
                                 el.parentElement.querySelector('[class*="expand"], [class*="plus"]');
                if (plusButton) {
                  plusButton.click();
                } else {
                  el.click();
                }
                break;
              }
            }
          }, subActivity.subcategory);
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Extract actual activities from the expanded content
          const extractedActivities = await page.evaluate((cat, subcat) => {
            const activities = [];
            
            // Look for activity details in tables, lists, or cards
            const activityElements = document.querySelectorAll(
              'tr:not(.header), .activity-item, .program-item, ' +
              '.list-group-item, [class*="activity-detail"]'
            );
            
            activityElements.forEach((el, index) => {
              const text = el.textContent;
              
              // Skip if it's a category header
              if (text.match(/^[A-Za-z\s&]+\s+\d+$/)) return;
              
              // Look for activity details
              if (text.includes('$') || text.includes('Register')) {
                const activity = {
                  id: `nvrc_${Date.now()}_${index}`,
                  category: cat,
                  subcategory: subcat,
                  name: '',
                  schedule: '',
                  cost: 0,
                  location: '',
                  provider: 'NVRC'
                };
                
                // Extract name - could be in various formats
                const nameEl = el.querySelector('td:first-child, .activity-name, h4, h5, strong');
                if (nameEl) {
                  activity.name = nameEl.textContent.trim();
                } else {
                  // Use first part of text as name
                  activity.name = text.split('\n')[0].trim();
                }
                
                // Extract cost
                const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
                if (costMatch) {
                  activity.cost = parseFloat(costMatch[1]);
                }
                
                // Extract schedule/time
                const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?)/);
                if (timeMatch) {
                  activity.schedule = timeMatch[0];
                }
                
                // Extract dates
                const dateMatch = text.match(/(\w{3}\s+\d{1,2}(?:\s*-\s*\w{3}\s+\d{1,2})?)/);
                if (dateMatch) {
                  activity.dates = dateMatch[0];
                }
                
                // Extract location
                const locationMatch = text.match(/([\w\s]+(?:Centre|Center|Community|School|Park|Pool|Arena))/i);
                if (locationMatch) {
                  activity.location = locationMatch[0].trim();
                }
                
                if (activity.name && activity.name.length > 3) {
                  activities.push(activity);
                }
              }
            });
            
            return activities;
          }, bar.name, subActivity.subcategory);
          
          activities.push(...extractedActivities);
          console.log(`      Extracted ${extractedActivities.length} activities`);
          
          // Collapse the sub-activity
          await page.evaluate((subText) => {
            const elements = Array.from(document.querySelectorAll('div, a, button, span'));
            for (const el of elements) {
              if (el.textContent.trim().includes(subText)) {
                const minusButton = el.querySelector('[class*="collapse"], [class*="minus"]') ||
                                  el.parentElement.querySelector('[class*="collapse"], [class*="minus"]');
                if (minusButton) {
                  minusButton.click();
                } else {
                  el.click();
                }
                break;
              }
            }
          }, subActivity.subcategory);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Collapse the main category
        await page.evaluate((barText) => {
          const elements = Array.from(document.querySelectorAll('div, a, button, span'));
          for (const el of elements) {
            if (el.textContent.trim() === barText) {
              const minusButton = el.querySelector('[class*="collapse"], [class*="minus"]') ||
                               el.parentElement.querySelector('[class*="collapse"], [class*="minus"]');
              if (minusButton) {
                minusButton.click();
              } else {
                el.click();
              }
              break;
            }
          }
        }, bar.text);
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // If no blue bars found, try alternative extraction
      if (activityBars.length === 0) {
        console.log('\n⚠️ No blue activity bars found, trying alternative extraction...');
        activities = await this.extractFromPage(page);
      }
      
      console.log(`\n✅ Successfully extracted ${activities.length} activities`);
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nvrc_working_hierarchical_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        url: currentUrl,
        activitiesCount: activities.length,
        activities: activities
      }, null, 2));
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

  async expandAndExtractActivities(page, categoryBar) {
    const activities = [];
    
    try {
      console.log(`\n📂 Processing category: ${categoryBar.text}`);
      
      // Click to expand the category
      const expanded = await page.evaluate((barText) => {
        const elements = Array.from(document.querySelectorAll('*'));
        
        for (const el of elements) {
          // Look for exact text match
          if (el.textContent.trim() === barText) {
            // Check if there's a + button associated
            const parent = el.parentElement;
            const expandBtn = parent?.querySelector('[class*="expand"], [class*="plus"], .fa-plus');
            
            if (expandBtn) {
              expandBtn.click();
              return 'clicked expand button';
            } else if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.style.cursor === 'pointer') {
              el.click();
              return 'clicked element';
            }
          }
        }
        return 'not found';
      }, categoryBar.text);
      
      console.log(`  Expansion result: ${expanded}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Look for sub-categories that appeared
      const subCategories = await page.evaluate((mainCategory) => {
        const subs = [];
        const allElements = document.querySelectorAll('div, a, span, button');
        
        allElements.forEach(el => {
          const text = el.textContent.trim();
          // Look for sub-category pattern (text with number)
          const match = text.match(/^([A-Za-z\s&\-\/]+)\s+(\d+)$/);
          
          if (match && !text.includes(mainCategory)) {
            // Check if this is a sub-category (indented or nested)
            const rect = el.getBoundingClientRect();
            const parent = el.closest('.expanded, .sub-categories, [class*="child"], [class*="sub"]');
            
            if (parent || rect.left > 100) { // Likely indented
              subs.push({
                text: text,
                name: match[1].trim(),
                count: parseInt(match[2])
              });
            }
          }
        });
        
        return subs;
      }, categoryBar.name);
      
      console.log(`  Found ${subCategories.length} sub-categories`);
      
      // If no sub-categories, try to extract activities directly
      if (subCategories.length === 0) {
        const directActivities = await this.extractActivitiesFromExpandedSection(page, categoryBar.name, '');
        activities.push(...directActivities);
      } else {
        // Process each sub-category
        for (const subCat of subCategories) {
          console.log(`    📁 Expanding sub-category: ${subCat.text}`);
          
          // Click to expand sub-category
          await page.evaluate((subText) => {
            const elements = Array.from(document.querySelectorAll('*'));
            for (const el of elements) {
              if (el.textContent.trim() === subText) {
                const expandBtn = el.parentElement?.querySelector('[class*="expand"], [class*="plus"], .fa-plus');
                if (expandBtn) {
                  expandBtn.click();
                } else {
                  el.click();
                }
                break;
              }
            }
          }, subCat.text);
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Extract activities from this sub-category
          const subActivities = await this.extractActivitiesFromExpandedSection(page, categoryBar.name, subCat.name);
          activities.push(...subActivities);
          console.log(`      Extracted ${subActivities.length} activities`);
          
          // Collapse sub-category
          await page.evaluate((subText) => {
            const elements = Array.from(document.querySelectorAll('*'));
            for (const el of elements) {
              if (el.textContent.trim() === subText) {
                const collapseBtn = el.parentElement?.querySelector('[class*="collapse"], [class*="minus"], .fa-minus');
                if (collapseBtn) {
                  collapseBtn.click();
                } else {
                  el.click();
                }
                break;
              }
            }
          }, subCat.text);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Collapse main category
      await page.evaluate((barText) => {
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          if (el.textContent.trim() === barText) {
            const collapseBtn = el.parentElement?.querySelector('[class*="collapse"], [class*="minus"], .fa-minus');
            if (collapseBtn) {
              collapseBtn.click();
            } else {
              el.click();
            }
            break;
          }
        }
      }, categoryBar.text);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error processing category ${categoryBar.text}:`, error);
    }
    
    return activities;
  }
  
  async extractActivitiesFromExpandedSection(page, category, subcategory) {
    return await page.evaluate((cat, subcat) => {
      const activities = [];
      
      // Look for activity rows in various formats
      const activitySelectors = [
        'tr:not(:has(th)):has(td)', // Table rows
        '.activity-row',
        '.program-item',
        '.list-group-item',
        '[class*="activity"]:not([class*="category"]):not([class*="header"])'
      ];
      
      const activityElements = document.querySelectorAll(activitySelectors.join(', '));
      
      activityElements.forEach((el, index) => {
        const text = el.textContent;
        
        // Skip category headers
        if (text.match(/^[A-Za-z\s&]+\s+\d+$/) || text.length < 20) return;
        
        // Look for activity indicators
        if (text.includes('$') || text.includes('Register') || text.includes(':')) {
          const activity = {
            id: `nvrc_${Date.now()}_${index}`,
            category: cat,
            subcategory: subcat,
            name: '',
            schedule: '',
            dates: '',
            cost: 0,
            location: '',
            provider: 'NVRC',
            fullText: text.substring(0, 500)
          };
          
          // Extract from table row
          if (el.tagName === 'TR') {
            const cells = el.querySelectorAll('td');
            if (cells.length >= 2) {
              activity.name = cells[0]?.textContent.trim() || '';
              activity.schedule = cells[1]?.textContent.trim() || '';
              if (cells[2]) {
                const costText = cells[2].textContent;
                const costMatch = costText.match(/\$(\d+(?:\.\d{2})?)/);
                if (costMatch) activity.cost = parseFloat(costMatch[1]);
              }
              if (cells[3]) activity.location = cells[3].textContent.trim();
            }
          } else {
            // Extract from other formats
            // Try to find a title
            const titleEl = el.querySelector('h3, h4, h5, h6, .title, .activity-name, strong');
            if (titleEl) {
              activity.name = titleEl.textContent.trim();
            } else {
              // Use first meaningful line
              const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
              activity.name = lines[0] || '';
            }
            
            // Extract cost
            const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
            if (costMatch) activity.cost = parseFloat(costMatch[1]);
            
            // Extract time
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?)/);
            if (timeMatch) activity.schedule = timeMatch[0];
            
            // Extract dates
            const dateMatch = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*(?:&\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*)*|\w{3}\s+\d{1,2}(?:\s*-\s*\w{3}\s+\d{1,2})?)/);
            if (dateMatch) activity.dates = dateMatch[0];
            
            // Extract location
            const locationMatch = text.match(/([A-Z][\w\s]+(?:Centre|Center|Community|School|Park|Pool|Arena|Rec))/i);
            if (locationMatch) activity.location = locationMatch[0].trim();
          }
          
          // Only add if we have a valid name
          if (activity.name && activity.name.length > 3 && !activity.name.match(/^\d+$/)) {
            activities.push(activity);
          }
        }
      });
      
      return activities;
    }, category, subcategory);
  }

  async extractFromPage(page) {
    // Extract from regular results page (not iframe)
    return await page.evaluate(() => {
      const activities = [];
      const elements = document.querySelectorAll('.node--type-perfectmind-program, .views-row, article');
      
      elements.forEach((element, index) => {
        const title = element.querySelector('h2, h3, .title')?.textContent.trim() || '';
        const fullText = element.textContent;
        
        if (title) {
          activities.push({
            id: `nvrc_${index}`,
            name: title,
            fullText: fullText.substring(0, 300),
            provider: 'NVRC'
          });
        }
      });
      
      return activities;
    });
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NVRCWorkingHierarchicalScraper();
  scraper.scrape()
    .then(activities => {
      console.log('\n🎉 Scraping complete!');
      console.log(`Total activities: ${activities.length}`);
      
      if (activities.length > 0) {
        console.log('\nSample activities:');
        activities.slice(0, 5).forEach(act => {
          console.log(`  - ${act.name} | ${act.cost || 'N/A'}`);
        });
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = NVRCWorkingHierarchicalScraper;