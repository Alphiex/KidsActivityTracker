#!/usr/bin/env node
/**
 * Re-fetch detail pages for activities that are missing data
 * Uses platform-specific extraction logic from existing scrapers
 * Supports: perfectmind, activenetwork, intelligenz
 *
 * Usage:
 *   node scrapers/scripts/refetchDetails.js <provider-code> [--limit=N]
 *
 * Examples:
 *   node scrapers/scripts/refetchDetails.js vancouver
 *   node scrapers/scripts/refetchDetails.js surrey --limit=100
 */

const { PrismaClient } = require('../../generated/prisma');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  browserCount: 4,          // Number of parallel browser instances
  batchSize: 20,            // Save to DB every N activities
  browserRestartInterval: 30, // Restart browser every N pages
  pageTimeout: 25000,       // Timeout per page
  maxRetries: 2             // Max retries per activity
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ============================================================
// PERFECTMIND EXTRACTION (Surrey, North Vancouver, Richmond, etc.)
// ============================================================
function extractPerfectMindData(pageHtml, pageText) {
  const data = {};

  // === LOCATION COORDINATES ===
  const latMatch = pageHtml.match(/["']Latitude["']\s*:\s*(-?\d+\.\d+)/i);
  const lngMatch = pageHtml.match(/["']Longitude["']\s*:\s*(-?\d+\.\d+)/i);
  if (latMatch && lngMatch) {
    data.latitude = parseFloat(latMatch[1]);
    data.longitude = parseFloat(lngMatch[1]);
  }

  // === LOCATION NAME ===
  const locMatch = pageHtml.match(/["']ActualLocation["']\s*:\s*["']([^"']+)["']/i);
  if (locMatch && locMatch[1].trim()) {
    data.locationName = locMatch[1].trim();
  }
  if (!data.locationName) {
    const locTextMatch = pageText.match(/\n([A-Z][A-Za-z\s]+(?:Centre|Center|Arena|Pool|Rink|Hall|Pavilion|Complex|Facility|Park))\s*\n?\s*Show Map/i);
    if (locTextMatch) {
      data.locationName = locTextMatch[1].trim();
    }
  }

  // === DATES ===
  const startDateMatch = pageHtml.match(/["']StartDate["']\s*:\s*["'](\d{4}-\d{2}-\d{2})/i);
  const endDateMatch = pageHtml.match(/["']EndDate["']\s*:\s*["'](\d{4}-\d{2}-\d{2})/i);
  if (startDateMatch) data.dateStart = new Date(startDateMatch[1]);
  if (endDateMatch) data.dateEnd = new Date(endDateMatch[1]);

  // Try MM/DD/YY format
  if (!data.dateStart) {
    const mmddyyMatch = pageText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (mmddyyMatch) {
      const parseMMDDYY = (str) => {
        const [m, d, y] = str.split('/').map(Number);
        const year = y < 100 ? 2000 + y : y;
        return new Date(year, m - 1, d);
      };
      data.dateStart = parseMMDDYY(mmddyyMatch[1]);
      data.dateEnd = parseMMDDYY(mmddyyMatch[2]);
    }
  }

  // === TIMES ===
  const startTimeMatch = pageHtml.match(/["']StartTime["']\s*:\s*["']([^"']+)["']/i);
  const endTimeMatch = pageHtml.match(/["']EndTime["']\s*:\s*["']([^"']+)["']/i);
  if (startTimeMatch) data.startTime = startTimeMatch[1];
  if (endTimeMatch) data.endTime = endTimeMatch[1];

  // Visible time format
  if (!data.startTime) {
    const timeMatch = pageText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(?:to|-)\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
    if (timeMatch) {
      data.startTime = timeMatch[1].trim();
      data.endTime = timeMatch[2].trim();
    }
  }

  // === DAY OF WEEK ===
  const daysMatch = pageHtml.match(/["']DayOfWeek["']\s*:\s*["']([^"']+)["']/i) ||
                    pageHtml.match(/["']Days["']\s*:\s*["']([^"']+)["']/i);
  if (daysMatch) {
    data.dayOfWeek = daysMatch[1].split(/[,\s]+/).filter(d => d.length > 2);
  }

  // Full day names from visible text
  const fullDayPatterns = pageText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?/gi);
  if (fullDayPatterns && fullDayPatterns.length > 0 && !data.dayOfWeek) {
    data.dayOfWeek = [...new Set(fullDayPatterns.map(d => d.replace(/s$/i, '')))];
  }

  // Abbreviated days
  if (!data.dayOfWeek || data.dayOfWeek.length === 0) {
    const shortDayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
    const shortDayPatterns = pageText.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g);
    if (shortDayPatterns && shortDayPatterns.length > 0) {
      data.dayOfWeek = [...new Set(shortDayPatterns.map(d => shortDayMap[d] || d))];
    }
  }

  // === AGE RANGE ===
  const ageMinMatch = pageHtml.match(/["']MinAge["']\s*:\s*(\d+)/i) ||
                      pageHtml.match(/["']AgeMin["']\s*:\s*(\d+)/i);
  const ageMaxMatch = pageHtml.match(/["']MaxAge["']\s*:\s*(\d+)/i) ||
                      pageHtml.match(/["']AgeMax["']\s*:\s*(\d+)/i);
  if (ageMinMatch) data.ageMin = parseInt(ageMinMatch[1]);
  if (ageMaxMatch) data.ageMax = parseInt(ageMaxMatch[1]);

  // Visible text age patterns
  if (!data.ageMin) {
    const ageRestrictionMatch = pageText.match(/Age\s*Restriction\s*(\d+)\s*(?:to|-)\s*(\d+)/i);
    if (ageRestrictionMatch) {
      data.ageMin = parseInt(ageRestrictionMatch[1]);
      data.ageMax = parseInt(ageRestrictionMatch[2]);
    } else {
      const ageRangeMatch = pageText.match(/(?:Ages?\s*)?(\d+)\s*(?:to|-)\s*(\d+)\s*(?:y(?:rs?|ears?)?|months?)?/i);
      if (ageRangeMatch) {
        data.ageMin = parseInt(ageRangeMatch[1]);
        data.ageMax = parseInt(ageRangeMatch[2]);
      }
    }
  }

  // === COST ===
  const feeMatch = pageHtml.match(/["']Fee["']\s*:\s*(\d+(?:\.\d{2})?)/i) ||
                   pageHtml.match(/["']Price["']\s*:\s*(\d+(?:\.\d{2})?)/i);
  if (feeMatch) data.cost = parseFloat(feeMatch[1]);

  // Visible cost
  const costMatch = pageText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (costMatch && !data.cost) {
    data.cost = parseFloat(costMatch[1].replace(/,/g, ''));
  }

  // === DESCRIPTION ===
  const descMatch = pageHtml.match(/["']Description["']\s*:\s*["']([^"]{50,})["']/i);
  if (descMatch) {
    data.description = descMatch[1].substring(0, 500);
  }

  // Visible description
  if (!data.description) {
    const descTextMatch = pageText.match(/(?:Description|About this (?:program|class|activity|Course))\s*[:\n]?\s*(.+?)(?=\n\s*(?:[A-Z][A-Za-z\s]+(?:Centre|Center|Arena|Pool|Rink)|Instructor|What to Bring|Prerequisites|Requirements|Registration|Course ID|Show Map|$))/si);
    if (descTextMatch) {
      data.description = descTextMatch[1].trim().substring(0, 500);
    }
  }

  return data;
}

// ============================================================
// ACTIVENETWORK EXTRACTION (Vancouver, West Vancouver)
// ============================================================
function extractActiveNetworkData(pageHtml, pageText) {
  const data = {};

  // === DATES ===
  // ActiveNet format: "Jan 10, 2026 - Mar 21, 2026"
  const dateRangeMatch = pageText.match(/([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/);
  if (dateRangeMatch) {
    const parseDate = (str) => {
      try {
        return new Date(str);
      } catch {
        return null;
      }
    };
    data.dateStart = parseDate(dateRangeMatch[1]);
    data.dateEnd = parseDate(dateRangeMatch[2]);
  }

  // === DAY OF WEEK & TIMES ===
  // "Weekdays9:00 AM - 4:00 PM" or "Mon, Wed9:00 AM - 10:00 AM"
  const weekdaysMatch = pageText.match(/Weekdays?\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (weekdaysMatch) {
    data.dayOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    data.startTime = weekdaysMatch[1];
    data.endTime = weekdaysMatch[2];
  } else {
    // Try specific day patterns
    const scheduleMatch = pageText.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,?\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*)\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (scheduleMatch) {
      const dayStr = scheduleMatch[1];
      const dayMatches = dayStr.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi);
      if (dayMatches) {
        const dayMap = {
          'mon': 'Monday', 'monday': 'Monday',
          'tue': 'Tuesday', 'tuesday': 'Tuesday',
          'wed': 'Wednesday', 'wednesday': 'Wednesday',
          'thu': 'Thursday', 'thursday': 'Thursday',
          'fri': 'Friday', 'friday': 'Friday',
          'sat': 'Saturday', 'saturday': 'Saturday',
          'sun': 'Sunday', 'sunday': 'Sunday'
        };
        data.dayOfWeek = [...new Set(dayMatches.map(d => dayMap[d.toLowerCase()] || d))];
      }
      data.startTime = scheduleMatch[2];
      data.endTime = scheduleMatch[3];
    }
  }

  // === LOCATION NAME ===
  // Look for facility patterns
  const roomMatch = pageText.match(/\n([A-Za-z][A-Za-z\s]+(?:Room|Gymnasium|Pool|Arena|Field|Court|Studio|Hall|Rink|Centre|Center))\n/);
  if (roomMatch) {
    data.locationName = roomMatch[1].trim();
  }

  // Fallback: look for community centre patterns
  if (!data.locationName) {
    const fallbackMatch = pageText.match(/([A-Za-z][A-Za-z\s-]+(?:Community Centre|Recreation Centre|Civic Centre|Community Center|Rec Centre))/i);
    if (fallbackMatch) {
      data.locationName = fallbackMatch[1].trim();
    }
  }

  // === AGE RANGE ===
  const allAgesMatch = pageText.match(/\bAll\s*ages?\b/i);
  if (allAgesMatch) {
    data.ageMin = 0;
    data.ageMax = 99;
  } else {
    const ageMatch1 = pageText.match(/Age\s+(?:at\s+least\s+)?(\d+)\s*(?:yrs?|years?)?\s*(?:but\s+less\s+than|to|-)\s*(\d+)/i);
    const ageMatch2 = pageText.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:yrs?|years?)/i);
    const ageMatch3 = pageText.match(/(\d+)\s*(?:yrs?|years?)\s*\+/i);

    if (ageMatch1) {
      data.ageMin = parseInt(ageMatch1[1]);
      data.ageMax = parseInt(ageMatch1[2]);
    } else if (ageMatch2) {
      data.ageMin = parseInt(ageMatch2[1]);
      data.ageMax = parseInt(ageMatch2[2]);
    } else if (ageMatch3) {
      data.ageMin = parseInt(ageMatch3[1]);
      data.ageMax = 99;
    }
  }

  // === COST ===
  const costMatches = pageText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
  if (costMatches) {
    const fees = costMatches.map(c => parseFloat(c.replace(/[$,]/g, '')));
    data.cost = Math.max(...fees);
  }

  // === DESCRIPTION ===
  const descMatch = pageText.match(/Description\s*\n\s*(.+?)(?=\n\s*(?:Keyboard|Activity meeting|Instructor|More Information|What to Bring|Requirements|Prerequisites))/s);
  if (descMatch) {
    data.description = descMatch[1].trim().substring(0, 500);
  }

  // === COORDINATES ===
  const latMatch = pageHtml.match(/["'](?:latitude|lat)["']\s*:\s*(-?\d+\.\d+)/i);
  const lngMatch = pageHtml.match(/["'](?:longitude|lng|lon)["']\s*:\s*(-?\d+\.\d+)/i);
  if (latMatch && lngMatch) {
    data.latitude = parseFloat(latMatch[1]);
    data.longitude = parseFloat(lngMatch[1]);
  }

  return data;
}

// ============================================================
// INTELLIGENZ EXTRACTION (Pitt Meadows, Bowen Island)
// ============================================================
function extractIntelligenzData(pageHtml, pageText) {
  const data = {};

  // Intelligenz uses table-based layout with label/value pairs

  // === AGES ===
  const agesMatch = pageText.match(/Ages?\s*[\n:]\s*(\d+)\s*[-–]\s*(\d+)/i);
  if (agesMatch) {
    data.ageMin = parseInt(agesMatch[1]);
    data.ageMax = parseInt(agesMatch[2]);
  }

  // === DATES ===
  // Format: "Start Date: Dec 15, 2025" or "Start Date\nDec 15, 2025"
  const startDateMatch = pageText.match(/Start\s*Date[\n:\s]+([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/i);
  const endDateMatch = pageText.match(/End\s*Date[\n:\s]+([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/i);

  if (startDateMatch) {
    try {
      data.dateStart = new Date(startDateMatch[1]);
    } catch {}
  }
  if (endDateMatch) {
    try {
      data.dateEnd = new Date(endDateMatch[1]);
    } catch {}
  }

  // === SCHEDULE TABLE (day, start time, end time, instructor, location, venue) ===
  // Parse from visible text
  const scheduleLines = pageText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi);
  if (scheduleLines && scheduleLines.length > 0) {
    const days = [];
    scheduleLines.forEach(line => {
      const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
      const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      if (dayMatch) {
        days.push(dayMatch[1]);
      }
      if (timeMatch && !data.startTime) {
        data.startTime = timeMatch[1];
        data.endTime = timeMatch[2];
      }
    });
    if (days.length > 0) {
      data.dayOfWeek = [...new Set(days)];
    }
  }

  // === LOCATION ===
  const locationMatch = pageText.match(/(?:Location|Venue|Facility)[\n:\s]+([A-Za-z][A-Za-z\s-]+(?:Centre|Center|Arena|Pool|Hall|Room|Field)?)/i);
  if (locationMatch) {
    data.locationName = locationMatch[1].trim();
  }

  // === COST ===
  const priceMatch = pageText.match(/\$\s*([\d,.]+)/);
  if (priceMatch) {
    data.cost = parseFloat(priceMatch[1].replace(/,/g, ''));
  }

  // === DESCRIPTION ===
  // First paragraph in panel-body
  const descMatch = pageText.match(/Course:\s*\d+\s*-\s*[^\n]+\n\s*(.+?)(?=\n\s*(?:Ages?|Start Date|End Date|Spaces|Course Type|$))/si);
  if (descMatch) {
    data.description = descMatch[1].trim().substring(0, 500);
  }

  // Fallback description extraction
  if (!data.description) {
    // Look for any paragraph that's at least 50 chars
    const paragraphs = pageText.split(/\n\n+/);
    for (const para of paragraphs) {
      const cleaned = para.trim();
      if (cleaned.length > 50 && !cleaned.match(/^(Ages?|Start Date|End Date|Spaces|Course Type|Location)/i)) {
        data.description = cleaned.substring(0, 500);
        break;
      }
    }
  }

  return data;
}

// ============================================================
// MAIN EXTRACTION FUNCTION (dispatches to platform-specific)
// ============================================================
async function extractDetailData(page, platform) {
  const { pageHtml, pageText } = await page.evaluate(() => ({
    pageHtml: document.documentElement.outerHTML,
    pageText: document.body.innerText
  }));

  switch (platform) {
    case 'perfectmind':
      return extractPerfectMindData(pageHtml, pageText);
    case 'activenetwork':
      return extractActiveNetworkData(pageHtml, pageText);
    case 'intelligenz':
      return extractIntelligenzData(pageHtml, pageText);
    default:
      // Fallback to generic extraction (PerfectMind patterns work for most)
      return extractPerfectMindData(pageHtml, pageText);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const providerCode = args[0];
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  if (!providerCode) {
    console.log('Usage: node scrapers/scripts/refetchDetails.js <provider-code> [--limit=N]');
    console.log('\nAvailable providers:');
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      select: { id: true, name: true, platform: true }
    });
    providers.forEach(p => console.log(`  - ${p.name} (${p.platform}) [${p.id}]`));
    process.exit(1);
  }

  // Find provider - first try exact ID match
  let provider = await prisma.provider.findUnique({
    where: { id: providerCode }
  });

  // If not found by ID, search by name
  if (!provider) {
    provider = await prisma.provider.findFirst({
      where: {
        name: { contains: providerCode, mode: 'insensitive' }
      }
    });
  }

  if (!provider) {
    console.error(`Provider not found: ${providerCode}`);
    process.exit(1);
  }

  log(`Provider: ${provider.name}`);
  log(`Platform: ${provider.platform}`);

  // Find activities missing key fields
  const whereClause = {
    providerId: provider.id,
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
    take: limit || undefined,
    orderBy: { id: 'asc' }
  });

  log(`Found ${activities.length} activities needing detail updates`);

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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    browsers.push(browser);
    pageCounters.push(0);
  }

  // Create work queue
  const queue = activities.map((a, i) => ({ activity: a, index: i, retries: 0 }));
  let processed = 0;
  let updated = 0;
  let errors = 0;

  // Worker function
  const worker = async (browserIndex) => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      try {
        // Restart browser if needed
        if (pageCounters[browserIndex] >= CONFIG.browserRestartInterval) {
          log(`Restarting browser ${browserIndex + 1}...`);
          try { await browsers[browserIndex].close(); } catch (e) {}
          browsers[browserIndex] = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          pageCounters[browserIndex] = 0;
        }

        const page = await browsers[browserIndex].newPage();
        try {
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
          await page.goto(item.activity.registrationUrl, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.pageTimeout
          });

          await new Promise(r => setTimeout(r, 2000));

          const detailData = await extractDetailData(page, provider.platform);

          // Update activity in database if we found data
          if (Object.keys(detailData).length > 0) {
            await prisma.activity.update({
              where: { id: item.activity.id },
              data: detailData
            });
            updated++;
          }

        } finally {
          await page.close();
          pageCounters[browserIndex]++;
        }

        processed++;
        if (processed % 25 === 0) {
          const pct = ((processed / activities.length) * 100).toFixed(1);
          log(`Progress: ${processed}/${activities.length} (${pct}%) - Updated: ${updated}, Errors: ${errors}`);
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
  log(`  Time: ${elapsed} minutes`);
  log(`  Rate: ${(processed / (elapsed || 1)).toFixed(1)} activities/minute`);

  await prisma.$disconnect();
}

main().catch(console.error);
