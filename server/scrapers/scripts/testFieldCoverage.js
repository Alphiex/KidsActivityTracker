#!/usr/bin/env node
/**
 * Field Coverage Test Script
 * Tests all city scrapers and generates a field coverage report
 *
 * Usage: node testFieldCoverage.js [--city=citycode] [--limit=20]
 */

const fs = require('fs');
const path = require('path');

// Import scrapers
const PerfectMindScraper = require('../platforms/PerfectMindScraper');
const ActiveNetworkScraper = require('../platforms/ActiveNetworkScraper');
const IntelligenzScraper = require('../platforms/IntelligenzScraper');
const FullCalendarScraper = require('../platforms/FullCalendarScraper');

// Custom scrapers
let NVRCScraper, WestVancouverScraper;
try {
  NVRCScraper = require('../providers/NVRCScraper');
} catch (e) {
  NVRCScraper = null;
}
try {
  WestVancouverScraper = require('../providers/WestVancouverScraper');
} catch (e) {
  WestVancouverScraper = null;
}

// Key fields to check for coverage
const KEY_FIELDS = [
  'name',
  'externalId',
  'category',
  'description',
  'cost',
  'dateStart',
  'dateEnd',
  'startTime',
  'endTime',
  'dayOfWeek',
  'ageMin',
  'ageMax',
  'locationName',
  'registrationUrl',
  'registrationStatus'
];

// Load all provider configs
function loadProviderConfigs() {
  const configDir = path.join(__dirname, '../configs/providers');
  const configs = {};

  const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const configPath = path.join(configDir, file);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const code = file.replace('.json', '');
      configs[code] = config;
    } catch (e) {
      console.error(`Error loading config ${file}:`, e.message);
    }
  }

  return configs;
}

// Get the appropriate scraper class for a platform
function getScraperClass(platform, code) {
  // Check for custom scrapers first
  if (code === 'north-vancouver' && NVRCScraper) return NVRCScraper;
  if (code === 'west-vancouver' && WestVancouverScraper) return WestVancouverScraper;

  switch (platform) {
    case 'perfectmind':
      return PerfectMindScraper;
    case 'activenetwork':
      return ActiveNetworkScraper;
    case 'intelligenz':
      return IntelligenzScraper;
    case 'fullcalendar':
      return FullCalendarScraper;
    default:
      return null;
  }
}

// Analyze field coverage for a set of activities
function analyzeFieldCoverage(activities) {
  const coverage = {};
  const total = activities.length;

  for (const field of KEY_FIELDS) {
    let populated = 0;

    for (const activity of activities) {
      const value = activity[field];

      if (field === 'dayOfWeek') {
        // Array field - check if non-empty array
        if (Array.isArray(value) && value.length > 0) populated++;
      } else if (field === 'cost') {
        // Cost can be 0 (free) which is valid
        if (value !== null && value !== undefined) populated++;
      } else {
        // Regular field - check if truthy
        if (value) populated++;
      }
    }

    coverage[field] = {
      count: populated,
      total: total,
      percentage: total > 0 ? Math.round((populated / total) * 100) : 0
    };
  }

  return coverage;
}

// Mock database for testing (we won't actually save)
class MockPrisma {
  constructor() {
    this.provider = {
      findFirst: async () => ({ id: 'test-provider', name: 'Test' }),
      create: async (data) => ({ id: 'test-provider', ...data.data })
    };
    this.activity = {
      findMany: async () => [],
      upsert: async () => ({}),
      updateMany: async () => ({})
    };
    this.location = {
      findFirst: async () => null,
      create: async (data) => ({ id: 'test-location', ...data.data })
    };
    this.activityType = {
      findUnique: async () => null
    };
  }

  async $disconnect() {
    // Mock disconnect - do nothing
  }
}

