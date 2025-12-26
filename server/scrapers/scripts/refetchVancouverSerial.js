#!/usr/bin/env node
/**
 * Vancouver detail refetch - SERIAL edition (single browser, no concurrency issues)
 */

const { PrismaClient } = require('../../generated/prisma');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

const CONFIG = {
  pageTimeout: 35000,
  maxRetries: 2,
  renderWait: 4000,
  delayBetweenRequests: 800,
  browserRestartInterval: 20
};

function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function extractData(page) {
  await new Promise(r => setTimeout(r, CONFIG.renderWait));

  return page.evaluate(() => {
    const data = {};
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // Description
    const descIdx = lines.findIndex(l => l === 'Description');
    if (descIdx >= 0) {
      const descLines = [];
      for (let i = descIdx + 1; i < lines.length && i < descIdx + 10; i++) {
        const line = lines[i];
        if (line === 'Keyboard shortcuts' || line.startsWith('Map data') ||
            line === 'Activity meeting dates' || line === 'Instructor' ||
            line === 'More Information') break;
        if (line.length > 20) descLines.push(line);
      }
      if (descLines.length > 0) data.description = descLines.join(' ').substring(0, 500);
    }

    // Dates - "Jan 9, 2026 - Mar 13, 2026"
    for (const line of lines) {
      const m = line.match(/([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4})/);
      if (m) {
        const s = new Date(m[1]), e = new Date(m[2]);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          data.dateStart = s.toISOString();
          data.dateEnd = e.toISOString();
          break;
        }
      }
    }

    // Times - "Fri4:15 PM - 4:45 PM" or "Sat11:30 AM - Noon"
    for (const line of lines) {
      // Pattern with standard times
      let m = line.match(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))*)\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (m) {
        const dayMap = { 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday', 'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday' };
        const days = m[1].match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/gi);
        if (days) data.dayOfWeek = [...new Set(days.map(d => dayMap[d.toLowerCase()]))];
        data.startTime = m[2];
        data.endTime = m[3];
        break;
      }
      // Pattern with Noon/Midnight as end time
      m = line.match(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))*)\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(Noon|Midnight)/i);
      if (m) {
        const dayMap = { 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday', 'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday' };
        const days = m[1].match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/gi);
        if (days) data.dayOfWeek = [...new Set(days.map(d => dayMap[d.toLowerCase()]))];
        data.startTime = m[2];
        data.endTime = m[3].toLowerCase() === 'noon' ? '12:00 PM' : '12:00 AM';
        break;
      }
    }

    // Location - find line right after date range
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for date pattern and capture next line as location
      if (/^[A-Z][a-z]{2,8}\s+\d{1,2},?\s*\d{4}\s*-/.test(line)) {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.length < 60 &&
            !/^\d+\s*(?:yrs?|years?)/i.test(nextLine) &&
            !/^[A-Z][a-z]{2,8}\s+\d/.test(nextLine) &&
            !/^Description$/i.test(nextLine)) {
          data.locationName = nextLine;
          break;
        }
      }
      // Also match explicit room patterns
      if (/^\d+\s+[A-Za-z].*(?:Room|Gymnasium|Pool|Arena|Rink|Court|Studio|Hall|Field|Centre)/i.test(line)) {
        data.locationName = line;
        break;
      }
      if (/^[A-Za-z].*(?:Room|Gymnasium|Pool|Arena|Rink|Court|Studio|Hall|Field|Lounge)$/i.test(line) && line.length < 50) {
        data.locationName = line;
        break;
      }
    }

    // Age
    for (const line of lines) {
      const m = line.match(/(\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)/i);
      if (m) {
        data.ageMin = parseInt(m[1]);
        data.ageMax = parseInt(m[2]);
        break;
      }
      const m2 = line.match(/(\d+)\s*(?:yrs?|years?)\s*\+/i);
      if (m2) {
        data.ageMin = parseInt(m2[1]);
        data.ageMax = 99;
        break;
      }
    }

    // Cost
    const prices = text.match(/\$\d+(?:\.\d{2})?/g);
    if (prices) {
      const nums = prices.map(p => parseFloat(p.replace('$', ''))).filter(p => p > 0 && p < 5000);
      if (nums.length > 0) data.cost = Math.max(...nums);
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

  const providerId = 'e22974df-bfcf-41b3-a1d9-db32ece51ecf';

  log('Vancouver Detail Refetch - Serial Edition');

  const activities = await prisma.activity.findMany({
    where: {
      providerId,
      isActive: true,
      registrationUrl: { not: null },
      OR: [
        { description: null }, { description: '' },
        { dateStart: null },
        { locationName: null }, { locationName: '' },
        { startTime: null }
      ]
    },
    skip,
    take: limit || undefined,
    orderBy: { id: 'asc' }
  });

  log(`Found ${activities.length} activities`);
  if (activities.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let processed = 0, updated = 0, errors = 0;
  let extracted = { desc: 0, date: 0, loc: 0, time: 0 };
  let pageCount = 0;

  for (const activity of activities) {
    // Restart browser periodically
    if (pageCount >= CONFIG.browserRestartInterval) {
      await browser.close();
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      pageCount = 0;
    }

    let retries = 0;
    while (retries <= CONFIG.maxRetries) {
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(activity.registrationUrl, {
          waitUntil: 'networkidle2',
          timeout: CONFIG.pageTimeout
        });

        const data = await extractData(page);
        await page.close();
        pageCount++;

        // Update missing fields
        const updateData = {};
        if (data.description && (!activity.description || activity.description === '')) {
          updateData.description = data.description;
          extracted.desc++;
        }
        if (data.dateStart && !activity.dateStart) {
          updateData.dateStart = new Date(data.dateStart);
          extracted.date++;
        }
        if (data.dateEnd && !activity.dateEnd) {
          updateData.dateEnd = new Date(data.dateEnd);
        }
        if (data.locationName && (!activity.locationName || activity.locationName === '')) {
          updateData.locationName = data.locationName;
          extracted.loc++;
        }
        if (data.startTime && !activity.startTime) {
          updateData.startTime = data.startTime;
          extracted.time++;
        }
        if (data.endTime && !activity.endTime) updateData.endTime = data.endTime;
        if (data.dayOfWeek && (!activity.dayOfWeek || activity.dayOfWeek.length === 0)) {
          updateData.dayOfWeek = data.dayOfWeek;
        }
        if (data.ageMin !== undefined && activity.ageMin === null) updateData.ageMin = data.ageMin;
        if (data.ageMax !== undefined && activity.ageMax === null) updateData.ageMax = data.ageMax;
        if (data.cost && (!activity.cost || activity.cost === 0)) updateData.cost = data.cost;

        if (Object.keys(updateData).length > 0) {
          await prisma.activity.update({ where: { id: activity.id }, data: updateData });
          updated++;
        }

        break; // Success
      } catch (error) {
        retries++;
        if (retries > CONFIG.maxRetries) {
          errors++;
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    processed++;
    await new Promise(r => setTimeout(r, CONFIG.delayBetweenRequests));

    if (processed % 25 === 0) {
      const pct = ((processed / activities.length) * 100).toFixed(1);
      log(`Progress: ${processed}/${activities.length} (${pct}%) Updated=${updated} Errors=${errors}`);
      log(`  Extracted: desc=${extracted.desc} date=${extracted.date} loc=${extracted.loc} time=${extracted.time}`);
    }
  }

  await browser.close();

  log(`Complete! Processed=${processed} Updated=${updated} Errors=${errors}`);
  log(`Extracted: desc=${extracted.desc} date=${extracted.date} loc=${extracted.loc} time=${extracted.time}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
