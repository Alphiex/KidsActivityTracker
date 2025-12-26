#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function checkCities() {
  console.log('Checking activity counts for cities...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(90000);

    const cities = [
      { name: 'Edmonton', url: 'https://movelearnplay.edmonton.ca/COE/public/category/courses' },
      { name: 'Calgary', url: 'https://liveandplay.calgary.ca/REGPROG/public/category/courses' },
    ];

    for (const city of cities) {
      console.log(`\n=== ${city.name} ===`);

      await page.goto(city.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));

      // Click search
      await page.evaluate(() => {
        const form = document.getElementById('searchForm');
        if (form) {
          const btn = form.querySelector('input[type="submit"]');
          if (btn) btn.click();
        }
      });

      // Wait for results and navigation
      await new Promise(r => setTimeout(r, 5000));
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
      } catch (e) {}
      await new Promise(r => setTimeout(r, 3000));

      // Get pagination info
      const stats = await page.evaluate(() => {
        const cards = document.querySelectorAll('div.card.mb-4 .card-title');
        const pageLinks = document.querySelectorAll('.pagination a[data-page]');
        let maxPage = 1;
        pageLinks.forEach(link => {
          const p = parseInt(link.getAttribute('data-page'));
          if (p > maxPage) maxPage = p;
        });

        return {
          cardsOnPage: cards.length,
          maxPage: maxPage,
          estimated: cards.length * maxPage
        };
      });

      console.log(`Cards per page: ${stats.cardsOnPage}`);
      console.log(`Total pages: ${stats.maxPage}`);
      console.log(`Estimated total: ~${stats.estimated} activities`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkCities().catch(console.error);
