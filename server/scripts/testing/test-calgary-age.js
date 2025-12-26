const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

async function test() {
  const prisma = new PrismaClient();
  const config = require('../scrapers/configs/providers/calgary.json');
  const scraper = ScraperFactory.createScraper(config);
  scraper.prisma = prisma;

  const result = await scraper.scrape();

  console.log('Total:', result.activities.length);

  // Check age coverage
  const withAge = result.activities.filter(function(a) {
    return a.ageMin !== null && a.ageMin !== undefined;
  }).length;
  console.log('With age:', withAge, '(' + ((withAge / result.activities.length) * 100).toFixed(1) + '%)');

  // Sample activities with their raw data
  console.log('\nSample activities with age info:');
  const withAgeActivities = result.activities.filter(function(a) {
    return a.ageMin !== null;
  });
  withAgeActivities.slice(0, 5).forEach(function(a, i) {
    console.log((i+1) + '. ' + a.name);
    console.log('   ageMin:', a.ageMin, 'ageMax:', a.ageMax);
  });

  console.log('\nSample activities WITHOUT age:');
  const noAge = result.activities.filter(function(a) {
    return a.ageMin === null;
  });
  noAge.slice(0, 5).forEach(function(a, i) {
    console.log((i+1) + '. ' + a.name);
    if (a.rawData && a.rawData.description) {
      console.log('   raw description:', a.rawData.description.substring(0, 200));
    }
  });

  await prisma.$disconnect();
}

test().catch(console.error);
