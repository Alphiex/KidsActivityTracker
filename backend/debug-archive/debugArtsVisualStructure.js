const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugArtsVisualStructure() {
  let browser;
  
  try {
    console.log('🔍 Debugging Arts Visual page structure...\n');
    
    browser = await puppeteer.launch({
      headless: false, // Show browser
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    
    // Enable console logging from page
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log('PAGE LOG:', msg.text());
      }
    });
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // Navigate and click Arts Visual
    const widgetUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
    await page.goto(widgetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('body', { timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔗 Clicking on Arts Visual (0-6yrs)...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const targetLink = links.find(l => l.textContent?.trim() === 'Arts Visual (0-6yrs)');
      if (targetLink) targetLink.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Expand all Show buttons
    console.log('📂 Expanding all Show buttons...');
    await page.evaluate(() => {
      const showButtons = Array.from(document.querySelectorAll('a, button, span'))
        .filter(el => el.textContent?.trim().toLowerCase() === 'show');
      
      console.log(`Found ${showButtons.length} Show buttons`);
      showButtons.forEach((btn, idx) => {
        console.log(`Clicking Show button ${idx + 1}`);
        btn.click();
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take annotated screenshot
    await page.evaluate(() => {
      // Highlight different elements
      document.querySelectorAll('.bm-group-title-row').forEach(el => {
        el.style.border = '3px solid red';
        el.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      });
      
      document.querySelectorAll('.bm-group-item-row').forEach(el => {
        el.style.border = '3px solid blue';
        el.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
      });
      
      // Find elements that look like activities
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach(el => {
        const text = el.textContent || '';
        if ((text.includes('Sign Up') || text.includes('Waitlist') || text.includes('Closed')) &&
            text.includes('$') &&
            el.children.length < 5) {
          el.style.border = '3px solid green';
          el.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
        }
      });
    });
    
    await page.screenshot({ path: 'arts-visual-annotated.png', fullPage: true });
    console.log('📸 Screenshot saved: arts-visual-annotated.png');
    console.log('  - Red border: .bm-group-title-row');
    console.log('  - Blue border: .bm-group-item-row');
    console.log('  - Green border: Elements with Sign Up/Waitlist/Closed + $');

    // Analyze the structure in detail
    const structure = await page.evaluate(() => {
      const analysis = {
        groupTitles: [],
        groupItems: [],
        activityElements: [],
        domStructure: []
      };
      
      // Analyze group titles
      document.querySelectorAll('.bm-group-title-row').forEach((el, idx) => {
        analysis.groupTitles.push({
          index: idx,
          text: el.textContent?.trim(),
          classes: el.className,
          hasShowButton: el.textContent?.includes('Show') || el.textContent?.includes('Hide')
        });
      });
      
      // Analyze group items
      document.querySelectorAll('.bm-group-item-row').forEach((el, idx) => {
        const text = el.textContent?.trim() || '';
        analysis.groupItems.push({
          index: idx,
          textLength: text.length,
          hasSignUp: text.includes('Sign Up'),
          hasWaitlist: text.includes('Waitlist'),
          hasClosed: text.includes('Closed'),
          hasPrice: text.includes('$'),
          firstChars: text.substring(0, 50) + '...'
        });
      });
      
      // Look for activities using different selectors
      const selectors = [
        '.bm-widget-grid-item',
        '.bm-grid-item',
        '[class*="activity"]',
        '[class*="program"]',
        '.k-grid-content tr',
        'div[role="row"]'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Selector "${selector}" found ${elements.length} elements`);
          analysis.domStructure.push({
            selector: selector,
            count: elements.length,
            sample: Array.from(elements).slice(0, 2).map(el => ({
              text: el.textContent?.trim().substring(0, 100),
              classes: el.className
            }))
          });
        }
      });
      
      // Find all elements that contain activity-like content
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach(el => {
        const text = el.textContent || '';
        if ((text.includes('Sign Up') || text.includes('Waitlist') || text.includes('Closed')) &&
            text.includes('$') &&
            text.includes('#') &&
            el.children.length < 10) {
          
          analysis.activityElements.push({
            tagName: el.tagName,
            className: el.className,
            textPreview: text.substring(0, 100) + '...',
            childCount: el.children.length,
            parentClass: el.parentElement?.className || 'no-parent'
          });
        }
      });
      
      return analysis;
    });
    
    console.log('\n📊 Structure Analysis:');
    console.log(`Group titles found: ${structure.groupTitles.length}`);
    structure.groupTitles.forEach(title => {
      console.log(`  - "${title.text}" (${title.hasShowButton ? 'has Show/Hide' : 'no Show/Hide'})`);
    });
    
    console.log(`\nGroup items found: ${structure.groupItems.length}`);
    const validItems = structure.groupItems.filter(item => 
      (item.hasSignUp || item.hasWaitlist || item.hasClosed) && item.hasPrice
    );
    console.log(`Valid activity items: ${validItems.length}`);
    
    console.log('\nActivity-like elements found:', structure.activityElements.length);
    structure.activityElements.forEach((el, idx) => {
      console.log(`\n${idx + 1}. ${el.tagName}.${el.className}`);
      console.log(`   Parent: ${el.parentClass}`);
      console.log(`   Text: ${el.textPreview}`);
    });
    
    console.log('\nDOM Structure exploration:');
    structure.domStructure.forEach(item => {
      console.log(`\n"${item.selector}" - ${item.count} elements`);
      item.sample.forEach(sample => {
        console.log(`  Sample: ${sample.text?.substring(0, 50)}...`);
      });
    });
    
    // Save detailed analysis
    fs.writeFileSync('arts-visual-structure-debug.json', JSON.stringify(structure, null, 2));
    console.log('\n💾 Detailed structure saved to arts-visual-structure-debug.json');
    
    // Get the raw HTML of the activity area
    const activityAreaHtml = await page.evaluate(() => {
      const mainContent = document.querySelector('.bm-widget-body, .content-area, main, [role="main"]');
      return mainContent ? mainContent.innerHTML : document.body.innerHTML;
    });
    
    fs.writeFileSync('arts-visual-activity-area.html', activityAreaHtml);
    console.log('💾 Activity area HTML saved to arts-visual-activity-area.html');
    
    console.log('\nBrowser will remain open for inspection...');
    console.log('Press Ctrl+C to close');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugArtsVisualStructure();