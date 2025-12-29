#!/usr/bin/env node

/**
 * Test new GTA city scrapers
 * Aurora, King, Whitchurch-Stouffville, Milton, Georgina
 */

const path = require('path');
const { PrismaClient } = require('../../generated/prisma');
const ActiveNetworkScraper = require('../platforms/ActiveNetworkScraper');
const PerfectMindScraper = require('../platforms/PerfectMindScraper');

const prisma = new PrismaClient();

// New GTA cities to test
const NEW_CITIES = [
  { code: 'aurora', platform: 'activenetwork' },
  { code: 'georgina', platform: 'activenetwork' },
  { code: 'whitchurch-stouffville', platform: 'activenetwork' },
  { code: 'king', platform: 'perfectmind' },
  { code: 'milton', platform: 'perfectmind' }
];

async function runScraper(city) {
  const configPath = path.join(__dirname, '../configs/providers', `${city.code}.json`);

  // Clear require cache to get fresh config
  delete require.cache[require.resolve(configPath)];
  const config = require(configPath);

  // Override to skip detail pages for speed
  config.scraperConfig.fetchDetailPages = false;

  let scraper;
  if (city.platform === 'activenetwork') {
    scraper = new ActiveNetworkScraper(config);
  } else if (city.platform === 'perfectmind') {
    scraper = new PerfectMindScraper(config);
  } else {
    throw new Error(`Unknown platform: ${city.platform}`);
  }

  const startTime = Date.now();

  try {
    const result = await scraper.scrape();
    const activitiesFound = result.activities?.length || 0;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      success: true,
      provider: city.code,
      platform: city.platform,
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
      provider: city.code,
      platform: city.platform,
      error: error.message,
      duration: `${duration}s`
    };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('Testing New GTA City Scrapers');
  console.log('='.repeat(70));
  console.log(`\nCities: ${NEW_CITIES.map(c => c.code).join(', ')}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const results = [];
  let totalActivities = 0;

  for (let i = 0; i < NEW_CITIES.length; i++) {
    const city = NEW_CITIES[i];
    console.log(`\n[${i + 1}/${NEW_CITIES.length}] Running ${city.code.toUpperCase()} (${city.platform})...`);
    console.log('-'.repeat(50));

    const result = await runScraper(city);
    results.push(result);

    if (result.success) {
      totalActivities += result.activities;
      console.log(`\n✅ ${city.code}: ${result.activities.toLocaleString()} activities`);
      console.log(`   Created: ${result.created}, Updated: ${result.updated}, Unchanged: ${result.unchanged}`);
      console.log(`   Duration: ${result.duration}`);
    } else {
      console.log(`\n❌ ${city.code}: FAILED - ${result.error} (${result.duration})`);
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

  console.log(`\nSuccessful: ${successful.length}/${NEW_CITIES.length}`);
  console.log(`Total Activities: ${totalActivities.toLocaleString()}`);

  if (successful.length > 0) {
    console.log('\nResults:');
    successful.forEach(r => {
      console.log(`  ✅ ${r.provider.padEnd(25)} ${r.activities.toLocaleString().padStart(6)} activities (${r.platform})`);
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(r => {
      console.log(`  ❌ ${r.provider} (${r.platform}): ${r.error}`);
    });
  }

  console.log(`\nCompleted: ${new Date().toISOString()}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
