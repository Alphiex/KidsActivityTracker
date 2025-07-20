const puppeteer = require('puppeteer');

async function testBasicPuppeteer() {
  let browser;
  
  try {
    console.log('Testing basic Puppeteer functionality...');
    
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    console.log('Navigating to Google...');
    await page.goto('https://www.google.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    console.log('✅ Successfully loaded Google');
    
    console.log('\nNow trying NVRC...');
    await page.goto('https://www.nvrc.ca', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    console.log('✅ Successfully loaded NVRC homepage');
    
    await browser.close();
    console.log('\n✅ Basic Puppeteer test passed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (browser) await browser.close();
  }
}

testBasicPuppeteer();