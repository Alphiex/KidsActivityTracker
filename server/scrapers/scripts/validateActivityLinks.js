#!/usr/bin/env node
/**
 * Validate activity registration URLs
 * Checks that all activity links return valid responses
 */

const { PrismaClient } = require('../../generated/prisma');
const axios = require('axios');
const fs = require('fs').promises;

const prisma = new PrismaClient();

async function validateActivityLinks() {
  console.log('Activity Link Validation');
  console.log('========================\n');

  // Get all active activities with registration URLs
  const activities = await prisma.activity.findMany({
    where: {
      isActive: true,
      registrationUrl: { not: null }
    },
    select: {
      id: true,
      name: true,
      registrationUrl: true,
      provider: { select: { name: true, id: true } }
    }
  });

  console.log(`Found ${activities.length} activities with registration URLs\n`);

  const results = {
    valid: 0,
    invalid: [],
    errors: [],
    byProvider: {}
  };

  // Group by provider for efficient validation
  const byProvider = {};
  activities.forEach(activity => {
    const providerName = activity.provider.name;
    if (!byProvider[providerName]) {
      byProvider[providerName] = [];
    }
    byProvider[providerName].push(activity);
  });

  // Validate sample from each provider (to avoid hitting rate limits)
  const sampleSize = parseInt(process.argv[2]) || 5; // Default sample size per provider

  for (const [providerName, providerActivities] of Object.entries(byProvider)) {
    console.log(`\nValidating ${providerName} (sampling ${Math.min(sampleSize, providerActivities.length)}/${providerActivities.length})...`);

    results.byProvider[providerName] = {
      total: providerActivities.length,
      sampled: 0,
      valid: 0,
      invalid: 0,
      errors: 0
    };

    // Take a random sample
    const sample = providerActivities
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);

    for (const activity of sample) {
      results.byProvider[providerName].sampled++;

      try {
        const response = await axios.head(activity.registrationUrl, {
          timeout: 15000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500 // Accept 2xx, 3xx, 4xx
        });

        if (response.status >= 200 && response.status < 400) {
          results.valid++;
          results.byProvider[providerName].valid++;
        } else {
          results.invalid.push({
            id: activity.id,
            name: activity.name,
            provider: providerName,
            url: activity.registrationUrl,
            status: response.status
          });
          results.byProvider[providerName].invalid++;
        }
      } catch (error) {
        // Check for specific error types
        const errorType = error.code || error.message.substring(0, 50);
        results.errors.push({
          id: activity.id,
          name: activity.name,
          provider: providerName,
          url: activity.registrationUrl,
          error: errorType
        });
        results.byProvider[providerName].errors++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    }

    const stats = results.byProvider[providerName];
    const validPct = ((stats.valid / stats.sampled) * 100).toFixed(1);
    console.log(`  ✓ ${stats.valid}/${stats.sampled} valid (${validPct}%)`);
  }

  // Summary
  console.log('\n\n========== VALIDATION SUMMARY ==========');
  console.log(`Total activities with URLs: ${activities.length}`);
  console.log(`Sampled: ${Object.values(results.byProvider).reduce((sum, p) => sum + p.sampled, 0)}`);
  console.log(`Valid: ${results.valid}`);
  console.log(`Invalid (4xx responses): ${results.invalid.length}`);
  console.log(`Errors (timeouts, etc): ${results.errors.length}`);

  // Show invalid URLs
  if (results.invalid.length > 0) {
    console.log('\n--- Invalid URLs (4xx responses) ---');
    results.invalid.slice(0, 10).forEach(r => {
      console.log(`  [${r.status}] ${r.provider}: ${r.name}`);
      console.log(`       ${r.url}`);
    });
    if (results.invalid.length > 10) {
      console.log(`  ... and ${results.invalid.length - 10} more`);
    }
  }

  // Show errors
  if (results.errors.length > 0) {
    console.log('\n--- Errors ---');
    results.errors.slice(0, 10).forEach(r => {
      console.log(`  [${r.error}] ${r.provider}: ${r.name}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more`);
    }
  }

  // Save detailed results
  const reportPath = `./validation-results-${new Date().toISOString().split('T')[0]}.json`;
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}`);

  await prisma.$disconnect();
}

validateActivityLinks().catch(console.error);
