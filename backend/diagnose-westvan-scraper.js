const puppeteer = require('puppeteer');

/**
 * Diagnostic script for West Vancouver Recreation scraper
 * Analyzes the actual site structure to understand why activities aren't being detected
 */
async function diagnoseWestVanScraper() {
  console.log('🔍 West Vancouver Recreation Site Diagnostic');
  console.log('============================================\n');
  
  const baseUrl = 'https://anc.ca.apm.activecommunities.com/westvanrec';
  const searchUrl = `${baseUrl}/activity/search?onlineSiteId=0&activity_select_param=2&max_age=18&viewMode=list`;
  
  console.log('📍 Target URL:', searchUrl);
  console.log('');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      devtools: true,  // Open devtools
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    console.log('🌐 Navigating to West Vancouver Recreation site...\n');
    
    // Enable request interception to see what's loading
    await page.setRequestInterception(true);
    const requests = [];
    
    page.on('request', (request) => {
      if (request.url().includes('activity') || request.url().includes('search')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          type: request.resourceType()
        });
      }
      request.continue();
    });
    
    // Navigate with extended timeout
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    console.log('✅ Page loaded\n');
    
    // Wait for potential dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Analyze page structure
    console.log('📋 Analyzing page structure...\n');
    
    const analysis = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        hasActivityList: false,
        activitySelectors: {},
        formElements: [],
        navigationElements: [],
        dynamicContent: {},
        textContent: []
      };
      
      // Check for common activity list selectors
      const selectors = {
        '.activity-list': document.querySelectorAll('.activity-list').length,
        '.activity-item': document.querySelectorAll('.activity-item').length,
        '.program-item': document.querySelectorAll('.program-item').length,
        '.course-item': document.querySelectorAll('.course-item').length,
        '.list-group-item': document.querySelectorAll('.list-group-item').length,
        '[class*="activity"]': document.querySelectorAll('[class*="activity"]').length,
        '[class*="program"]': document.querySelectorAll('[class*="program"]').length,
        '[class*="course"]': document.querySelectorAll('[class*="course"]').length,
        'table tr': document.querySelectorAll('table tr').length,
        '.table tbody tr': document.querySelectorAll('.table tbody tr').length,
        'a[href*="activity"]': document.querySelectorAll('a[href*="activity"]').length,
        'a[href*="course"]': document.querySelectorAll('a[href*="course"]').length,
        'a[href*="program"]': document.querySelectorAll('a[href*="program"]').length
      };
      
      result.activitySelectors = selectors;
      result.hasActivityList = Object.values(selectors).some(count => count > 0);
      
      // Check for forms and filters
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        result.formElements.push({
          id: form.id,
          action: form.action,
          method: form.method,
          inputs: form.querySelectorAll('input, select').length
        });
      });
      
      // Check for navigation/category elements
      const navSelectors = [
        'a[href*="category"]',
        '.category-link',
        '.nav-link',
        '[role="navigation"] a'
      ];
      
      navSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          result.navigationElements.push({
            selector: selector,
            count: elements.length,
            samples: Array.from(elements).slice(0, 3).map(el => ({
              text: el.textContent.trim(),
              href: el.href
            }))
          });
        }
      });
      
      // Check for dynamic content indicators
      result.dynamicContent = {
        hasAngular: typeof window.angular !== 'undefined',
        hasReact: document.querySelector('[data-reactroot]') !== null,
        hasVue: document.querySelector('#app') !== null,
        hasJQuery: typeof window.$ !== 'undefined',
        hasAjaxIndicators: document.querySelectorAll('.loading, .spinner, [class*="load"]').length
      };
      
      // Get sample text content
      const textElements = document.querySelectorAll('h1, h2, h3, .alert, .message, .error');
      result.textContent = Array.from(textElements).slice(0, 10).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 100)
      }));
      
      // Check for iframes
      result.hasIframe = document.querySelectorAll('iframe').length > 0;
      
      // Check page content for keywords
      const bodyText = document.body.innerText.toLowerCase();
      result.hasKeywords = {
        'no results': bodyText.includes('no results'),
        'no activities': bodyText.includes('no activities'),
        'search': bodyText.includes('search'),
        'aquatics': bodyText.includes('aquatics'),
        'swimming': bodyText.includes('swimming'),
        'filter': bodyText.includes('filter')
      };
      
      return result;
    });
    
    // Display analysis results
    console.log('📊 Page Analysis Results:');
    console.log('========================\n');
    
    console.log('🌐 Page Info:');
    console.log(`   Title: ${analysis.title}`);
    console.log(`   URL: ${analysis.url}`);
    console.log(`   Has Activity List: ${analysis.hasActivityList}`);
    console.log(`   Has Iframe: ${analysis.hasIframe}`);
    console.log('');
    
    console.log('🔍 Activity Selectors Found:');
    Object.entries(analysis.activitySelectors).forEach(([selector, count]) => {
      if (count > 0) {
        console.log(`   ${selector}: ${count} elements`);
      }
    });
    console.log('');
    
    console.log('📝 Forms on Page:');
    analysis.formElements.forEach(form => {
      console.log(`   Form: ${form.id || '(no id)'}`);
      console.log(`     Action: ${form.action}`);
      console.log(`     Inputs: ${form.inputs}`);
    });
    console.log('');
    
    console.log('🔗 Navigation Elements:');
    analysis.navigationElements.forEach(nav => {
      console.log(`   ${nav.selector}: ${nav.count} elements`);
      nav.samples.forEach(sample => {
        console.log(`     - "${sample.text}" -> ${sample.href}`);
      });
    });
    console.log('');
    
    console.log('⚡ Dynamic Content:');
    Object.entries(analysis.dynamicContent).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log('');
    
    console.log('🔤 Page Keywords:');
    Object.entries(analysis.hasKeywords).forEach(([keyword, found]) => {
      console.log(`   "${keyword}": ${found ? '✅ Found' : '❌ Not found'}`);
    });
    console.log('');
    
    console.log('📄 Page Text Content:');
    analysis.textContent.forEach(content => {
      console.log(`   <${content.tag}>: ${content.text}`);
    });
    console.log('');
    
    console.log('🌐 Network Requests:');
    console.log(`   Total activity/search requests: ${requests.length}`);
    requests.slice(0, 5).forEach(req => {
      console.log(`   ${req.method} ${req.type}: ${req.url.substring(0, 100)}`);
    });
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'westvan-diagnostic-screenshot.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as westvan-diagnostic-screenshot.png');
    
    // Save page HTML
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('westvan-diagnostic-page.html', html);
    console.log('📄 Page HTML saved as westvan-diagnostic-page.html');
    
    console.log('\n🔍 Diagnostic Complete!');
    console.log('======================\n');
    
    console.log('💡 Recommendations:');
    if (!analysis.hasActivityList) {
      console.log('   ⚠️ No activity list elements found - may need to:');
      console.log('      1. Check if activities load dynamically via AJAX');
      console.log('      2. Verify search parameters are correct');
      console.log('      3. Check if login/session is required');
      console.log('      4. Look for different URL patterns or navigation flow');
    }
    
    if (analysis.hasIframe) {
      console.log('   ⚠️ Page contains iframe - activities might be inside iframe');
    }
    
    if (Object.keys(analysis.dynamicContent).some(k => analysis.dynamicContent[k])) {
      console.log('   ⚠️ Page has dynamic content - may need to wait for AJAX loads');
    }
    
    console.log('\n   ℹ️ Check the screenshot and HTML file for visual inspection');
    console.log('   ℹ️ Browser window will remain open for manual inspection');
    console.log('   ℹ️ Press Ctrl+C to close when done');
    
    // Keep browser open for manual inspection
    await new Promise(() => {}); // Infinite wait
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    if (browser) await browser.close();
    throw error;
  }
}

// Run diagnostic
if (require.main === module) {
  console.log('Starting West Vancouver Recreation diagnostic...\n');
  diagnoseWestVanScraper()
    .then(() => {
      console.log('✅ Diagnostic completed');
    })
    .catch((error) => {
      console.error('❌ Diagnostic error:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseWestVanScraper };