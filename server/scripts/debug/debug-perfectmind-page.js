#!/usr/bin/env node
/**
 * Debug script to analyze PerfectMind page structure
 * Shows all links, sections, and how they're being detected
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Load provider configs dynamically
const configDir = path.join(__dirname, '../scrapers/configs/providers');
const CITY_URLS = {};

fs.readdirSync(configDir).forEach(file => {
  if (file.endsWith('.json')) {
    const config = JSON.parse(fs.readFileSync(path.join(configDir, file)));
    if (config.platform === 'perfectmind' && config.scraperConfig?.entryPoints?.[0]) {
      const entryPoint = config.scraperConfig.entryPoints[0];
      const url = entryPoint.startsWith('http') ? entryPoint : `${config.baseUrl}${entryPoint}`;
      CITY_URLS[config.code] = url;
    }
  }
});

const city = process.argv[2];
const url = CITY_URLS[city];

if (!url) {
  console.log('Available cities:', Object.keys(CITY_URLS).join(', '));
  process.exit(1);
}

// Activity patterns from the scraper
const activityPatterns = [
  /aquatic/i, /arts/i, /dance/i, /music/i, /fitness/i, /martial/i,
  /racquet/i, /sports/i, /skating/i, /gymnastics/i, /cooking/i,
  /science/i, /nature/i, /computer/i, /language/i, /swimming/i,
  /arena/i, /birthday/i, /general interest/i, /heritage/i,
  /health/i, /wellness/i, /first aid/i, /events/i, /digital/i,
  /learn\s*&?\s*discover/i, /after\s*school/i, /active\s*play/i,
  /outdoor/i, /crafts/i, /lifeguard/i, /skill\s*development/i
];

// Kids section patterns from the scraper
const kidsSectionPatterns = [
  /preschool/i, /children/i, /^child$/i, /\bchild\b/i, /youth/i, /teen/i,
  /family/i, /camps?/i, /early years/i, /0-5/i, /6-12/i, /13-18/i,
  /adult\s*&\s*child/i, /school\s*age/i, /pro\s*d\s*day/i, /spring\s*break/i,
  /summer/i, /winter\s*break/i, /after\s*school/i
];

async function analyzePageStructure() {
  console.log(`\n=== Analyzing ${city.toUpperCase()} ===`);
  console.log(`URL: ${url}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get ALL text elements with positions for analysis
    const pageData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const results = [];

      links.forEach((link, index) => {
        const text = link.textContent?.trim() || '';
        if (!text || text.length < 2 || text.length > 100) return;

        const rect = link.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return; // Hidden elements

        results.push({
          index,
          text,
          y: Math.round(rect.y),
          x: Math.round(rect.x),
          href: link.href || '',
          className: link.className || ''
        });
      });

      return results.sort((a, b) => a.y - b.y);
    });

    console.log(`\nFound ${pageData.length} visible links\n`);

    // Identify section headers (likely bold/large text with age patterns)
    const sectionHeaders = pageData.filter(l =>
      /preschool|children\s*\(|youth\s*\(|camps$|child|teen|family|early years/i.test(l.text) ||
      /\d+-\d+\s*yrs/i.test(l.text) ||
      /\d+-\d+\s*years/i.test(l.text) ||
      /pro\s*d\s*day|spring\s*break|summer|winter\s*break/i.test(l.text)
    );

    console.log('=== POTENTIAL SECTION HEADERS ===');
    sectionHeaders.forEach(h => {
      console.log(`  Y=${h.y}: "${h.text}"`);
    });

    // Identify activity links
    const activityLinks = pageData.filter(l => {
      const text = l.text.toLowerCase();
      return activityPatterns.some(p => p.test(text));
    });

    console.log(`\n=== ACTIVITY-LIKE LINKS (${activityLinks.length}) ===`);
    activityLinks.forEach(l => {
      console.log(`  Y=${l.y}: "${l.text}"`);
    });

    // Show all links grouped by Y position to understand page layout
    console.log('\n=== ALL LINKS BY Y POSITION ===');
    let lastY = -100;
    pageData.forEach(l => {
      if (l.y - lastY > 30) {
        console.log(''); // Add gap for visual separation
      }
      lastY = l.y;

      // Mark if it matches patterns
      const isSection = kidsSectionPatterns.some(p => p.test(l.text));
      const isActivity = activityPatterns.some(p => p.test(l.text));
      const marker = isSection ? '[SECTION]' : (isActivity ? '[ACTIVITY]' : '');

      console.log(`  Y=${l.y.toString().padStart(4)}: ${marker.padEnd(12)} "${l.text}"`);
    });

    // Simulate the scraper's filtering logic
    console.log('\n=== SCRAPER SIMULATION ===');

    // Find section headers - updated to match PerfectMindScraper.js
    const sections = pageData.filter(l => {
      const text = l.text.trim();
      return /^(preschool|child|children|youth|teen|family|camps?|early\s*years|school\s*age)$/i.test(text) ||
        /preschool|children\s*\(|youth\s*\(|camps$/i.test(text) ||
        /\d+-\d+\s*(yrs|years)/i.test(text) ||
        /adult\s*&\s*child/i.test(text) ||
        /early\s*years\s*(adult\s*participation)?/i.test(text) ||
        /^(pro\s*d\s*day|spring\s*break|summer|winter\s*break|after\s*school)$/i.test(text);
    }).sort((a, b) => a.y - b.y);

    console.log(`Found ${sections.length} section headers:`);
    sections.forEach(s => console.log(`  - "${s.text}" at Y=${s.y}`));

    // Assign sections to links
    const linksWithSections = pageData.map(link => {
      let section = '';
      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].y < link.y) {
          section = sections[i].text;
          break;
        }
      }
      return { ...link, section };
    });

    // Apply scraper's filter logic
    const excludePatterns = [
      /adult/i, /19\+/i, /55\+/i, /senior/i, /plant/i,
      /drop-in/i, /login/i, /skip/i, /show more/i, /advanced search/i
    ];

    const filtered = linksWithSections.filter(link => {
      const text = link.text.toLowerCase();
      const section = link.section.toLowerCase();

      if (excludePatterns.some(p => p.test(text))) return false;
      const isActivity = activityPatterns.some(p => p.test(text));
      if (!isActivity) return false;
      const isKidsSection = kidsSectionPatterns.some(p => p.test(section));
      return isKidsSection;
    });

    console.log(`\n=== LINKS THAT WOULD BE SCRAPED (${filtered.length}) ===`);
    filtered.forEach(l => {
      console.log(`  "${l.text}" in section "${l.section}"`);
    });

    if (filtered.length === 0) {
      console.log('\n*** WARNING: No links matched! ***');
      console.log('This could mean:');
      console.log('1. Activity patterns don\'t match the link text');
      console.log('2. Section patterns don\'t match the section headers');
      console.log('3. Section headers aren\'t being detected');
    }

  } finally {
    await browser.close();
  }
}

analyzePageStructure().catch(console.error);
