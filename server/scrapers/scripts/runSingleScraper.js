#!/usr/bin/env node

/**
 * Run a single scraper by provider code
 *
 * Usage:
 *   node runSingleScraper.js vancouver         # Run Vancouver scraper
 *   node runSingleScraper.js richmond --dry-run # Test without database writes
 *   node runSingleScraper.js --list            # List all available providers
 */

const fs = require('fs');
const path = require('path');
const ScraperOrchestrator = require('../base/ScraperOrchestrator');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Kids Activity Tracker - Single Scraper Runner
==============================================

Usage:
  node runSingleScraper.js <provider-code> [options]

Options:
  --dry-run    Test scraping without database writes
  --list       List all available providers
  --help       Show this help message

Examples:
  node runSingleScraper.js vancouver
  node runSingleScraper.js richmond --dry-run
  node runSingleScraper.js --list
`);
    process.exit(0);
  }

  const orchestrator = new ScraperOrchestrator();

  // List providers
  if (args.includes('--list')) {
    const providers = orchestrator.loadProviderConfigs();

    console.log('Available Providers');
    console.log('===================\n');

    const grouped = providers.reduce((acc, p) => {
      if (!acc[p.platform]) acc[p.platform] = [];
      acc[p.platform].push(p);
      return acc;
    }, {});

    for (const [platform, platformProviders] of Object.entries(grouped)) {
      console.log(`${platform.toUpperCase()}:`);
      platformProviders.forEach(p => {
        const status = p.isActive ? '✓' : '✗';
        console.log(`  ${status} ${p.code.padEnd(15)} - ${p.name}`);
      });
      console.log('');
    }

    process.exit(0);
  }

  // Run single scraper
  const providerCode = args.find(arg => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!providerCode) {
    console.error('Error: Provider code is required');
    console.log('Use --list to see available providers');
    process.exit(1);
  }

  console.log('Kids Activity Tracker - Single Scraper');
  console.log('======================================\n');

  try {
    const result = await orchestrator.runSingle(providerCode, { dryRun });

    if (!result.success) {
      console.error(`\nScraper failed: ${result.error}`);
      process.exit(1);
    }

    console.log('\n✅ Scraper completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await orchestrator.cleanup();
  }
}

main();
