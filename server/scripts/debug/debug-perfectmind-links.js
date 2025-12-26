#!/usr/bin/env node
/**
 * Debug PerfectMind link discovery to understand the page structure
 */

const puppeteer = require('puppeteer');

const url = 'https://cityofportmoody.perfectmind.com/Contacts/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406';

// Activity type patterns from PerfectMindScraper
const activityPatterns = [
  /aquatic/i, /arts/i, /dance/i, /music/i, /fitness/i, /martial/i,
  /racquet/i, /sports/i, /skating/i, /gymnastics/i, /cooking/i,
  /science/i, /nature/i, /computer/i, /language/i, /swimming/i,
  /arena/i, /birthday/i, /general interest/i, /heritage/i,
  /health/i, /wellness/i, /first aid/i, /events/i, /digital/i,
  /learn\s*&?\s*discover/i, /after\s*school/i, /active\s*play/i,
  /outdoor/i, /crafts/i, /lifeguard/i, /skill\s*development/i,
  // Additional patterns
  /program/i, /class/i, /lesson/i, /club/i, /camp/i,
  /playschool/i, /childminding/i, /drop-in/i, /fencing/i,
  /ice\s*sport/i, /specialized/i, /private/i, /weight\s*room/i,
  /try\s*it/i, /volunteer/i, /educational/i, /cultural/i
];

const kidsSectionPatterns = [
  /preschool/i, /children/i, /^child$/i, /\bchild\b/i, /youth/i, /teen/i,
  /family/i, /camps?/i, /early\s*years/i, /early\s*learners/i,
  /school\s*age/i, /pro[\s-]*d[\s-]*day/i, /spring\s*break/i,
  /summer/i, /winter\s*break/i, /afterschool|after\s*school/i,
  /childminding/i, /just\s*for\s*kids/i, /grown-?up/i,
  /specialized\s*programs/i, /ice\s*sports?/i, /fencing/i,
  /try\s*it/i, /playschool/i
];

async function debugLinks() {
  console.log(`\n=== Debugging PerfectMind Link Discovery ===`);
  console.log(`URL: ${url}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get all links with positions
    const linksData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const results = [];

      links.forEach((link, index) => {
        const text = link.textContent?.trim() || '';
        if (!text || text.length < 3 || text.length > 100) return;

        const rect = link.getBoundingClientRect();
        results.push({
          index,
          text,
          y: Math.round(rect.y),
          x: Math.round(rect.x),
          href: link.href
        });
      });

      return results;
    });

    console.log(`Found ${linksData.length} total links\n`);

    // Identify section headers
    const sectionHeaders = linksData.filter(l => {
      const text = l.text.trim();
      return /^(preschool|child|children|youth|teen|family|camps?|early\s*years|school\s*age)$/i.test(text) ||
        /preschool|children|youth|camps$/i.test(text) ||
        /early\s*years/i.test(text) ||
        /^early\s*learners/i.test(text) ||
        /^ice\s*sports?$/i.test(text) ||
        /^fencing$/i.test(text) ||
        /^fitness$/i.test(text);
    }).sort((a, b) => a.y - b.y);

    console.log('=== SECTION HEADERS DETECTED ===');
    sectionHeaders.forEach(h => {
      console.log(`  Y=${h.y}: "${h.text}"`);
    });

    // Assign sections to all links
    const linksWithSections = linksData.map(link => {
      let section = '';
      for (let i = sectionHeaders.length - 1; i >= 0; i--) {
        if (sectionHeaders[i].y < link.y) {
          section = sectionHeaders[i].text;
          break;
        }
      }
      return { ...link, section };
    });

    // Show all links that would be processed
    // Using new logic: link text OR section must be kids-related
    console.log('\n=== LINKS UNDER KIDS SECTIONS ===');
    const kidsLinks = linksWithSections.filter(l => {
      const text = l.text.toLowerCase();
      const section = (l.section || '').toLowerCase();
      const textIsKids = kidsSectionPatterns.some(p => p.test(text));
      const sectionIsKids = section && kidsSectionPatterns.some(p => p.test(section));
      return textIsKids || sectionIsKids;
    });

    kidsLinks.forEach(l => {
      const matchesActivity = activityPatterns.some(p => p.test(l.text));
      const marker = matchesActivity ? '✓' : '✗';
      console.log(`  ${marker} [${l.section}] "${l.text}" (Y=${l.y})`);
    });

    // Show which activity links would be processed (text must match both kids AND activity patterns)
    console.log('\n=== ACTIVITY LINKS THAT WOULD BE PROCESSED ===');
    const activityLinks = kidsLinks.filter(l => {
      const text = l.text.toLowerCase();
      return activityPatterns.some(p => p.test(text)) &&
             kidsSectionPatterns.some(p => p.test(text));
    });
    activityLinks.forEach(l => {
      console.log(`  [${l.section || 'no section'}] "${l.text}"`);
    });

    console.log(`\nTotal activity links to process: ${activityLinks.length}`);

    // Show links that are being missed
    console.log('\n=== LINKS BEING MISSED (kids-related but no activity pattern match) ===');
    const missedLinks = kidsLinks.filter(l => {
      const text = l.text.toLowerCase();
      return !activityPatterns.some(p => p.test(text));
    });
    missedLinks.forEach(l => {
      console.log(`  [${l.section || 'no section'}] "${l.text}"`);
    });

  } finally {
    await browser.close();
  }
}

debugLinks().catch(console.error);
