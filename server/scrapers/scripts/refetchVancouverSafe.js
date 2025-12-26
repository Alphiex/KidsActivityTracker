#!/usr/bin/env node
/**
 * Vancouver detail refetch - SAFE edition with rate limiting protection
 * Uses fewer browsers and longer delays to avoid being blocked
 */

const { PrismaClient } = require('../../generated/prisma');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

const CONFIG = {
  browserCount: 2,            // Only 2 browsers to avoid rate limiting
  browserRestartInterval: 15, // Restart more frequently
  pageTimeout: 45000,         // Longer timeout
  maxRetries: 2,
  renderWait: 5000,           // 5 second wait for React
  delayBetweenRequests: 1500, // 1.5 second delay between requests
  batchSize: 100,             // Process in smaller batches
  batchDelay: 30000           // 30 second pause between batches
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * Enhanced Active Network extraction
 */
async function extractActiveNetworkData(page) {
  await new Promise(r => setTimeout(r, CONFIG.renderWait));

  return page.evaluate(() => {
    const data = {};
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // === DESCRIPTION ===
    const descIdx = lines.findIndex(l => l === 'Description');
    if (descIdx >= 0 && descIdx < lines.length - 1) {
      const descLines = [];
      for (let i = descIdx + 1; i < lines.length && i < descIdx + 10; i++) {
        const line = lines[i];
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
    // Try multiple patterns for dates - return as ISO strings
    for (const line of lines) {
      // Pattern 1: "Jan 6, 2026 - Jan 29, 2026"
      let dateMatch = line.match(/([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})/);
      if (dateMatch) {
        try {
          const start = new Date(dateMatch[1]);
          const end = new Date(dateMatch[2]);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            data.dateStart = start.toISOString();
            data.dateEnd = end.toISOString();
            break;
          }
        } catch (e) {}
      }

      // Pattern 2: "January 6 - January 29, 2026" (single year)
      dateMatch = line.match(/([A-Z][a-z]+\s+\d{1,2})\s*-\s*([A-Z][a-z]+\s+\d{1,2}),?\s*(\d{4})/);
      if (dateMatch) {
        try {
          const start = new Date(`${dateMatch[1]}, ${dateMatch[3]}`);
          const end = new Date(`${dateMatch[2]}, ${dateMatch[3]}`);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            data.dateStart = start.toISOString();
            data.dateEnd = end.toISOString();
            break;
          }
        } catch (e) {}
      }

      // Pattern 3: Look for "Activity meeting dates" section
      if (line === 'Activity meeting dates') {
        // Next lines might have individual dates
        const idx = lines.indexOf(line);
        for (let i = idx + 1; i < Math.min(idx + 20, lines.length); i++) {
          const nextLine = lines[i];
          const singleDate = nextLine.match(/^([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/);
          if (singleDate) {
            try {
              const date = new Date(singleDate[1]);
              if (!isNaN(date.getTime())) {
                if (!data.dateStart) data.dateStart = date.toISOString();
                data.dateEnd = date.toISOString();
              }
            } catch (e) {}
          }
        }
        if (data.dateStart) break;
      }
    }

    // === DAY OF WEEK & TIMES ===
    for (const line of lines) {
      // Pattern 1: "Tue, Thu7:00 PM - 8:00 PM" (no space)
      let timeMatch = line.match(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);

      // Pattern 2: With space "Tue, Thu 7:00 PM - 8:00 PM"
      if (!timeMatch) {
        timeMatch = line.match(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
      }

      if (timeMatch) {
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

      // Pattern 3: "Weekdays 9:00 AM - 4:00 PM"
      const weekdayMatch = line.match(/^Weekdays?\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (weekdayMatch) {
        data.dayOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        data.startTime = weekdayMatch[1];
        data.endTime = weekdayMatch[2];
        break;
      }
    }

    // === LOCATION ===
    for (const line of lines) {
      // Room with number: "104 Multipurpose Room"
      if (/^\d+\s+[A-Za-z].*(?:Room|Gymnasium|Pool|Arena|Rink|Court|Studio|Hall|Field|Centre|Center)/i.test(line)) {
        data.locationName = line;
        break;
      }
      // Just room name: "Dance Studio"
      if (/^[A-Za-z].*(?:Room|Gymnasium|Pool|Arena|Rink|Court|Studio|Hall|Field)$/i.test(line) && line.length < 50) {
        data.locationName = line;
        break;
      }
      // Community centre name
      if (/Community\s+Centre|Recreation\s+Centre|Rec\s+Centre/i.test(line) && line.length < 60) {
        data.locationName = line;
        break;
      }
    }

    // === AGE RANGE ===
    for (const line of lines) {
      if (/^(\d+)\s*(?:yrs?|years?)\s*\+/i.test(line)) {
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

  log('Vancouver Detail Refetch - SAFE Edition');
  log(`Config: ${CONFIG.browserCount} browsers, ${CONFIG.delayBetweenRequests}ms delay, ${CONFIG.batchSize} batch size`);

  // Find activities with missing data
  const whereClause = {
    providerId,
    isActive: true,
    registrationUrl: { not: null },
    OR: [
      { description: null },
      { description: '' },
      { dateStart: null },
      { locationName: null },
      { locationName: '' },
      { startTime: null }
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

  // Initialize browsers
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

  // Stats
  let processed = 0;
  let updated = 0;
  let errors = 0;
  let extracted = { desc: 0, date: 0, loc: 0, time: 0 };
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;

  // Process in batches
  const totalBatches = Math.ceil(activities.length / CONFIG.batchSize);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * CONFIG.batchSize;
    const batchEnd = Math.min(batchStart + CONFIG.batchSize, activities.length);
    const batch = activities.slice(batchStart, batchEnd);

    log(`\nProcessing batch ${batchNum + 1}/${totalBatches} (${batch.length} activities)`);

    // Create work queue for this batch
    const queue = batch.map((a, i) => ({ activity: a, index: batchStart + i, retries: 0 }));

    // Worker function
    const worker = async (browserIndex) => {
      while (queue.length > 0 && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
        const item = queue.shift();
        if (!item) break;

        // Delay between requests
        await new Promise(r => setTimeout(r, CONFIG.delayBetweenRequests));

        try {
          // Restart browser periodically
          if (pageCounters[browserIndex] >= CONFIG.browserRestartInterval) {
            log(`Restarting browser ${browserIndex + 1}...`);
            try { await browsers[browserIndex].close(); } catch (e) {}
            await new Promise(r => setTimeout(r, 2000));
            browsers[browserIndex] = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            });
            pageCounters[browserIndex] = 0;
          }

          const page = await browsers[browserIndex].newPage();
          try {
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });

            await page.goto(item.activity.registrationUrl, {
              waitUntil: 'networkidle2',
              timeout: CONFIG.pageTimeout
            });

            const detailData = await extractActiveNetworkData(page);

            // Debug first few
            if (processed < 3) {
              log(`  Debug ${processed}: ${JSON.stringify(detailData)}`);
            }

            // Update only missing fields
            const updateData = {};
            if (detailData.description && (!item.activity.description || item.activity.description === '')) {
              updateData.description = detailData.description;
              extracted.desc++;
            }
            if (detailData.dateStart && !item.activity.dateStart) {
              updateData.dateStart = new Date(detailData.dateStart);
              extracted.date++;
            }
            if (detailData.dateEnd && !item.activity.dateEnd) {
              updateData.dateEnd = new Date(detailData.dateEnd);
            }
            if (detailData.locationName && (!item.activity.locationName || item.activity.locationName === '')) {
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

            if (Object.keys(updateData).length > 0) {
              await prisma.activity.update({
                where: { id: item.activity.id },
                data: updateData
              });
              updated++;
            }

            consecutiveErrors = 0; // Reset on success

          } finally {
            await page.close();
            pageCounters[browserIndex]++;
          }

          processed++;

        } catch (error) {
          consecutiveErrors++;
          if (item.retries < CONFIG.maxRetries) {
            item.retries++;
            queue.push(item);
          } else {
            errors++;
            processed++;
          }

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            log(`⚠️  ${MAX_CONSECUTIVE_ERRORS} consecutive errors - pausing for 60 seconds...`);
            await new Promise(r => setTimeout(r, 60000));
            consecutiveErrors = 0;
          }
        }
      }
    };

    // Run workers for this batch
    await Promise.all(browsers.map((_, i) => worker(i)));

    // Progress report
    const pct = ((processed / activities.length) * 100).toFixed(1);
    log(`Batch ${batchNum + 1} complete: ${processed}/${activities.length} (${pct}%)`);
    log(`  Updated: ${updated}, Errors: ${errors}`);
    log(`  Extracted: desc=${extracted.desc}, date=${extracted.date}, loc=${extracted.loc}, time=${extracted.time}`);

    // Pause between batches if not last batch
    if (batchNum < totalBatches - 1) {
      log(`Pausing ${CONFIG.batchDelay/1000}s before next batch...`);
      await new Promise(r => setTimeout(r, CONFIG.batchDelay));
    }
  }

  // Cleanup
  for (const browser of browsers) {
    try { await browser.close(); } catch (e) {}
  }

  log(`\n✅ Complete!`);
  log(`  Processed: ${processed}`);
  log(`  Updated: ${updated}`);
  log(`  Errors: ${errors}`);
  log(`  Extracted: desc=${extracted.desc}, date=${extracted.date}, loc=${extracted.loc}, time=${extracted.time}`);

  await prisma.$disconnect();
}

main().catch(console.error);
