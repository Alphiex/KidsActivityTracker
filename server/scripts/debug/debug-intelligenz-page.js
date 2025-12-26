#!/usr/bin/env node
/**
 * Debug script to analyze Intelligenz Solutions page structure
 * Shows all form elements, selectors, and how activities are structured
 */

const puppeteer = require('puppeteer');

const url = 'https://www.pittfitandfun.ca/copm/public/category/browse/Search';

async function analyzeIntelligenzPage() {
  console.log(`\n=== Analyzing Intelligenz Page ===`);
  console.log(`URL: ${url}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    // Wait for JavaScript to render
    console.log('Waiting for JavaScript to render...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot for reference
    await page.screenshot({ path: '/tmp/intelligenz-debug.png', fullPage: true });
    console.log('Screenshot saved to /tmp/intelligenz-debug.png');

    // Analyze page structure
    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        title: document.title,
        url: window.location.href,
        forms: [],
        selects: [],
        inputs: [],
        buttons: [],
        links: [],
        tables: []
      };

      // Find all forms
      const forms = document.querySelectorAll('form');
      forms.forEach((form, idx) => {
        analysis.forms.push({
          index: idx,
          id: form.id,
          name: form.name,
          action: form.action,
          method: form.method,
          className: form.className
        });
      });

      // Find all select elements
      const selects = document.querySelectorAll('select');
      selects.forEach((select, idx) => {
        const options = Array.from(select.options).slice(0, 10).map(o => ({
          value: o.value,
          text: o.text.trim().substring(0, 50)
        }));
        analysis.selects.push({
          index: idx,
          id: select.id,
          name: select.name,
          className: select.className,
          optionCount: select.options.length,
          sampleOptions: options
        });
      });

      // Find all input elements
      const inputs = document.querySelectorAll('input');
      inputs.forEach((input, idx) => {
        analysis.inputs.push({
          index: idx,
          type: input.type,
          id: input.id,
          name: input.name,
          className: input.className,
          value: input.value?.substring(0, 50)
        });
      });

      // Find all buttons
      const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
      buttons.forEach((btn, idx) => {
        analysis.buttons.push({
          index: idx,
          tag: btn.tagName,
          type: btn.type,
          id: btn.id,
          className: btn.className,
          text: btn.textContent?.trim().substring(0, 50) || btn.value
        });
      });

      // Find category links in sidebar
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent?.trim() || '';
        const href = link.href || '';
        if (href.includes('category') || href.includes('program') || href.includes('browse') ||
            text.toLowerCase().includes('child') || text.toLowerCase().includes('youth') ||
            text.toLowerCase().includes('preschool') || text.toLowerCase().includes('parent')) {
          analysis.links.push({
            text: text.substring(0, 50),
            href: href,
            className: link.className
          });
        }
      });

      // Find tables
      const tables = document.querySelectorAll('table');
      tables.forEach((table, idx) => {
        const rows = table.querySelectorAll('tr');
        analysis.tables.push({
          index: idx,
          id: table.id,
          className: table.className,
          rowCount: rows.length,
          sampleRow: rows[0]?.textContent?.substring(0, 200).trim()
        });
      });

      return analysis;
    });

    console.log('\n=== PAGE ANALYSIS ===');
    console.log('Title:', pageAnalysis.title);
    console.log('URL:', pageAnalysis.url);

    console.log('\n=== FORMS ===');
    pageAnalysis.forms.forEach(f => {
      console.log(`  Form #${f.index}: id="${f.id}" name="${f.name}" action="${f.action}" method="${f.method}"`);
    });

    console.log('\n=== SELECT DROPDOWNS ===');
    pageAnalysis.selects.forEach(s => {
      console.log(`  Select #${s.index}: id="${s.id}" name="${s.name}" (${s.optionCount} options)`);
      console.log(`    Class: ${s.className}`);
      console.log(`    Sample options:`);
      s.sampleOptions.forEach(o => {
        console.log(`      - "${o.text}" (value: ${o.value})`);
      });
    });

    console.log('\n=== INPUTS ===');
    pageAnalysis.inputs.forEach(i => {
      console.log(`  Input #${i.index}: type="${i.type}" id="${i.id}" name="${i.name}"`);
    });

    console.log('\n=== BUTTONS ===');
    pageAnalysis.buttons.forEach(b => {
      console.log(`  Button #${b.index}: <${b.tag}> type="${b.type}" text="${b.text}" id="${b.id}"`);
    });

    console.log('\n=== CATEGORY LINKS ===');
    pageAnalysis.links.slice(0, 20).forEach((l, i) => {
      console.log(`  ${i + 1}. "${l.text}" -> ${l.href}`);
    });

    console.log('\n=== TABLES ===');
    pageAnalysis.tables.forEach(t => {
      console.log(`  Table #${t.index}: id="${t.id}" class="${t.className}" (${t.rowCount} rows)`);
      if (t.sampleRow) {
        console.log(`    Sample: "${t.sampleRow.substring(0, 100)}..."`);
      }
    });

    // Now try searching with empty criteria to see results page
    console.log('\n=== ATTEMPTING SEARCH ===');

    // Click the search button
    const searchClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('input[type="submit"], button'));
      const searchBtn = buttons.find(b => {
        const text = (b.value || b.textContent || '').toLowerCase();
        return text.includes('search');
      });
      if (searchBtn) {
        searchBtn.click();
        return true;
      }
      return false;
    });

    console.log('Search clicked:', searchClicked);

    if (searchClicked) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await page.screenshot({ path: '/tmp/intelligenz-results.png', fullPage: true });
      console.log('Results screenshot saved to /tmp/intelligenz-results.png');

      // Analyze results
      const resultsAnalysis = await page.evaluate(() => {
        const results = {
          url: window.location.href,
          tables: [],
          resultRows: [],
          resultContainers: []
        };

        // Find tables with results
        const tables = document.querySelectorAll('table');
        tables.forEach((table, idx) => {
          const rows = table.querySelectorAll('tr');
          if (rows.length > 1) {
            results.tables.push({
              index: idx,
              id: table.id,
              className: table.className,
              rowCount: rows.length,
              headerRow: rows[0]?.textContent?.trim().substring(0, 200),
              dataRows: Array.from(rows).slice(1, 5).map(r => r.textContent?.trim().substring(0, 200))
            });
          }
        });

        // Find result containers
        const containers = document.querySelectorAll('.course-row, .result-item, tr.course, .search-result');
        containers.forEach((c, idx) => {
          if (idx < 5) {
            results.resultContainers.push({
              tag: c.tagName,
              className: c.className,
              text: c.textContent?.trim().substring(0, 300)
            });
          }
        });

        return results;
      });

      console.log('\n=== SEARCH RESULTS ===');
      console.log('URL:', resultsAnalysis.url);

      console.log('\n=== RESULT TABLES ===');
      resultsAnalysis.tables.forEach(t => {
        console.log(`  Table #${t.index}: id="${t.id}" class="${t.className}" (${t.rowCount} rows)`);
        console.log(`    Header: ${t.headerRow}`);
        console.log(`    Data rows:`);
        t.dataRows.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r?.substring(0, 150)}...`);
        });
      });

      console.log('\n=== RESULT CONTAINERS ===');
      resultsAnalysis.resultContainers.forEach((c, i) => {
        console.log(`  ${i + 1}. <${c.tag}> class="${c.className}"`);
        console.log(`     Text: ${c.text?.substring(0, 150)}...`);
      });
    }

  } finally {
    await browser.close();
  }
}

analyzeIntelligenzPage().catch(console.error);
