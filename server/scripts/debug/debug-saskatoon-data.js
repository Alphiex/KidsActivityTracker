const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

async function test() {
  const prisma = new PrismaClient();
  const config = require('../scrapers/configs/providers/saskatoon.json');
  const scraper = ScraperFactory.createScraper(config);
  scraper.prisma = prisma;

  const result = await scraper.scrape();

  console.log('Total:', result.activities.length);

  // Check raw data for availability
  console.log('\nSample raw data:');
  result.activities.slice(0, 10).forEach(function(a, i) {
    console.log((i+1) + '. ' + a.name);
    console.log('   ageMin:', a.ageMin, 'ageMax:', a.ageMax);
    console.log('   spotsAvailable:', a.spotsAvailable);
    if (a.rawData) {
      console.log('   raw availability:', a.rawData.availability);
      console.log('   raw description:', a.rawData.description);
    }
  });

  await prisma.$disconnect();
}

test().catch(console.error);
