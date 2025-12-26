#!/usr/bin/env node
/**
 * Check actual activity counts on ActiveNet pages
 */

const puppeteer = require('puppeteer');

const SITES = {
  vancouver: 'https://anc.ca.apm.activecommunities.com/vancouver/activity/search?onlineSiteId=0&activity_select_param=2&viewMode=list&max_age=18',
  burnaby: 'https://anc.ca.apm.activecommunities.com/burnaby/activity/search?onlineSiteId=0&activity_select_param=2&viewMode=list&max_age=18',
  westvan: 'https://anc.ca.apm.activecommunities.com/westvanrec/activity/search?onlineSiteId=0&activity_select_param=2&viewMode=list&max_age=18'
};

async function checkCounts() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const [city, url] of Object.entries(SITES)) {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      console.log(`\nChecking ${city.toUpperCase()}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Look for results count - ActiveNet shows "Found X matching result(s)"
      const count = await page.evaluate(() => {
        // Look for "Found X matching result(s)" text
        const allText = document.body.innerText;
        const foundMatch = allText.match(/Found\s+(\d+)\s+matching/i);
        if (foundMatch) return foundMatch[1];

        // Alternative patterns
        const altMatch = allText.match(/(\d{1,5})\s*(?:matching\s*)?results?/i);
        if (altMatch) return altMatch[1];

        return 'Not found';
      });

      console.log(`${city}: ${count} results`);

      // Also count how many activity cards are visible initially
      const cardCount = await page.evaluate(() => {
        return document.querySelectorAll('.card.activity-card').length;
      });
      console.log(`${city}: ${cardCount} cards visible initially`);

      await page.close();
    }
  } finally {
    await browser.close();
  }
}

checkCounts().catch(console.error);