// Run a limited scrape for a single provider
async function runLimitedScrape(config, limit = 20, fetchDetailPages = false) {
  const ScraperClass = getScraperClass(config.platform, config.code);

  if (!ScraperClass) {
    return { error: `No scraper for platform: ${config.platform}` };
  }

  // Modify config for limited testing
  const testConfig = {
    ...config,
    scraperConfig: {
      ...config.scraperConfig,
      maxActivities: limit,
      fetchDetailPages: fetchDetailPages, // Enable detail pages if --details flag is set
      headless: true,
      timeout: fetchDetailPages ? 300000 : 60000 // Longer timeout when fetching details
    }
  };

  const scraper = new ScraperClass(testConfig);

  // Override prisma with mock
  scraper.prisma = new MockPrisma();

  // Override saveActivitiesToDatabase to just return the activities
  scraper.saveActivitiesToDatabase = async (activities) => {
    return {
      created: activities.length,
      updated: 0,
      unchanged: 0,
      deactivated: 0,
      errors: 0
    };
  };

  try {
    console.log(`  Starting scrape for ${config.name}...`);
    const startTime = Date.now();

    // For PerfectMind, we need to limit during extraction
    if (config.platform === 'perfectmind') {
      // Run the scraper but intercept after extraction
      const result = await scraper.scrape();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Limit to first N activities
      const limitedActivities = result.activities.slice(0, limit);

      return {
        activities: limitedActivities,
        count: limitedActivities.length,
        duration: `${duration}s`,
        platform: config.platform
      };
    } else {
      const result = await scraper.scrape();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      const limitedActivities = result.activities.slice(0, limit);

      return {
        activities: limitedActivities,
        count: limitedActivities.length,
        duration: `${duration}s`,
        platform: config.platform
      };
    }
  } catch (error) {
    return {
      error: error.message,
      platform: config.platform
    };
  } finally {
    if (scraper.cleanup) {
      await scraper.cleanup().catch(() => {});
    }
  }
}

