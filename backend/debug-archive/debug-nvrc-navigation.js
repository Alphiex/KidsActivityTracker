const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugNavigation() {
  let browser;
  
  try {
    console.log('🔍 NVRC Navigation Debugger\n');
    console.log('This script will help debug the navigation through NVRC\'s program search.\n');
    
    // Launch browser in headful mode for debugging
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50, // Slow down actions to see what's happening
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1440,900'
      ],
      defaultViewport: null
    });

    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Step 1: Navigate to NVRC homepage first...');
    await page.goto('https://www.nvrc.ca', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('✅ Loaded NVRC homepage');
    await page.screenshot({ path: 'debug-1-homepage.png' });
    
    // Wait a bit for any redirects or JavaScript
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\nStep 2: Navigate to find-program page...');
    await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('✅ Loaded find-program page');
    await page.screenshot({ path: 'debug-2-find-program.png' });
    
    // Wait for any dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\nStep 3: Looking for form elements...');
    
    // Debug: Get all form elements and their state
    const formInfo = await page.evaluate(() => {
      const info = {
        forms: document.querySelectorAll('form').length,
        checkboxes: document.querySelectorAll('input[type="checkbox"]').length,
        radioButtons: document.querySelectorAll('input[type="radio"]').length,
        buttons: document.querySelectorAll('button').length,
        links: document.querySelectorAll('a').length,
        selects: document.querySelectorAll('select').length
      };
      
      // Get checkbox labels
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).map(cb => ({
        id: cb.id,
        name: cb.name,
        value: cb.value,
        checked: cb.checked,
        label: cb.parentElement?.textContent?.trim() || cb.nextElementSibling?.textContent?.trim() || 'No label'
      }));
      
      // Get all buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn')).map(btn => ({
        text: btn.textContent?.trim() || btn.value || '',
        type: btn.type || 'link',
        class: btn.className,
        id: btn.id
      }));
      
      return { info, checkboxes, buttons };
    });
    
    console.log('Form elements found:', formInfo.info);
    console.log('\nCheckboxes found:');
    formInfo.checkboxes.forEach(cb => {
      console.log(`  - ${cb.label} (value: ${cb.value}, checked: ${cb.checked})`);
    });
    console.log('\nButtons found:');
    formInfo.buttons.forEach(btn => {
      if (btn.text) console.log(`  - "${btn.text}" (type: ${btn.type})`);
    });
    
    // Save page HTML for inspection
    const pageContent = await page.content();
    fs.writeFileSync('debug-page-content.html', pageContent);
    console.log('\n💾 Saved page HTML to debug-page-content.html');
    
    console.log('\nStep 4: Trying to interact with the form...');
    
    // Try different strategies to find and interact with elements
    
    // Strategy 1: Look for iframe
    const iframes = await page.$$('iframe');
    console.log(`\nFound ${iframes.length} iframes`);
    
    if (iframes.length > 0) {
      console.log('Checking iframes...');
      for (let i = 0; i < iframes.length; i++) {
        const frame = await iframes[i].contentFrame();
        if (frame) {
          const frameUrl = await frame.url();
          console.log(`  Iframe ${i}: ${frameUrl}`);
          
          // Check if this iframe contains the form
          const hasForm = await frame.evaluate(() => {
            return document.querySelectorAll('input[type="checkbox"]').length > 0;
          });
          
          if (hasForm) {
            console.log(`  ✅ Found form in iframe ${i}!`);
            // Work with this frame instead of the main page
            // ... continue with form interaction in the frame
          }
        }
      }
    }
    
    // Strategy 2: Check for dynamic loading
    console.log('\nChecking for dynamic content loading...');
    
    // Wait for specific elements that might load dynamically
    try {
      await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
      console.log('✅ Checkboxes appeared');
    } catch (e) {
      console.log('❌ No checkboxes found within 5 seconds');
    }
    
    // Strategy 3: Check for shadow DOM
    const hasShadowDOM = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        if (el.shadowRoot) return true;
      }
      return false;
    });
    console.log(`\nHas Shadow DOM: ${hasShadowDOM}`);
    
    // Strategy 4: Try to find the form by looking for specific text
    console.log('\nLooking for program selection elements by text...');
    
    const programElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const programRelated = elements.filter(el => {
        const text = el.textContent || '';
        return text.includes('0 - 6 years') || 
               text.includes('School Age') || 
               text.includes('Youth') ||
               text.includes('Programs') ||
               text.includes('Activities');
      }).slice(0, 10); // Get first 10 matches
      
      return programRelated.map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.substring(0, 100)
      }));
    });
    
    console.log('Program-related elements found:');
    programElements.forEach(el => {
      console.log(`  - <${el.tag}> ${el.class}: "${el.text}..."`);
    });
    
    // Take final screenshot
    await page.screenshot({ path: 'debug-final-state.png', fullPage: true });
    console.log('\n📸 Saved final screenshot to debug-final-state.png');
    
    console.log('\n🔍 Debug Summary:');
    console.log('- Check the screenshots to see what the page looks like');
    console.log('- Check debug-page-content.html to inspect the HTML structure');
    console.log('- The form might be in an iframe, loaded dynamically, or use a different structure');
    
    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('\n❌ Error during debugging:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the debugger
console.log('Starting NVRC navigation debugger...\n');
debugNavigation().then(() => {
  console.log('\n✅ Debug session completed');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Debug session failed:', err);
  process.exit(1);
});