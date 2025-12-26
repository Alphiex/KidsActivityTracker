#!/usr/bin/env node
/**
 * Debug script to analyze Active Network page structure
 * Shows all elements, selectors, and how activities are structured
 */

const puppeteer = require('puppeteer');

const CITY_URLS = {
  westvan: 'https://anc.ca.apm.activecommunities.com/westvanrec/activity/search',
  vancouver: 'https://anc.ca.apm.activecommunities.com/vancouver/activity/search',
  burnaby: 'https://anc.ca.apm.activecommunities.com/burnaby/activity/search'
};

const city = process.argv[2] || 'westvan';
const url = CITY_URLS[city];

if (!url) {
  console.log('Available cities:', Object.keys(CITY_URLS).join(', '));
  process.exit(1);
}

async function analyzeActiveNetPage() {
  console.log(`\n=== Analyzing ${city.toUpperCase()} Active Network Page ===`);
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
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take screenshot for reference
    await page.screenshot({ path: '/tmp/activenet-debug.png', fullPage: true });
    console.log('Screenshot saved to /tmp/activenet-debug.png');

    // Analyze page structure
    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        title: document.title,
        url: window.location.href,
        mainContainers: [],
        activityElements: [],
        links: [],
        tables: [],
        classes: new Set(),
        potentialActivitySelectors: []
      };

      // Find main content containers
      const containers = document.querySelectorAll('main, #main, .main, #content, .content, [role="main"]');
      containers.forEach(c => {
        analysis.mainContainers.push({
          tag: c.tagName,
          id: c.id,
          className: c.className,
          childCount: c.children.length
        });
      });

      // Look for common activity listing patterns
      const potentialSelectors = [
        '.activity-item',
        '.activity-listing',
        '.program-item',
        '.search-result-item',
        '.activity-row',
        '.program-row',
        '[class*="activity"]',
        '[class*="program"]',
        '[class*="course"]',
        '[class*="class"]',
        '[class*="result"]',
        '[class*="listing"]',
        '[class*="card"]',
        'article',
        '.card',
        'li[class*="item"]',
        'tr[class*="row"]'
      ];

      potentialSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            analysis.potentialActivitySelectors.push({
              selector,
              count: elements.length,
              sampleText: elements[0].textContent?.substring(0, 200).trim()
            });
          }
        } catch (e) {}
      });

      // Find all tables
      const tables = document.querySelectorAll('table');
      tables.forEach((table, idx) => {
        const rows = table.querySelectorAll('tr');
        analysis.tables.push({
          index: idx,
          id: table.id,
          className: table.className,
          rowCount: rows.length,
          sampleRow: rows[1]?.textContent?.substring(0, 200).trim()
        });
      });

      // Find elements that look like they contain activity data
      const allElements = document.querySelectorAll('*');
      const activityKeywords = ['register', 'enroll', 'sign up', '$', 'age', 'location', 'schedule'];

      allElements.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        const hasKeywords = activityKeywords.filter(kw => text.includes(kw)).length >= 2;

        if (hasKeywords && el.children.length < 20 && text.length < 1000) {
          // Collect class names
          if (el.className) {
            el.className.split(' ').forEach(c => analysis.classes.add(c));
          }

          // Check if this might be an activity listing
          if (text.includes('$') && (text.includes('register') || text.includes('age'))) {
            analysis.activityElements.push({
              tag: el.tagName,
              id: el.id,
              className: el.className,
              textPreview: el.textContent?.substring(0, 300).trim()
            });
          }
        }
      });

      // Get visible links related to activities
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent?.trim() || '';
        const href = link.href || '';
        if (text && text.length > 3 && text.length < 100) {
          if (href.includes('activity') || href.includes('program') || href.includes('course') ||
              text.toLowerCase().includes('register') || text.toLowerCase().includes('view')) {
            analysis.links.push({
              text: text.substring(0, 100),
              href: href.substring(0, 200),
              className: link.className
            });
          }
        }
      });

      analysis.classes = Array.from(analysis.classes).slice(0, 50);
      analysis.activityElements = analysis.activityElements.slice(0, 10);
      analysis.links = analysis.links.slice(0, 20);

      return analysis;
    });

    console.log('\n=== PAGE ANALYSIS ===');
    console.log('Title:', pageAnalysis.title);
    console.log('URL:', pageAnalysis.url);

    console.log('\n=== MAIN CONTAINERS ===');
    pageAnalysis.mainContainers.forEach(c => {
      console.log(`  <${c.tag}> id="${c.id}" class="${c.className}" (${c.childCount} children)`);
    });

    console.log('\n=== POTENTIAL ACTIVITY SELECTORS ===');
    pageAnalysis.potentialActivitySelectors.forEach(s => {
      console.log(`  ${s.selector}: ${s.count} elements`);
      if (s.sampleText) {
        console.log(`    Sample: "${s.sampleText.substring(0, 100)}..."`);
      }
    });

    console.log('\n=== TABLES ===');
    pageAnalysis.tables.forEach(t => {
      console.log(`  Table #${t.index}: id="${t.id}" class="${t.className}" (${t.rowCount} rows)`);
      if (t.sampleRow) {
        console.log(`    Sample row: "${t.sampleRow.substring(0, 100)}..."`);
      }
    });

    console.log('\n=== ACTIVITY-LIKE ELEMENTS ===');
    pageAnalysis.activityElements.forEach((e, i) => {
      console.log(`  ${i + 1}. <${e.tag}> class="${e.className}"`);
      console.log(`     Text: "${e.textPreview?.substring(0, 150)}..."`);
    });

    console.log('\n=== RELEVANT LINKS ===');
    pageAnalysis.links.forEach((l, i) => {
      console.log(`  ${i + 1}. "${l.text}" -> ${l.href}`);
    });

    console.log('\n=== INTERESTING CLASSES ===');
    console.log('  ', pageAnalysis.classes.join(', '));

    // Now let's get the raw HTML structure around activity listings
    console.log('\n=== RAW HTML STRUCTURE ===');
    const htmlStructure = await page.evaluate(() => {
      // Try to find the main activity listing container
      const mainContent = document.querySelector('main') || document.querySelector('#content') || document.body;

      // Get all divs with substantial content
      const divs = mainContent.querySelectorAll('div');
      const contentDivs = Array.from(divs)
        .filter(d => {
          const text = d.textContent || '';
          return text.includes('$') && text.length > 100 && text.length < 5000 && d.children.length > 2;
        })
        .slice(0, 5);

      return contentDivs.map(d => ({
        className: d.className,
        id: d.id,
        outerHTML: d.outerHTML.substring(0, 1000)
      }));
    });

    htmlStructure.forEach((h, i) => {
      console.log(`\n--- Container ${i + 1} ---`);
      console.log(`Class: ${h.className}`);
      console.log(`ID: ${h.id}`);
      console.log(`HTML preview:\n${h.outerHTML.substring(0, 500)}...`);
    });

    // Check for pagination elements
    console.log('\n=== PAGINATION ELEMENTS ===');
    const paginationInfo = await page.evaluate(() => {
      const paginationSelectors = [
        '.pagination',
        '.pager',
        '[class*="pagination"]',
        '[class*="pager"]',
        'button[class*="next"]',
        'button[class*="more"]',
        'a[class*="next"]',
        '[class*="load-more"]',
        '[class*="show-more"]',
        '[class*="infinite"]',
        '[class*="virtual"]'
      ];

      const results = [];
      paginationSelectors.forEach(selector => {
        try {
          const els = document.querySelectorAll(selector);
          if (els.length > 0) {
            results.push({
              selector,
              count: els.length,
              html: Array.from(els).slice(0, 2).map(e => e.outerHTML.substring(0, 300))
            });
          }
        } catch (e) {}
      });

      // Also check for scroll-based loading indicators
      const scrollContainers = document.querySelectorAll('[class*="scroll"], [class*="list"], [class*="container"]');
      const hasInfiniteScroll = Array.from(scrollContainers).some(c => {
        const style = window.getComputedStyle(c);
        return style.overflow === 'auto' || style.overflowY === 'auto' || style.overflowY === 'scroll';
      });

      return { pagination: results, hasInfiniteScroll };
    });

    console.log('Pagination elements found:', paginationInfo.pagination.length);
    paginationInfo.pagination.forEach(p => {
      console.log(`  ${p.selector}: ${p.count} elements`);
      p.html.forEach(h => console.log(`    ${h.substring(0, 200)}`));
    });
    console.log('Has infinite scroll containers:', paginationInfo.hasInfiniteScroll);

    // Count activity cards
    const cardCount = await page.evaluate(() => {
      return document.querySelectorAll('.card.activity-card').length;
    });
    console.log(`\n=== ACTIVITY CARDS ON PAGE: ${cardCount} ===`);

  } finally {
    await browser.close();
  }
}

analyzeActiveNetPage().catch(console.error);
