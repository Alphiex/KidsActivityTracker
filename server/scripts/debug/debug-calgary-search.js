#!/usr/bin/env node

/**
 * Debug Calgary search form submission
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugCalgarySearch() {
  console.log('Testing Calgary search form submission...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);

    // Navigate to courses page
    console.log('Loading Calgary courses page...');
    await page.goto('https://liveandplay.calgary.ca/REGPROG/public/category/courses', {
      waitUntil: 'networkidle2'
    });
    await new Promise(r => setTimeout(r, 3000));

    // Find the search form and submit button
    console.log('Looking for search form...');

    const formInfo = await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (!form) return { found: false };

      // Find submit button
      const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');

      return {
        found: true,
        formId: form.id,
        submitButton: {
          exists: !!submitBtn,
          type: submitBtn?.type,
          value: submitBtn?.value,
          text: submitBtn?.textContent
        }
      };
    });

    console.log('Form info:', formInfo);

    // Click the submit button inside the search form
    console.log('\nClicking search submit button...');

    const searchClicked = await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (!form) return { clicked: false, reason: 'Form not found' };

      const submitBtn = form.querySelector('input[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
        return { clicked: true, method: 'submit button click' };
      }

      // Try form.submit()
      form.submit();
      return { clicked: true, method: 'form.submit()' };
    });

    console.log('Search result:', searchClicked);

    // Wait for navigation/response
    await new Promise(r => setTimeout(r, 8000));

    // Take screenshot after search
    await page.screenshot({ path: '/tmp/calgary-after-search.png', fullPage: true });
    console.log('Saved screenshot to /tmp/calgary-after-search.png');

    // Check for results
    const resultsInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 3000),
        tables: Array.from(document.querySelectorAll('table')).map(t => ({
          id: t.id,
          class: t.className,
          headers: Array.from(t.querySelectorAll('th')).map(th => th.textContent?.trim()),
          rowCount: t.querySelectorAll('tbody tr').length
        })),
        hasResults: !document.body.innerText.includes('Click "Search" on Filter to Show Results'),
        courseElements: document.querySelectorAll('[class*="course"], [class*="program"], .list-group-item').length
      };
    });

    console.log('\n=== AFTER SEARCH ===');
    console.log('Has results:', resultsInfo.hasResults);
    console.log('Tables found:', resultsInfo.tables.length);
    resultsInfo.tables.forEach(t => {
      console.log(`  Table: headers=[${t.headers?.join(', ')}], rows=${t.rowCount}`);
    });
    console.log('Course elements:', resultsInfo.courseElements);
    console.log('\nBody text excerpt:');
    console.log(resultsInfo.bodyText);

    // Save HTML
    fs.writeFileSync('/tmp/calgary-after-search.html', await page.content());
    console.log('\nSaved HTML to /tmp/calgary-after-search.html');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugCalgarySearch().catch(console.error);
