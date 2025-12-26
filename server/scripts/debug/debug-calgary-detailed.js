#!/usr/bin/env node

/**
 * Detailed debug script for Calgary Live and Play
 * Captures page state before and after search to understand structure
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugCalgary() {
  console.log('Debugging Calgary Live and Play in detail...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);

    // Intercept network requests to see what APIs are called
    const apiCalls = [];
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      if (url.includes('api') || url.includes('search') || url.includes('course') || url.includes('program')) {
        apiCalls.push({ type: 'request', method: request.method(), url });
      }
      request.continue();
    });

    page.on('response', async response => {
      const url = response.url();
      if ((url.includes('api') || url.includes('GetPrograms') || url.includes('Course')) &&
          response.headers()['content-type']?.includes('json')) {
        try {
          const text = await response.text();
          apiCalls.push({
            type: 'response',
            url,
            status: response.status(),
            preview: text.substring(0, 500)
          });
        } catch (e) {
          // ignore
        }
      }
    });

    // Navigate to courses page
    console.log('Loading Calgary courses page...');
    await page.goto('https://liveandplay.calgary.ca/REGPROG/public/category/courses', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(r => setTimeout(r, 5000));

    // Take initial screenshot
    await page.screenshot({ path: '/tmp/calgary-initial.png', fullPage: true });
    console.log('Saved initial screenshot to /tmp/calgary-initial.png');

    // Get page structure
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,

        // Forms
        forms: [],

        // Buttons
        buttons: [],

        // Links
        categoryLinks: [],

        // Any tables
        tables: [],

        // Any lists that might contain courses
        lists: [],

        // Text content areas
        contentAreas: []
      };

      // Find forms
      document.querySelectorAll('form').forEach(form => {
        info.forms.push({
          id: form.id,
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input, select')).map(i => ({
            type: i.type || i.tagName,
            name: i.name,
            id: i.id,
            value: i.value?.substring(0, 50)
          }))
        });
      });

      // Find buttons
      document.querySelectorAll('button, input[type="submit"], a.btn, .btn').forEach(btn => {
        info.buttons.push({
          tag: btn.tagName,
          id: btn.id,
          class: btn.className?.substring(0, 100),
          text: (btn.textContent || btn.value || '').trim().substring(0, 50),
          onclick: btn.onclick?.toString().substring(0, 100)
        });
      });

      // Find category links (these might be the way to browse)
      document.querySelectorAll('a[href*="category"], a[href*="Category"], a[href*="program"], a[href*="Program"]').forEach(link => {
        info.categoryLinks.push({
          text: link.textContent?.trim().substring(0, 100),
          href: link.href
        });
      });

      // Find tables
      document.querySelectorAll('table').forEach(table => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
        const rowCount = table.querySelectorAll('tbody tr').length;
        info.tables.push({ headers, rowCount, id: table.id, class: table.className });
      });

      // Find list items that might be courses
      document.querySelectorAll('.list-group-item, .card, [class*="course"], [class*="program"], [class*="activity"]').forEach(item => {
        const text = item.textContent?.trim().substring(0, 200);
        if (text && text.length > 20) {
          info.lists.push({
            class: item.className?.substring(0, 100),
            text
          });
        }
      });

      // Main content area
      const main = document.querySelector('main, #content, .content, [role="main"]');
      if (main) {
        info.contentAreas.push({
          selector: main.tagName + (main.id ? '#' + main.id : ''),
          text: main.textContent?.trim().substring(0, 1000)
        });
      }

      return info;
    });

    console.log('\n=== PAGE INFO ===');
    console.log('Title:', pageInfo.title);
    console.log('URL:', pageInfo.url);

    console.log('\n=== FORMS ===');
    pageInfo.forms.forEach(f => {
      console.log(`Form: id="${f.id}" action="${f.action}" method="${f.method}"`);
      f.inputs.forEach(i => console.log(`  - ${i.type}: name="${i.name}" id="${i.id}"`));
    });

    console.log('\n=== BUTTONS ===');
    pageInfo.buttons.slice(0, 20).forEach(b => {
      console.log(`${b.tag}: id="${b.id}" text="${b.text}" class="${b.class?.substring(0, 50)}"`);
    });

    console.log('\n=== CATEGORY LINKS ===');
    pageInfo.categoryLinks.slice(0, 20).forEach(l => {
      console.log(`"${l.text}" -> ${l.href}`);
    });

    console.log('\n=== TABLES ===');
    pageInfo.tables.forEach(t => {
      console.log(`Table: ${t.headers?.join(', ')} (${t.rowCount} rows)`);
    });

    console.log('\n=== LIST ITEMS (potential courses) ===');
    pageInfo.lists.slice(0, 10).forEach(l => {
      console.log(`Class: ${l.class}`);
      console.log(`Text: ${l.text.substring(0, 150)}...`);
      console.log('---');
    });

    // Now try to find and click a category that might have kids activities
    console.log('\n\n=== TRYING TO BROWSE CATEGORIES ===');

    const kidsCategories = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a').forEach(link => {
        const text = link.textContent?.toLowerCase() || '';
        if (text.includes('child') || text.includes('youth') || text.includes('kids') ||
            text.includes('camp') || text.includes('preschool') || text.includes('swim') ||
            text.includes('sport') || text.includes('dance') || text.includes('art')) {
          links.push({ text: link.textContent?.trim(), href: link.href });
        }
      });
      return links;
    });

    console.log('Found potential kids category links:');
    kidsCategories.slice(0, 15).forEach(l => console.log(`  "${l.text}" -> ${l.href}`));

    // Try clicking on a category if found
    if (kidsCategories.length > 0) {
      const targetCategory = kidsCategories.find(c =>
        c.text?.toLowerCase().includes('child') ||
        c.text?.toLowerCase().includes('youth') ||
        c.text?.toLowerCase().includes('camp')
      ) || kidsCategories[0];

      console.log(`\nNavigating to: "${targetCategory.text}"`);
      await page.goto(targetCategory.href, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 5000));

      await page.screenshot({ path: '/tmp/calgary-category.png', fullPage: true });
      console.log('Saved category screenshot to /tmp/calgary-category.png');

      // Check what's on this page
      const categoryPage = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          // Look for course listings
          courseItems: Array.from(document.querySelectorAll('[class*="course"], [class*="program"], [class*="activity"], .list-group-item, .card, tr'))
            .slice(0, 20)
            .map(el => ({
              class: el.className?.substring(0, 100),
              text: el.textContent?.trim().substring(0, 300)
            })),
          // Check for search results table
          tables: Array.from(document.querySelectorAll('table')).map(t => ({
            id: t.id,
            class: t.className,
            headers: Array.from(t.querySelectorAll('th')).map(th => th.textContent?.trim()),
            rows: t.querySelectorAll('tbody tr').length
          })),
          // Page body excerpt
          bodyText: document.body.innerText.substring(0, 2000)
        };
      });

      console.log('\n=== CATEGORY PAGE ===');
      console.log('Title:', categoryPage.title);
      console.log('URL:', categoryPage.url);
      console.log('\nTables:', categoryPage.tables.length);
      categoryPage.tables.forEach(t => {
        console.log(`  ${t.headers?.join(', ')} (${t.rows} rows)`);
      });

      console.log('\nCourse items found:', categoryPage.courseItems.length);
      categoryPage.courseItems.slice(0, 5).forEach(c => {
        console.log(`\nClass: ${c.class}`);
        console.log(`Text: ${c.text.substring(0, 200)}...`);
      });

      console.log('\n\nBody text excerpt:');
      console.log(categoryPage.bodyText.substring(0, 1500));
    }

    // Check API calls
    console.log('\n\n=== API CALLS DETECTED ===');
    apiCalls.forEach(call => {
      console.log(`${call.type}: ${call.method || ''} ${call.url}`);
      if (call.preview) console.log(`  Preview: ${call.preview.substring(0, 200)}`);
    });

    // Save HTML for analysis
    const html = await page.content();
    fs.writeFileSync('/tmp/calgary-page.html', html);
    console.log('\nSaved HTML to /tmp/calgary-page.html');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugCalgary().catch(console.error);
