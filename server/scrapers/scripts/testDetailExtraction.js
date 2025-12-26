#!/usr/bin/env node
/**
 * Test Detail Extraction Script
 * Tests the enhanced detail extraction on a sample Vancouver activity
 */

const puppeteer = require('puppeteer');

async function testDetailExtraction() {
  console.log('Testing Enhanced Detail Extraction');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  console.log('\nFetching Vancouver activity detail page...');
  await page.goto('https://anc.ca.apm.activecommunities.com/vancouver/activity/search/detail/585722', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  await new Promise(r => setTimeout(r, 3000));

  const detailData = await page.evaluate(() => {
    const data = {};
    const pageText = document.body.innerText;
    const pageHtml = document.documentElement.outerHTML;

    // === DATES ===
    const dateRangeMatch = pageText.match(/([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/);
    if (dateRangeMatch) {
      data.dateStartStr = dateRangeMatch[1];
      data.dateEndStr = dateRangeMatch[2];
    }

    // === DAY OF WEEK & TIMES ===
    const scheduleMatch = pageText.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,?\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))*\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
    if (scheduleMatch) {
      const dayStr = scheduleMatch[0].split(/\d/)[0];
      const dayMatches = dayStr.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi);
      if (dayMatches) {
        data.dayOfWeek = [...new Set(dayMatches.map(d => {
          const dayMap = {
            'mon': 'Monday', 'monday': 'Monday',
            'tue': 'Tuesday', 'tuesday': 'Tuesday',
            'wed': 'Wednesday', 'wednesday': 'Wednesday',
            'thu': 'Thursday', 'thursday': 'Thursday',
            'fri': 'Friday', 'friday': 'Friday',
            'sat': 'Saturday', 'saturday': 'Saturday',
            'sun': 'Sunday', 'sunday': 'Sunday'
          };
          return dayMap[d.toLowerCase()] || d;
        }))];
      }
      data.startTime = scheduleMatch[3];
      data.endTime = scheduleMatch[4];
    }

    // === AGE RANGE ===
    const ageMatch1 = pageText.match(/Age\s+(?:at\s+least\s+)?(\d+)\s*(?:yrs?|years?)?\s*(?:but\s+less\s+than|to|-)\s*(\d+)/i);
    if (ageMatch1) {
      data.ageMin = parseInt(ageMatch1[1]);
      data.ageMax = parseInt(ageMatch1[2]);
    }

    // === COST ===
    const costMatches = pageText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
    if (costMatches) {
      const fees = costMatches.map(c => parseFloat(c.replace(/[$,]/g, '')));
      data.cost = Math.max(...fees);
    }

    // === DESCRIPTION ===
    const descMatch = pageText.match(/Description\s*\n\s*(.+?)(?=\n\s*(?:Keyboard|Activity meeting|Instructor|More Information))/s);
    if (descMatch) {
      data.description = descMatch[1].trim().substring(0, 200) + '...';
    }

    // === INSTRUCTOR ===
    const instructorMatch = pageText.match(/Instructor\s*\n\s*([^\n]+)/);
    if (instructorMatch) {
      data.instructor = instructorMatch[1].trim();
    }

    // === SESSIONS ===
    const sessionsMatch = pageText.match(/Number of sessions\s*\n?\s*(\d+)/i);
    if (sessionsMatch) {
      data.sessionCount = parseInt(sessionsMatch[1]);
    }

    // === REGISTRATION STATUS ===
    if (/Full\s*\+?\s*Waiting\s*List/i.test(pageText)) {
      data.registrationStatus = 'Waitlist';
    } else if (/\bFull\b/i.test(pageText)) {
      data.registrationStatus = 'Full';
    }

    // === LOCATION ===
    // Look for facility patterns
    const facilityMatch = pageText.match(/(Gymnasium|Pool|Arena|Field|Court|Studio|Room)\s*$/m);
    if (facilityMatch) {
      data.locationName = facilityMatch[0].trim();
    }

    // Try to extract community centre from text
    const centreMatch = pageText.match(/Winter\s+([A-Za-z\s-]+(?:Centre|Center|Community))/i) ||
                       pageText.match(/([A-Za-z\s-]+(?:Community Centre|Recreation Centre))/i);
    if (centreMatch) {
      data.facilityName = centreMatch[1].trim();
    }

    return data;
  });

  console.log('\n=== Extracted Detail Data ===');
  console.log(JSON.stringify(detailData, null, 2));

  console.log('\n=== Summary ===');
  console.log('- Dates:', detailData.dateStartStr ? `${detailData.dateStartStr} to ${detailData.dateEndStr}` : 'NOT FOUND');
  console.log('- Days:', detailData.dayOfWeek ? detailData.dayOfWeek.join(', ') : 'NOT FOUND');
  console.log('- Times:', detailData.startTime ? `${detailData.startTime} - ${detailData.endTime}` : 'NOT FOUND');
  console.log('- Age:', detailData.ageMin ? `${detailData.ageMin} - ${detailData.ageMax}` : 'NOT FOUND');
  console.log('- Cost:', detailData.cost ? `$${detailData.cost}` : 'NOT FOUND');
  console.log('- Location:', detailData.locationName || detailData.facilityName || 'NOT FOUND');
  console.log('- Instructor:', detailData.instructor || 'NOT FOUND');
  console.log('- Sessions:', detailData.sessionCount || 'NOT FOUND');
  console.log('- Status:', detailData.registrationStatus || 'Unknown');

  await browser.close();
  console.log('\nTest complete!');
}

testDetailExtraction().catch(console.error);
