#!/usr/bin/env node

/**
 * Run scrapers - supports all scrapers or by tier/batch
 *
 * Usage:
 *   node runAllScrapers.js                           # Run all scrapers
 *   node runAllScrapers.js --dry-run                 # Test without database writes
 *   node runAllScrapers.js --platform perfectmind    # Run only PerfectMind scrapers
 *   node runAllScrapers.js --sequential              # Run one at a time
 *   node runAllScrapers.js critical                  # Run all critical tier
 *   node runAllScrapers.js critical 0                # Run critical tier batch 0
 *   node runAllScrapers.js standard 1                # Run standard tier batch 1
 */

const ScraperOrchestrator = require('../base/ScraperOrchestrator');

async function main() {
  const args = process.argv.slice(2);

  console.log('Kids Activity Tracker - Scraper Orchestrator');
  console.log('=============================================\n');

  const orchestrator = new ScraperOrchestrator();

  // Check for tier-based running (first arg is a tier name)
  const validTiers = ['critical', 'high', 'standard', 'low'];
  const tierArg = args.find(a => validTiers.includes(a));

  try {
    let results;

    if (tierArg) {
      // Tier-based running
      const dryRun = args.includes('--dry-run');
      const batchArg = args.find(a => /^\d+$/.test(a));
      const batch = batchArg !== undefined ? parseInt(batchArg) : null;

      console.log(`Running tier: ${tierArg}${batch !== null ? `, batch: ${batch}` : ''}`);
      console.log('');

      results = await orchestrator.runByTier(tierArg, {
        batch,
        dryRun,
        batchSize: 5
      });
    } else {
      // Run all scrapers
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

      results = await orchestrator.runAll(options);
    }

    if (results.summary && results.summary.failed > 0) {
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