// Generate coverage report
function generateReport(results) {
  console.log('\n' + '='.repeat(100));
  console.log('FIELD COVERAGE REPORT');
  console.log('='.repeat(100));

  // Summary table header
  const fields = KEY_FIELDS;
  let header = 'City'.padEnd(20) + '| Count |';
  for (const field of fields) {
    header += ` ${field.substring(0, 8).padEnd(8)} |`;
  }
  console.log('\n' + header);
  console.log('-'.repeat(header.length));

  const allCoverages = [];

  // Print each city's coverage
  for (const [city, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`${city.padEnd(20)}| ERROR: ${result.error.substring(0, 60)}`);
      continue;
    }

    if (!result.activities || result.activities.length === 0) {
      console.log(`${city.padEnd(20)}|   0   | No activities found`);
      continue;
    }

    const coverage = analyzeFieldCoverage(result.activities);
    allCoverages.push({ city, coverage, count: result.count });

    let row = `${city.padEnd(20)}| ${String(result.count).padStart(5)} |`;
    for (const field of fields) {
      const pct = coverage[field].percentage;
      const cell = `${pct}%`.padStart(7);
      row += ` ${cell} |`;
    }
    console.log(row);
  }

  // Calculate overall averages
  if (allCoverages.length > 0) {
    console.log('-'.repeat(header.length));

    let avgRow = 'AVERAGE'.padEnd(20) + '|       |';
    for (const field of fields) {
      const avgPct = Math.round(
        allCoverages.reduce((sum, c) => sum + c.coverage[field].percentage, 0) / allCoverages.length
      );
      avgRow += ` ${String(avgPct + '%').padStart(7)} |`;
    }
    console.log(avgRow);
  }

  // Detailed breakdown by platform
  console.log('\n' + '='.repeat(100));
  console.log('COVERAGE BY PLATFORM');
  console.log('='.repeat(100));

  const byPlatform = {};
  for (const [city, result] of Object.entries(results)) {
    if (result.error || !result.activities) continue;
    const platform = result.platform || 'unknown';
    if (!byPlatform[platform]) byPlatform[platform] = [];
    byPlatform[platform].push({ city, result });
  }

  for (const [platform, cities] of Object.entries(byPlatform)) {
    console.log(`\n${platform.toUpperCase()} (${cities.length} cities):`);

    // Combine all activities for this platform
    const allActivities = cities.flatMap(c => c.result.activities);
    const platformCoverage = analyzeFieldCoverage(allActivities);

    for (const field of fields) {
      const c = platformCoverage[field];
      const bar = '█'.repeat(Math.floor(c.percentage / 5)) + '░'.repeat(20 - Math.floor(c.percentage / 5));
      console.log(`  ${field.padEnd(18)} ${bar} ${c.percentage}% (${c.count}/${c.total})`);
    }
  }

  // Gaps identification
  console.log('\n' + '='.repeat(100));
  console.log('GAPS IDENTIFIED (Fields < 80% coverage)');
  console.log('='.repeat(100));

  for (const { city, coverage } of allCoverages) {
    const gaps = fields.filter(f => coverage[f].percentage < 80);
    if (gaps.length > 0) {
      console.log(`\n${city}:`);
      for (const gap of gaps) {
        console.log(`  - ${gap}: ${coverage[gap].percentage}% (${coverage[gap].count}/${coverage[gap].total})`);
      }
    }
  }

  // Sample activities from first city with data
  console.log('\n' + '='.repeat(100));
  console.log('SAMPLE ACTIVITIES (First 3 from each platform)');
  console.log('='.repeat(100));

  const samplesByPlatform = {};
  for (const [city, result] of Object.entries(results)) {
    if (result.error || !result.activities || result.activities.length === 0) continue;
    const platform = result.platform || 'unknown';
    if (!samplesByPlatform[platform]) {
      samplesByPlatform[platform] = result.activities.slice(0, 3);
    }
  }

  for (const [platform, samples] of Object.entries(samplesByPlatform)) {
    console.log(`\n${platform.toUpperCase()}:`);
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      console.log(`  ${i + 1}. ${(a.name || 'No name').substring(0, 50)}`);
      console.log(`     Category: ${a.category || 'N/A'} | Cost: $${a.cost || 0}`);
      console.log(`     Dates: ${a.dateStart ? new Date(a.dateStart).toLocaleDateString() : 'N/A'} - ${a.dateEnd ? new Date(a.dateEnd).toLocaleDateString() : 'N/A'}`);
      console.log(`     Time: ${a.startTime || 'N/A'} - ${a.endTime || 'N/A'} | Days: ${Array.isArray(a.dayOfWeek) ? a.dayOfWeek.join(', ') : 'N/A'}`);
      console.log(`     Age: ${a.ageMin ?? 'N/A'}-${a.ageMax ?? 'N/A'} | Location: ${(a.locationName || 'N/A').substring(0, 30)}`);
    }
  }

  return allCoverages;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='));
  const limitArg = args.find(a => a.startsWith('--limit='));

  const specificCity = cityArg ? cityArg.split('=')[1] : null;
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;
  const fetchDetails = args.includes('--details');

  console.log('='.repeat(100));
  console.log(`SCRAPER FIELD COVERAGE TEST - ${new Date().toISOString()}`);
  console.log(`Limit: ${limit} activities per city | Detail pages: ${fetchDetails ? 'ENABLED' : 'disabled'}`);
  console.log('='.repeat(100));

  const configs = loadProviderConfigs();
  const results = {};

  // Filter to specific city if requested
  const citiesToTest = specificCity
    ? Object.entries(configs).filter(([code]) => code === specificCity || code.includes(specificCity))
    : Object.entries(configs);

  console.log(`\nTesting ${citiesToTest.length} cities...\n`);

  for (const [code, config] of citiesToTest) {
    console.log(`[${code}] ${config.name} (${config.platform})`);

    try {
      results[code] = await runLimitedScrape(config, limit, fetchDetails);

      if (results[code].error) {
        console.log(`  ❌ Error: ${results[code].error}`);
      } else {
        console.log(`  ✅ Got ${results[code].count} activities in ${results[code].duration}`);
      }
    } catch (error) {
      results[code] = { error: error.message };
      console.log(`  ❌ Error: ${error.message}`);
    }

    // Small delay between cities to be nice to servers
    await new Promise(r => setTimeout(r, 2000));
  }

  // Generate report
  generateReport(results);

  console.log('\n' + '='.repeat(100));
  console.log('TEST COMPLETE');
  console.log('='.repeat(100));
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runLimitedScrape, analyzeFieldCoverage, generateReport };
