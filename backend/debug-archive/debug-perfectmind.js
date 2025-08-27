const puppeteer = require('puppeteer');

async function debug() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('🔍 Debugging PerfectMind page...\n');
  
  // Navigate to PerfectMind
  const url = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False&redirectedFromEmbededMode=False';
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Take screenshot
  await page.screenshot({ path: 'debug-perfectmind.png', fullPage: true });
  console.log('📸 Saved screenshot');
  
  // Get page content
  const pageInfo = await page.evaluate(() => {
    return {
      title: document.title,
      url: window.location.href,
      bodyText: document.body.innerText.substring(0, 500),
      linkCount: document.querySelectorAll('a').length,
      hasIframes: document.querySelectorAll('iframe').length,
      forms: document.querySelectorAll('form').length,
      buttons: document.querySelectorAll('button').length
    };
  });
  
  console.log('\n📄 Page info:', pageInfo);
  
  // Get all links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => ({
      text: a.textContent?.trim() || '',
      href: a.href || ''
    }));
  });
  
  console.log('\n🔗 First 20 links:', links);
  
  await browser.close();
}

debug().catch(console.error);