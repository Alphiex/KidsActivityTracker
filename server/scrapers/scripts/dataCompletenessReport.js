#!/usr/bin/env node
/**
 * Generate data completeness report for all providers
 * Shows what percentage of activities have each required field
 */

const { PrismaClient } = require('../../generated/prisma');

const prisma = new PrismaClient();

async function generateCompletenessReport() {
  console.log('Data Completeness Report');
  console.log('========================\n');

  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    include: {
      activities: {
        where: { isActive: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  const report = [];
  let totalActivities = 0;

  for (const provider of providers) {
    const activities = provider.activities;
    const total = activities.length;
    totalActivities += total;

    if (total === 0) {
      report.push({
        provider: provider.name,
        totalActivities: 0,
        completeness: {}
      });
      continue;
    }

    const stats = {
      provider: provider.name,
      totalActivities: total,
      completeness: {
        hasDescription: (activities.filter(a => a.description && a.description.length > 10).length / total * 100).toFixed(1),
        hasDateRange: (activities.filter(a => a.dateStart && a.dateEnd).length / total * 100).toFixed(1),
        hasTimeRange: (activities.filter(a => a.startTime && a.endTime).length / total * 100).toFixed(1),
        hasAgeRange: (activities.filter(a => a.ageMin !== null && a.ageMax !== null).length / total * 100).toFixed(1),
        hasCost: (activities.filter(a => a.cost !== null).length / total * 100).toFixed(1),
        hasRegistrationUrl: (activities.filter(a => a.registrationUrl).length / total * 100).toFixed(1),
        hasDaysOfWeek: (activities.filter(a => a.dayOfWeek && a.dayOfWeek.length > 0).length / total * 100).toFixed(1),
        hasLocation: (activities.filter(a => a.locationId || a.locationName).length / total * 100).toFixed(1),
        hasActivityType: (activities.filter(a => a.activityTypeId).length / total * 100).toFixed(1)
      }
    };

    report.push(stats);
  }

  // Calculate overall averages
  const overall = {
    totalProviders: providers.length,
    totalActivities: totalActivities,
    averages: {}
  };

  const fieldNames = Object.keys(report[0]?.completeness || {});
  for (const field of fieldNames) {
    const values = report.filter(r => r.totalActivities > 0).map(r => parseFloat(r.completeness[field]));
    overall.averages[field] = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  }

  // Display report
  console.log('Provider Activity Counts:');
  console.log('-------------------------');
  report
    .sort((a, b) => b.totalActivities - a.totalActivities)
    .forEach(r => {
      console.log(`  ${r.provider}: ${r.totalActivities}`);
    });

  console.log(`\nTotal: ${totalActivities} activities across ${providers.length} providers\n`);

  // Display completeness table
  console.log('Field Completeness by Provider:');
  console.log('-------------------------------\n');

  // Header
  const header = ['Provider', 'Count', 'Desc', 'Dates', 'Times', 'Ages', 'Cost', 'URL', 'Days', 'Loc', 'Type'];
  console.log(header.map(h => h.padEnd(30)).join(''));
  console.log('-'.repeat(header.length * 30));

  // Provider rows
  report
    .sort((a, b) => b.totalActivities - a.totalActivities)
    .forEach(r => {
      if (r.totalActivities === 0) return;
      const row = [
        r.provider.substring(0, 28),
        r.totalActivities.toString(),
        r.completeness.hasDescription + '%',
        r.completeness.hasDateRange + '%',
        r.completeness.hasTimeRange + '%',
        r.completeness.hasAgeRange + '%',
        r.completeness.hasCost + '%',
        r.completeness.hasRegistrationUrl + '%',
        r.completeness.hasDaysOfWeek + '%',
        r.completeness.hasLocation + '%',
        r.completeness.hasActivityType + '%'
      ];
      console.log(row.map((c, i) => c.padEnd(i === 0 ? 30 : 10)).join(''));
    });

  // Averages row
  console.log('-'.repeat(header.length * 30));
  const avgRow = [
    'AVERAGE',
    totalActivities.toString(),
    overall.averages.hasDescription + '%',
    overall.averages.hasDateRange + '%',
    overall.averages.hasTimeRange + '%',
    overall.averages.hasAgeRange + '%',
    overall.averages.hasCost + '%',
    overall.averages.hasRegistrationUrl + '%',
    overall.averages.hasDaysOfWeek + '%',
    overall.averages.hasLocation + '%',
    overall.averages.hasActivityType + '%'
  ];
  console.log(avgRow.map((c, i) => c.padEnd(i === 0 ? 30 : 10)).join(''));

  // Success criteria check
  console.log('\n\n========== SUCCESS CRITERIA ==========');
  const criteria = [
    { name: 'Total activities', target: 50000, actual: totalActivities, unit: '' },
    { name: 'Activities with description', target: 90, actual: parseFloat(overall.averages.hasDescription), unit: '%' },
    { name: 'Activities with age range', target: 85, actual: parseFloat(overall.averages.hasAgeRange), unit: '%' },
    { name: 'Activities with dates', target: 95, actual: parseFloat(overall.averages.hasDateRange), unit: '%' },
    { name: 'Activities with valid URLs', target: 99, actual: parseFloat(overall.averages.hasRegistrationUrl), unit: '%' },
  ];

  criteria.forEach(c => {
    const passed = c.actual >= c.target;
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${c.name}: ${c.actual}${c.unit} (target: ${c.target}${c.unit})`);
  });

  // Cities with 2000+ activities
  const citiesOver2000 = report.filter(r => r.totalActivities >= 2000).length;
  const passed2000 = citiesOver2000 >= 12;
  console.log(`${passed2000 ? '✅' : '❌'} Cities with 2000+ activities: ${citiesOver2000} (target: 12+)`);

  // Cities with 500+ activities
  const citiesOver500 = report.filter(r => r.totalActivities >= 500).length;
  const passed500 = citiesOver500 >= 18;
  console.log(`${passed500 ? '✅' : '❌'} Cities with 500+ activities: ${citiesOver500} (target: 18+)`);

  await prisma.$disconnect();
}

generateCompletenessReport().catch(console.error);
