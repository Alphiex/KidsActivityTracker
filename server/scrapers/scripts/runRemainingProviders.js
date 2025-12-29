#!/usr/bin/env node

/**
 * Run remaining ActiveNetwork providers that weren't completed
 * Uses fast mode (no detail pages) with optimized batch save
 */

const path = require('path');
const { PrismaClient } = require('../../generated/prisma');
const ActiveNetworkScraper = require('../platforms/ActiveNetworkScraper');

const prisma = new PrismaClient();

// Providers that need to be run
const REMAINING_PROVIDERS = ['toronto', 'waterloo', 'windsor', 'winnipeg'];

async function runScraper(providerCode) {
  const configPath = path.join(__dirname, '../configs/providers', `${providerCode}.json`);

  // Clear require cache to get fresh config
  delete require.cache[require.resolve(configPath)];
  const config = require(configPath);

  // Override to skip detail pages for speed
  config.scraperConfig.fetchDetailPages = false;

  const scraper = new ActiveNetworkScraper(config);

  const startTime = Date.now();

  try {
    const result = await scraper.scrape();
    const activitiesFound = result.activities?.length || 0;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      success: true,
      provider: providerCode,
      activities: activitiesFound,
      duration: `${duration}s`,
      created: result.stats?.created || 0,
      updated: result.stats?.updated || 0,
      unchanged: result.stats?.unchanged || 0
    };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    return {
      success: false,
      provider: providerCode,
      error: error.message,
      duration: `${duration}s`
    };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('Running Remaining ActiveNetwork Providers');
  console.log('='.repeat(70));
  console.log(`\nProviders: ${REMAINING_PROVIDERS.join(', ')}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = [];
  let totalActivities = 0;

  for (let i = 0; i < REMAINING_PROVIDERS.length; i++) {
    const provider = REMAINING_PROVIDERS[i];
    console.log(`\n[${i + 1}/${REMAINING_PROVIDERS.length}] Running ${provider.toUpperCase()}...`);
    console.log('-'.repeat(50));

    const result = await runScraper(provider);
    results.push(result);

    if (result.success) {
      totalActivities += result.activities;
      console.log(`\n✅ ${provider}: ${result.activities.toLocaleString()} activities`);
      console.log(`   Created: ${result.created}, Updated: ${result.updated}, Unchanged: ${result.unchanged}`);
      console.log(`   Duration: ${result.duration}`);
    } else {
      console.log(`\n❌ ${provider}: FAILED - ${result.error} (${result.duration})`);
    }

    // Small delay between scrapers
    await new Promise(r => setTimeout(r, 2000));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nSuccessful: ${successful.length}/${REMAINING_PROVIDERS.length}`);
  console.log(`Total Activities: ${totalActivities.toLocaleString()}`);

  if (successful.length > 0) {
    console.log('\nResults:');
    successful.forEach(r => {
      console.log(`  ✅ ${r.provider.padEnd(15)} ${r.activities.toLocaleString().padStart(8)} activities (${r.duration})`);
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(r => {
      console.log(`  ❌ ${r.provider}: ${r.error}`);
    });
  }

  console.log(`\nCompleted: ${new Date().toISOString()}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
