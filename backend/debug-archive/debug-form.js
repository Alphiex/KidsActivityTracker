const puppeteer = require('puppeteer');

async function debugForm() {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
      defaultViewport: null
    });

    const page = await browser.newPage();
    
    console.log('🔍 Debugging NVRC form...');
    await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await page.waitForSelector('form', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // STEP 1: Select age groups
    console.log('\n📋 STEP 1: Selecting age groups...');
    
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
    }
    
    console.log('⏳ Waiting for Step 2...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Debug Step 2
    console.log('\n🔍 Debugging Step 2 structure...');
    const step2Info = await page.evaluate(() => {
      const info = {
        fieldsets: [],
        checkboxes: []
      };
      
      // Find all fieldsets
      document.querySelectorAll('fieldset').forEach((fieldset, i) => {
        const legend = fieldset.querySelector('legend');
        info.fieldsets.push({
          index: i,
          legend: legend ? legend.textContent.trim() : 'No legend',
          checkboxCount: fieldset.querySelectorAll('input[type="checkbox"]').length
        });
      });
      
      // Find all checkboxes
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
        info.checkboxes.push({
          id: cb.id,
          checked: cb.checked,
          label: label ? label.textContent.trim() : 'No label',
          fieldset: cb.closest('fieldset')?.querySelector('legend')?.textContent.trim() || 'No fieldset'
        });
      });
      
      return info;
    });
    
    console.log('Fieldsets:', step2Info.fieldsets);
    console.log('\nCheckboxes:');
    step2Info.checkboxes.forEach(cb => {
      if (!cb.label.includes('years') && !cb.label.includes('Select all')) {
        console.log(`  - ${cb.label} (${cb.fieldset}) [${cb.checked ? '✓' : ' '}]`);
      }
    });
    
    // Select all programs
    console.log('\n📋 Selecting all programs...');
    const selected = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const label = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
        const text = label ? label.textContent.trim() : '';
        
        if (!text.includes('years') && 
            !text.includes('Select all locations') &&
            text !== '' &&
            !cb.checked) {
          
          // Check if in Step 2
          const fieldset = cb.closest('fieldset');
          const legend = fieldset?.querySelector('legend');
          if (legend && legend.textContent.includes('Choose a program')) {
            cb.click();
            count++;
          }
        }
      });
      return count;
    });
    
    console.log(`Selected ${selected} programs`);
    
    console.log('\n⏳ Waiting for Step 3...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Select all locations
    console.log('\n📋 Selecting all locations...');
    await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes('select all locations')) {
          const cb = label.querySelector('input[type="checkbox"]') || 
                     document.getElementById(label.getAttribute('for'));
          if (cb && !cb.checked) cb.click();
          break;
        }
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find submit button
    console.log('\n🔍 Looking for submit button...');
    const submitInfo = await page.evaluate(() => {
      const buttons = [];
      
      // Find all potential submit elements
      document.querySelectorAll('input[type="submit"], button[type="submit"], button').forEach(btn => {
        buttons.push({
          tag: btn.tagName,
          type: btn.type,
          value: btn.value || '',
          text: btn.textContent || '',
          className: btn.className,
          id: btn.id
        });
      });
      
      return buttons;
    });
    
    console.log('Found buttons:', submitInfo);
    
    // Click submit
    const clicked = await page.evaluate(() => {
      // Try different selectors
      const selectors = [
        'input[value*="Show Results"]',
        'button:contains("Show Results")',
        'input[type="submit"]',
        'button[type="submit"]'
      ];
      
      for (const selector of selectors) {
        try {
          const btn = document.querySelector(selector);
          if (btn) {
            btn.click();
            return `Clicked: ${selector}`;
          }
        } catch (e) {
          // Try next selector
        }
      }
      
      // Also try by text
      const allButtons = document.querySelectorAll('input, button');
      for (const btn of allButtons) {
        const text = btn.value || btn.textContent || '';
        if (text.includes('Show Results')) {
          btn.click();
          return `Clicked button with text: ${text}`;
        }
      }
      
      return 'No button found';
    });
    
    console.log('Submit result:', clicked);
    
    console.log('\n⏸️ Keeping browser open for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugForm();