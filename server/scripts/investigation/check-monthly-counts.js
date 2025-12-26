#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function checkMonths() {
  console.log('Checking activity counts by month...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(90000);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    console.log('=== EDMONTON - Activities by Month ===');
    
    for (const month of months) {
      await page.goto('https://movelearnplay.edmonton.ca/COE/public/category/courses', { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      await new Promise(r => setTimeout(r, 2000));

      // Select month and search
      await page.evaluate((m) => {
        const select = document.querySelector('select[name="StartMonth"]');
        if (select) {
          for (const opt of select.options) {
            if (opt.text === m) {
              opt.selected = true;
              break;
            }
          }
        }
        const form = document.getElementById('searchForm');
        if (form) {
          const btn = form.querySelector('input[type="submit"]');
          if (btn) btn.click();
        }
      }, month);

      await new Promise(r => setTimeout(r, 5000));

      const count = await page.evaluate(() => {
        const cards = document.querySelectorAll('div.card.mb-4');
        const pagination = document.querySelectorAll('.pagination a[data-page]');
        let maxPage = 1;
        pagination.forEach(p => {
          const num = parseInt(p.getAttribute('data-page'));
          if (num > maxPage) maxPage = num;
        });
        return {
          cards: cards.length,
          pages: maxPage,
          estimated: cards.length * maxPage
        };
      });

      console.log(`  ${month}: ${count.cards} cards × ${count.pages} pages = ~${count.estimated} activities`);
    }

    // Also try with NO month filter to see total
    console.log('\n=== NO MONTH FILTER ===');
    await page.goto('https://movelearnplay.edmonton.ca/COE/public/category/courses', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (form) {
        const btn = form.querySelector('input[type="submit"]');
        if (btn) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 5000));

    const totalCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('div.card.mb-4');
      const pagination = document.querySelectorAll('.pagination a[data-page]');
      let maxPage = 1;
      pagination.forEach(p => {
        const num = parseInt(p.getAttribute('data-page'));
        if (num > maxPage) maxPage = num;
      });
      return { cards: cards.length, pages: maxPage, estimated: cards.length * maxPage };
    });
    console.log(`Total (no filter): ${totalCount.cards} cards × ${totalCount.pages} pages = ~${totalCount.estimated} activities`);

  } finally {
    await browser.close();
  }
}

checkMonths().catch(console.error);
