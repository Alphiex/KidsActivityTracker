#!/usr/bin/env node

/**
 * comprehensiveValidation.js
 *
 * Validates 5 random activities from each provider by:
 * 1. Fetching random activities from database
 * 2. Opening source URL in Puppeteer
 * 3. Extracting visible data from page
 * 4. Comparing with scraped data
 * 5. Reporting discrepancies
 */

const puppeteer = require('puppeteer');
const { PrismaClient } = require('../../generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Configuration
const ACTIVITIES_PER_PROVIDER = 5;
const SCREENSHOT_DIR = path.join(__dirname, '../validation/screenshots/comprehensive');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Field extraction patterns for different platforms
const extractionPatterns = {
  activenetwork: {
    // ActiveNetwork/ActiveCommunities patterns
    instructor: [
      /Instructor\s+([^\n\t]+)/i,
      /Supervisor\s+([^\n\t]+)/i,
      /Coach\s+([^\n\t]+)/i,
      /Leader\s+([^\n\t]+)/i,
    ],
    sessionCount: /Number of sessions\s+(\d+)/i,
    registrationStatus: [
      { pattern: /Waiting\s*List\s*registration\s*is\s*open/i, status: 'Waitlist' },
      { pattern: /\+\s*Waiting\s*List/i, status: 'Waitlist' },
      { pattern: /Waiting\s*List/i, status: 'Waitlist' },
      { pattern: /\bFull\b/i, status: 'Full' },
      { pattern: /Register\s*Now/i, status: 'Open' },
      { pattern: /Enroll\s*Now/i, status: 'Open' },
    ],
    cost: /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    ageRange: /(?:Age\s+)?(?:at\s+least\s+)?(\d+)\s*(?:yrs?|years?)?\s*(?:but\s+less\s+than|to|-)\s*(\d+)/i,
    dates: /([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})\s*[-–to]+\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/i,
    spotsAvailable: /(\d+)\s+(?:spots?|openings?)\s*(?:available|remaining)/i,
  },
  perfectmind: {
    instructor: [
      /Instructor[:\s]+([^\n]+)/i,
      /Supervisor[:\s]+([^\n]+)/i,
      /Coach[:\s]+([^\n]+)/i,
    ],
    sessionCount: /(\d+)\s+sessions?/i,
    registrationStatus: [
      { pattern: /Waitlist/i, status: 'Waitlist' },
      { pattern: /\bFull\b/i, status: 'Full' },
      { pattern: /Register/i, status: 'Open' },
      { pattern: /Available/i, status: 'Open' },
    ],
    cost: /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    ageRange: /(\d+)\s*[-–to]+\s*(\d+)\s*(?:yrs?|years?)/i,
    dates: /([A-Z][a-z]{2}\s+\d{1,2})\s*[-–to]+\s*([A-Z][a-z]{2}\s+\d{1,2})/i,
    spotsAvailable: /(\d+)\s+(?:spots?|spaces?)\s*(?:available|left)/i,
  }
};

// Extract data from page text using platform-specific patterns
function extractFromPageText(pageText, platform) {
  const patterns = extractionPatterns[platform] || extractionPatterns.activenetwork;
  const extracted = {};

  // Instructor
  if (patterns.instructor) {
    for (const pattern of patterns.instructor) {
      const match = pageText.match(pattern);
      if (match && match[1]?.trim()) {
        const value = match[1].trim();
        if (!/^(TBD|TBA|Staff|N\/A)$/i.test(value)) {
          extracted.instructor = value;
          break;
        }
      }
    }
  }

  // Session count
  if (patterns.sessionCount) {
    const match = pageText.match(patterns.sessionCount);
    if (match) extracted.sessionCount = parseInt(match[1]);
  }

  // Registration status
  if (patterns.registrationStatus) {
    for (const { pattern, status } of patterns.registrationStatus) {
      if (pattern.test(pageText)) {
        extracted.registrationStatus = status;
        break;
      }
    }
  }

  // Cost
  if (patterns.cost) {
    const matches = pageText.match(new RegExp(patterns.cost.source, 'g'));
    if (matches) {
      const costs = matches.map(m => parseFloat(m.replace(/[$,]/g, '')));
      extracted.cost = Math.max(...costs);
    }
  }

  // Age range
  if (patterns.ageRange) {
    const match = pageText.match(patterns.ageRange);
    if (match) {
      extracted.ageMin = parseInt(match[1]);
      extracted.ageMax = parseInt(match[2]);
    }
  }

  // Spots available
  if (patterns.spotsAvailable) {
    const match = pageText.match(patterns.spotsAvailable);
    if (match) extracted.spotsAvailable = parseInt(match[1]);
  }

  return extracted;
}

// Compare extracted data with database data
function compareData(dbActivity, extractedData) {
  const discrepancies = [];

  // Registration status
  if (extractedData.registrationStatus && dbActivity.registrationStatus) {
    if (extractedData.registrationStatus !== dbActivity.registrationStatus) {
      // Special case: if extracted is Waitlist and db is Full, that's a discrepancy
      // Special case: if extracted is Waitlist and db is Open, that's a major discrepancy
      discrepancies.push({
        field: 'registrationStatus',
        expected: extractedData.registrationStatus,
        actual: dbActivity.registrationStatus,
        severity: extractedData.registrationStatus === 'Waitlist' && dbActivity.registrationStatus === 'Open' ? 'high' : 'medium'
      });
    }
  }

  // Spots available - if status is Waitlist/Full but spots > 0, that's wrong
  if (extractedData.registrationStatus === 'Waitlist' || extractedData.registrationStatus === 'Full') {
    if (dbActivity.spotsAvailable && dbActivity.spotsAvailable > 0) {
      discrepancies.push({
        field: 'spotsAvailable',
        expected: 0,
        actual: dbActivity.spotsAvailable,
        severity: 'high',
        note: `Status is ${extractedData.registrationStatus} but spots shows ${dbActivity.spotsAvailable}`
      });
    }
  }

  // Cost comparison (within $1 tolerance)
  if (extractedData.cost !== undefined && dbActivity.cost !== null) {
    if (Math.abs(extractedData.cost - dbActivity.cost) > 1) {
      discrepancies.push({
        field: 'cost',
        expected: extractedData.cost,
        actual: dbActivity.cost,
        severity: 'medium'
      });
    }
  }

  // Instructor - check if DB has TBD but page has actual name
  if (extractedData.instructor && (!dbActivity.instructor || dbActivity.instructor === 'TBD')) {
    discrepancies.push({
      field: 'instructor',
      expected: extractedData.instructor,
      actual: dbActivity.instructor || 'null',
      severity: 'low'
    });
  }

  // Age range
  if (extractedData.ageMin !== undefined && extractedData.ageMax !== undefined) {
    if (dbActivity.ageMin !== extractedData.ageMin || dbActivity.ageMax !== extractedData.ageMax) {
      discrepancies.push({
        field: 'ageRange',
        expected: `${extractedData.ageMin}-${extractedData.ageMax}`,
        actual: `${dbActivity.ageMin}-${dbActivity.ageMax}`,
        severity: 'medium'
      });
    }
  }

  // Session count
  if (extractedData.sessionCount && dbActivity.sessionCount !== extractedData.sessionCount) {
    discrepancies.push({
      field: 'sessionCount',
      expected: extractedData.sessionCount,
      actual: dbActivity.sessionCount,
      severity: 'low'
    });
  }

  return discrepancies;
}

async function validateProvider(browser, provider, activities) {
  const results = [];

  for (const activity of activities) {
    // Use detailUrl or registrationUrl
    const activityUrl = activity.detailUrl || activity.registrationUrl;

    const result = {
      activityId: activity.id,
      activityName: activity.name,
      sourceUrl: activityUrl,
      discrepancies: [],
      error: null,
      screenshotPath: null
    };

    if (!activityUrl) {
      result.error = 'No URL available';
      results.push(result);
      continue;
    }

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });

      // Navigate to activity URL
      await page.goto(activityUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for content to load
      await new Promise(r => setTimeout(r, 3000));

      // Take screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, `${provider.code}_${activity.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      result.screenshotPath = screenshotPath;

      // Extract page text
      const pageText = await page.evaluate(() => document.body.innerText);

      // Extract data from page
      const extractedData = extractFromPageText(pageText, provider.platform);

      // Compare with database
      result.discrepancies = compareData(activity, extractedData);
      result.extractedData = extractedData;
      result.dbData = {
        registrationStatus: activity.registrationStatus,
        spotsAvailable: activity.spotsAvailable,
        cost: activity.cost,
        instructor: activity.instructor,
        ageMin: activity.ageMin,
        ageMax: activity.ageMax,
        sessionCount: activity.sessionCount
      };

      await page.close();
    } catch (error) {
      result.error = error.message;
    }

    results.push(result);

    // Progress indicator
    process.stdout.write('.');
  }

  return results;
}

