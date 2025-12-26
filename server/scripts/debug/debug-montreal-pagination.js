#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugMontreal() {
  console.log('Debugging Montreal IC3 pagination...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(90000);

    // Track API calls
    const apiCalls = [];
    await page.setRequestInterception(true);

    page.on('request', request => {
      const url = request.url();
      if (url.includes('search') && request.method() === 'POST') {
        try {
          const postData = request.postData();
          if (postData) {
            const parsed = JSON.parse(postData);
            apiCalls.push({ type: 'POST', url, body: parsed });
            console.log('POST request body:', JSON.stringify(parsed, null, 2).substring(0, 500));
          }
        } catch (e) {}
      }
      request.continue();
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('U5200') && url.includes('search') &&
          response.headers()['content-type']?.includes('json')) {
        try {
          const json = await response.json();
          console.log(`API Response: ${json.results?.length} results, ${json.recordCount} total`);
        } catch (e) {}
      }
    });

    // Navigate to IC3
    console.log('Loading Montreal IC3 page...');
    await page.goto('https://loisirs.montreal.ca/IC3/', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for Angular
    await new Promise(r => setTimeout(r, 8000));

    // Click search button
    console.log('Clicking search button...');
    await page.evaluate(() => {
      const btn = document.querySelector('#u2010_btnSearch');
      if (btn) btn.click();
    });

    // Wait for results
    await new Promise(r => setTimeout(r, 8000));

    // Check for pagination controls
    const paginationInfo = await page.evaluate(() => {
      const info = {
        paginationElements: [],
        loadMoreButtons: [],
        scrollContainers: [],
        pageInfo: null
      };

      // Look for pagination
      document.querySelectorAll('[class*="pagination"], [class*="pager"]').forEach(el => {
        info.paginationElements.push({
          class: el.className,
          html: el.outerHTML?.substring(0, 500)
        });
      });

      // Look for load more buttons
      document.querySelectorAll('button, a').forEach(el => {
        const text = (el.textContent || '').toLowerCase();
        if (text.includes('more') || text.includes('plus') ||
            text.includes('next') || text.includes('suivant')) {
          info.loadMoreButtons.push({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 100),
            class: el.className
          });
        }
      });

      // Look for infinite scroll containers
      document.querySelectorAll('[infinite-scroll], [ng-infinite-scroll], .infinite-scroll').forEach(el => {
        info.scrollContainers.push(el.className);
      });

      // Look for page number display
      const pageText = document.body.innerText.match(/page\s*\d+\s*(?:of|de|\/)\s*\d+/i);
      if (pageText) info.pageInfo = pageText[0];

      // Check for result count display
      const countMatch = document.body.innerText.match(/(\d+)\s*(?:results?|résultats?)/i);
      if (countMatch) info.resultCount = countMatch[0];

      return info;
    });

    console.log('\n=== PAGINATION INFO ===');
    console.log('Pagination elements:', paginationInfo.paginationElements.length);
    paginationInfo.paginationElements.forEach(p => {
      console.log('  Class:', p.class);
      console.log('  HTML:', p.html?.substring(0, 200));
    });

    console.log('\nLoad more buttons:', paginationInfo.loadMoreButtons.length);
    paginationInfo.loadMoreButtons.forEach(b => {
      console.log('  ' + b.tag + ': "' + b.text + '" class=' + b.class);
    });

    console.log('\nScroll containers:', paginationInfo.scrollContainers);
    console.log('Page info:', paginationInfo.pageInfo);
    console.log('Result count:', paginationInfo.resultCount);

    // Try scrolling to bottom to trigger more
    console.log('\n=== TRYING SCROLL ===');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 3000));
      console.log('Scroll attempt', i + 1);
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/montreal-pagination.png', fullPage: true });
    console.log('\nScreenshot saved to /tmp/montreal-pagination.png');

    // Show API calls
    console.log('\n=== API CALLS ===');
    apiCalls.forEach((call, i) => {
      console.log(`\nCall ${i + 1}:`);
      console.log('URL:', call.url);
      if (call.body) {
        console.log('Body skip/take:', call.body.skip, call.body.take);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugMontreal().catch(console.error);
