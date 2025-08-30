const fs = require('fs');
const path = require('path');

/**
 * Quick script to fix regex syntax issues in WestVancouverScraper.js
 */
function fixRegexSyntax() {
  const filePath = path.join(__dirname, 'scrapers/providers/WestVancouverScraper.js');
  
  console.log('🔧 Fixing regex syntax issues in WestVancouverScraper.js...');
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix common regex escaping issues
  const fixes = [
    // Fix double-escaped backslashes in regex patterns
    [/\\\\s/g, '\\s'],
    [/\\\\d/g, '\\d'],
    [/\\\\w/g, '\\w'],
    [/\\\\n/g, '\\n'],
    [/\\\\\./g, '\\.'],
    [/\\\\\+/g, '\\+'],
    [/\\\\\*/g, '\\*'],
    [/\\\\\?/g, '\\?'],
    [/\\\\\(/g, '\\('],
    [/\\\\\)/g, '\\)'],
    [/\\\\\[/g, '\\['],
    [/\\\\\]/g, '\\]'],
    [/\\\\\{/g, '\\{'],
    [/\\\\\}/g, '\\}']
  ];
  
  let fixCount = 0;
  fixes.forEach(([pattern, replacement]) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      fixCount += matches.length;
    }
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Fixed ${fixCount} regex syntax issues`);
  
  // Verify the file can be required now
  try {
    delete require.cache[require.resolve('./scrapers/providers/WestVancouverScraper')];
    require('./scrapers/providers/WestVancouverScraper');
    console.log('✅ WestVancouverScraper.js syntax verified');
    return true;
  } catch (error) {
    console.error('❌ Still has syntax issues:', error.message);
    return false;
  }
}

if (require.main === module) {
  fixRegexSyntax();
}

module.exports = { fixRegexSyntax };