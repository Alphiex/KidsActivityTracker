#!/usr/bin/env node

/**
 * Run all ActiveNetwork scrapers
 * This script runs scrapers sequentially to avoid overwhelming the system
 */

const fs = require('fs');
const path = require('path');
const ScraperOrchestrator = require('../base/ScraperOrchestrator');

// ActiveNetwork providers to run
const ACTIVENETWORK_PROVIDERS = [
  'ajax',
  'barrie',
  'bowen-island',
  'brantford',
  'burnaby',
  'cambridge',
  'clarington',
  'kitchener',
  'langley-city',
  'mississauga',
  'niagara-falls',
  'ottawa',
  'pickering',
  'port-coquitlam',
  'regina',
  'richmond-hill',
  'saanich',
  'st-catharines',
  'stjohns',
  'toronto',
  'vancouver',
  'waterloo',
  'west-vancouver',
  'whitby',
  'windsor',
  'winnipeg'
];

async function main() {
  console.log('='.repeat(60));
  console.log('ActiveNetwork Scrapers - Running All Providers');
  console.log('='.repeat(60));
  console.log(`\nTotal providers: ${ACTIVENETWORK_PROVIDERS.length}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const orchestrator = new ScraperOrchestrator();
  const results = [];
  let totalActivities = 0;

  for (let i = 0; i < ACTIVENETWORK_PROVIDERS.length; i++) {
    const providerCode = ACTIVENETWORK_PROVIDERS[i];
    const progress = `[${i + 1}/${ACTIVENETWORK_PROVIDERS.length}]`;

    console.log(`\n${'-'.repeat(60)}`);
    console.log(`${progress} Starting: ${providerCode.toUpperCase()}`);
    console.log(`${'-'.repeat(60)}`);

    const startTime = Date.now();

    try {
      const result = await orchestrator.runSingle(providerCode, { dryRun: false });
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

      if (result.success) {
        const activities = result.stats?.activitiesFound || 0;
        totalActivities += activities;
        results.push({
          provider: providerCode,
          success: true,
          activities,
          duration: `${duration}m`
        });
        console.log(`\n✅ ${providerCode}: ${activities} activities in ${duration} minutes`);
      } else {
        results.push({
          provider: providerCode,
          success: false,
          error: result.error,
          duration: `${duration}m`
        });
        console.log(`\n❌ ${providerCode}: FAILED - ${result.error}`);
      }
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      results.push({
        provider: providerCode,
        success: false,
        error: error.message,
        duration: `${duration}m`
      });
      console.log(`\n❌ ${providerCode}: ERROR - ${error.message}`);
    }

    // Small delay between scrapers
    await new Promise(r => setTimeout(r, 2000));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nSuccessful: ${successful.length}/${ACTIVENETWORK_PROVIDERS.length}`);
  console.log(`Total activities: ${totalActivities.toLocaleString()}`);

  if (successful.length > 0) {
    console.log('\nSuccessful scrapers:');
    successful.forEach(r => {
      console.log(`  ✅ ${r.provider.padEnd(20)} ${r.activities.toString().padStart(6)} activities (${r.duration})`);
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed scrapers:');
    failed.forEach(r => {
      console.log(`  ❌ ${r.provider.padEnd(20)} ${r.error}`);
    });
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);

  await orchestrator.cleanup();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
