#!/usr/bin/env node
/**
 * Debug Pitt Meadows Intelligenz site structure
 */

const puppeteer = require('puppeteer');

const searchUrl = 'https://www.pittfitandfun.ca/copm/public/category/browse/Search';

async function debug() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Loading Pitt Meadows search page...');
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    await page.screenshot({ path: '/tmp/pittmeadows-search.png', fullPage: true });
    console.log('Screenshot saved to /tmp/pittmeadows-search.png');

    // Check for course type dropdown
    const dropdownInfo = await page.evaluate(() => {
      const selectors = [
        '#CourseTypes',
        '#courseTypes',
        'select[name="CourseTypes"]',
        'select.list-box',
        'select'
      ];

      const results = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, i) => {
          if (el.tagName === 'SELECT') {
            const options = Array.from(el.options).map(opt => ({
              value: opt.value,
              text: opt.text.trim(),
              disabled: opt.disabled
            }));
            results.push({
              selector,
              id: el.id,
              name: el.name,
              optionCount: options.length,
              options: options.slice(0, 30) // First 30 options
            });
          }
        });
      }
      return results;
    });

    console.log('\n=== DROPDOWN ELEMENTS ===');
    dropdownInfo.forEach(info => {
      console.log(`\nSelector: ${info.selector} (id=${info.id}, name=${info.name})`);
      console.log(`Options (${info.optionCount}):`);
      info.options.forEach(opt => console.log(`  - "${opt.text}" (value=${opt.value}${opt.disabled ? ', DISABLED' : ''})`));
    });

    // Check page structure for results
    const pageStructure = await page.evaluate(() => {
      return {
        forms: document.querySelectorAll('form').length,
        panels: document.querySelectorAll('.panel').length,
        tables: document.querySelectorAll('table').length,
        buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).map(b => b.textContent?.trim() || b.value).filter(Boolean),
        pagination: document.querySelectorAll('.pagination, ul.pagination').length
      };
    });

    console.log('\n=== PAGE STRUCTURE ===');
    console.log(JSON.stringify(pageStructure, null, 2));

    // Try to submit search with no filters to see all results
    console.log('\n=== SUBMITTING SEARCH ===');
    await page.evaluate(() => {
      const submitBtn = document.querySelector('input[type="submit"][value="Search"], button:contains("Search")');
      if (submitBtn) submitBtn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Count results
    const resultsInfo = await page.evaluate(() => {
      return {
        panels: document.querySelectorAll('.panel.panel-default').length,
        courseResults: document.querySelectorAll('.panel.course-results, .course-panel').length,
        bookButtons: document.querySelectorAll('a[href*="CourseDetails"], a.btn-primary').length,
        h3Count: document.querySelectorAll('h3').length,
        pagination: document.querySelector('.pagination') ? 'YES' : 'NO',
        paginationPages: Array.from(document.querySelectorAll('.pagination a[data-page]')).map(a => a.getAttribute('data-page'))
      };
    });

    console.log('\n=== SEARCH RESULTS ===');
    console.log(JSON.stringify(resultsInfo, null, 2));

    await page.screenshot({ path: '/tmp/pittmeadows-results.png', fullPage: true });
    console.log('Results screenshot saved to /tmp/pittmeadows-results.png');

  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
