#!/usr/bin/env node

/**
 * Debug script to investigate new platform sites
 * Captures network requests, API responses, and DOM structure
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const SITES = {
  calgary: {
    url: 'https://liveandplay.calgary.ca/REGPROG/public/category/browse/RegisteredPrograms',
    name: 'Calgary REGPROG'
  },
  saskatoon: {
    url: 'https://leisure.saskatoon.ca/wbwsc/webtracrec.wsc/search.html',
    splashUrl: 'https://leisure.saskatoon.ca/wbwsc/webtracrec.wsc/splash.html',
    name: 'Saskatoon WebTrac'
  },
  montreal: {
    url: 'https://loisirs.montreal.ca/IC3/',
    name: 'Montreal IC3'
  }
};

async function debugSite(siteName) {
  const site = SITES[siteName];
  if (!site) {
    console.error(`Unknown site: ${siteName}`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Debugging: ${site.name}`);
  console.log(`URL: ${site.url}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture network requests
  const apiResponses = [];
  const xhrRequests = [];

  await page.setRequestInterception(true);

  page.on('request', request => {
    const url = request.url();
    const resourceType = request.resourceType();

    if (resourceType === 'xhr' || resourceType === 'fetch') {
      xhrRequests.push({
        url,
        method: request.method(),
        postData: request.postData()
      });
      console.log(`[XHR] ${request.method()} ${url.substring(0, 100)}`);
    }
    request.continue();
  });

  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('application/json')) {
      try {
        const json = await response.json();
        apiResponses.push({ url, data: json });
        console.log(`[JSON Response] ${url.substring(0, 80)}...`);

        // Check if this looks like activity data
        if (Array.isArray(json) && json.length > 0) {
          console.log(`  -> Array with ${json.length} items`);
          if (json[0]) {
            console.log(`  -> Sample keys: ${Object.keys(json[0]).slice(0, 10).join(', ')}`);
          }
        } else if (json.data || json.results || json.activities || json.courses) {
          const items = json.data || json.results || json.activities || json.courses;
          if (Array.isArray(items)) {
            console.log(`  -> Wrapped array with ${items.length} items`);
            if (items[0]) {
              console.log(`  -> Sample keys: ${Object.keys(items[0]).slice(0, 10).join(', ')}`);
            }
          }
        }
      } catch (e) {
        // Not valid JSON
      }
    }
  });

  try {
    // Navigate to splash page first if needed (Saskatoon)
    if (site.splashUrl) {
      console.log(`\nNavigating to splash: ${site.splashUrl}`);
      await page.goto(site.splashUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
    }

    // Navigate to main URL
    console.log(`\nNavigating to: ${site.url}`);
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for SPA to load
    console.log('\nWaiting for page to fully load...');
    await new Promise(r => setTimeout(r, 8000));

    // Get page structure
    console.log('\n--- PAGE STRUCTURE ---');
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        forms: [],
        selects: [],
        buttons: [],
        tables: [],
        cards: [],
        angularApp: !!document.querySelector('[ng-app], [data-ng-app], [ng-controller]'),
        reactApp: !!document.querySelector('[data-reactroot], #root'),
        mainContent: null
      };

      // Get forms
      document.querySelectorAll('form').forEach(form => {
        info.forms.push({
          action: form.action,
          method: form.method,
          id: form.id,
          inputs: Array.from(form.querySelectorAll('input, select')).map(i => ({
            type: i.type || 'select',
            name: i.name,
            id: i.id
          }))
        });
      });

      // Get selects
      document.querySelectorAll('select').forEach(select => {
        const options = Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
        info.selects.push({
          name: select.name,
          id: select.id,
          optionCount: options.length,
          sampleOptions: options.slice(0, 5)
        });
      });

      // Get buttons
      document.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(btn => {
        info.buttons.push({
          type: btn.type,
          text: (btn.value || btn.textContent || '').trim().substring(0, 50),
          id: btn.id,
          class: btn.className.substring(0, 50)
        });
      });

      // Get tables
      document.querySelectorAll('table').forEach(table => {
        const rows = table.querySelectorAll('tr');
        info.tables.push({
          id: table.id,
          class: table.className.substring(0, 50),
          rowCount: rows.length,
          headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()).slice(0, 10)
        });
      });

      // Get card-like elements
      const cardSelectors = [
        '.card', '.activity', '.program', '.course', '.result-item',
        '[class*="card"]', '[class*="activity"]', '[class*="program"]',
        '[class*="result"]', '[class*="item"]'
      ];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0 && cards.length < 100) {
          info.cards.push({
            selector: sel,
            count: cards.length,
            sampleText: cards[0]?.textContent?.substring(0, 200)
          });
        }
      }

      // Get main content area
      const mainContent = document.querySelector('main, #main, .main-content, [role="main"]');
      if (mainContent) {
        info.mainContent = mainContent.textContent.substring(0, 500);
      }

      return info;
    });

    console.log(`Title: ${pageInfo.title}`);
    console.log(`Angular App: ${pageInfo.angularApp}`);
    console.log(`React App: ${pageInfo.reactApp}`);
    console.log(`Forms: ${pageInfo.forms.length}`);
    console.log(`Selects: ${pageInfo.selects.length}`);
    console.log(`Buttons: ${pageInfo.buttons.length}`);
    console.log(`Tables: ${pageInfo.tables.length}`);

    if (pageInfo.forms.length > 0) {
      console.log('\n--- FORMS ---');
      pageInfo.forms.forEach((form, i) => {
        console.log(`Form ${i + 1}: ${form.id || '(no id)'}`);
        console.log(`  Action: ${form.action}`);
        console.log(`  Inputs: ${form.inputs.map(i => `${i.name}(${i.type})`).join(', ')}`);
      });
    }

    if (pageInfo.selects.length > 0) {
      console.log('\n--- SELECT DROPDOWNS ---');
      pageInfo.selects.forEach(sel => {
        console.log(`${sel.name || sel.id}: ${sel.optionCount} options`);
        sel.sampleOptions.forEach(o => console.log(`  - ${o.text} (${o.value})`));
      });
    }

    if (pageInfo.buttons.length > 0) {
      console.log('\n--- BUTTONS ---');
      pageInfo.buttons.slice(0, 10).forEach(btn => {
        console.log(`  [${btn.type}] "${btn.text}" (${btn.id || btn.class})`);
      });
    }

    if (pageInfo.tables.length > 0) {
      console.log('\n--- TABLES ---');
      pageInfo.tables.forEach(table => {
        console.log(`  ${table.id || table.class}: ${table.rowCount} rows`);
        if (table.headers.length > 0) {
          console.log(`    Headers: ${table.headers.join(', ')}`);
        }
      });
    }

    if (pageInfo.cards.length > 0) {
      console.log('\n--- CARD-LIKE ELEMENTS ---');
      pageInfo.cards.forEach(card => {
        console.log(`  ${card.selector}: ${card.count} items`);
        console.log(`    Sample: ${card.sampleText?.substring(0, 100)}...`);
      });
    }

    // Try clicking search/submit buttons
    console.log('\n--- ATTEMPTING SEARCH ---');

    const searchResult = await page.evaluate(() => {
      // Find and click search button
      const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
      for (const btn of buttons) {
        const text = (btn.value || btn.textContent || '').toLowerCase();
        if (text.includes('search') || text.includes('rechercher') || text.includes('find')) {
          console.log(`Clicking: ${text}`);
          btn.click();
          return { clicked: true, text };
        }
      }
      return { clicked: false };
    });

    if (searchResult.clicked) {
      console.log(`Clicked search button: "${searchResult.text}"`);
      await new Promise(r => setTimeout(r, 5000));

      // Check for results
      const resultsInfo = await page.evaluate(() => {
        // Look for result containers
        const resultSelectors = [
          'table tbody tr',
          '.search-results', '.results',
          '[class*="result"]', '[class*="activity"]',
          '.list-item', '.program-item'
        ];

        for (const sel of resultSelectors) {
          const items = document.querySelectorAll(sel);
          if (items.length > 0) {
            return {
              selector: sel,
              count: items.length,
              samples: Array.from(items).slice(0, 3).map(item => ({
                text: item.textContent?.substring(0, 300),
                html: item.outerHTML?.substring(0, 500)
              }))
            };
          }
        }

        return { found: false, bodyText: document.body.innerText.substring(0, 2000) };
      });

      console.log('\n--- SEARCH RESULTS ---');
      if (resultsInfo.selector) {
        console.log(`Found ${resultsInfo.count} items with selector: ${resultsInfo.selector}`);
        resultsInfo.samples?.forEach((sample, i) => {
          console.log(`\nSample ${i + 1}:`);
          console.log(sample.text);
        });
      } else {
        console.log('No results found. Page content:');
        console.log(resultsInfo.bodyText);
      }
    }

    // Summary
    console.log('\n--- API RESPONSES CAPTURED ---');
    console.log(`Total: ${apiResponses.length}`);
    apiResponses.forEach((resp, i) => {
      console.log(`${i + 1}. ${resp.url.substring(0, 80)}`);
    });

    // Save results
    const outputPath = `/tmp/debug-${siteName}.json`;
    fs.writeFileSync(outputPath, JSON.stringify({
      pageInfo,
      apiResponses,
      xhrRequests
    }, null, 2));
    console.log(`\nFull data saved to: ${outputPath}`);

    // Brief pause before closing
    await new Promise(r => setTimeout(r, 2000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

const siteName = process.argv[2];
if (!siteName) {
  console.log('Usage: node debug-new-platforms.js <calgary|saskatoon|montreal>');
  process.exit(1);
}

debugSite(siteName);
