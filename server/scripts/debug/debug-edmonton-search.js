#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function debugSearch() {
  console.log('Testing Edmonton comprehensive search...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);

    // Check search form options on main courses page
    console.log('=== Checking search form options ===');
    await page.goto('https://movelearnplay.edmonton.ca/COE/public/category/courses', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const filterInfo = await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (!form) return { hasForm: false };

      const selects = form.querySelectorAll('select');
      const selectInfo = {};
      selects.forEach(s => {
        const name = s.name || s.id || 'unknown';
        selectInfo[name] = Array.from(s.options).map(o => ({ value: o.value, text: o.text }));
      });

      const inputs = form.querySelectorAll('input[type="text"], input[type="number"]');
      const inputInfo = [];
      inputs.forEach(i => {
        inputInfo.push({ name: i.name || i.id, placeholder: i.placeholder });
      });

      return {
        hasForm: true,
        selects: selectInfo,
        inputs: inputInfo
      };
    });
    
    console.log('Form info:', JSON.stringify(filterInfo, null, 2));

    // Also check if different category types are visible
    console.log('\n=== Category type breakdown ===');
    const categoryTypes = await page.evaluate(() => {
      // Look for subcategory links or type indicators
      const links = document.querySelectorAll('a[href*="category"]');
      const types = new Set();
      links.forEach(l => types.add(l.textContent?.trim()));
      return Array.from(types).filter(t => t && t.length < 50);
    });
    console.log('Category types found:', categoryTypes);

  } finally {
    await browser.close();
  }
}

debugSearch().catch(console.error);
