#!/usr/bin/env node

/**
 * Restore all provider schedules to production mode
 * Run: node server/scripts/restore-schedule-prod.js
 */

const fs = require('fs');
const path = require('path');

const providersDir = path.join(__dirname, '../scrapers/configs/providers');

const files = fs.readdirSync(providersDir).filter(f => f.endsWith('.json'));
let restored = 0;
let noBackup = 0;

console.log(`Restoring ${files.length} provider configs to production schedule...`);

for (const file of files) {
  const filePath = path.join(providersDir, file);

  try {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (config.schedule?._production) {
      // Restore production schedule
      config.schedule = {
        ...config.schedule._production,
        tier: config.schedule.tier
      };

      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
      restored++;
      console.log(`  Restored: ${file}`);
    } else {
      noBackup++;
      console.log(`  No backup: ${file} (already in production mode)`);
    }
  } catch (error) {
    console.error(`  Error restoring ${file}: ${error.message}`);
  }
}

console.log(`\nDone! Restored ${restored}/${files.length} provider configs.`);
if (noBackup > 0) {
  console.log(`${noBackup} configs had no backup (were already in production mode).`);
}
