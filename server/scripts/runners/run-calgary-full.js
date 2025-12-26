#!/usr/bin/env node

const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

async function run() {
  console.log('='.repeat(60));
  console.log('CALGARY FULL SCRAPE - Started at', new Date().toISOString());
  console.log('='.repeat(60));

  const prisma = new PrismaClient();
  const config = require('../scrapers/configs/providers/calgary.json');
  const scraper = ScraperFactory.createScraper(config);
  scraper.prisma = prisma;

  const startTime = Date.now();

  try {
    const result = await scraper.scrape();

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('CALGARY SCRAPE COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total activities: ${result.activities.length}`);
    console.log(`Duration: ${duration} minutes`);
    console.log(`Stats:`, result.stats);

  } catch (e) {
    console.error('SCRAPE FAILED:', e);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
