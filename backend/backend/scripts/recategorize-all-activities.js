#!/usr/bin/env node

/**
 * COMPREHENSIVE ACTIVITY RECATEGORIZATION SCRIPT
 * 
 * This script analyzes and recategorizes ALL activities in the database
 * using the new priority-based keyword matching algorithm.
 * 
 * Usage: node scripts/recategorize-all-activities.js
 */

const { ComprehensiveActivityCategorizer } = require('../utils/comprehensiveActivityCategorizer');

async function main() {
  console.log('🚀 COMPREHENSIVE ACTIVITY RECATEGORIZATION');
  console.log('='.repeat(60));
  console.log('This will analyze and fix activity categorization for ALL activities');
  console.log('using priority-based keyword matching.');
  console.log('');

  const categorizer = new ComprehensiveActivityCategorizer();
  
  try {
    // Run the recategorization
    const stats = await categorizer.recategorizeAllActivities();
    
    // Verify the results
    await categorizer.verifyCategorization();
    
    console.log('\n🎉 RECATEGORIZATION COMPLETED SUCCESSFULLY!');
    console.log(`📊 Updated ${stats.updated} activities out of ${stats.total} total`);
    console.log(`✨ ${stats.highConfidence} high-confidence matches`);
    console.log(`⚡ ${stats.mediumConfidence} medium-confidence matches`);
    
    if (stats.updated > 0) {
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Test mobile app category browsing to verify fixes');
      console.log('2. Verify swimming activities only show swimming content');
      console.log('3. Verify racquet sports only show racquet content');
      console.log('4. Update scraper logic to use this categorization for new activities');
    }
    
  } catch (error) {
    console.error('❌ RECATEGORIZATION FAILED:', error);
    process.exit(1);
  } finally {
    await categorizer.disconnect();
  }
}

// Handle script interruption gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️ Script interrupted. Exiting gracefully...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});