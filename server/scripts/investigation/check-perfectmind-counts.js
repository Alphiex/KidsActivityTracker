#!/usr/bin/env node
/**
 * Check actual activity counts on PerfectMind pages
 */

const puppeteer = require('puppeteer');

// PerfectMind sites to check - mapped to their widget URLs
const SITES = {
  'Port Moody': 'https://cityofportmoody.perfectmind.com/SocialSite/MemberRegistration/MemberSignIn?returnUrl=%2FSocialSite%2FBookMe4LandingPages%2FCoursesLandingPage%3Fwidgetid%3D15f6af07-39c5-473e-b053-96653f77a406%26redirect%3Dsearch',
  'Maple Ridge': 'https://cityofmapleridge.perfectmind.com/SocialSite/MemberRegistration/MemberSignIn?returnUrl=%2FSocialSite%2FBookMe4LandingPages%2FCoursesLandingPage%3Fwidgetid%3D96ad7ff9-69a2-4e51-a648-70e6b20d4bae%26redirect%3Dsearch',
  'New Westminster': 'https://cityofnewwestminster.perfectmind.com/SocialSite/MemberRegistration/MemberSignIn?returnUrl=%2FSocialSite%2FBookMe4LandingPages%2FCoursesLandingPage%3Fwidgetid%3D9b7f7f8a-6f1e-4f3e-8e6a-7b8c9d0e1f2a%26redirect%3Dsearch',
  'Langley': 'https://tol.perfectmind.com/SocialSite/MemberRegistration/MemberSignIn?returnUrl=%2FSocialSite%2FBookMe4LandingPages%2FCoursesLandingPage%3Fwidgetid%3D12345678-1234-1234-1234-123456789012%26redirect%3Dsearch',
  'Abbotsford': 'https://abbotsford.perfectmind.com/SocialSite/MemberRegistration/MemberSignIn?returnUrl=%2FSocialSite%2FBookMe4LandingPages%2FCoursesLandingPage%3Fwidgetid%3D12345678-1234-1234-1234-123456789012%26redirect%3Dsearch'
};

// URLs from the actual database scraper configs
const DIRECT_URLS = {
  'Port Moody': 'https://cityofportmoody.perfectmind.com/Contacts/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406',
  'Maple Ridge': 'https://cityofmapleridge.perfectmind.com/23724/Reports/BookMe4?widgetId=47fd20cf-24b1-4cbe-89a0-d25473cacb49',
  'New Westminster': 'https://cityofnewwestminster.perfectmind.com/23693/Clients/BookMe4?widgetId=50a33660-b4f7-44d9-9256-e10effec8641',
  'Langley': 'https://tol.perfectmind.com/Clients/BookMe4',
  'Abbotsford': 'https://abbotsford.perfectmind.com/23852/Clients/BookMe4LandingPages'
};

async function checkCounts() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const [city, url] of Object.entries(DIRECT_URLS)) {
      console.log(`\n=== Checking ${city.toUpperCase()} ===`);
      console.log(`URL: ${url}`);

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Look for common PerfectMind elements
        const analysis = await page.evaluate(() => {
          const result = {
            sections: [],
            groupItems: 0,
            groupTitles: 0,
            links: 0,
            totalText: ''
          };

          // Count group items (activities)
          result.groupItems = document.querySelectorAll('.bm-group-item-row').length;
          result.groupTitles = document.querySelectorAll('.bm-group-title-row').length;

          // Look for section headers
          const sectionHeaders = document.querySelectorAll('.bm-filter-item, .bm-section-header, .activity-section');
          result.sections = Array.from(sectionHeaders).map(s => s.textContent?.trim()).slice(0, 10);

          // Count all links that might be activities
          const activityLinks = document.querySelectorAll('a[href*="courseId"], a[href*="BookMe4"]');
          result.links = activityLinks.length;

          // Get page structure info
          result.totalText = document.body.innerText.substring(0, 2000);

          return result;
        });

        console.log(`Group items: ${analysis.groupItems}`);
        console.log(`Group titles: ${analysis.groupTitles}`);
        console.log(`Activity links: ${analysis.links}`);
        console.log(`Sections found: ${analysis.sections.join(', ') || 'None'}`);

        // Take screenshot
        await page.screenshot({ path: `/tmp/perfectmind-${city.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });
        console.log(`Screenshot saved to /tmp/perfectmind-${city.toLowerCase().replace(/\s+/g, '-')}.png`);

      } catch (error) {
        console.log(`Error: ${error.message}`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }
}

checkCounts().catch(console.error);
