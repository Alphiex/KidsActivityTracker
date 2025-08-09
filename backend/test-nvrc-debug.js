#!/usr/bin/env node

const NVRCExtractionDebugger = require('./debug-nvrc-extraction');

console.log('🔍 Starting NVRC extraction debug test...\n');

const debugger = new NVRCExtractionDebugger();

debugger.debug()
  .then(results => {
    console.log('\n✅ Debug completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Total group titles found: ${results.pageAnalysis.groupTitles.length}`);
    console.log(`- Total group items found: ${results.pageAnalysis.groupItems.length}`);
    console.log(`- Unmatched items: ${results.pageAnalysis.unmatchedItems.length}`);
    console.log(`- Activities found (alternative method): ${results.alternativeExtraction.totalActivities}`);
    
    console.log('\n📸 Screenshots saved:');
    console.log('- debug-1-initial-page.png');
    console.log('- debug-2-before-expand.png');
    console.log('- debug-3-after-expand.png');
    console.log('- debug-4-annotated.png (with highlights)');
    
    console.log('\n📄 Full debug data saved to: nvrc-extraction-debug.json');
    
    if (results.alternativeExtraction.totalActivities > 3) {
      console.log('\n✅ SUCCESS: Found more than 3 activities!');
      console.log('The fixed extraction logic should resolve the issue.');
    } else {
      console.log('\n⚠️  WARNING: Still only finding 3 or fewer activities.');
      console.log('Check the screenshots and debug data for more information.');
    }
  })
  .catch(error => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });