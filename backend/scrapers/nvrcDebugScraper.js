const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugNVRCPage() {
  let browser;
  
  try {
    console.log('🚀 Starting NVRC Debug Scraper...');
    
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: ['--window-size=1920,1080'],
      defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('\n📍 Navigating to NVRC PerfectMind...');
    const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
    
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take screenshot
    await page.screenshot({ path: 'nvrc-debug-main-page.png', fullPage: true });
    console.log('📸 Screenshot saved: nvrc-debug-main-page.png');
    
    // Analyze the page structure
    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        title: document.title,
        url: window.location.href,
        linksByText: {},
        sectionsFound: [],
        navigationStructure: []
      };
      
      // Find all links and group by text
      const links = Array.from(document.querySelectorAll('a'));
      links.forEach(link => {
        const text = link.textContent?.trim();
        if (text && text.length > 2) {
          if (!analysis.linksByText[text]) {
            analysis.linksByText[text] = {
              count: 0,
              hrefs: []
            };
          }
          analysis.linksByText[text].count++;
          if (analysis.linksByText[text].hrefs.length < 3) {
            analysis.linksByText[text].hrefs.push(link.href);
          }
        }
      });
      
      // Look for section headers
      const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5'));
      headers.forEach(header => {
        const text = header.textContent?.trim();
        if (text) {
          analysis.sectionsFound.push({
            tag: header.tagName,
            text: text
          });
        }
      });
      
      // Look for navigation/menu structures
      const navElements = Array.from(document.querySelectorAll('nav, [class*="nav"], [class*="menu"], ul'));
      navElements.forEach(nav => {
        const links = nav.querySelectorAll('a');
        if (links.length > 3) {
          const navLinks = Array.from(links).slice(0, 10).map(link => ({
            text: link.textContent?.trim(),
            href: link.href
          }));
          analysis.navigationStructure.push({
            type: nav.tagName,
            class: nav.className,
            linkCount: links.length,
            sampleLinks: navLinks
          });
        }
      });
      
      return analysis;
    });
    
    console.log('\n📊 Page Analysis:');
    console.log('Title:', pageAnalysis.title);
    console.log('URL:', pageAnalysis.url);
    
    console.log('\n🔗 Links found (by text):');
    Object.entries(pageAnalysis.linksByText)
      .filter(([text, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .forEach(([text, data]) => {
        console.log(`  "${text}" (${data.count}x)`);
        if (data.hrefs[0]) {
          console.log(`    → ${data.hrefs[0]}`);
        }
      });
    
    console.log('\n📑 Section Headers:');
    pageAnalysis.sectionsFound.slice(0, 10).forEach(section => {
      console.log(`  ${section.tag}: ${section.text}`);
    });
    
    console.log('\n🧭 Navigation Structures:');
    pageAnalysis.navigationStructure.slice(0, 5).forEach(nav => {
      console.log(`  ${nav.type}.${nav.class} (${nav.linkCount} links)`);
      nav.sampleLinks.slice(0, 3).forEach(link => {
        console.log(`    - ${link.text}`);
      });
    });
    
    // Save analysis to file
    fs.writeFileSync('nvrc-page-analysis.json', JSON.stringify(pageAnalysis, null, 2));
    console.log('\n💾 Full analysis saved to: nvrc-page-analysis.json');
    
    console.log('\n⏸️  Browser will remain open for manual inspection...');
    console.log('Press Ctrl+C to close when done.');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugNVRCPage();