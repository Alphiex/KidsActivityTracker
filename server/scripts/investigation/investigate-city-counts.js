#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function investigate() {
  console.log('Investigating actual activity counts...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(90000);

    // Check Edmonton
    console.log('=== EDMONTON ===');
    await page.goto('https://movelearnplay.edmonton.ca/COE/public/category/courses', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await new Promise(r => setTimeout(r, 3000));

    // Look for any total count display before searching
    let edmontonInfo = await page.evaluate(() => {
      // Check if there's a badge showing total
      const badge = document.querySelector('.badge-value');
      const totalText = document.body.innerText.match(/(\d+)\s*(?:results?|courses?|programs?|activities?)/i);
      
      // Check for any filters that might be set
      const filters = {};
      document.querySelectorAll('select').forEach(s => {
        if (s.value && s.value !== '') {
          filters[s.name || s.id] = s.options[s.selectedIndex]?.text;
        }
      });

      return {
        badge: badge?.textContent,
        totalText: totalText?.[0],
        filters,
        url: window.location.href
      };
    });
    console.log('Before search:', edmontonInfo);

    // Click search
    await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (form) {
        const btn = form.querySelector('input[type="submit"]');
        if (btn) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 8000));

    edmontonInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('div.card.mb-4');
      const pagination = document.querySelectorAll('.pagination a[data-page], .pagination a[href*="page"]');
      let maxPage = 1;
      pagination.forEach(p => {
        const num = parseInt(p.textContent) || parseInt(p.getAttribute('data-page'));
        if (num > maxPage) maxPage = num;
      });
      
      // Look for "showing X of Y" or similar
      const showingMatch = document.body.innerText.match(/showing\s*\d+\s*(?:to|-)?\s*\d*\s*of\s*(\d+)/i);
      const resultsMatch = document.body.innerText.match(/(\d+)\s*results?/i);
      
      return {
        cardsOnPage: cards.length,
        maxPage,
        showingText: showingMatch?.[0],
        resultsText: resultsMatch?.[0],
        estimatedTotal: cards.length * maxPage,
        url: window.location.href
      };
    });
    console.log('After search:', edmontonInfo);

    // Check Calgary
    console.log('\n=== CALGARY ===');
    await page.goto('https://liveandplay.calgary.ca/REGPROG/public/category/courses', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await new Promise(r => setTimeout(r, 3000));

    let calgaryInfo = await page.evaluate(() => {
      const badge = document.querySelector('.badge-value');
      const totalText = document.body.innerText.match(/(\d+)\s*(?:results?|courses?|programs?|activities?)/i);
      const filters = {};
      document.querySelectorAll('select').forEach(s => {
        if (s.value && s.value !== '') {
          filters[s.name || s.id] = s.options[s.selectedIndex]?.text;
        }
      });
      return {
        badge: badge?.textContent,
        totalText: totalText?.[0],
        filters,
        url: window.location.href
      };
    });
    console.log('Before search:', calgaryInfo);

    // Click search
    await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (form) {
        const btn = form.querySelector('input[type="submit"]');
        if (btn) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 8000));

    calgaryInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('div.card.mb-4');
      const pagination = document.querySelectorAll('.pagination a[data-page], .pagination a[href*="page"]');
      let maxPage = 1;
      pagination.forEach(p => {
        const num = parseInt(p.textContent) || parseInt(p.getAttribute('data-page'));
        if (num > maxPage) maxPage = num;
      });
      
      const showingMatch = document.body.innerText.match(/showing\s*\d+\s*(?:to|-)?\s*\d*\s*of\s*(\d+)/i);
      const resultsMatch = document.body.innerText.match(/(\d+)\s*results?/i);
      
      return {
        cardsOnPage: cards.length,
        maxPage,
        showingText: showingMatch?.[0],
        resultsText: resultsMatch?.[0],
        estimatedTotal: cards.length * maxPage,
        url: window.location.href
      };
    });
    console.log('After search:', calgaryInfo);

    // Check if Calgary has multiple category endpoints too
    console.log('\n=== CALGARY CATEGORY ENDPOINTS ===');
    await page.goto('https://liveandplay.calgary.ca/REGPROG/public/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await new Promise(r => setTimeout(r, 3000));

    const calgaryCategories = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="category"], a[href*="browse"]').forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent?.trim();
        if (href && text && text.length < 100) {
          links.push({ text, href });
        }
      });
      return links;
    });
    console.log('Calgary categories found:', calgaryCategories.length);
    calgaryCategories.slice(0, 15).forEach(c => console.log(`  - ${c.text}: ${c.href}`));

  } finally {
    await browser.close();
  }
}

investigate().catch(console.error);
