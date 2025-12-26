#!/usr/bin/env node

const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

async function test() {
  const prisma = new PrismaClient();
  const config = require('../scrapers/configs/providers/edmonton.json');
  const scraper = ScraperFactory.createScraper(config);
  scraper.prisma = prisma;

  const result = await scraper.scrape();
  const activities = result.activities;

  console.log('\n=== EDMONTON FIELD COVERAGE ===');
  console.log('Total activities:', activities.length);

  // Count non-null values for each field
  const fields = [
    'name', 'externalId', 'category', 'subcategory', 'description',
    'dateStart', 'dateEnd', 'startTime', 'endTime', 'dayOfWeek',
    'ageMin', 'ageMax', 'cost', 'spotsAvailable', 'totalSpots',
    'registrationStatus', 'locationName', 'registrationUrl'
  ];

  let totalFields = 0;
  let filledFields = 0;

  console.log('\nField breakdown:');
  for (const field of fields) {
    let count = 0;
    for (const a of activities) {
      let val = a[field];
      // Handle arrays
      if (Array.isArray(val)) {
        if (val.length > 0) count++;
      } else if (val !== null && val !== undefined && val !== '') {
        // 0 is valid for numeric fields like cost, spotsAvailable
        count++;
      }
    }
    const pct = ((count / activities.length) * 100).toFixed(1);
    totalFields += activities.length;
    filledFields += count;
    console.log(`  ${field}: ${count}/${activities.length} (${pct}%)`);
  }

  // Critical fields for the app
  const criticalFields = ['name', 'externalId', 'dateStart', 'startTime', 'dayOfWeek', 'cost', 'registrationStatus', 'locationName'];
  let criticalFilled = 0;
  let criticalTotal = 0;

  console.log('\nCritical fields:');
  for (const field of criticalFields) {
    let count = 0;
    for (const a of activities) {
      let val = a[field];
      if (Array.isArray(val)) {
        if (val.length > 0) count++;
      } else if (val !== null && val !== undefined && val !== '') {
        // 0 is valid for numeric fields
        count++;
      }
    }
    criticalTotal += activities.length;
    criticalFilled += count;
    const pct = ((count / activities.length) * 100).toFixed(1);
    console.log(`  ${field}: ${count}/${activities.length} (${pct}%)`);
  }

  const overallCoverage = ((filledFields / totalFields) * 100).toFixed(1);
  const criticalCoverage = ((criticalFilled / criticalTotal) * 100).toFixed(1);

  console.log('\n=== SUMMARY ===');
  console.log(`Overall coverage: ${overallCoverage}%`);
  console.log(`Critical fields coverage: ${criticalCoverage}%`);

  await prisma.$disconnect();
}

test().catch(console.error);
