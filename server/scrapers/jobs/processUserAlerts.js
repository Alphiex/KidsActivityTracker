#!/usr/bin/env node

/**
 * Process User Alerts Job
 *
 * Processes activity changes and sends immediate alerts to users:
 * - Capacity alerts for favorited activities running low on spots
 * - Price drop alerts for favorited activities
 * - Spots available alerts for waitlisted activities
 *
 * This should be called after each scraper run completes to capture
 * snapshots and detect changes.
 *
 * Usage:
 *   node scrapers/jobs/processUserAlerts.js [providerId]
 *
 * Arguments:
 *   providerId - Optional. Process alerts only for this provider.
 *                If not provided, processes alerts for all recent changes.
 *
 * NOTE: Requires 'npm run build' to compile TypeScript first.
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import compiled services
let notificationService, activitySnapshotService;
try {
  const notificationModule = require('../../dist/services/notificationService');
  const snapshotModule = require('../../dist/services/activitySnapshotService');
  notificationService = notificationModule.notificationService;
  activitySnapshotService = snapshotModule.activitySnapshotService;
} catch (error) {
  console.error('Error loading services. Run "npm run build" first:', error.message);
  process.exit(1);
}

// Get provider ID from command line
const providerId = process.argv[2] || null;

/**
 * Main function - process alerts for recent changes
 */
async function processAlerts() {
  console.log('='.repeat(60));
  console.log('PROCESS USER ALERTS JOB');
  console.log(`Started at: ${new Date().toISOString()}`);
  if (providerId) {
    console.log(`Provider: ${providerId}`);
  }
  console.log('='.repeat(60));

  // Check if enabled
  if (process.env.USER_ALERTS_ENABLED === 'false') {
    console.log('User alerts are disabled via environment. Exiting.');
    process.exit(0);
  }

  try {
    // Capture snapshots if provider specified
    if (providerId) {
      console.log('\n1. Capturing activity snapshots...');
      const snapshotCount = await activitySnapshotService.captureProviderSnapshots(providerId);
      console.log(`   Captured ${snapshotCount} snapshot(s)`);
    }

    // Look for changes in the last 2 hours (enough time for scraper run)
    const since = new Date();
    since.setHours(since.getHours() - 2);

    // Process capacity changes
    console.log('\n2. Detecting capacity changes...');
    const capacityChanges = await activitySnapshotService.detectCapacityChanges(since);
    console.log(`   Found ${capacityChanges.length} capacity change(s)`);

    if (capacityChanges.length > 0) {
      console.log('   Processing capacity alerts...');
      await notificationService.processCapacityChanges(capacityChanges);
      console.log('   Done processing capacity alerts');
    }

    // Process price drops
    console.log('\n3. Detecting price drops...');
    const priceDrops = await activitySnapshotService.detectPriceDrops(since);
    console.log(`   Found ${priceDrops.length} price drop(s)`);

    if (priceDrops.length > 0) {
      console.log('   Processing price drop alerts...');
      await notificationService.processPriceDrops(priceDrops);
      console.log('   Done processing price drop alerts');
    }

    // Process spots becoming available (for waitlist)
    console.log('\n4. Detecting newly available activities...');
    const newlyAvailable = await activitySnapshotService.detectNewlyAvailable(since);
    console.log(`   Found ${newlyAvailable.length} activity/ies with new spots`);

    if (newlyAvailable.length > 0) {
      console.log('   Processing waitlist notifications...');
      for (const event of newlyAvailable) {
        await notificationService.processWaitlistNotifications(event.activityId);
      }
      console.log('   Done processing waitlist notifications');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Capacity changes detected: ${capacityChanges.length}`);
    console.log(`  Price drops detected: ${priceDrops.length}`);
    console.log(`  Newly available activities: ${newlyAvailable.length}`);

  } catch (error) {
    console.error('Error processing alerts:', error);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

// Run the job
processAlerts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
