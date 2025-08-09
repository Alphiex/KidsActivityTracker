const puppeteer = require('puppeteer');

async function testPageStructure() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('🔍 Testing PerfectMind page structure...\n');
  
  // Try different URLs
  const urls = [
    'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a',
    'https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&embed=False',
    'https://www.nvrc.ca/programs-memberships/find-program'
  ];
  
  for (const url of urls) {
    console.log(`\n📍 Testing URL: ${url.substring(0, 80)}...`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      const pageInfo = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const visibleLinks = links.filter(a => a.offsetParent !== null);
        
        // Get sample links
        const sampleLinks = visibleLinks.slice(0, 20).map(a => ({
          text: a.textContent?.trim() || '',
          href: a.href || '',
          hasOnclick: !!a.onclick
        }));
        
        // Check for iframes
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const iframeInfo = iframes.map(f => ({
          src: f.src || '',
          id: f.id || '',
          width: f.width || f.offsetWidth,
          height: f.height || f.offsetHeight
        }));
        
        return {
          title: document.title,
          hasBody: !!document.body,
          bodyLength: document.body?.innerText?.length || 0,
          linkCount: links.length,
          visibleLinkCount: visibleLinks.length,
          sampleLinks: sampleLinks,
          iframeCount: iframes.length,
          iframes: iframeInfo,
          hasTables: document.querySelectorAll('table').length,
          hasShowButtons: Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent?.trim().toLowerCase() === 'show'
          ).length
        };
      });
      
      console.log('Page info:', JSON.stringify(pageInfo, null, 2));
      
      // If there's an iframe, try to access it
      if (pageInfo.iframeCount > 0) {
        console.log('\n🔍 Found iframe, attempting to access...');
        
        for (let i = 0; i < pageInfo.iframes.length; i++) {
          const iframe = pageInfo.iframes[i];
          if (iframe.src && iframe.src.includes('perfectmind')) {
            console.log(`\nNavigating to iframe URL: ${iframe.src}`);
            
            await page.goto(iframe.src, { waitUntil: 'networkidle0', timeout: 30000 });
            await new Promise(r => setTimeout(r, 5000));
            
            const iframeContent = await page.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a')).slice(0, 10);
              return {
                title: document.title,
                linkCount: document.querySelectorAll('a').length,
                sampleLinks: links.map(a => a.textContent?.trim() || '')
              };
            });
            
            console.log('Iframe content:', iframeContent);
          }
        }
      }
      
    } catch (error) {
      console.error(`Error with ${url}:`, error.message);
    }
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
}

testPageStructure().catch(console.error);