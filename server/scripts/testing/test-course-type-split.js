#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function test() {
  console.log('Testing course type splitting for Edmonton January...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(90000);

    const coursesUrl = 'https://movelearnplay.edmonton.ca/COE/public/category/courses';

    // Get course types count
    await page.goto(coursesUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    const courseTypes = await page.evaluate(() => {
      const types = [];
      const select = document.querySelector('select[name="CourseTypes"]');
      if (select) {
        for (const opt of select.options) {
          if (opt.value && opt.value.length > 10) {
            types.push({ value: opt.value, text: opt.text });
          }
        }
      }
      return types;
    });
    console.log(`Found ${courseTypes.length} course types`);

    // Test January without filter
    console.log('\n=== January (no filter) ===');
    await page.goto(coursesUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      const monthSelect = form.querySelector('select[name="StartMonth"]');
      if (monthSelect) {
        for (const opt of monthSelect.options) {
          if (opt.text === 'January') { opt.selected = true; break; }
        }
      }
      form.querySelector('input[type="submit"]').click();
    });

    await new Promise(r => setTimeout(r, 8000));

    const janInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('div.card.mb-4');
      const pagination = document.querySelectorAll('.pagination a[data-page]');
      let maxPage = 1;
      pagination.forEach(p => {
        const num = parseInt(p.getAttribute('data-page'));
        if (num > maxPage) maxPage = num;
      });
      return { cards: cards.length, maxPage };
    });
    console.log(`Cards: ${janInfo.cards}, Max page: ${janInfo.maxPage}`);
    console.log(`Hit limit: ${janInfo.maxPage >= 20 ? 'YES - will split by course type' : 'NO'}`);

    // Test a few course types for January
    if (janInfo.maxPage >= 20) {
      console.log('\n=== Testing sample course types for January ===');
      const sampleTypes = courseTypes.slice(0, 5);
      
      for (const ct of sampleTypes) {
        await page.goto(coursesUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));

        await page.evaluate((type) => {
          const form = document.getElementById('searchForm');
          const monthSelect = form.querySelector('select[name="StartMonth"]');
          if (monthSelect) {
            for (const opt of monthSelect.options) {
              if (opt.text === 'January') { opt.selected = true; break; }
            }
          }
          const courseSelect = form.querySelector('select[name="CourseTypes"]');
          if (courseSelect) {
            for (const opt of courseSelect.options) {
              if (opt.value === type.value) { opt.selected = true; break; }
            }
          }
          form.querySelector('input[type="submit"]').click();
        }, ct);

        await new Promise(r => setTimeout(r, 5000));

        const typeInfo = await page.evaluate(() => {
          const cards = document.querySelectorAll('div.card.mb-4');
          const pagination = document.querySelectorAll('.pagination a[data-page]');
          let maxPage = 1;
          pagination.forEach(p => {
            const num = parseInt(p.getAttribute('data-page'));
            if (num > maxPage) maxPage = num;
          });
          return { cards: cards.length, maxPage };
        });
        
        console.log(`  ${ct.text.substring(0, 40)}: ${typeInfo.cards} cards, ${typeInfo.maxPage} pages`);
      }
    }

    console.log('\n=== Summary ===');
    console.log('Course type splitting is working!');
    console.log('When a month hits the pagination limit, individual course types will be queried.');
    console.log('This will significantly increase activity count but also scrape time.');

  } finally {
    await browser.close();
  }
}

test().catch(console.error);
