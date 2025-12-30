#!/usr/bin/env node

/**
 * runValidation.js
 *
 * CLI script to run scraper validation.
 * Samples activities, captures screenshots, extracts data with Claude AI,
 * compares with parsed data, and generates reports.
 *
 * Usage:
 *   node runValidation.js [options]
 *
 * Options:
 *   --samples N       Number of activities to sample (default: 50)
 *   --platform NAME   Filter by platform (e.g., PerfectMind, ActiveNetwork)
 *   --provider ID     Filter by specific provider ID
 *   --skip-screenshots Skip screenshot capture (use existing)
 *   --skip-extraction  Skip AI extraction (use existing)
 *   --dry-run         Show sampling plan without executing
 *   --report-only     Only generate reports from existing data
 */

const path = require('path');
const { PrismaClient } = require('../../generated/prisma');
const ValidationSampler = require('../validation/ValidationSampler');
const ScreenshotCapture = require('../validation/ScreenshotCapture');
const ClaudeVisionExtractor = require('../validation/ClaudeVisionExtractor');
const DataComparator = require('../validation/DataComparator');
const ReportGenerator = require('../validation/ReportGenerator');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    samples: 50,
    platform: null,
    providerId: null,
    skipScreenshots: false,
    skipExtraction: false,
    dryRun: false,
    reportOnly: false,
    runId: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--samples':
      case '-n':
        options.samples = parseInt(args[++i]) || 50;
        break;
      case '--platform':
      case '-p':
        options.platform = args[++i];
        break;
      case '--provider':
        options.providerId = args[++i];
        break;
      case '--skip-screenshots':
        options.skipScreenshots = true;
        break;
      case '--skip-extraction':
        options.skipExtraction = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--report-only':
        options.reportOnly = true;
        options.runId = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Scraper Validation Tool
=======================

Usage: node runValidation.js [options]

Options:
  -n, --samples N       Number of activities to sample (default: 50)
  -p, --platform NAME   Filter by platform (PerfectMind, ActiveNetwork, etc.)
  --provider ID         Filter by specific provider ID
  --skip-screenshots    Skip screenshot capture (use existing)
  --skip-extraction     Skip AI extraction (use existing)
  --dry-run             Show sampling plan without executing
  --report-only ID      Generate report from existing run ID
  -h, --help            Show this help message

Examples:
  # Validate 100 random activities
  node runValidation.js --samples 100

  # Validate only PerfectMind activities
  node runValidation.js --platform PerfectMind --samples 50

  # Dry run to see sampling plan
  node runValidation.js --samples 200 --dry-run
