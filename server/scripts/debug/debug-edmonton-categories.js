#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function debugCategories() {
  console.log('Checking Edmonton categories...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);

    const categories = [
      { name: 'Courses', url: 'https://movelearnplay.edmonton.ca/COE/public/category/courses' },
      { name: 'Programs (PROG)', url: 'https://movelearnplay.edmonton.ca/COE/public/category/browse/PROG' },
      { name: 'Drop-in', url: 'https://movelearnplay.edmonton.ca/COE/public/category/browse/DROPIN' },
      { name: 'Golf', url: 'https://movelearnplay.edmonton.ca/COE/public/category/browse/GOLF' },
    ];

    for (const cat of categories) {
      console.log(`\n=== ${cat.name} ===`);
      console.log(`URL: ${cat.url}`);

      await page.goto(cat.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));

      // Click search if there's a form
      await page.evaluate(() => {
        const form = document.getElementById('searchForm');
        if (form) {
          const btn = form.querySelector('input[type="submit"]');
          if (btn) btn.click();
        }
      });

      await new Promise(r => setTimeout(r, 5000));

      // Count results
      const stats = await page.evaluate(() => {
        const cards = document.querySelectorAll('div.card.mb-4');
        const pagination = document.querySelectorAll('.pagination .page-item');
        const lastPageLink = document.querySelector('.pagination a[data-page]:last-of-type');
        const lastPage = lastPageLink ? lastPageLink.getAttribute('data-page') : '1';

        // Try to find total count text
        const bodyText = document.body.innerText;
        const totalMatch = bodyText.match(/(\d+)\s*(?:results?|items?|activities?|courses?)/i);

        return {
          cardsOnPage: cards.length,
          paginationItems: pagination.length,
          lastPage: lastPage,
          totalText: totalMatch ? totalMatch[0] : null
        };
      });

      console.log(`Cards on first page: ${stats.cardsOnPage}`);
      console.log(`Last page number: ${stats.lastPage}`);
      console.log(`Estimated total: ${stats.cardsOnPage * parseInt(stats.lastPage || 1)}`);
      if (stats.totalText) console.log(`Total text found: ${stats.totalText}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugCategories().catch(console.error);
