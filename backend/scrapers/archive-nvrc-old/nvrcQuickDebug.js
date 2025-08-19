const puppeteer = require('puppeteer');
const fs = require('fs');

async function quickDebug() {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('Navigating to NVRC...');
    const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a';
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshot
    await page.screenshot({ path: 'nvrc-page.png', fullPage: true });
    
    // Get page content
    const pageContent = await page.evaluate(() => {
      // Get all text content from links
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent?.trim(),
        href: a.href,
        visible: a.offsetHeight > 0
      })).filter(l => l.text && l.visible);
      
      // Get page structure
      return {
        title: document.title,
        linkCount: links.length,
        sampleLinks: links.slice(0, 50),
        hasIframes: document.querySelectorAll('iframe').length > 0,
        bodyText: document.body.innerText.substring(0, 1000)
      };
    });
    
    console.log('\nPage Analysis:');
    console.log('Title:', pageContent.title);
    console.log('Total visible links:', pageContent.linkCount);
    console.log('Has iframes:', pageContent.hasIframes);
    
    console.log('\nFirst 50 links:');
    pageContent.sampleLinks.forEach((link, i) => {
      console.log(`${i+1}. "${link.text}"`);
    });
    
    fs.writeFileSync('nvrc-page-content.json', JSON.stringify(pageContent, null, 2));
    console.log('\nSaved to nvrc-page-content.json');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

quickDebug();