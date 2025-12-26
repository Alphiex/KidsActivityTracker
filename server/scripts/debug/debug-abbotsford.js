#!/usr/bin/env node
/**
 * Debug Abbotsford PerfectMind page to understand accordion structure
 */

const puppeteer = require('puppeteer');

const ABBOTSFORD_URL = 'https://abbotsford.perfectmind.com/23852/Clients/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406';

async function debug() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Loading Abbotsford page...');
    await page.goto(ABBOTSFORD_URL, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take initial screenshot
    await page.screenshot({ path: '/tmp/abbotsford-initial.png', fullPage: true });
    console.log('Screenshot saved: /tmp/abbotsford-initial.png');

    // Analyze page structure
    const analysis = await page.evaluate(() => {
      const result = {
        url: window.location.href,
        title: document.title,
        accordions: [],
        expandButtons: [],
        categoryLinks: [],
        groupItems: document.querySelectorAll('.bm-group-item-row').length,
        groupTitles: document.querySelectorAll('.bm-group-title-row').length
      };

      // Find accordion/expandable elements
      const accordionSelectors = [
        '.accordion',
        '[class*="accordion"]',
        '[class*="collapse"]',
        '[class*="expand"]',
        '.panel-group',
        '.bm-group-title-row'
      ];

      for (const selector of accordionSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          result.accordions.push({
            selector,
            count: elements.length,
            samples: Array.from(elements).slice(0, 5).map(el => ({
              text: el.textContent?.trim().substring(0, 100),
              className: el.className
            }))
          });
        }
      }

      // Find expand/plus buttons
      const allElements = document.querySelectorAll('a, button, span, i, div');
      allElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        const className = el.className || '';

        // Look for + buttons or expand indicators
        if (text === '+' || text === '−' || text === '-' ||
            className.includes('plus') || className.includes('expand') ||
            className.includes('collapse') || className.includes('toggle') ||
            className.includes('fa-plus') || className.includes('fa-minus')) {
          result.expandButtons.push({
            tag: el.tagName,
            text: text.substring(0, 20),
            className: className.substring(0, 100),
            visible: el.offsetParent !== null
          });
        }
      });

      // Find category links
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent?.trim() || '';
        if (text.length > 3 && text.length < 80 &&
            !text.toLowerCase().includes('login') &&
            !text.toLowerCase().includes('skip')) {
          result.categoryLinks.push({
            text,
            href: link.href?.substring(0, 100) || ''
          });
        }
      });

      // Get page body text preview
      result.bodyPreview = document.body.innerText.substring(0, 2000);

      return result;
    });

    console.log('\n=== PAGE ANALYSIS ===');
    console.log('URL:', analysis.url);
    console.log('Title:', analysis.title);
    console.log('Group items:', analysis.groupItems);
    console.log('Group titles:', analysis.groupTitles);

    console.log('\n=== ACCORDION ELEMENTS ===');
    analysis.accordions.forEach(a => {
      console.log(`\n${a.selector}: ${a.count} elements`);
      a.samples.forEach(s => console.log(`  - "${s.text}" (class: ${s.className})`));
    });

    console.log('\n=== EXPAND/PLUS BUTTONS ===');
    console.log(`Found ${analysis.expandButtons.length} expand buttons`);
    analysis.expandButtons.slice(0, 20).forEach(b => {
      console.log(`  <${b.tag}> "${b.text}" class="${b.className}" visible=${b.visible}`);
    });

    console.log('\n=== CATEGORY LINKS (first 30) ===');
    analysis.categoryLinks.slice(0, 30).forEach((link, i) => {
      console.log(`  ${i + 1}. "${link.text}"`);
    });

    console.log('\n=== PAGE CONTENT PREVIEW ===');
    console.log(analysis.bodyPreview.substring(0, 1000));

    // Try clicking accordion/expand buttons
    console.log('\n=== CLICKING EXPAND BUTTONS ===');

    // First, try clicking any + or expand elements
    const clickResults = await page.evaluate(() => {
      let clicked = 0;
      const clickTargets = [];

      // Look for clickable accordion headers or plus buttons
      const selectors = [
        '.bm-group-title-row',
        '[class*="accordion"]',
        '[class*="expand"]',
        '.panel-heading',
        '.panel-title a'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.offsetParent !== null) { // visible
            el.click();
            clicked++;
            clickTargets.push(el.textContent?.trim().substring(0, 50));
          }
        });
      }

      // Also look for + symbols in text
      const allElements = document.querySelectorAll('a, span, div, button');
      allElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text === '+' && el.offsetParent !== null) {
          el.click();
          clicked++;
          clickTargets.push('+ button');
        }
      });

      return { clicked, targets: clickTargets.slice(0, 10) };
    });

    console.log(`Clicked ${clickResults.clicked} elements:`, clickResults.targets);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot after clicking
    await page.screenshot({ path: '/tmp/abbotsford-after-expand.png', fullPage: true });
    console.log('Screenshot saved: /tmp/abbotsford-after-expand.png');

    // Count items after expansion
    const afterCount = await page.evaluate(() => {
      return {
        groupItems: document.querySelectorAll('.bm-group-item-row').length,
        groupTitles: document.querySelectorAll('.bm-group-title-row').length,
        allLinks: document.querySelectorAll('a').length
      };
    });
    console.log('\n=== AFTER EXPANSION ===');
    console.log('Group items:', afterCount.groupItems);
    console.log('Group titles:', afterCount.groupTitles);
    console.log('All links:', afterCount.allLinks);

  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
