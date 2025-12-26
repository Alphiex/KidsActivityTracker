#!/usr/bin/env node

/**
 * Debug script to see actual search results from Saskatoon WebTrac
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugResults() {
  console.log('Debugging Saskatoon WebTrac search results...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);

    // Go to splash page first to initialize session
    console.log('Loading splash page...');
    await page.goto('https://leisure.saskatoon.ca/wbwsc/webtracrec.wsc/splash.html', {
      waitUntil: 'networkidle2'
    });
    await new Promise(r => setTimeout(r, 2000));

    // Go to search page
    console.log('Loading search page...');
    await page.goto('https://leisure.saskatoon.ca/wbwsc/webtracrec.wsc/search.html', {
      waitUntil: 'networkidle2'
    });
    await new Promise(r => setTimeout(r, 2000));

    // Select "Children Recreation" type by clicking on the listitem
    console.log('Selecting Children Recreation type...');

    // Click on the listitem to select it (WebTrac uses custom Vue components)
    const selectedType = await page.evaluate(() => {
      // Find the listitem with Children Rec
      const items = document.querySelectorAll('.listitem');
      for (const item of items) {
        if (item.dataset.value === 'Children Rec') {
          item.click();
          return item.textContent.trim();
        }
      }
      return null;
    });
    console.log('Selected type:', selectedType);

    await new Promise(r => setTimeout(r, 1000));

    // Click search button and wait for navigation/response
    console.log('Clicking search button and waiting...');

    // Use Promise.all with click and waitForNavigation
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
        page.click('#arwebsearch_buttonsearch')
      ]);
    } catch (e) {
      console.log('Navigation wait completed or timed out:', e.message);
    }

    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 5000));

    // Check for search results
    const pageContent = await page.evaluate(() => {
      return {
        bodyText: document.body.innerText.substring(0, 5000),
        hasResults: !document.body.innerText.includes('Begin Search'),
        resultsHTML: document.querySelector('#arwebsearch_nextgenresultsgroup')?.innerHTML?.substring(0, 3000)
      };
    });

    console.log('\n=== PAGE STATE ===');
    console.log('Has Results:', pageContent.hasResults);
    console.log('\nBody text excerpt:', pageContent.bodyText.substring(0, 1000));

    // Take a screenshot
    await page.screenshot({ path: '/tmp/saskatoon-after-search.png', fullPage: true });
    console.log('\nSaved screenshot to /tmp/saskatoon-after-search.png');

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/saskatoon-after-search.html', html);
    console.log('Saved HTML to /tmp/saskatoon-after-search.html');

    // Check if we need to trigger form submission differently
    if (!pageContent.hasResults) {
      console.log('\n=== Trying form.submit() directly ===');

      await page.evaluate(() => {
        const form = document.querySelector('#arwebsearch');
        if (form) form.submit();
      });

      await new Promise(r => setTimeout(r, 8000));

      const afterSubmit = await page.evaluate(() => {
        return {
          bodyText: document.body.innerText.substring(0, 2000),
          hasResults: !document.body.innerText.includes('Begin Search'),
        };
      });

      console.log('After form.submit - Has Results:', afterSubmit.hasResults);
      console.log('Body excerpt:', afterSubmit.bodyText.substring(0, 500));

      await page.screenshot({ path: '/tmp/saskatoon-after-submit.png', fullPage: true });
      fs.writeFileSync('/tmp/saskatoon-after-submit.html', await page.content());
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugResults().catch(console.error);
