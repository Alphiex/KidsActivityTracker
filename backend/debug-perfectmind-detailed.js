const puppeteer = require('puppeteer');

async function debugDetailed() {
  const browser = await puppeteer.launch({ 
    headless: false,  // Run with GUI to see what's happening
    slowMo: 100,      // Slow down actions
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('🔍 Debugging PerfectMind in detail...\n');
  
  // Navigate to PerfectMind
  const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Take initial screenshot
  await page.screenshot({ path: 'debug-initial.png', fullPage: true });
  
  // Look for program links in the left sidebar
  console.log('\n📋 Looking for program categories in sidebar...');
  const sidebarPrograms = await page.evaluate(() => {
    // Find the sidebar element
    const sidebar = document.querySelector('.widget-facets, .sidebar, [class*="filter"], [class*="facet"]');
    if (!sidebar) return { found: false, message: 'No sidebar found' };
    
    // Get all links in the sidebar
    const links = Array.from(sidebar.querySelectorAll('a'));
    const programs = links.map(link => ({
      text: link.textContent?.trim() || '',
      href: link.href || '',
      onclick: link.getAttribute('onclick') || '',
      classes: link.className
    })).filter(p => p.text && !p.text.includes('Reset') && !p.text.includes('Show More'));
    
    return { found: true, programs: programs };
  });
  
  console.log('Sidebar analysis:', sidebarPrograms);
  
  // Look for visible activities on the page
  console.log('\n📋 Looking for visible activities...');
  const visibleContent = await page.evaluate(() => {
    const content = {
      tables: document.querySelectorAll('table').length,
      forms: document.querySelectorAll('form').length,
      links: document.querySelectorAll('a').length,
      elementsWithIds: [],
      registerButtons: [],
      priceElements: []
    };
    
    // Find elements with 6-digit IDs
    const allElements = Array.from(document.querySelectorAll('*'));
    allElements.forEach(el => {
      if (el.id && el.id.match(/^\d{6}$/)) {
        content.elementsWithIds.push({
          id: el.id,
          tag: el.tagName,
          text: el.textContent?.substring(0, 100)
        });
      }
    });
    
    // Find register/sign up buttons
    const buttons = Array.from(document.querySelectorAll('a, button'));
    buttons.forEach(btn => {
      const text = btn.textContent?.trim() || '';
      if (text.includes('Register') || text.includes('Sign Up') || text.includes('Waitlist')) {
        content.registerButtons.push({
          text: text,
          href: btn.href || '',
          parent: btn.parentElement?.textContent?.substring(0, 100)
        });
      }
    });
    
    // Find price elements
    const textNodes = Array.from(document.querySelectorAll('*')).filter(el => 
      el.textContent?.includes('$') && !el.querySelector('*')
    );
    textNodes.forEach(node => {
      const text = node.textContent || '';
      if (text.match(/\$\d+/)) {
        content.priceElements.push(text.substring(0, 100));
      }
    });
    
    return content;
  });
  
  console.log('Visible content analysis:', visibleContent);
  
  // Try clicking on a specific program category
  if (sidebarPrograms.found && sidebarPrograms.programs.length > 0) {
    const targetProgram = sidebarPrograms.programs.find(p => 
      p.text.includes('Arts') || p.text.includes('Dance') || p.text.includes('Swimming')
    ) || sidebarPrograms.programs[0];
    
    console.log(`\n👆 Clicking on program: ${targetProgram.text}`);
    
    await page.evaluate((programText) => {
      const links = Array.from(document.querySelectorAll('a'));
      const link = links.find(a => a.textContent?.trim() === programText);
      if (link) link.click();
    }, targetProgram.text);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.screenshot({ path: 'debug-after-click.png', fullPage: true });
    
    // Check what changed
    const afterClick = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        newElementsWithIds: Array.from(document.querySelectorAll('[id]'))
          .filter(el => el.id.match(/^\d{6}$/))
          .length,
        visibleText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('\nAfter clicking program:', afterClick);
  }
  
  console.log('\n✋ Browser left open for manual inspection...');
  console.log('Check the screenshots: debug-initial.png and debug-after-click.png');
  console.log('Press Ctrl+C to exit');
  
  // Keep script running
  await new Promise(() => {});
}

debugDetailed().catch(console.error);