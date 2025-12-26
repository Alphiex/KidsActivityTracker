#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function investigate() {
  console.log('Investigating pagination limits and date filters...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(90000);

    // Check Edmonton with different date ranges
    console.log('=== EDMONTON - Checking date filters ===');
    await page.goto('https://movelearnplay.edmonton.ca/COE/public/category/courses', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await new Promise(r => setTimeout(r, 3000));

    // Get all form fields
    const formFields = await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (!form) return null;
      
      const fields = [];
      form.querySelectorAll('input, select').forEach(el => {
        fields.push({
          type: el.type || el.tagName.toLowerCase(),
          name: el.name || el.id,
          value: el.value,
          options: el.tagName === 'SELECT' ? Array.from(el.options).slice(0, 5).map(o => o.text) : null
        });
      });
      return fields;
    });
    console.log('Form fields:', JSON.stringify(formFields, null, 2));

    // Click search with default params
    await page.evaluate(() => {
      const form = document.getElementById('searchForm');
      if (form) {
        const btn = form.querySelector('input[type="submit"]');
        if (btn) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 8000));

    // Navigate to the LAST page to see actual pagination
    let paginationInfo = await page.evaluate(() => {
      const pagination = document.querySelector('.pagination');
      if (!pagination) return { hasPagination: false };
      
      const links = pagination.querySelectorAll('a');
      const pageNumbers = [];
      links.forEach(a => {
        const num = parseInt(a.textContent);
        if (!isNaN(num)) pageNumbers.push(num);
        
        const dataPage = a.getAttribute('data-page');
        if (dataPage) pageNumbers.push(parseInt(dataPage));
      });
      
      // Look for "last" or ">>" link
      let lastLink = null;
      links.forEach(a => {
        const text = a.textContent.trim();
        if (text === '>>' || text === 'Last' || text.includes('last')) {
          lastLink = a.getAttribute('href') || a.getAttribute('data-page');
        }
      });
      
      return {
        hasPagination: true,
        pageNumbers: [...new Set(pageNumbers)].sort((a,b) => a-b),
        lastLink,
        paginationHTML: pagination.innerHTML.substring(0, 500)
      };
    });
    console.log('Pagination info:', paginationInfo);

    // Check if there's a page size selector
    const pageSizeInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const pageSizeMatch = text.match(/showing\s*(\d+)\s*(?:of|per|items)/i);
      const perPageSelect = document.querySelector('select[name*="size"], select[name*="perPage"], select[name*="pageSize"]');
      
      return {
        pageSizeMatch: pageSizeMatch?.[0],
        hasPerPageSelect: !!perPageSelect,
        perPageOptions: perPageSelect ? Array.from(perPageSelect.options).map(o => o.text) : null
      };
    });
    console.log('Page size info:', pageSizeInfo);

    // Try going to page 20 and see if there's more
    console.log('\nNavigating to page 20...');
    const clicked = await page.evaluate(() => {
      const links = document.querySelectorAll('.pagination a');
      for (const link of links) {
        if (link.textContent.trim() === '20' || link.getAttribute('data-page') === '20') {
          link.click();
          return true;
        }
      }
      return false;
    });
    
    if (clicked) {
      await new Promise(r => setTimeout(r, 5000));
      
      const page20Info = await page.evaluate(() => {
        const cards = document.querySelectorAll('div.card.mb-4');
        const pagination = document.querySelector('.pagination');
        const links = pagination?.querySelectorAll('a') || [];
        const pageNumbers = [];
        links.forEach(a => {
          const num = parseInt(a.textContent);
          if (!isNaN(num)) pageNumbers.push(num);
        });
        
        return {
          cardsOnPage: cards.length,
          visiblePages: [...new Set(pageNumbers)].sort((a,b) => a-b),
          currentUrl: window.location.href
        };
      });
      console.log('Page 20 info:', page20Info);
      
      // If there are more pages visible now, keep going
      if (page20Info.visiblePages.includes(21)) {
        console.log('More pages exist beyond 20!');
      }
    }

  } finally {
    await browser.close();
  }
}

investigate().catch(console.error);