`);
}

async function main() {
  const options = parseArgs();
  const prisma = new PrismaClient();

  console.log('\n=== Scraper Validation Tool ===\n');
  console.log('Options:', JSON.stringify(options, null, 2), '\n');

  try {
    // Initialize components
    const sampler = new ValidationSampler({ prisma });
    const screenshotCapture = new ScreenshotCapture();
    const extractor = new ClaudeVisionExtractor();
    const comparator = new DataComparator();
    const reportGenerator = new ReportGenerator();

    // Report-only mode
    if (options.reportOnly) {
      console.log('Generating report from existing run:', options.runId);
      await generateReportFromRun(prisma, options.runId, reportGenerator);
      return;
    }

    // Create validation run record
    const validationRun = await prisma.validationRun.create({
      data: {
        platform: options.platform,
        providerId: options.providerId,
        status: 'running',
        sampleSize: options.samples,
        startedAt: new Date(),
        triggeredBy: 'manual',
      },
    });

    console.log(`Created validation run: ${validationRun.id}\n`);

    // Step 1: Sample activities
    console.log('=== Step 1: Sampling Activities ===');
    const sampledActivities = await sampler.sampleProportionally(options.samples, {
      platform: options.platform,
      providerId: options.providerId,
    });

    console.log(`\nSampled ${sampledActivities.length} activities\n`);

    if (options.dryRun) {
      console.log('Dry run complete. Exiting without executing.');
      await prisma.validationRun.update({
        where: { id: validationRun.id },
        data: { status: 'cancelled', totalSampled: sampledActivities.length },
      });
      return;
    }

    await prisma.validationRun.update({
      where: { id: validationRun.id },
      data: { totalSampled: sampledActivities.length },
    });

    // Step 2: Capture screenshots
    let screenshots = [];
    if (!options.skipScreenshots) {
      console.log('=== Step 2: Capturing Screenshots ===');
      screenshots = await screenshotCapture.captureMany(sampledActivities, {
        onProgress: ({ completed, total, percent }) => {
          process.stdout.write(`\r  Progress: ${completed}/${total} (${percent}%)`);
        },
      });
      console.log('\n');

      const successfulScreenshots = screenshots.filter(s => s.success);
      console.log(`Captured ${successfulScreenshots.length} screenshots successfully`);
      console.log(`Failed: ${screenshots.length - successfulScreenshots.length}\n`);
    } else {
      console.log('Skipping screenshot capture (using existing)\n');
      // Load existing screenshots - would need path mapping
    }

    // Step 3: Extract data with Claude AI
    let extractions = [];
    if (!options.skipExtraction) {
      console.log('=== Step 3: Extracting Data with Claude AI ===');

      const screenshotData = screenshots
        .filter(s => s.success)
        .map(s => {
          const activity = sampledActivities.find(a => a.id === s.activityId);
          return {
            ...s,
            name: activity?.name,
            platform: activity?.platform,
            courseId: activity?.courseId,
          };
        });

      extractions = await extractor.extractMany(screenshotData, {
        onProgress: ({ completed, total, percent }) => {
          process.stdout.write(`\r  Progress: ${completed}/${total} (${percent}%)`);
        },
      });
      console.log('\n');

      const usage = extractor.getUsageStats();
      console.log(`API Usage: ${usage.totalInputTokens} input tokens, ${usage.totalOutputTokens} output tokens`);
      console.log(`Estimated cost: $${usage.totalCost.toFixed(4)}\n`);

      await prisma.validationRun.update({
        where: { id: validationRun.id },
        data: { totalApiCost: usage.totalCost },
      });
    } else {
      console.log('Skipping AI extraction (using existing)\n');
    }

    // Step 4: Compare data
    console.log('=== Step 4: Comparing Data ===');
    const results = [];

    for (const extraction of extractions) {
      const activity = sampledActivities.find(a => a.id === extraction.activityId);
      if (!activity) continue;

      let comparisonResult = null;
      let status = 'ERROR';

      if (extraction.success && extraction.extractedData) {
        comparisonResult = comparator.compare(extraction.extractedData, activity);

        // Determine status
        if (comparisonResult.matchScore >= 90) {
          status = 'PASSED';
        } else if (comparisonResult.matchScore >= 70 || comparisonResult.discrepancies.some(d => d.severity === 'critical')) {
          status = 'NEEDS_REVIEW';
        } else {
          status = 'FAILED';
        }
      }

      const result = {
        activityId: activity.id,
        providerId: activity.providerId,
        providerName: activity.providerName,
        platform: activity.platform,
        sourceUrl: activity.detailUrl || activity.registrationUrl,
        screenshotPath: extraction.screenshotPath,
        extractedData: extraction.extractedData,
        parsedData: activity,
        status,
        matchScore: comparisonResult?.matchScore || 0,
        fieldResults: comparisonResult?.fieldResults || {},
        discrepancies: comparisonResult?.discrepancies || [],
        apiCost: extraction.cost || 0,
        errorMessage: extraction.error,
      };

      results.push(result);

      // Save to database
      await prisma.validationResult.create({
        data: {
          validationRunId: validationRun.id,
          activityId: activity.id,
          providerId: activity.providerId,
          sourceUrl: result.sourceUrl,
          screenshotPath: result.screenshotPath,
          extractedData: result.extractedData,
          parsedData: result.parsedData,
          discrepancies: result.discrepancies,
          status,
          matchScore: result.matchScore,
          fieldResults: result.fieldResults,
          apiCost: result.apiCost,
          errorMessage: result.errorMessage,
        },
      });
    }

    // Calculate summary stats
    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const needsReview = results.filter(r => r.status === 'NEEDS_REVIEW').length;
    const errors = results.filter(r => r.status === 'ERROR').length;

    console.log('\nComparison Results:');
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Needs Review: ${needsReview}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Overall Accuracy: ${Math.round((passed / results.length) * 100)}%\n`);

    // Step 5: Generate reports
    console.log('=== Step 5: Generating Reports ===');
    const { jsonPath, htmlPath } = await reportGenerator.generateReport(validationRun, results);
    console.log(`  JSON Report: ${jsonPath}`);
    console.log(`  HTML Report: ${htmlPath}\n`);

    // Update validation run
    await prisma.validationRun.update({
      where: { id: validationRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        totalValidated: results.length,
        passCount: passed,
        failCount: failed,
        needsReviewCount: needsReview,
        errorCount: errors,
        overallAccuracy: results.length > 0 ? (passed / results.length) * 100 : 0,
      },
    });

    console.log('=== Validation Complete ===');
    console.log(`Run ID: ${validationRun.id}`);
    console.log(`View HTML report: file://${htmlPath}`);

    // Cleanup
    await screenshotCapture.close();
    await sampler.close();

  } catch (error) {
    console.error('Validation failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function generateReportFromRun(prisma, runId, reportGenerator) {
  const run = await prisma.validationRun.findUnique({
    where: { id: runId },
    include: {
      results: {
        include: {
          activity: {
            include: { provider: true },
          },
        },
      },
    },
  });

  if (!run) {
    console.error(`Validation run not found: ${runId}`);
    return;
  }

  const results = run.results.map(r => ({
    ...r,
    providerName: r.activity?.provider?.name,
    platform: r.activity?.provider?.platform,
  }));

  const { jsonPath, htmlPath } = await reportGenerator.generateReport(run, results);
  console.log(`Generated reports:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  HTML: ${htmlPath}`);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
