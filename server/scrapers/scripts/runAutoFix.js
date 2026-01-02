#!/usr/bin/env node
/**
 * Auto-Fix CLI
 *
 * Automatically identifies and fixes scraper issues using LLM analysis.
 *
 * Usage:
 *   node runAutoFix.js                    # Dry run (preview changes)
 *   node runAutoFix.js --apply            # Apply fixes
 *   node runAutoFix.js --analyze          # Only analyze discrepancies
 *   node runAutoFix.js --platform=amilia  # Fix specific platform
 *   node runAutoFix.js --field=instructor # Fix specific field
 *
 * Options:
 *   --apply         Actually apply the fixes (default: dry run)
 *   --analyze       Only analyze, don't discover or patch
 *   --platform=X    Only fix specific platform
 *   --field=X       Only fix specific field
 *   --max=N         Maximum number of fields to fix (default: 5)
 *   --no-validate   Skip validation step
 *   --verbose       Show detailed output
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const AutoFixPipeline = require('../validation/AutoFixPipeline');
const DiscrepancyAnalyzer = require('../validation/DiscrepancyAnalyzer');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    apply: false,
    analyze: false,
    platform: null,
    field: null,
    max: 5,
    validate: true,
    verbose: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--analyze') {
      options.analyze = true;
    } else if (arg === '--no-validate') {
      options.validate = false;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--platform=')) {
      options.platform = arg.split('=')[1];
    } else if (arg.startsWith('--field=')) {
      options.field = arg.split('=')[1];
    } else if (arg.startsWith('--max=')) {
      options.max = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

// Print help
function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                     SCRAPER AUTO-FIX TOOL                        ║
╚══════════════════════════════════════════════════════════════════╝

Automatically identifies and fixes scraper issues using LLM analysis.

USAGE:
  node runAutoFix.js [options]

OPTIONS:
  --apply           Apply fixes to scraper files (default: dry run)
  --analyze         Only analyze discrepancies, don't fix anything
  --platform=NAME   Only fix specific platform (e.g., amilia, perfectmind)
  --field=NAME      Only fix specific field (e.g., instructor, sessionCount)
  --max=N           Maximum number of fields to fix (default: 5)
  --no-validate     Skip validation step (faster but riskier)
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

EXAMPLES:
  # Preview what would be fixed (dry run)
  node runAutoFix.js

  # Actually apply the fixes
  node runAutoFix.js --apply

  # Only analyze discrepancies
  node runAutoFix.js --analyze

  # Fix only the instructor field for Amilia scrapers
  node runAutoFix.js --platform=amilia --field=instructor --apply

  # Fix up to 10 fields without validation
  node runAutoFix.js --max=10 --no-validate --apply

FIELDS THAT CAN BE FIXED:
  • instructor       - Staff/teacher name
  • sessionCount     - Number of sessions/classes
  • cost             - Price/fee amount
  • registrationStatus - Open/Full/Waitlist/Closed
  • spotsAvailable   - Available spots
  • ageMin/ageMax    - Age requirements
  • location         - Facility name

SUPPORTED PLATFORMS:
  • perfectmind
  • activenetwork
  • amilia
  • ic3
  • webtrac
  • intelligenz
  • qidigo

NOTE:
  Requires ANTHROPIC_API_KEY environment variable to be set.
  Each fix costs approximately $0.01-0.05 in API calls.
`);
}

// Main function
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Check for API key (not needed for analyze-only mode)
  if (!process.env.ANTHROPIC_API_KEY && !options.analyze) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('   Set it in server/.env or export it in your shell');
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                     SCRAPER AUTO-FIX TOOL                        ║
╚══════════════════════════════════════════════════════════════════╝
`);

  // Analysis only mode
  if (options.analyze) {
    console.log('Running in ANALYZE ONLY mode...\n');

    const analyzer = new DiscrepancyAnalyzer();
    const PlatformAnalyzer = require('../validation/PlatformAnalyzer');
    const platformAnalyzer = new PlatformAnalyzer();

    const analysis = await analyzer.analyze();

    console.log(analyzer.generateReport(analysis));

    // Generate and show routing plan
    const routingPlan = await platformAnalyzer.generateFixRoutingPlan(analysis);

    console.log('\nFIX ROUTING ANALYSIS:');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`  Platform-level fixes: ${routingPlan.platformFixes.length}`);
    console.log(`  Provider-specific fixes: ${routingPlan.providerFixes.length}`);
    console.log(`  Need manual review: ${routingPlan.manualReview.length}`);

    if (routingPlan.platformFixes.length > 0) {
      console.log('\n  PLATFORM FIXES (will patch base scraper):');
      for (const fix of routingPlan.platformFixes) {
        const pct = Math.round(fix.affectedRatio * 100);
        console.log(`    • ${fix.field} → ${fix.platform} scraper (${pct}% of ${fix.affectedProviders.length} providers)`);
      }
    }

    if (routingPlan.providerFixes.length > 0) {
      console.log('\n  PROVIDER FIXES (will patch extensions):');
      for (const fix of routingPlan.providerFixes.slice(0, 5)) {
        const status = fix.hasExtension ? '✓ exists' : '⚠ needs creation';
        console.log(`    • ${fix.field} → ${fix.provider} [${status}]`);
      }
      if (routingPlan.providerFixes.length > 5) {
        console.log(`    ... and ${routingPlan.providerFixes.length - 5} more`);
      }
    }

    if (routingPlan.manualReview.length > 0) {
      console.log('\n  NEEDS MANUAL REVIEW:');
      for (const item of routingPlan.manualReview.slice(0, 3)) {
        console.log(`    • ${item.field} on ${item.platform}: ${item.recommendation}`);
      }
    }

    console.log('');
    process.exit(0);
  }

  // Create pipeline
  const pipeline = new AutoFixPipeline({
    dryRun: !options.apply,
    requireValidation: options.validate,
    maxFieldsToFix: options.max,
  });

  console.log(`Mode: ${options.apply ? '🔧 APPLY FIXES' : '👀 DRY RUN (preview only)'}`);
  if (options.platform) console.log(`Platform: ${options.platform}`);
  if (options.field) console.log(`Field: ${options.field}`);
  console.log(`Max fixes: ${options.max}`);
  console.log(`Validation: ${options.validate ? 'enabled' : 'disabled'}`);
  console.log('');

  try {
    const results = await pipeline.run({
      platform: options.platform,
      field: options.field,
      maxFixes: options.max,
      dryRun: !options.apply,
    });

    // Detailed output in verbose mode
    if (options.verbose && results.fixes?.length > 0) {
      console.log('\n📋 DETAILED FIX INFORMATION:');
      console.log('───────────────────────────────────────────────────────────────');
      for (const fix of results.fixes) {
        console.log(`\nField: ${fix.field}`);
        console.log(`  Selector: ${fix.selector}`);
        console.log(`  Confidence: ${fix.confidence}%`);
        console.log(`  Provider: ${fix.provider || 'unknown'}`);
        if (fix.alternativeSelectors?.length) {
          console.log(`  Alternatives: ${fix.alternativeSelectors.join(', ')}`);
        }
        if (fix.validation) {
          console.log(`  Validation accuracy: ${Math.round(fix.validation.accuracy * 100)}%`);
        }
      }
    }

    // Exit code based on success
    const success = results.summary?.fixesApplied > 0 ||
                   (options.apply === false && results.fixes?.length > 0);

    if (!options.apply && results.fixes?.length > 0) {
      console.log('\n💡 To apply these fixes, run with --apply flag');
    }

    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
