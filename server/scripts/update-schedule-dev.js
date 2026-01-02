#!/usr/bin/env node

/**
 * Update all provider schedules to development mode (random every 3 days)
 * Run: node server/scripts/update-schedule-dev.js
 */

const fs = require('fs');
const path = require('path');

const providersDir = path.join(__dirname, '../scrapers/configs/providers');

// Generate a random time between 00:00 and 23:59
function randomTime() {
  const hour = Math.floor(Math.random() * 24).toString().padStart(2, '0');
  const minute = Math.floor(Math.random() * 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

// Development schedule - every 3 days at a random time
const devSchedule = {
  frequency: 'every-3-days',
  randomized: true
};

const files = fs.readdirSync(providersDir).filter(f => f.endsWith('.json'));
let updated = 0;

console.log(`Updating ${files.length} provider configs to development schedule...`);

for (const file of files) {
  const filePath = path.join(providersDir, file);

  try {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Store original schedule for reference
    if (config.schedule && !config.schedule._production) {
      config.schedule._production = { ...config.schedule };
      delete config.schedule._production._production;
    }

    // Update to dev schedule with random time
    config.schedule = {
      ...config.schedule,
      tier: config.schedule?.tier || 'standard',
      frequency: devSchedule.frequency,
      times: [randomTime()],
      randomized: devSchedule.randomized,
      _production: config.schedule?._production
    };

    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    updated++;
    console.log(`  Updated: ${file}`);
  } catch (error) {
    console.error(`  Error updating ${file}: ${error.message}`);
  }
}

console.log(`\nDone! Updated ${updated}/${files.length} provider configs.`);
console.log('All scrapers now set to run randomly every 3 days.');
console.log('\nTo restore production schedules, run: node server/scripts/restore-schedule-prod.js');
