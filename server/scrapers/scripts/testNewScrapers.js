#!/usr/bin/env node

/**
 * Test new city scrapers and report field coverage statistics
 *
 * Usage:
 *   node testNewScrapers.js                    # Test all new scrapers
 *   node testNewScrapers.js toronto            # Test single scraper
 *   node testNewScrapers.js --platform=regprog # Test platform
 */

const fs = require('fs');
const path = require('path');
const ScraperFactory = require('../base/ScraperFactory');

// New cities to test
const NEW_CITIES = {
  // ActiveNet cities
  activenetwork: ['toronto', 'ottawa', 'winnipeg', 'mississauga', 'kitchener', 'windsor', 'regina', 'richmond-hill'],
  // PerfectMind cities
  perfectmind: ['brampton', 'hamilton', 'halifax', 'london', 'markham', 'vaughan', 'oakville'],
  // New platforms
  regprog: ['calgary'],
  coe: ['edmonton'],
  webtrac: ['saskatoon'],
  ic3: ['montreal']
};

// Fields to track coverage
const IMPORTANT_FIELDS = [
  'name',
  'externalId',
  'category',
  'dateStart',
  'dateEnd',
  'startTime',
  'endTime',
  'dayOfWeek',
  'ageMin',
  'ageMax',
  'cost',
  'spotsAvailable',
  'registrationStatus',
  'locationName',
  'registrationUrl',
  'description'
];

/**
 * Calculate field coverage statistics
 */
function calculateFieldCoverage(activities) {
  const stats = {};
  const totalActivities = activities.length;

  for (const field of IMPORTANT_FIELDS) {
    let populated = 0;
    for (const activity of activities) {
      const value = activity[field];
      if (value !== null && value !== undefined && value !== '' &&
          !(Array.isArray(value) && value.length === 0)) {
        populated++;
      }
    }
    stats[field] = {
      populated,
      total: totalActivities,
      percentage: totalActivities > 0 ? Math.round((populated / totalActivities) * 100) : 0
    };
  }

  return stats;
}

/**
 * Load provider config
 */
