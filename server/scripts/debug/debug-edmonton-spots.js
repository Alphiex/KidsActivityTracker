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

  console.log('\n=== SPOTS ANALYSIS ===');
  console.log('Total activities:', activities.length);

  const withSpots = activities.filter(a => a.spotsAvailable !== null && a.spotsAvailable !== undefined);
  const withoutSpots = activities.filter(a => a.spotsAvailable === null || a.spotsAvailable === undefined);

  console.log('With spots:', withSpots.length);
  console.log('Without spots:', withoutSpots.length);

  console.log('\n=== Sample WITHOUT spots ===');
  withoutSpots.slice(0, 10).forEach((a, i) => {
    console.log(`${i+1}. ${a.name}`);
    console.log(`   rawData.spotsAvailable: ${a.rawData?.spotsAvailable}`);
    console.log(`   registrationStatus: ${a.registrationStatus}`);
  });

  console.log('\n=== Sample WITH spots ===');
  withSpots.slice(0, 5).forEach((a, i) => {
    console.log(`${i+1}. ${a.name}`);
    console.log(`   spotsAvailable: ${a.spotsAvailable}`);
  });

  await prisma.$disconnect();
}

test().catch(console.error);
