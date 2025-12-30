#!/usr/bin/env node

/**
 * reviewDiscrepancies.js
 *
 * CLI script to review and analyze validation discrepancies.
 * Groups issues by field, provider, and severity to identify patterns.
 *
 * Usage:
 *   node reviewDiscrepancies.js [options]
 *
 * Options:
 *   --run ID          Review specific validation run
 *   --field NAME      Filter by field (e.g., dateStart, cost)
 *   --severity LEVEL  Filter by severity (critical, high, medium, low)
 *   --platform NAME   Filter by platform
 *   --export FILE     Export discrepancies to JSON file
 *   --interactive     Interactive review mode
 */

const path = require('path');
const readline = require('readline');
const { PrismaClient } = require('../../generated/prisma');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    runId: null,
    field: null,
    severity: null,
    platform: null,
    export: null,
    interactive: false,
    limit: 100,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--run':
        options.runId = args[++i];
        break;
      case '--field':
        options.field = args[++i];
        break;
      case '--severity':
        options.severity = args[++i];
        break;
      case '--platform':
        options.platform = args[++i];
        break;
      case '--export':
        options.export = args[++i];
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
      case '--limit':
        options.limit = parseInt(args[++i]) || 100;
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
Discrepancy Review Tool
=======================

Usage: node reviewDiscrepancies.js [options]

Options:
  --run ID            Review specific validation run
  --field NAME        Filter by field (dateStart, cost, dayOfWeek, etc.)
  --severity LEVEL    Filter by severity (critical, high, medium, low)
  --platform NAME     Filter by platform (PerfectMind, ActiveNetwork, etc.)
  --export FILE       Export discrepancies to JSON file
  -i, --interactive   Interactive review mode
  --limit N           Limit results (default: 100)
  -h, --help          Show this help message

Examples:
  # Review all discrepancies from latest run
  node reviewDiscrepancies.js

  # Review only critical date issues
  node reviewDiscrepancies.js --field dateStart --severity critical

  # Interactive review for PerfectMind
  node reviewDiscrepancies.js --platform PerfectMind --interactive
`);
}

async function main() {
  const options = parseArgs();
  const prisma = new PrismaClient();

  console.log('\n=== Discrepancy Review Tool ===\n');

  try {
    // Get validation run(s) to analyze
    let runId = options.runId;

    if (!runId) {
      // Get the latest completed run
      const latestRun = await prisma.validationRun.findFirst({
        where: { status: 'completed' },
        orderBy: { completedAt: 'desc' },
      });

      if (!latestRun) {
        console.log('No completed validation runs found. Run validation first:');
        console.log('  node runValidation.js --samples 50\n');
        return;
      }

      runId = latestRun.id;
      console.log(`Analyzing latest run: ${runId}`);
      console.log(`  Completed: ${latestRun.completedAt?.toLocaleString()}`);
      console.log(`  Results: ${latestRun.totalValidated} validated, ${latestRun.passCount} passed, ${latestRun.failCount} failed\n`);
    }

    // Fetch results with discrepancies
    const whereClause = {
      validationRunId: runId,
      status: { in: ['FAILED', 'NEEDS_REVIEW'] },
    };

    const results = await prisma.validationResult.findMany({
      where: whereClause,
      include: {
        activity: {
          include: { provider: true },
        },
      },
      take: options.limit,
    });

    if (results.length === 0) {
      console.log('No discrepancies found. All validations passed!');
      return;
    }

    console.log(`Found ${results.length} results with discrepancies\n`);

    // Filter and analyze
    const discrepancies = extractDiscrepancies(results, options);

    // Show summary by field
    console.log('=== Discrepancies by Field ===\n');
    const byField = groupByField(discrepancies);
    for (const [field, items] of Object.entries(byField).sort((a, b) => b[1].length - a[1].length)) {
      const severityCounts = countBySeverity(items);
      console.log(`  ${formatFieldName(field)}: ${items.length} issues`);
      console.log(`    Critical: ${severityCounts.critical}, High: ${severityCounts.high}, Medium: ${severityCounts.medium}, Low: ${severityCounts.low}`);
    }

    // Show summary by provider
    console.log('\n=== Discrepancies by Provider ===\n');
    const byProvider = groupByProvider(discrepancies);
    for (const [provider, items] of Object.entries(byProvider).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${provider}: ${items.length} issues`);
    }

    // Show critical issues in detail
    const criticalIssues = discrepancies.filter(d => d.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.log('\n=== Critical Issues (Top 10) ===\n');
      for (const issue of criticalIssues.slice(0, 10)) {
        console.log(`  Activity: ${issue.activityName}`);
        console.log(`  Provider: ${issue.provider}`);
        console.log(`  Field: ${formatFieldName(issue.field)}`);
        console.log(`  Expected: ${issue.expected}`);
        console.log(`  Actual: ${issue.actual}`);
        console.log(`  URL: ${issue.sourceUrl || 'N/A'}`);
        console.log('');
      }
    }

    // Export if requested
    if (options.export) {
      const exportData = {
        runId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalDiscrepancies: discrepancies.length,
          byField,
          byProvider,
        },
        discrepancies,
      };

      const fs = require('fs').promises;
      await fs.writeFile(options.export, JSON.stringify(exportData, null, 2));
      console.log(`\nExported to: ${options.export}`);
    }

    // Interactive mode
    if (options.interactive) {
      await interactiveReview(prisma, results, discrepancies);
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function extractDiscrepancies(results, options) {
  const discrepancies = [];

  for (const result of results) {
    const discArray = result.discrepancies;
    if (!Array.isArray(discArray)) continue;

    for (const d of discArray) {
      // Apply filters
      if (options.field && d.field !== options.field) continue;
      if (options.severity && d.severity !== options.severity) continue;
      if (options.platform && result.activity?.provider?.platform !== options.platform) continue;

      discrepancies.push({
        resultId: result.id,
        activityId: result.activityId,
        activityName: result.parsedData?.name || 'Unknown',
        provider: result.activity?.provider?.name || 'Unknown',
        platform: result.activity?.provider?.platform || 'Unknown',
        sourceUrl: result.sourceUrl,
        field: d.field,
        expected: d.expected,
        actual: d.actual,
        severity: d.severity,
        notes: d.notes,
      });
    }
  }

  return discrepancies;
}

function groupByField(discrepancies) {
  const groups = {};
  for (const d of discrepancies) {
    if (!groups[d.field]) groups[d.field] = [];
    groups[d.field].push(d);
  }
  return groups;
}

function groupByProvider(discrepancies) {
  const groups = {};
  for (const d of discrepancies) {
    if (!groups[d.provider]) groups[d.provider] = [];
    groups[d.provider].push(d);
  }
  return groups;
}

function countBySeverity(items) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of items) {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
  }
  return counts;
}

