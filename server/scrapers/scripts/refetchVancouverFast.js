#!/usr/bin/env node
/**
 * Vancouver fast detail refetch - 4 browsers parallel with proper handling
 */

const { PrismaClient } = require('../../generated/prisma');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();
const BROWSER_COUNT = 4;
const PAGE_TIMEOUT = 30000;
const RENDER_WAIT = 3500;
const BATCH_SIZE = 100;
const RESTART_AFTER = 25;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function extractData(page) {
  await new Promise(r => setTimeout(r, RENDER_WAIT));
  return page.evaluate(() => {
    const data = {};
    const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l);

    // Description
    const descIdx = lines.findIndex(l => l === 'Description');
    if (descIdx >= 0) {
      const descLines = [];
      for (let i = descIdx + 1; i < lines.length && i < descIdx + 10; i++) {
        const line = lines[i];
        if (/^(Keyboard shortcuts|Map data|Activity meeting dates|Instructor|More Information)/.test(line)) break;
        if (line.length > 20) descLines.push(line);
      }
      if (descLines.length > 0) data.description = descLines.join(' ').substring(0, 500);
    }

    // Dates - handle both ranges and single dates
    for (const line of lines) {
      // Date range: "Jan 10, 2026 - Feb 28, 2026"
      let m = line.match(/([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})/);
      if (m) {
        const s = new Date(m[1]), e = new Date(m[2]);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          data.dateStart = s.toISOString();
          data.dateEnd = e.toISOString();
          break;
        }
      }
      // Single date: "Dec 15, 2025" (but not on lines with extra content)
      m = line.match(/^([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})$/);
      if (m) {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) {
          data.dateStart = d.toISOString();
          data.dateEnd = d.toISOString();
          break;
        }
      }
    }

    // Times
    for (const line of lines) {
      let m = line.match(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:,\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))*)\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M|Noon|Midnight)/i);
      if (m) {
        const dayMap = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
        const days = m[1].match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/gi);
        if (days) data.dayOfWeek = [...new Set(days.map(d => dayMap[d.toLowerCase()]))];
        data.startTime = m[2];
        data.endTime = m[3] === 'Noon' ? '12:00 PM' : (m[3] === 'Midnight' ? '12:00 AM' : m[3]);
        break;
      }
    }

    // Location - line after date (range or single)
    for (let i = 0; i < lines.length; i++) {
      // Match date range OR single date
      if (/^[A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4}/.test(lines[i])) {
        const next = lines[i + 1];
        if (next && next.length < 60 &&
            !/^\d+\s*(?:yrs?|years?)/i.test(next) &&
            !/^[A-Z][a-z]{2,8}\s+\d/.test(next) &&
            !/^Age\s/i.test(next) &&
            !/^Description$/i.test(next)) {
          data.locationName = next;
          break;
        }
      }
    }

    // Age
    for (const line of lines) {
      const m = line.match(/(\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)/i);
      if (m) { data.ageMin = parseInt(m[1]); data.ageMax = parseInt(m[2]); break; }
      const m2 = line.match(/(\d+)\s*(?:yrs?|years?)\s*\+/i);
      if (m2) { data.ageMin = parseInt(m2[1]); data.ageMax = 99; break; }
    }

    // Cost
    const prices = document.body.innerText.match(/\$\d+(?:\.\d{2})?/g);
    if (prices) {
      const nums = prices.map(p => parseFloat(p.replace('$', ''))).filter(p => p > 0 && p < 5000);
      if (nums.length > 0) data.cost = Math.max(...nums);
    }

    return data;
  });
}

