#!/usr/bin/env node
const puppeteer = require('puppeteer');

async function main() {
  const url = process.argv[2] || 'https://ca.apm.activecommunities.com/vancouver/Activity_Search/swimming---preschool-1---octopus/596222?locale=en-US';

  console.log('Fetching:', url);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000)); // Wait for React

  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  console.log('\n=== PAGE LINES (first 80) ===');
  lines.slice(0, 80).forEach((line, i) => console.log(`${i}: ${line}`));

  // Look for date-like patterns
  console.log('\n=== DATE-LIKE LINES ===');
  lines.forEach((line, i) => {
    if (/\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(line)) {
      console.log(`${i}: ${line}`);
    }
  });

  await browser.close();
}

main().catch(console.error);
