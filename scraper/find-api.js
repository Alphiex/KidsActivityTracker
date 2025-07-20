const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('nvrc-page.html', 'utf8');

// Look for JavaScript that loads programs
const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];

console.log('Searching for API endpoints and data loading scripts...\n');

scriptMatches.forEach((script, index) => {
  // Look for AJAX calls, fetch requests, or API endpoints
  const patterns = [
    /url:\s*["']([^"']+)["']/gi,
    /fetch\(["']([^"']+)["']/gi,
    /\.ajax\({[^}]*url:\s*["']([^"']+)["']/gi,
    /endpoint:\s*["']([^"']+)["']/gi,
    /api\/[^"'\s]*/gi,
    /\/perfectmind\/[^"'\s]*/gi,
    /ajaxurl.*?["']([^"']+)["']/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = script.match(pattern);
    if (matches) {
      console.log(`Script ${index} contains potential endpoints:`);
      matches.forEach(match => console.log('  -', match));
    }
  });
  
  // Look for data being embedded directly
  if (script.includes('programs:') || script.includes('courses:') || script.includes('activities:')) {
    console.log(`\nScript ${index} may contain embedded program data`);
    
    // Save this script for closer inspection
    fs.writeFileSync(`script-${index}.js`, script);
    console.log(`  Saved to script-${index}.js for analysis`);
  }
});

// Check for data attributes that might trigger lazy loading
const $ = cheerio.load(html);
const lazyElements = $('[data-lazy], [data-src], [data-load], [data-ajax]');
console.log('\n\nElements with lazy loading attributes:', lazyElements.length);
lazyElements.each((i, el) => {
  const $el = $(el);
  const attrs = el.attribs;
  console.log(`  ${$el.prop('tagName')}:`, attrs);
});

// Look for PerfectMind specific containers
const pmContainers = $('.perfectmind-results, #perfectmind-results-block, [class*="perfectmind"]');
console.log('\n\nPerfectMind containers found:', pmContainers.length);
pmContainers.each((i, el) => {
  const $el = $(el);
  console.log(`  ${$el.prop('tagName')}.${$el.attr('class')} - ID: ${$el.attr('id')}`);
  
  // Check if it has content
  const text = $el.text().trim();
  if (text.length > 0) {
    console.log(`    Contains text: ${text.substring(0, 100)}...`);
  }
});