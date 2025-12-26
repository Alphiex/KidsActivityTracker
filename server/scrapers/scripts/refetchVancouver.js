#!/usr/bin/env node
/**
 * Vancouver-specific detail refetch with improved Active Network extraction
 * Uses higher concurrency and better patterns for the Active Communities platform
 */

const { PrismaClient } = require('../../generated/prisma');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

const CONFIG = {
  browserCount: 6,          // More browsers for faster processing
  browserRestartInterval: 25,
  pageTimeout: 30000,       // Longer timeout for React apps
  maxRetries: 3,
  renderWait: 4000          // Wait for React to render
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * Enhanced Active Network extraction for Vancouver
 * Simpler patterns that work reliably in browser context
 */
async function extractActiveNetworkData(page) {
  // Wait for React content to render
  await new Promise(r => setTimeout(r, CONFIG.renderWait));

  return page.evaluate(() => {
    const data = {};
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // === DESCRIPTION ===
    // Find "Description" line and get content until next section
    const descIdx = lines.findIndex(l => l === 'Description');
    if (descIdx >= 0 && descIdx < lines.length - 1) {
      // Collect lines until we hit a section header or empty-ish content
      const descLines = [];
      for (let i = descIdx + 1; i < lines.length && i < descIdx + 10; i++) {
        const line = lines[i];
        // Stop at section headers or short lines that look like metadata
        if (line === 'Keyboard shortcuts' || line.startsWith('Map data') ||
            line === 'Activity meeting dates' || line === 'Instructor' ||
            line === 'More Information' || line.match(/^[A-Z][a-z]+\s+\d+,\s+\d{4}/)) {
          break;
        }
        if (line.length > 20) {
          descLines.push(line);
        }
      }
      if (descLines.length > 0) {
        data.description = descLines.join(' ').substring(0, 500);
      }
    }

    // === DATES ===
    // Look for "Jan 6, 2026 - Jan 29, 2026" pattern
    for (const line of lines) {
      const dateMatch = line.match(/([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})/);
      if (dateMatch) {
        try {
          const start = new Date(dateMatch[1]);
          const end = new Date(dateMatch[2]);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            data.dateStart = start;
            data.dateEnd = end;
            break;
          }
        } catch (e) {}
      }
    }

    // === DAY OF WEEK & TIMES ===
    // Look for lines like "Tue, Thu7:00 PM - 8:00 PM"
    for (const line of lines) {
      // Match "Mon, Wed7:00 PM - 8:00 PM" or "Saturday9:00 AM - 12:00 PM"
      const timeMatch = line.match(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (timeMatch) {
        // Extract days
        const dayStr = timeMatch[1];
        const dayMap = {
          'mon': 'Monday', 'monday': 'Monday',
          'tue': 'Tuesday', 'tuesday': 'Tuesday',
          'wed': 'Wednesday', 'wednesday': 'Wednesday',
          'thu': 'Thursday', 'thursday': 'Thursday',
          'fri': 'Friday', 'friday': 'Friday',
          'sat': 'Saturday', 'saturday': 'Saturday',
          'sun': 'Sunday', 'sunday': 'Sunday'
        };
        const days = dayStr.match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/gi);
        if (days) {
          data.dayOfWeek = [...new Set(days.map(d => dayMap[d.toLowerCase()]))];
        }
        data.startTime = timeMatch[2];
        data.endTime = timeMatch[3];
        break;
      }

      // Also try "Weekdays9:00 AM - 4:00 PM"
      const weekdayMatch = line.match(/^Weekdays?(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (weekdayMatch) {
        data.dayOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        data.startTime = weekdayMatch[1];
        data.endTime = weekdayMatch[2];
        break;
      }
    }

    // === LOCATION ===
    // Look for lines with room/facility names (usually after the date line)
    for (const line of lines) {
      // Match "104 Multipurpose Room" or "Gymnasium" etc
      if (/^\d+\s+[A-Za-z].*(?:Room|Gymnasium|Pool|Arena|Rink|Court|Studio|Hall|Field)/i.test(line)) {
        data.locationName = line;
        break;
      }
      if (/^[A-Za-z].*(?:Room|Gymnasium|Pool|Arena|Rink|Court|Studio|Hall|Field)$/i.test(line) && line.length < 50) {
        data.locationName = line;
        break;
      }
    }

    // Fallback: look for community centre in the subtitle
    if (!data.locationName) {
      for (const line of lines) {
        const centreMatch = line.match(/\d{4}\s+(?:Winter|Summer|Spring|Fall)\s+([A-Za-z][A-Za-z\s-]+?)(?:\|#|$)/i);
        if (centreMatch) {
          data.locationName = centreMatch[1].trim() + ' Community Centre';
          break;
        }
      }
    }

    // === AGE RANGE ===
    for (const line of lines) {
      // "14 yrs +" or "6 - 12 yrs"
      if (/^\d+\s*(?:yrs?|years?)\s*\+/i.test(line)) {
        const match = line.match(/(\d+)\s*(?:yrs?|years?)\s*\+/i);
        if (match) {
          data.ageMin = parseInt(match[1]);
          data.ageMax = 99;
          break;
        }
      }
      const ageRange = line.match(/(\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)/i);
      if (ageRange) {
        data.ageMin = parseInt(ageRange[1]);
        data.ageMax = parseInt(ageRange[2]);
        break;
      }
    }

    // === COST ===
    const allPrices = text.match(/\$\d+(?:\.\d{2})?/g);
    if (allPrices && allPrices.length > 0) {
      const prices = allPrices.map(p => parseFloat(p.replace('$', ''))).filter(p => p > 0 && p < 5000);
      if (prices.length > 0) {
        data.cost = Math.max(...prices);
      }
    }

    return data;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  const skipArg = args.find(a => a.startsWith('--skip='));
  const skip = skipArg ? parseInt(skipArg.split('=')[1]) : 0;

  const providerId = 'e22974df-bfcf-41b3-a1d9-db32ece51ecf'; // Vancouver

  log('Vancouver Detail Refetch - Enhanced Edition');
  log(`Config: ${CONFIG.browserCount} browsers, ${CONFIG.pageTimeout}ms timeout`);

  // Find activities with missing or incomplete data
  const whereClause = {
    providerId,
    isActive: true,
    registrationUrl: { not: null },
    OR: [
      { description: null },
      { description: '' },
      { dateStart: null },
      { locationName: null },
      { locationName: '' }
    ]
  };

  let activities = await prisma.activity.findMany({
    where: whereClause,
    skip: skip,
    take: limit || undefined,
    orderBy: { id: 'asc' }
  });

  log(`Found ${activities.length} activities needing updates`);

  if (activities.length === 0) {
    log('No activities need updating!');
    await prisma.$disconnect();
    return;
  }

  // Initialize browser pool
  const browsers = [];
  const pageCounters = [];

  log(`Launching ${CONFIG.browserCount} browsers...`);
  for (let i = 0; i < CONFIG.browserCount; i++) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    browsers.push(browser);
    pageCounters.push(0);
  }

  // Work queue
  const queue = activities.map((a, i) => ({ activity: a, index: i, retries: 0 }));
  let processed = 0;
  let updated = 0;
  let errors = 0;
  let extracted = { desc: 0, date: 0, loc: 0, time: 0 };

  // Worker function
  const worker = async (browserIndex) => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      try {
        // Restart browser periodically
        if (pageCounters[browserIndex] >= CONFIG.browserRestartInterval) {
          log(`Restarting browser ${browserIndex + 1}...`);
          try { await browsers[browserIndex].close(); } catch (e) {}
          browsers[browserIndex] = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
          });
          pageCounters[browserIndex] = 0;
        }

        const page = await browsers[browserIndex].newPage();
        try {
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

          // Set viewport for proper rendering
          await page.setViewport({ width: 1280, height: 800 });

          await page.goto(item.activity.registrationUrl, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.pageTimeout
          });

          const detailData = await extractActiveNetworkData(page);

          // Debug: log first few extractions
          if (processed < 5) {
            log(`  Debug activity ${processed}: ${JSON.stringify(detailData)}`);
          }

          // Only update if we got new data
          const updateData = {};
          if (detailData.description && !item.activity.description) {
            updateData.description = detailData.description;
            extracted.desc++;
          }
          if (detailData.dateStart && !item.activity.dateStart) {
            updateData.dateStart = detailData.dateStart;
            extracted.date++;
          }
          if (detailData.dateEnd && !item.activity.dateEnd) {
            updateData.dateEnd = detailData.dateEnd;
          }
          if (detailData.locationName && !item.activity.locationName) {
            updateData.locationName = detailData.locationName;
            extracted.loc++;
          }
          if (detailData.startTime && !item.activity.startTime) {
            updateData.startTime = detailData.startTime;
            extracted.time++;
          }
          if (detailData.endTime && !item.activity.endTime) {
            updateData.endTime = detailData.endTime;
          }
          if (detailData.dayOfWeek && (!item.activity.dayOfWeek || item.activity.dayOfWeek.length === 0)) {
            updateData.dayOfWeek = detailData.dayOfWeek;
          }
          if (detailData.ageMin !== undefined && item.activity.ageMin === null) {
            updateData.ageMin = detailData.ageMin;
          }
          if (detailData.ageMax !== undefined && item.activity.ageMax === null) {
            updateData.ageMax = detailData.ageMax;
          }
          if (detailData.cost && (!item.activity.cost || item.activity.cost === 0)) {
            updateData.cost = detailData.cost;
          }
          if (detailData.latitude && !item.activity.latitude) {
            updateData.latitude = detailData.latitude;
            updateData.longitude = detailData.longitude;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.activity.update({
              where: { id: item.activity.id },
              data: updateData
            });
            updated++;
          }

        } finally {
          await page.close();
          pageCounters[browserIndex]++;
        }

        processed++;
        if (processed % 50 === 0) {
          const pct = ((processed / activities.length) * 100).toFixed(1);
          log(`Progress: ${processed}/${activities.length} (${pct}%) - Updated: ${updated}, Errors: ${errors}`);
          log(`  Extracted: desc=${extracted.desc}, date=${extracted.date}, loc=${extracted.loc}, time=${extracted.time}`);
        }

      } catch (error) {
        if (item.retries < CONFIG.maxRetries) {
          item.retries++;
          queue.push(item);
        } else {
          errors++;
          processed++;
        }
      }
    }
  };

  // Start workers
  log('Starting parallel workers...');
  const startTime = Date.now();
  await Promise.all(browsers.map((_, i) => worker(i)));

  // Cleanup
  for (const browser of browsers) {
    try { await browser.close(); } catch (e) {}
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  log(`\nComplete!`);
  log(`  Processed: ${processed}`);
  log(`  Updated: ${updated}`);
  log(`  Errors: ${errors}`);
  log(`  Extracted: desc=${extracted.desc}, date=${extracted.date}, loc=${extracted.loc}, time=${extracted.time}`);
  log(`  Time: ${elapsed} minutes`);
  log(`  Rate: ${(processed / (elapsed || 1)).toFixed(1)} activities/minute`);

  await prisma.$disconnect();
}

main().catch(console.error);