function loadProviderConfig(providerCode) {
  const configPath = path.join(__dirname, '..', 'configs', 'providers', `${providerCode}.json`);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Test a single scraper
 */
async function testScraper(providerCode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${providerCode.toUpperCase()}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  let result = {
    provider: providerCode,
    success: false,
    activitiesFound: 0,
    fieldCoverage: {},
    error: null,
    duration: 0
  };

  try {
    // Load config
    const config = loadProviderConfig(providerCode);
    console.log(`Platform: ${config.platform}`);
    console.log(`URL: ${config.baseUrl}`);

    // Create scraper
    const scraper = ScraperFactory.createScraper(config);

    // Override saveActivitiesToDatabase to capture activities without saving
    const originalSave = scraper.saveActivitiesToDatabase.bind(scraper);
    let capturedActivities = [];

    scraper.saveActivitiesToDatabase = async (activities, providerId) => {
      capturedActivities = activities;
      // Return mock stats without actually saving
      return {
        created: activities.length,
        updated: 0,
        unchanged: 0,
        removed: 0,
        errors: 0,
        newActivities: [],
        changedActivities: []
      };
    };

    // Also need to mock getOrCreateProvider
    scraper.getOrCreateProvider = async () => {
      return { id: 'test-provider-id', name: config.name };
    };

    // Run the scraper
    console.log(`\nStarting scrape...`);
    const scrapeResult = await scraper.scrape();

    // Calculate statistics
    result.success = true;
    result.activitiesFound = capturedActivities.length;
    result.fieldCoverage = calculateFieldCoverage(capturedActivities);
    result.duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print results
    console.log(`\n✅ Scrape completed in ${result.duration}s`);
    console.log(`\nActivities Found: ${result.activitiesFound}`);

    if (result.activitiesFound > 0) {
      console.log(`\nField Coverage:`);
      console.log('-'.repeat(40));

      let totalCoverage = 0;
      let fieldCount = 0;

      for (const [field, stats] of Object.entries(result.fieldCoverage)) {
        const bar = '█'.repeat(Math.floor(stats.percentage / 5)) + '░'.repeat(20 - Math.floor(stats.percentage / 5));
        const emoji = stats.percentage >= 80 ? '✅' : stats.percentage >= 50 ? '⚠️' : '❌';
        console.log(`${emoji} ${field.padEnd(18)} ${bar} ${stats.percentage}% (${stats.populated}/${stats.total})`);
        totalCoverage += stats.percentage;
        fieldCount++;
      }

      result.averageCoverage = Math.round(totalCoverage / fieldCount);
      console.log(`\nAverage Field Coverage: ${result.averageCoverage}%`);

      // Show sample activities
      console.log(`\nSample Activities (first 3):`);
      console.log('-'.repeat(40));
      capturedActivities.slice(0, 3).forEach((a, i) => {
        console.log(`${i + 1}. ${a.name}`);
        console.log(`   Category: ${a.category || 'N/A'}`);
        console.log(`   Age: ${a.ageMin ?? 'N/A'}-${a.ageMax ?? 'N/A'}`);
        console.log(`   Cost: $${a.cost ?? 'N/A'}`);
        console.log(`   Dates: ${a.dateStart ? a.dateStart.toISOString().split('T')[0] : 'N/A'} - ${a.dateEnd ? a.dateEnd.toISOString().split('T')[0] : 'N/A'}`);
        console.log(`   Time: ${a.startTime || 'N/A'} - ${a.endTime || 'N/A'}`);
        console.log(`   Location: ${a.locationName || 'N/A'}`);
      });
    }

    // Cleanup
    await scraper.cleanup();

  } catch (error) {
    result.error = error.message;
    result.duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n❌ Error: ${error.message}`);
    console.log(error.stack);
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     KIDS ACTIVITY TRACKER - NEW SCRAPER TEST SUITE        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted: ${new Date().toISOString()}`);

  let citiesToTest = [];

  // Parse arguments
  if (args.length === 0) {
    // Test all new cities
    for (const cities of Object.values(NEW_CITIES)) {
      citiesToTest.push(...cities);
    }
  } else if (args[0].startsWith('--platform=')) {
    const platform = args[0].split('=')[1];
    if (NEW_CITIES[platform]) {
      citiesToTest = NEW_CITIES[platform];
    } else {
      console.error(`Unknown platform: ${platform}`);
      process.exit(1);
    }
  } else {
    // Single city
    citiesToTest = [args[0]];
  }

  console.log(`\nCities to test: ${citiesToTest.join(', ')}`);
  console.log(`Total: ${citiesToTest.length}`);

  // Run tests
  const results = [];
  for (const city of citiesToTest) {
    const result = await testScraper(city);
    results.push(result);
  }

  // Print summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                     SUMMARY REPORT                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n┌────────────────┬──────────┬────────────┬─────────────────┐');
  console.log('│ Provider       │ Status   │ Activities │ Field Coverage  │');
  console.log('├────────────────┼──────────┼────────────┼─────────────────┤');

  let totalActivities = 0;
  let successCount = 0;
  let totalCoverage = 0;

  for (const result of results) {
    const status = result.success ? '✅ OK' : '❌ FAIL';
    const activities = result.activitiesFound.toString().padStart(8);
    const coverage = result.averageCoverage ? `${result.averageCoverage}%`.padStart(13) : 'N/A'.padStart(13);

    console.log(`│ ${result.provider.padEnd(14)} │ ${status.padEnd(8)} │ ${activities} │ ${coverage} │`);

    if (result.success) {
      totalActivities += result.activitiesFound;
      successCount++;
      if (result.averageCoverage) {
        totalCoverage += result.averageCoverage;
      }
    }
  }

  console.log('└────────────────┴──────────┴────────────┴─────────────────┘');

  console.log(`\nTotal Results:`);
  console.log(`  Scrapers Tested: ${results.length}`);
  console.log(`  Successful: ${successCount}/${results.length}`);
  console.log(`  Total Activities: ${totalActivities}`);
  console.log(`  Average Field Coverage: ${successCount > 0 ? Math.round(totalCoverage / successCount) : 0}%`);

  // Detailed field coverage across all scrapers
  if (successCount > 0) {
    console.log('\nField Coverage by Field (across all successful scrapers):');
    console.log('-'.repeat(50));

    const aggregatedCoverage = {};
    for (const field of IMPORTANT_FIELDS) {
      aggregatedCoverage[field] = { totalPct: 0, count: 0 };
    }

    for (const result of results) {
      if (result.success && result.fieldCoverage) {
        for (const [field, stats] of Object.entries(result.fieldCoverage)) {
          aggregatedCoverage[field].totalPct += stats.percentage;
          aggregatedCoverage[field].count++;
        }
      }
    }

    for (const [field, data] of Object.entries(aggregatedCoverage)) {
      if (data.count > 0) {
        const avgPct = Math.round(data.totalPct / data.count);
        const bar = '█'.repeat(Math.floor(avgPct / 5)) + '░'.repeat(20 - Math.floor(avgPct / 5));
        const emoji = avgPct >= 80 ? '✅' : avgPct >= 50 ? '⚠️' : '❌';
        console.log(`${emoji} ${field.padEnd(18)} ${bar} ${avgPct}%`);
      }
    }
  }

  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
