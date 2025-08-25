const { consolidateActivityTypes } = require('./utils/activityTypeConsolidation');

const testData = [
  { name: 'Swimming', count: 895 },
  { name: 'Private Lessons Swimming', count: 33 },
  { name: 'Swimming - Aquatic Leadership', count: 13 },
  { name: 'Music', count: 19 },
  { name: 'Private Lessons Music', count: 313 },
  { name: 'Sports', count: 188 },
  { name: 'Part Day Camp', count: 52 },
  { name: 'Full Day Camp', count: 36 },
];

const consolidated = consolidateActivityTypes(testData);
console.log('Consolidated activity types:');
consolidated.forEach(type => {
  console.log(`  ${type.name}: ${type.count} activities`);
});
