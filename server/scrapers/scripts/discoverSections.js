#!/usr/bin/env node

/**
 * Discover available sections on a PerfectMind site
 * Usage: node discoverSections.js <url>
 */

const puppeteer = require('puppeteer');

async function discoverSections(url) {
  console.log(`Discovering sections on: ${url}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/perfectmind-page.png', fullPage: true });
    console.log('Screenshot saved to /tmp/perfectmind-page.png\n');

    // Look for various section patterns
    const sections = await page.evaluate(() => {
      const results = {
        headers: [],
        links: [],
        categories: [],
        allText: []
      };

      // Find all potential section headers
      const headerSelectors = [
        '.bm-category-header',
        '.category-header',
        '.section-header',
        'h2', 'h3', 'h4',
        '.bm-group-title',
        '[class*="category"]',
        '[class*="section"]'
      ];

      headerSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 2 && text.length < 100) {
            results.headers.push({
              selector,
              text,
              className: el.className
            });
          }
        });
      });

      // Find all links that might be activity categories
      document.querySelectorAll('a').forEach(link => {
        const text = link.textContent?.trim();
        const href = link.href;
        if (text && text.length > 3 && text.length < 80) {
          // Look for age indicators or category keywords
          if (text.includes('yrs') || text.includes('Years') ||
              text.includes('Age') || text.includes('School') ||
              text.includes('Youth') || text.includes('Early') ||
              text.includes('Adult') || text.includes('Family') ||
              text.includes('Aquatic') || text.includes('Swim') ||
              text.includes('Arts') || text.includes('Sport') ||
              text.includes('Camp') || text.includes('Fitness')) {
            results.links.push({ text, href: href?.substring(0, 100) });
          }
        }
      });

      // Look for category dropdowns or filters
      document.querySelectorAll('select option, .filter-option, .category-item').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 2) {
          results.categories.push(text);
        }
      });

      // Get unique visible text blocks that might be section names
      const seen = new Set();
      document.querySelectorAll('span, div, p').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 5 && text.length < 50 && !seen.has(text)) {
          if (text.match(/^[A-Z]/) && !text.includes('\n')) {
            const keywords = ['Year', 'Age', 'School', 'Youth', 'Adult', 'Family', 'Child', 'Teen', 'Senior'];
            if (keywords.some(kw => text.includes(kw))) {
              results.allText.push(text);
              seen.add(text);
            }
          }
        }
      });

      return results;
    });

    console.log('=== HEADERS FOUND ===');
    const uniqueHeaders = [...new Set(sections.headers.map(h => h.text))];
    uniqueHeaders.slice(0, 20).forEach(h => console.log(`  - ${h}`));

    console.log('\n=== ACTIVITY LINKS FOUND ===');
    const uniqueLinks = [...new Set(sections.links.map(l => l.text))];
    uniqueLinks.slice(0, 30).forEach(l => console.log(`  - ${l}`));

    console.log('\n=== POTENTIAL SECTIONS ===');
    const uniqueText = [...new Set(sections.allText)];
    uniqueText.slice(0, 20).forEach(t => console.log(`  - ${t}`));

    // Get page HTML for analysis
    const pageContent = await page.content();

    // Look for specific PerfectMind patterns
    const bmCategories = pageContent.match(/bm-category[^"']*/g) || [];
    if (bmCategories.length > 0) {
      console.log('\n=== BM CATEGORY CLASSES ===');
      [...new Set(bmCategories)].forEach(c => console.log(`  - ${c}`));
    }

    return {
      headers: uniqueHeaders,
      links: uniqueLinks,
      potentialSections: uniqueText
    };

  } catch (error) {
    console.error('Error:', error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    // Test all PerfectMind sites
    const sites = [
      { name: 'Richmond', url: 'https://richmondcity.perfectmind.com/23650/Clients/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406' },
      { name: 'Coquitlam', url: 'https://cityofcoquitlam.perfectmind.com/23902/Clients/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406' },
      { name: 'Port Moody', url: 'https://cityofportmoody.perfectmind.com/Contacts/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406' },
      { name: 'Maple Ridge', url: 'https://cityofmapleridge.perfectmind.com/23724/Reports/BookMe4?widgetId=47fd20cf-24b1-4cbe-89a0-d25473cacb49' },
      { name: 'New Westminster', url: 'https://cityofnewwestminster.perfectmind.com/23693/Clients/BookMe4?widgetId=50a33660-b4f7-44d9-9256-e10effec8641' },
    ];

    for (const site of sites) {
      console.log('\n' + '='.repeat(60));
      console.log(`ANALYZING: ${site.name}`);
      console.log('='.repeat(60));
      await discoverSections(site.url);
    }
  } else {
    await discoverSections(url);
  }
}

main();
