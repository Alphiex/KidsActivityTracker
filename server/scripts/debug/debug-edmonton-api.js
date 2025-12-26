#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function debugEdmontonAPI() {
  console.log('Debugging Edmonton API calls...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);

    // Track all API/XHR calls
    const apiCalls = [];

    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      const method = request.method();

      // Log JSON/API requests
      if (url.includes('api') || url.includes('json') ||
          request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        apiCalls.push({ method, url: url.substring(0, 200), type: request.resourceType() });
      }
      request.continue();
    });

    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (contentType.includes('json') && !url.includes('gtag') && !url.includes('analytics')) {
        try {
          const text = await response.text();
          if (text.length > 10 && text.length < 10000) {
            console.log(`\nJSON Response from: ${url.substring(0, 100)}`);
            console.log(`Content: ${text.substring(0, 500)}`);
          }
        } catch (e) {}
      }
    });

    // Navigate and search
    console.log('Loading Edmonton courses page...');
    await page.goto('https://movelearnplay.edmonton.ca/COE/public/category/courses', {
      waitUntil: 'networkidle2'
    });
    await new Promise(r => setTimeout(r, 3000));

    // Click search
    console.log('Clicking search...');
    await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (form) {
        const btn = form.querySelector('input[type="submit"]');
        if (btn) btn.click();
      }
    });

    await new Promise(r => setTimeout(r, 5000));

    // Navigate to a detail page
    console.log('\nNavigating to detail page...');
    await page.goto('https://movelearnplay.edmonton.ca/COE/public/booking/CourseDetails/764052', {
      waitUntil: 'networkidle2'
    });
    await new Promise(r => setTimeout(r, 3000));

    // Click on "Classes" button if it exists
    const classesClicked = await page.evaluate(() => {
      const btn = document.querySelector('a[href="#Accordion-btn"][title*="Classes"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log('Classes button clicked:', classesClicked);

    await new Promise(r => setTimeout(r, 3000));

    // Check for any dynamically loaded content
    const dynamicContent = await page.evaluate(() => {
      // Look for any tables or lists that might have availability
      const tables = document.querySelectorAll('table');
      const result = [];
      tables.forEach((t, i) => {
        const text = t.innerText;
        if (text.includes('Spaces') || text.includes('Available') || text.includes('spots')) {
          result.push({ index: i, text: text.substring(0, 500) });
        }
      });
      return result;
    });

    console.log('\n=== Dynamic content with availability ===');
    dynamicContent.forEach(c => {
      console.log(`Table ${c.index}: ${c.text}`);
    });

    console.log('\n=== API Calls Made ===');
    apiCalls.forEach(c => {
      console.log(`${c.method} ${c.type}: ${c.url}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugEdmontonAPI().catch(console.error);
