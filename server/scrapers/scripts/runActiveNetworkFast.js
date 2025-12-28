#!/usr/bin/env node

/**
 * Fast run of all ActiveNetwork scrapers (without detail page fetching)
 * This is for quick testing of the API extraction fix
 */

const path = require('path');
const { PrismaClient } = require('../../generated/prisma');

// Platform scrapers
const ActiveNetworkScraper = require('../platforms/ActiveNetworkScraper');

const prisma = new PrismaClient();

// ActiveNetwork providers to run
const ACTIVENETWORK_PROVIDERS = [
  'ajax', 'barrie', 'bowen-island', 'brantford', 'burnaby', 'cambridge',
  'clarington', 'kitchener', 'langley-city', 'mississauga', 'niagara-falls',
  'ottawa', 'pickering', 'port-coquitlam', 'regina', 'richmond-hill',
  'saanich', 'st-catharines', 'stjohns', 'toronto', 'vancouver',
  'waterloo', 'west-vancouver', 'whitby', 'windsor', 'winnipeg'
];

async function runScraper(providerCode) {
  const configPath = path.join(__dirname, '../configs/providers', `${providerCode}.json`);
  const config = require(configPath);

  // Override to skip detail pages for speed
  config.scraperConfig.fetchDetailPages = false;

  const scraper = new ActiveNetworkScraper(config);
  scraper.prisma = prisma;

  const startTime = Date.now();
  let activitiesFound = 0;

  try {
    const result = await scraper.scrape();
    activitiesFound = result.stats?.activitiesFound || result.activities?.length || 0;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      success: true,
      provider: providerCode,
      activities: activitiesFound,
      duration: `${duration}s`,
      created: result.stats?.activitiesCreated || 0,
      updated: result.stats?.activitiesUpdated || 0
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
  console.log('ActiveNetwork Scrapers - Fast Run (No Detail Pages)');
  console.log('='.repeat(70));
  console.log(`\nProviders: ${ACTIVENETWORK_PROVIDERS.length}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = [];
  let totalActivities = 0;

  for (let i = 0; i < ACTIVENETWORK_PROVIDERS.length; i++) {
    const provider = ACTIVENETWORK_PROVIDERS[i];
    console.log(`[${i + 1}/${ACTIVENETWORK_PROVIDERS.length}] Running ${provider}...`);

    const result = await runScraper(provider);
    results.push(result);

    if (result.success) {
      totalActivities += result.activities;
      console.log(`   ✅ ${result.activities.toLocaleString()} activities (${result.duration})`);
    } else {
      console.log(`   ❌ FAILED: ${result.error} (${result.duration})`);
    }

    // Small delay between scrapers
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nSuccessful: ${successful.length}/${ACTIVENETWORK_PROVIDERS.length}`);
  console.log(`Total Activities: ${totalActivities.toLocaleString()}`);

  // Sort by activity count
  successful.sort((a, b) => b.activities - a.activities);

  console.log('\nBy Activity Count:');
  successful.forEach(r => {
    console.log(`  ${r.provider.padEnd(20)} ${r.activities.toLocaleString().padStart(8)} activities`);
  });

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
