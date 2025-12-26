const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

const scrapers = [
  { name: 'Calgary', config: '../scrapers/configs/providers/calgary.json' },
  { name: 'Saskatoon', config: '../scrapers/configs/providers/saskatoon.json' },
  { name: 'Montreal', config: '../scrapers/configs/providers/montreal.json' },
  { name: 'Edmonton', config: '../scrapers/configs/providers/edmonton.json' }
];

async function testScraper(prisma, scraperInfo) {
  console.log('\n' + '='.repeat(60));
  console.log('Testing: ' + scraperInfo.name);
  console.log('='.repeat(60));

  try {
    const config = require(scraperInfo.config);
    const scraper = ScraperFactory.createScraper(config);
    scraper.prisma = prisma;

    const result = await scraper.scrape();

    console.log('Total activities: ' + result.activities.length);

    if (result.activities.length > 0) {
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

      console.log('\nField Coverage:');
      Object.entries(coverage).forEach(function(entry) {
        const bar = '#'.repeat(Math.round(parseFloat(entry[1]) / 5));
        console.log('  ' + entry[0].padEnd(18) + ': ' + entry[1].padStart(6) + '% ' + bar);
      });

      const avgCoverage = Object.values(coverage).reduce(function(a, b) {
        return parseFloat(a) + parseFloat(b);
      }, 0) / fields.length;
      console.log('\n  AVERAGE: ' + avgCoverage.toFixed(1) + '%');

      // Sample activities
      console.log('\nSample activities:');
      result.activities.slice(0, 2).forEach(function(a, i) {
        console.log('  ' + (i+1) + '. ' + a.name.substring(0, 50));
        console.log('     Age: ' + a.ageMin + '-' + a.ageMax + ', Cost: $' + a.cost);
        console.log('     Location: ' + (a.locationName || 'N/A'));
      });

      return { name: scraperInfo.name, count: result.activities.length, coverage: avgCoverage };
    }

    return { name: scraperInfo.name, count: 0, coverage: 0 };

  } catch (error) {
    console.error('Error: ' + error.message);
    return { name: scraperInfo.name, count: 0, coverage: 0, error: error.message };
  }
}

async function main() {
  console.log('Testing All New Platform Scrapers');
  console.log('==================================\n');

  const prisma = new PrismaClient();
  const results = [];

  try {
    for (const scraper of scrapers) {
      const result = await testScraper(prisma, scraper);
      results.push(result);
    }

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log('\nScraper'.padEnd(15) + 'Activities'.padStart(12) + 'Coverage'.padStart(12) + 'Status'.padStart(10));
    console.log('-'.repeat(49));

    results.forEach(function(r) {
      const status = r.coverage >= 80 ? 'PASS' : (r.coverage >= 50 ? 'OK' : 'NEEDS WORK');
      console.log(
        r.name.padEnd(15) +
        String(r.count).padStart(12) +
        (r.coverage.toFixed(1) + '%').padStart(12) +
        status.padStart(10)
      );
    });

    const totalActivities = results.reduce((sum, r) => sum + r.count, 0);
    const avgCoverage = results.reduce((sum, r) => sum + r.coverage, 0) / results.length;

    console.log('-'.repeat(49));
    console.log('TOTAL'.padEnd(15) + String(totalActivities).padStart(12) + (avgCoverage.toFixed(1) + '%').padStart(12));

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