async function main() {
  console.log('=== Comprehensive Scraper Validation ===\n');

  // Get all providers from config files
  const configDir = path.join(__dirname, '../configs/providers');
  const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));

  const providerConfigs = configFiles.map(f => {
    const config = JSON.parse(fs.readFileSync(path.join(configDir, f)));
    return {
      code: config.code,
      name: config.name,
      platform: config.platform,
      baseUrl: config.baseUrl,
      isActive: config.isActive
    };
  }).filter(p => p.isActive);

  console.log(`Found ${providerConfigs.length} active providers in configs\n`);

  // Get provider IDs from database
  const dbProviders = await prisma.provider.findMany({
    where: { isActive: true },
    select: { id: true, name: true, platform: true }
  });

  // Merge config data with DB data
  const providers = providerConfigs.map(config => {
    const dbProvider = dbProviders.find(db => db.name === config.name);
    return dbProvider ? { ...config, id: dbProvider.id } : null;
  }).filter(Boolean);

  console.log(`Matched ${providers.length} providers with database\n`);

  // Filter to specific providers if needed (for testing)
  const targetProviders = process.argv[2]
    ? providers.filter(p => p.code === process.argv[2])
    : providers;

  if (targetProviders.length === 0) {
    console.log('No matching providers found');
    process.exit(1);
  }

  console.log(`Validating ${targetProviders.length} providers, ${ACTIVITIES_PER_PROVIDER} activities each\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allResults = {};
  const summary = {
    totalProviders: 0,
    totalActivities: 0,
    totalDiscrepancies: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lowSeverity: 0,
    errors: 0,
    byField: {}
  };

  for (const provider of targetProviders) {
    console.log(`\n[${provider.code}] ${provider.name} (${provider.platform})`);
    process.stdout.write('  Validating: ');

    // Get random activities for this provider
    // Use registrationUrl or detailUrl - different providers use different fields
    const activities = await prisma.activity.findMany({
      where: {
        providerId: provider.id,
        isActive: true,
        OR: [
          { detailUrl: { not: null } },
          { registrationUrl: { not: null } }
        ]
      },
      orderBy: { id: 'asc' },
      take: 100 // Get more, then randomly sample
    });

    if (activities.length === 0) {
      console.log('No activities found');
      continue;
    }

    // Randomly sample
    const sampled = [];
    const indices = new Set();
    while (sampled.length < Math.min(ACTIVITIES_PER_PROVIDER, activities.length)) {
      const idx = Math.floor(Math.random() * activities.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        sampled.push(activities[idx]);
      }
    }

    // Validate activities
    const results = await validateProvider(browser, provider, sampled);
    allResults[provider.code] = results;

    // Count discrepancies
    let providerDiscrepancies = 0;
    for (const result of results) {
      summary.totalActivities++;
      if (result.error) {
        summary.errors++;
      }
      for (const disc of result.discrepancies) {
        providerDiscrepancies++;
        summary.totalDiscrepancies++;
        if (disc.severity === 'high') summary.highSeverity++;
        else if (disc.severity === 'medium') summary.mediumSeverity++;
        else summary.lowSeverity++;

        summary.byField[disc.field] = (summary.byField[disc.field] || 0) + 1;
      }
    }

    summary.totalProviders++;
    console.log(` ${results.length} activities, ${providerDiscrepancies} discrepancies`);
  }

  await browser.close();

  // Generate report
  console.log('\n\n=== VALIDATION SUMMARY ===');
  console.log(`Providers validated: ${summary.totalProviders}`);
  console.log(`Activities validated: ${summary.totalActivities}`);
  console.log(`Total discrepancies: ${summary.totalDiscrepancies}`);
  console.log(`  - High severity: ${summary.highSeverity}`);
  console.log(`  - Medium severity: ${summary.mediumSeverity}`);
  console.log(`  - Low severity: ${summary.lowSeverity}`);
  console.log(`Errors (couldn't validate): ${summary.errors}`);

  console.log('\nDiscrepancies by field:');
  for (const [field, count] of Object.entries(summary.byField).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count}`);
  }

  // Save detailed results
  const reportPath = path.join(SCREENSHOT_DIR, `validation_report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ summary, results: allResults }, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);

  // Show high-severity discrepancies
  console.log('\n=== HIGH SEVERITY DISCREPANCIES ===');
  for (const [providerCode, results] of Object.entries(allResults)) {
    for (const result of results) {
      const highDiscs = result.discrepancies.filter(d => d.severity === 'high');
      if (highDiscs.length > 0) {
        console.log(`\n[${providerCode}] ${result.activityName}`);
        console.log(`  URL: ${result.sourceUrl}`);
        for (const disc of highDiscs) {
          console.log(`  ${disc.field}: expected "${disc.expected}", got "${disc.actual}"${disc.note ? ` (${disc.note})` : ''}`);
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