async function processActivity(browser, activity, stats) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(activity.registrationUrl, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });

    const data = await extractData(page);

    const updateData = {};
    if (data.description && (!activity.description || activity.description === '')) {
      updateData.description = data.description;
      stats.desc++;
    }
    if (data.dateStart && !activity.dateStart) {
      updateData.dateStart = new Date(data.dateStart);
      stats.date++;
    }
    if (data.dateEnd && !activity.dateEnd) {
      updateData.dateEnd = new Date(data.dateEnd);
    }
    if (data.locationName && (!activity.locationName || activity.locationName === '')) {
      updateData.locationName = data.locationName;
      stats.loc++;
    }
    if (data.startTime && !activity.startTime) {
      updateData.startTime = data.startTime;
      stats.time++;
    }
    if (data.endTime && !activity.endTime) updateData.endTime = data.endTime;
    if (data.dayOfWeek && (!activity.dayOfWeek || activity.dayOfWeek.length === 0)) updateData.dayOfWeek = data.dayOfWeek;
    if (data.ageMin !== undefined && activity.ageMin === null) updateData.ageMin = data.ageMin;
    if (data.ageMax !== undefined && activity.ageMax === null) updateData.ageMax = data.ageMax;
    if (data.cost && (!activity.cost || activity.cost === 0)) updateData.cost = data.cost;

    if (Object.keys(updateData).length > 0) {
      await prisma.activity.update({ where: { id: activity.id }, data: updateData });
      stats.updated++;
    }
    stats.processed++;
  } catch (e) {
    stats.errors++;
    stats.processed++;
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  log('Vancouver Fast Detail Refetch');

  const activities = await prisma.activity.findMany({
    where: {
      providerId: 'e22974df-bfcf-41b3-a1d9-db32ece51ecf',
      isActive: true,
      registrationUrl: { not: null },
      OR: [
        { description: null }, { description: '' },
        { dateStart: null },
        { locationName: null }, { locationName: '' },
        { startTime: null }
      ]
    },
    take: limit || undefined,
    orderBy: { id: 'asc' }
  });

  log(`Found ${activities.length} activities`);
  if (!activities.length) { await prisma.$disconnect(); return; }

  // Create browser pool
  const browsers = [];
  for (let i = 0; i < BROWSER_COUNT; i++) {
    browsers.push(await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }));
  }

  const stats = { processed: 0, updated: 0, errors: 0, desc: 0, date: 0, loc: 0, time: 0 };
  const pageCounts = new Array(BROWSER_COUNT).fill(0);
  let queueIndex = 0;
  const startTime = Date.now();

  // Process in batches with worker pool
  const processBatch = async () => {
    const promises = [];

    for (let i = 0; i < BROWSER_COUNT && queueIndex < activities.length; i++) {
      const activity = activities[queueIndex++];
      const browserIdx = i;

      promises.push((async () => {
        try {
          // Restart browser if needed
          if (pageCounts[browserIdx] >= RESTART_AFTER) {
            try { await browsers[browserIdx].close(); } catch (e) {}
            browsers[browserIdx] = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            });
            pageCounts[browserIdx] = 0;
          }

          await processActivity(browsers[browserIdx], activity, stats);
          pageCounts[browserIdx]++;
        } catch (e) {
          stats.errors++;
          stats.processed++;
        }
      })());
    }

    try {
      await Promise.all(promises);
    } catch (e) {
      // Errors should already be handled in individual promises
    }
  };

  // Process all activities
  while (queueIndex < activities.length) {
    await processBatch();

    if (stats.processed % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 60000;
      const rate = stats.processed / elapsed;
      const remaining = (activities.length - stats.processed) / rate;
      log(`Progress: ${stats.processed}/${activities.length} (${((stats.processed / activities.length) * 100).toFixed(1)}%)`);
      log(`  Updated=${stats.updated} Errors=${stats.errors} Rate=${rate.toFixed(1)}/min ETA=${remaining.toFixed(1)}min`);
      log(`  Extracted: desc=${stats.desc} date=${stats.date} loc=${stats.loc} time=${stats.time}`);
    }
  }

  // Cleanup
  for (const b of browsers) {
    try { await b.close(); } catch (e) {}
  }

  const elapsed = (Date.now() - startTime) / 60000;
  log(`\n✅ Complete in ${elapsed.toFixed(1)} minutes`);
  log(`  Processed=${stats.processed} Updated=${stats.updated} Errors=${stats.errors}`);
  log(`  Extracted: desc=${stats.desc} date=${stats.date} loc=${stats.loc} time=${stats.time}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
