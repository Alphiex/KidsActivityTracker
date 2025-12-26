#!/usr/bin/env node
/**
 * Debug Coquitlam PerfectMind site structure
 */

const puppeteer = require('puppeteer');

const mainUrl = 'https://cityofcoquitlam.perfectmind.com/23902/Clients/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406';

async function debug() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Loading Coquitlam page...');
    await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take screenshot
    await page.screenshot({ path: '/tmp/coquitlam-main.png', fullPage: true });
    console.log('Screenshot saved to /tmp/coquitlam-main.png');

    // Get all category boxes and their links
    const categories = await page.evaluate(() => {
      const boxes = document.querySelectorAll('.bm-categorybox');
      const results = [];

      boxes.forEach(box => {
        const titleEl = box.querySelector('.bm-category-links-title, .bm-box-title, h3, h4');
        const title = titleEl ? titleEl.textContent.trim() : 'Unknown';

        const links = box.querySelectorAll('a.bm-category-calendar-link.enabled');
        const linkTexts = Array.from(links).map(l => l.textContent.trim());

        results.push({
          title,
          linkCount: links.length,
          links: linkTexts
        });
      });

      return results;
    });

    console.log('\n=== CATEGORY BOXES ===');
    let totalLinks = 0;
    categories.forEach(cat => {
      console.log(`\n${cat.title} (${cat.linkCount} links):`);
      cat.links.forEach(l => console.log(`  - ${l}`));
      totalLinks += cat.linkCount;
    });
    console.log(`\nTotal category links: ${totalLinks}`);

    // Check for different page structures
    const pageStructure = await page.evaluate(() => {
      return {
        categoryBoxes: document.querySelectorAll('.bm-categorybox').length,
        categoryLinks: document.querySelectorAll('a.bm-category-calendar-link.enabled').length,
        allLinks: document.querySelectorAll('a').length,
        hasAngular: typeof window.angular !== 'undefined',
        bmGroups: document.querySelectorAll('.bm-group').length,
        sections: document.querySelectorAll('section, .section').length
      };
    });

    console.log('\n=== PAGE STRUCTURE ===');
    console.log(JSON.stringify(pageStructure, null, 2));

    // Check if there are age-group sections
    const ageGroups = await page.evaluate(() => {
      const groups = [];
      // Look for age-related section headers
      document.querySelectorAll('h2, h3, h4, .header, [class*="title"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text && /child|youth|teen|preschool|early|toddler|infant|adult|senior/i.test(text)) {
          groups.push(text);
        }
      });
      return groups;
    });

    console.log('\n=== AGE GROUP HEADERS FOUND ===');
    ageGroups.forEach(g => console.log(`  - ${g}`));

  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
