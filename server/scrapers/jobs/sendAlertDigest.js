#!/usr/bin/env node

/**
 * Send Alert Digest Job
 *
 * Sends a daily digest email with all scraper alerts from the last 24 hours.
 *
 * Usage:
 *   node scrapers/jobs/sendAlertDigest.js
 *
 * Schedule via cron:
 *   0 8 * * * cd /path/to/server && node scrapers/jobs/sendAlertDigest.js
 *
 * NOTE: Requires 'npm run build' to compile emailService.ts first.
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ScraperMonitor = require('../base/ScraperMonitor');

// Import compiled email service
let emailService;
try {
  const emailServiceModule = require('../../dist/utils/emailService');
  emailService = emailServiceModule.emailService;
} catch (error) {
  console.error('Error loading email service. Run "npm run build" first:', error.message);
  process.exit(1);
}

/**
 * Load alert configuration
 */
function loadConfig() {
  const configPath = path.join(__dirname, '../configs/alerts.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Could not load alerts.json:', error.message);
    return null;
  }
}

/**
 * Main function - send daily digest
 */
async function sendDailyDigest() {
  console.log('='.repeat(60));
  console.log('SCRAPER ALERT DIGEST JOB');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const config = loadConfig();
  if (!config) {
    console.error('Failed to load config');
    process.exit(1);
  }

  if (!config.enabled) {
    console.log('Alerts are disabled in config. Exiting.');
    process.exit(0);
  }

  if (!config.recipients || config.recipients.length === 0) {
    console.error('No recipients configured in alerts.json');
    process.exit(1);
  }

  const monitor = new ScraperMonitor();

  try {
    // Get alerts from last 24 hours
    const since = new Date();
    since.setHours(since.getHours() - 24);

    console.log(`Fetching alerts since: ${since.toISOString()}`);
    const alerts = await monitor.getPendingAlerts(since);

    console.log(`Found ${alerts.length} pending alert(s)`);

    if (alerts.length === 0) {
      console.log('No alerts to send. All scrapers healthy!');
      console.log('='.repeat(60));
      await monitor.disconnect();
      process.exit(0);
    }

    // Display summary
    console.log('\nAlert Summary:');
    alerts.forEach((alert, i) => {
      console.log(`  ${i + 1}. ${alert.providerName} - ${alert.alertReason}`);
    });

    // Send digest email
    console.log(`\nSending digest to: ${config.recipients.join(', ')}`);

    await emailService.sendScraperDigest({
      to: config.recipients,
      alerts: alerts,
      date: new Date()
    });

    console.log('Digest email sent successfully!');

    // Mark alerts as sent
    const alertIds = alerts.map(a => a.id);
    await monitor.markAlertsSent(alertIds);
    console.log(`Marked ${alertIds.length} alert(s) as sent`);

  } catch (error) {
    console.error('Error sending digest:', error);
    process.exit(1);
  } finally {
    await monitor.disconnect();
  }

  console.log('='.repeat(60));
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

// Run the job
sendDailyDigest()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
