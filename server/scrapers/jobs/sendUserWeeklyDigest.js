#!/usr/bin/env node

/**
 * Send User Weekly Digest Job
 *
 * Sends weekly summary emails to users with activity highlights and stats.
 *
 * Usage:
 *   node scrapers/jobs/sendUserWeeklyDigest.js
 *
 * Schedule via cron (Sunday 9 AM PST):
 *   0 9 * * 0 cd /path/to/server && node scrapers/jobs/sendUserWeeklyDigest.js
 *
 * NOTE: Requires 'npm run build' to compile TypeScript first.
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import compiled services
let notificationService, userPreferenceMatcherService;
try {
  const notificationModule = require('../../dist/services/notificationService');
  const matcherModule = require('../../dist/services/userPreferenceMatcherService');
  notificationService = notificationModule.notificationService;
  userPreferenceMatcherService = matcherModule.userPreferenceMatcherService;
} catch (error) {
  console.error('Error loading services. Run "npm run build" first:', error.message);
  process.exit(1);
}

/**
 * Main function - send weekly digests to all eligible users
 */
async function sendWeeklyDigests() {
  console.log('='.repeat(60));
  console.log('USER WEEKLY DIGEST JOB');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Check if enabled via environment
  if (process.env.EMAIL_DIGEST_ENABLED === 'false') {
    console.log('Email digests are disabled via environment. Exiting.');
    process.exit(0);
  }

  try {
    // Get all users with weekly digest enabled
    const users = await userPreferenceMatcherService.getUsersWithNotificationType('weeklyDigest');
    console.log(`Found ${users.length} user(s) with weekly digest enabled`);

    if (users.length === 0) {
      console.log('No users to send digests to. Exiting.');
      console.log('='.repeat(60));
      process.exit(0);
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of users) {
      console.log(`\nProcessing user: ${user.email}`);

      const result = await notificationService.sendWeeklyDigest(user.id);

      if (result.success) {
        console.log(`  ✓ Digest sent successfully (log: ${result.logId})`);
        successCount++;
      } else {
        if (result.error?.includes('No matching activities')) {
          console.log(`  - Skipped: ${result.error}`);
          skipCount++;
        } else if (result.error?.includes('already sent')) {
          console.log(`  - Skipped: ${result.error}`);
          skipCount++;
        } else {
          console.log(`  ✗ Error: ${result.error}`);
          errorCount++;
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total users processed: ${users.length}`);
    console.log(`  Digests sent: ${successCount}`);
    console.log(`  Skipped: ${skipCount}`);
    console.log(`  Errors: ${errorCount}`);

  } catch (error) {
    console.error('Error in weekly digest job:', error);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

// Run the job
sendWeeklyDigests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
