const fs = require('fs');
const cheerio = require('cheerio');

// Load the saved HTML
const html = fs.readFileSync('nvrc-page.html', 'utf8');
const $ = cheerio.load(html);

console.log('Analyzing NVRC HTML structure...\n');

// Look for PerfectMind results container
const resultsBlock = $('#perfectmind-results-block');
console.log('PerfectMind results block found:', resultsBlock.length > 0);

// Check for data attributes
const dataElements = $('[data-drupal-selector*="perfectmind"]');
console.log('Elements with PerfectMind data attributes:', dataElements.length);

// Look for JavaScript configuration
const scripts = $('script').map((i, el) => $(el).html()).get();
const perfectMindScripts = scripts.filter(script => 
  script && script.includes('perfectmind')
);

console.log('\nFound', perfectMindScripts.length, 'scripts with PerfectMind references');

// Extract Drupal settings if available
const drupalSettingsScript = scripts.find(script => 
  script && script.includes('drupalSettings')
);

if (drupalSettingsScript) {
  console.log('\nDrupal settings found!');
  
  // Try to extract the settings object
  const settingsMatch = drupalSettingsScript.match(/drupalSettings\s*=\s*({[\s\S]*?});/);
  if (settingsMatch) {
    try {
      const settings = JSON.parse(settingsMatch[1]);
      
      // Look for PerfectMind configuration
      if (settings.perfectmind) {
        console.log('\nPerfectMind configuration:');
        console.log(JSON.stringify(settings.perfectmind, null, 2));
        
        // Save settings for reference
        fs.writeFileSync('drupal-settings.json', JSON.stringify(settings, null, 2));
        console.log('\nFull settings saved to drupal-settings.json');
      }
      
      // Look for API endpoints
      if (settings.path) {
        console.log('\nPath configuration:', settings.path);
      }
      
    } catch (e) {
      console.log('Could not parse Drupal settings:', e.message);
    }
  }
}

// Look for any forms that might submit to APIs
const forms = $('form');
console.log('\n\nForms found:', forms.length);
forms.each((i, form) => {
  const $form = $(form);
  const action = $form.attr('action');
  const id = $form.attr('id');
  if (action || id) {
    console.log(`Form ${i + 1}: ID="${id}", Action="${action}"`);
  }
});

// Check for hidden fields that might contain API info
const hiddenInputs = $('input[type="hidden"]');
console.log('\nHidden inputs:', hiddenInputs.length);
hiddenInputs.each((i, input) => {
  const $input = $(input);
  const name = $input.attr('name');
  const value = $input.attr('value');
  if (name && name.includes('perfectmind')) {
    console.log(`  ${name}: ${value}`);
  }
});

// Look for AJAX configuration
const ajaxElements = $('[data-ajax-url], [data-drupal-ajax]');
console.log('\nAJAX-enabled elements:', ajaxElements.length);
ajaxElements.each((i, el) => {
  const $el = $(el);
  console.log(`  ${$el.prop('tagName')} - URL: ${$el.attr('data-ajax-url')}`);
});