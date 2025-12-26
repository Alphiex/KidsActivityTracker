#!/usr/bin/env node

/**
 * Run all active scrapers
 *
 * Usage:
 *   node runAllScrapers.js                    # Run all scrapers
 *   node runAllScrapers.js --dry-run          # Test without database writes
 *   node runAllScrapers.js --platform perfectmind  # Run only PerfectMind scrapers
 *   node runAllScrapers.js --sequential       # Run one at a time
 */

const ScraperOrchestrator = require('../base/ScraperOrchestrator');

async function main() {
  const args = process.argv.slice(2);

  const options = {
    dryRun: args.includes('--dry-run'),
    sequential: args.includes('--sequential'),
    platforms: null
  };

  // Parse platform filter
  const platformIndex = args.indexOf('--platform');
  if (platformIndex !== -1 && args[platformIndex + 1]) {
    options.platforms = [args[platformIndex + 1]];
  }

  console.log('Kids Activity Tracker - Scraper Orchestrator');
  console.log('=============================================\n');

  const orchestrator = new ScraperOrchestrator();

  try {
    const results = await orchestrator.runAll(options);

    if (results.summary.failed > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await orchestrator.cleanup();
  }
}

main();
