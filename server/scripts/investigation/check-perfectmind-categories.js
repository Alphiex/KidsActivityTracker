#!/usr/bin/env node
/**
 * Check all categories on PerfectMind sites to understand what's available
 */

const puppeteer = require('puppeteer');

const SITES = {
  'Abbotsford': {
    url: 'https://abbotsford.perfectmind.com/23852/Clients/BookMe4LandingPages',
    expected: 'thousands'
  },
  'Langley': {
    url: 'https://tol.perfectmind.com/Clients/BookMe4',
    expected: 'thousands'
  },
  'Port Moody': {
    url: 'https://cityofportmoody.perfectmind.com/Contacts/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406',
    expected: 'thousands'
  },
  'Maple Ridge': {
    url: 'https://cityofmapleridge.perfectmind.com/23724/Reports/BookMe4?widgetId=47fd20cf-24b1-4cbe-89a0-d25473cacb49',
    expected: 'thousands'
  },
  'Pitt Meadows': {
    url: 'https://www.pittfitandfun.ca/copm/public/category/browse/Search',
    expected: 'hundreds'
  }
};

async function checkCategories() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const [city, config] of Object.entries(SITES)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ${city.toUpperCase()} ===`);
    console.log(`URL: ${config.url}`);
    console.log(`${'='.repeat(60)}`);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    try {
      await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Take screenshot
      await page.screenshot({ path: `/tmp/categories-${city.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });
      console.log(`Screenshot: /tmp/categories-${city.toLowerCase().replace(/\s+/g, '-')}.png`);

      // Get all links that might be categories
      const analysis = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const categories = [];

        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';

          // Skip very short or very long text
          if (text.length < 3 || text.length > 100) return;

          // Skip navigation links
          if (/login|sign in|register|home|contact|about|help|skip/i.test(text)) return;

          categories.push({
            text,
            href: href.substring(0, 100)
          });
        });

        // Also look for non-link categories (divs, spans with category-like content)
        const boxes = document.querySelectorAll('[class*="category"], [class*="box"], [class*="card"], h2, h3, h4');
        const boxCategories = [];
        boxes.forEach(box => {
          const text = box.textContent?.trim() || '';
          if (text.length > 3 && text.length < 100) {
            boxCategories.push(text.substring(0, 80));
          }
        });

        return {
          linkCount: categories.length,
          links: categories.slice(0, 50),
          boxCategories: [...new Set(boxCategories)].slice(0, 30),
          pageTitle: document.title,
          bodyText: document.body.innerText.substring(0, 1000)
        };
      });

      console.log(`\nPage Title: ${analysis.pageTitle}`);
      console.log(`Total links found: ${analysis.linkCount}`);

      console.log(`\n--- Category Links (first 30) ---`);
      analysis.links.slice(0, 30).forEach((link, i) => {
        console.log(`  ${i + 1}. "${link.text}"`);
      });

      if (analysis.boxCategories.length > 0) {
        console.log(`\n--- Box/Header Categories ---`);
        analysis.boxCategories.forEach((cat, i) => {
          console.log(`  ${i + 1}. "${cat}"`);
        });
      }

      console.log(`\n--- Page Content Preview ---`);
      console.log(analysis.bodyText.substring(0, 500));

    } catch (error) {
      console.log(`ERROR: ${error.message}`);
    }

    await page.close();
  }

  await browser.close();
}

checkCategories().catch(console.error);
