#!/usr/bin/env node
/**
 * Run scrapers by tier and batch
 *
 * Usage:
 *   node runByTier.js <tier> [batch]
 *   node runByTier.js critical       # Run all critical tier scrapers
 *   node runByTier.js critical 0     # Run batch 0 of critical tier
 *   node runByTier.js standard 1     # Run batch 1 of standard tier
 *   node runByTier.js --schedule     # Show schedule info
 */

const ScraperOrchestrator = require('../base/ScraperOrchestrator');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Scraper Tier Runner
===================

Usage:
  node runByTier.js <tier> [batch]

Tiers:
  critical  - Major cities (3x daily)
  high      - High-traffic cities
  standard  - Standard cities (2x daily)
  low       - Small communities (1x daily)

Options:
  --schedule  Show tier schedule information
  --dry-run   Test without actually scraping

Examples:
  node runByTier.js critical         # Run all critical tier
  node runByTier.js critical 0       # Run batch 0 of critical
  node runByTier.js standard --dry-run
`);
    process.exit(0);
  }

  const orchestrator = new ScraperOrchestrator();

  // Show schedule info
  if (args.includes('--schedule')) {
    const schedule = orchestrator.getTierSchedule(5);
    console.log('\nScraper Schedule by Tier');
    console.log('='.repeat(50));

    for (const [tier, info] of Object.entries(schedule)) {
      console.log(`\n${tier.toUpperCase()} (${info.total} providers, ${info.batches} batches):`);
      info.providers.forEach((batch, idx) => {
        console.log(`  Batch ${idx}: ${batch.join(', ')}`);
      });
    }

    console.log('\n\nSuggested Schedule:');
    console.log('-'.repeat(50));
    console.log('Critical (24 providers, 5 batches) - 3x daily:');
    console.log('  06:00 UTC - Batch 0');
    console.log('  06:30 UTC - Batch 1');
    console.log('  07:00 UTC - Batch 2');
    console.log('  07:30 UTC - Batch 3');
    console.log('  08:00 UTC - Batch 4');
    console.log('  14:00 UTC - Batch 0 (run 2)');
    console.log('  14:30 UTC - Batch 1 (run 2)');
    console.log('  ... etc');
    console.log('');
    console.log('Standard (20 providers, 4 batches) - 2x daily:');
    console.log('  10:00 UTC - Batch 0');
    console.log('  10:30 UTC - Batch 1');
    console.log('  11:00 UTC - Batch 2');
    console.log('  11:30 UTC - Batch 3');
    console.log('  18:00 UTC - Batch 0 (run 2)');
    console.log('  ... etc');
    console.log('');
    console.log('Low (5 providers, 1 batch) - 1x daily:');
    console.log('  04:00 UTC - All');

    process.exit(0);
  }

  const tier = args[0];
  const validTiers = ['critical', 'high', 'standard', 'low'];

  if (!validTiers.includes(tier)) {
    console.error(`Invalid tier: ${tier}`);
    console.error(`Valid tiers: ${validTiers.join(', ')}`);
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const batchArg = args.find(a => /^\d+$/.test(a));
  const batch = batchArg !== undefined ? parseInt(batchArg) : null;

  try {
    const result = await orchestrator.runByTier(tier, {
      batch,
      dryRun,
      batchSize: 5
    });

    console.log('\n' + '='.repeat(60));
    console.log('RUN COMPLETE');
    console.log('='.repeat(60));
    console.log(`Tier: ${tier}`);
    if (batch !== null) console.log(`Batch: ${batch}`);
    console.log(`Duration: ${result.durationMinutes} minutes`);
    console.log(`Success: ${result.summary.successful}/${result.summary.total}`);
    console.log(`Activities: ${result.summary.activitiesFound} found, ${result.summary.activitiesCreated} new, ${result.summary.activitiesUpdated} updated`);

    if (result.summary.failed > 0) {
      console.log(`\nFailed scrapers:`);
      result.providers
        .filter(p => !p.success)
        .forEach(p => console.log(`  - ${p.provider}: ${p.error}`));
    }

    process.exit(result.summary.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