function formatFieldName(field) {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

async function interactiveReview(prisma, results, discrepancies) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n=== Interactive Review Mode ===');
  console.log('Commands: (n)ext, (p)rev, (c)onfirm, (r)eject, (s)kip, (q)uit\n');

  let index = 0;
  const resultList = results.filter(r => r.discrepancies?.length > 0);

  while (index < resultList.length) {
    const result = resultList[index];
    const activity = result.parsedData;

    console.log(`\n--- Result ${index + 1}/${resultList.length} ---`);
    console.log(`Activity: ${activity?.name || 'Unknown'}`);
    console.log(`Course ID: ${activity?.courseId || 'N/A'}`);
    console.log(`Provider: ${result.activity?.provider?.name}`);
    console.log(`Match Score: ${result.matchScore}%`);
    console.log(`Status: ${result.status}`);
    console.log(`URL: ${result.sourceUrl || 'N/A'}`);

    console.log('\nDiscrepancies:');
    const discArray = result.discrepancies || [];
    for (const d of discArray) {
      console.log(`  [${d.severity.toUpperCase()}] ${formatFieldName(d.field)}`);
      console.log(`    Expected: ${d.expected}`);
      console.log(`    Actual: ${d.actual}`);
    }

    const cmd = await question('\nCommand (n/p/c/r/s/q): ');

    switch (cmd.toLowerCase()) {
      case 'n':
        index++;
        break;
      case 'p':
        index = Math.max(0, index - 1);
        break;
      case 'c':
        // Confirm discrepancy (mark as reviewed)
        await prisma.validationResult.update({
          where: { id: result.id },
          data: {
            reviewedAt: new Date(),
            reviewedBy: 'manual',
            isConfirmed: true,
          },
        });
        console.log('Marked as confirmed (discrepancy is valid)');
        index++;
        break;
      case 'r':
        // Reject discrepancy (false positive)
        await prisma.validationResult.update({
          where: { id: result.id },
          data: {
            reviewedAt: new Date(),
            reviewedBy: 'manual',
            isConfirmed: false,
            reviewNotes: 'False positive - marked as rejected',
          },
        });
        console.log('Marked as rejected (false positive)');
        index++;
        break;
      case 's':
        index++;
        break;
      case 'q':
        console.log('Exiting review mode');
        rl.close();
        return;
      default:
        console.log('Unknown command');
    }
  }

  console.log('\nReview complete!');
  rl.close();
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
