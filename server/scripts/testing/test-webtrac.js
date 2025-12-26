const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

async function testWebTrac() {
  console.log('Testing Saskatoon WebTrac scraper...\n');

  const prisma = new PrismaClient();

  try {
    // Load config
    const config = require('../scrapers/configs/providers/saskatoon.json');
    console.log('Config loaded:', config.name);

    // Create scraper
    const scraper = ScraperFactory.createScraper(config);
    scraper.prisma = prisma;

    // Run scraper
    const result = await scraper.scrape();

    console.log('\n=== RESULTS ===');
    console.log('Total activities:', result.activities.length);

    if (result.activities.length > 0) {
      console.log('\nSample activities:');
      result.activities.slice(0, 5).forEach((activity, idx) => {
        console.log('\n' + (idx + 1) + '. ' + activity.name);
        console.log('   Category: ' + activity.category);
        console.log('   Age: ' + activity.ageMin + '-' + activity.ageMax);
        console.log('   Cost: ' + activity.cost);
        console.log('   Date: ' + activity.dateStart + ' to ' + activity.dateEnd);
        console.log('   Time: ' + activity.startTime + ' - ' + activity.endTime);
        console.log('   Location: ' + activity.locationName);
      });

      // Calculate field coverage
      const fields = ['name', 'category', 'ageMin', 'ageMax', 'cost', 'dateStart', 'dateEnd',
                     'startTime', 'endTime', 'locationName', 'registrationUrl', 'spotsAvailable'];
      const coverage = {};
      fields.forEach(function(f) {
        const filled = result.activities.filter(function(a) {
          return a[f] !== null && a[f] !== undefined && a[f] !== '';
        }).length;
        coverage[f] = ((filled / result.activities.length) * 100).toFixed(1);
      });

      console.log('\n=== FIELD COVERAGE ===');
      Object.entries(coverage).forEach(function(entry) {
        console.log('  ' + entry[0] + ': ' + entry[1] + '%');
      });

      const avgCoverage = Object.values(coverage).reduce(function(a, b) {
        return parseFloat(a) + parseFloat(b);
      }, 0) / fields.length;
      console.log('\nAverage coverage: ' + avgCoverage.toFixed(1) + '%');
    }

    console.log('\n' + result.report);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWebTrac().catch(console.error);
