const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

async function test() {
  const prisma = new PrismaClient();
  const config = require('../scrapers/configs/providers/edmonton.json');
  const scraper = ScraperFactory.createScraper(config);
  scraper.prisma = prisma;

  const result = await scraper.scrape();

  console.log('Total:', result.activities.length);

  // Check field coverage
  console.log('\nField Coverage:');
  const withAge = result.activities.filter(a => a.ageMin !== null).length;
  console.log('ageMin:', withAge, '/', result.activities.length);
  const withDates = result.activities.filter(a => a.dateStart !== null).length;
  console.log('dateStart:', withDates, '/', result.activities.length);

  // Sample activities with raw data
  console.log('\nActivities WITH age:');
  result.activities.filter(a => a.ageMin !== null).slice(0, 3).forEach(function(a, i) {
    console.log((i+1) + '. ' + a.name);
    console.log('   ageMin:', a.ageMin, 'ageMax:', a.ageMax);
    console.log('   raw:', a.rawData?.name || 'N/A');
  });

  console.log('\nActivities WITHOUT age:');
  result.activities.filter(a => a.ageMin === null).slice(0, 5).forEach(function(a, i) {
    console.log((i+1) + '. ' + a.name);
    console.log('   raw name:', a.rawData?.name);
    console.log('   raw dateFrom:', a.rawData?.dateFrom);
    console.log('   raw dateTo:', a.rawData?.dateTo);
  });

  console.log('\nActivities WITHOUT dateStart:');
  result.activities.filter(a => a.dateStart === null).slice(0, 3).forEach(function(a, i) {
    console.log((i+1) + '. ' + a.name);
    console.log('   raw dateFrom:', a.rawData?.dateFrom);
    console.log('   raw dateTo:', a.rawData?.dateTo);
  });

  await prisma.$disconnect();
}

test().catch(console.error);
