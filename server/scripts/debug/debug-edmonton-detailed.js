#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugEdmonton() {
  console.log('Debugging Edmonton Move Learn Play in detail...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(60000);

    // Navigate to courses page
    console.log('Loading Edmonton courses page...');
    await page.goto('https://movelearnplay.edmonton.ca/COE/public/category/courses', {
      waitUntil: 'networkidle2'
    });
    await new Promise(r => setTimeout(r, 5000));

    // Take screenshot
    await page.screenshot({ path: '/tmp/edmonton-initial.png', fullPage: true });
    console.log('Screenshot saved to /tmp/edmonton-initial.png');

    // Check page structure - is it similar to Calgary?
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        forms: [],
        cards: [],
        activityBlocks: []
      };

      // Check for forms like Calgary
      document.querySelectorAll('form').forEach(form => {
        info.forms.push({
          id: form.id,
          action: form.action,
          inputs: Array.from(form.querySelectorAll('input, select')).slice(0, 5).map(i => ({
            type: i.type || i.tagName,
            name: i.name,
            id: i.id
          }))
        });
      });

      // Check for card-based layout like Calgary
      document.querySelectorAll('.card, [class*="card"]').forEach((card, i) => {
        if (i < 5) {
          const title = card.querySelector('h4, h3, .card-title')?.textContent?.trim();
          const hasId = card.querySelector('.d-id, [class*="id"]');
          const hasPrice = card.querySelector('.d-price, [class*="price"]');
          info.cards.push({
            class: card.className?.substring(0, 100),
            title: title?.substring(0, 100),
            hasId: !!hasId,
            hasPrice: !!hasPrice,
            html: card.outerHTML?.substring(0, 500)
          });
        }
      });

      // Look for activity blocks with ID/Price pattern
      const bodyText = document.body.innerText;
      const idMatches = bodyText.match(/ID:\s*\d+/g) || [];
      info.idCount = idMatches.length;

      // Check for data attributes with age info
      const elementsWithData = document.querySelectorAll('[data-class-description], [data-description], [data-age]');
      info.elementsWithDataAttrs = elementsWithData.length;

      // Sample the first few activity blocks
      const h4s = document.querySelectorAll('h4');
      h4s.forEach((h4, i) => {
        if (i < 5) {
          const parent = h4.closest('.card, section, article, div');
          if (parent) {
            info.activityBlocks.push({
              heading: h4.textContent?.trim()?.substring(0, 100),
              parentClass: parent.className?.substring(0, 100),
              parentText: parent.innerText?.substring(0, 500)
            });
          }
        }
      });

      return info;
    });

    console.log('\n=== PAGE INFO ===');
    console.log('Title:', pageInfo.title);
    console.log('URL:', pageInfo.url);

    console.log('\n=== FORMS ===');
    pageInfo.forms.forEach(f => {
      console.log(`Form: id="${f.id}" action="${f.action}"`);
      f.inputs.forEach(i => console.log(`  - ${i.type}: name="${i.name}" id="${i.id}"`));
    });

    console.log('\n=== CARDS ===');
    console.log('Found', pageInfo.cards.length, 'cards');
    pageInfo.cards.forEach((c, i) => {
      console.log(`\nCard ${i + 1}:`);
      console.log('  Class:', c.class);
      console.log('  Title:', c.title);
      console.log('  Has ID element:', c.hasId);
      console.log('  Has Price element:', c.hasPrice);
      console.log('  HTML preview:', c.html?.substring(0, 300));
    });

    console.log('\n=== ACTIVITY BLOCKS ===');
    console.log('ID count:', pageInfo.idCount);
    console.log('Elements with data attrs:', pageInfo.elementsWithDataAttrs);
    pageInfo.activityBlocks.forEach((b, i) => {
      console.log(`\nBlock ${i + 1}:`);
      console.log('  Heading:', b.heading);
      console.log('  Parent class:', b.parentClass);
      console.log('  Text preview:', b.parentText?.substring(0, 400));
    });

    // Save HTML for analysis
    const html = await page.content();
    fs.writeFileSync('/tmp/edmonton-page.html', html);
    console.log('\n\nSaved HTML to /tmp/edmonton-page.html');

    // Check if Edmonton uses the same structure as Calgary
    console.log('\n=== CHECKING FOR CALGARY-STYLE STRUCTURE ===');
    const calgaryStyle = await page.evaluate(() => {
      return {
        hasSearchForm: !!document.getElementById('searchForm'),
        hasBadgeValues: document.querySelectorAll('.badge-value').length,
        hasCardMb4: document.querySelectorAll('.card.mb-4').length,
        hasDataDescription: document.querySelectorAll('[data-class-description]').length
      };
    });
    console.log('Search form:', calgaryStyle.hasSearchForm);
    console.log('Badge values:', calgaryStyle.hasBadgeValues);
    console.log('.card.mb-4 elements:', calgaryStyle.hasCardMb4);
    console.log('data-class-description elements:', calgaryStyle.hasDataDescription);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugEdmonton().catch(console.error);
