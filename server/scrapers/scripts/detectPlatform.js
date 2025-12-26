#!/usr/bin/env node

/**
 * Detect the platform/technology used by a recreation website
 *
 * Usage:
 *   node detectPlatform.js "https://example.com/recreation"
 */

const puppeteer = require('puppeteer');

const PLATFORM_SIGNATURES = {
  perfectmind: {
    urlPatterns: ['perfectmind.com', '.perfectmind.com'],
    htmlPatterns: [
      'PerfectMind',
      'bm-group-item',
      'BookMe4',
      'perfectmind.js'
    ],
    confidence: 0
  },
  activenetwork: {
    urlPatterns: ['activecommunities.com', 'apm.activecommunities.com'],
    htmlPatterns: [
      'Active Network',
      'ActiveNet',
      'activity_select_param',
      'ActivityCategoryID'
    ],
    confidence: 0
  },
  intelligenz: {
    urlPatterns: ['pittfitandfun.ca', '/copm/public/'],
    htmlPatterns: [
      'intelligenz solutions',
      'jQuery datepicker',
      'courseType'
    ],
    confidence: 0
  },
  cityview: {
    urlPatterns: ['cityview.net', 'webtrac'],
    htmlPatterns: [
      'WebTrac',
      'CityView',
      'wbwsc'
    ],
    confidence: 0
  },
  activeNet: {
    urlPatterns: ['active.com'],
    htmlPatterns: [
      'ACTIVE.com',
      'active-registration'
    ],
    confidence: 0
  }
};

async function detectPlatform(url) {
  console.log(`Analyzing: ${url}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // Capture network requests
    const requests = [];
    page.on('request', request => {
      requests.push(request.url());
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Get page content
    const content = await page.content();
    const pageUrl = page.url();

    // Check each platform
    const results = {};

    for (const [platform, signatures] of Object.entries(PLATFORM_SIGNATURES)) {
      let confidence = 0;
      const matches = [];

      // Check URL patterns
      for (const pattern of signatures.urlPatterns) {
        if (pageUrl.includes(pattern) || url.includes(pattern)) {
          confidence += 40;
          matches.push(`URL contains "${pattern}"`);
        }
      }

      // Check HTML patterns
      for (const pattern of signatures.htmlPatterns) {
        if (content.toLowerCase().includes(pattern.toLowerCase())) {
          confidence += 20;
          matches.push(`HTML contains "${pattern}"`);
        }
      }

      // Check network requests
      for (const requestUrl of requests) {
        for (const pattern of signatures.urlPatterns) {
          if (requestUrl.includes(pattern)) {
            confidence += 15;
            matches.push(`Request to "${pattern}"`);
            break;
          }
        }
      }

      if (matches.length > 0) {
        results[platform] = {
          confidence: Math.min(confidence, 100),
          matches: [...new Set(matches)]
        };
      }
    }

    // Sort by confidence
    const sorted = Object.entries(results)
      .sort((a, b) => b[1].confidence - a[1].confidence);

    console.log('Detection Results');
    console.log('=================\n');

    if (sorted.length === 0) {
      console.log('❓ No known platform detected');
      console.log('\nThis may be a custom platform or CMS.');
      console.log('Manual analysis required.\n');
      return null;
    }

    for (const [platform, data] of sorted) {
      const icon = data.confidence >= 80 ? '✅' : data.confidence >= 50 ? '⚠️' : '❓';
      console.log(`${icon} ${platform.toUpperCase()} (${data.confidence}% confidence)`);
      data.matches.forEach(match => console.log(`   - ${match}`));
      console.log('');
    }

    const [bestMatch, bestData] = sorted[0];

    if (bestData.confidence >= 80) {
      console.log(`\n🎯 Recommended platform: ${bestMatch.toUpperCase()}`);
      console.log(`   Use the ${bestMatch} scraper template.\n`);
    } else {
      console.log('\n⚠️  Low confidence detection. Manual verification recommended.\n');
    }

    return {
      url,
      finalUrl: pageUrl,
      detectedPlatform: bestMatch,
      confidence: bestData.confidence,
      allResults: results
    };

  } catch (error) {
    console.error('Error analyzing URL:', error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.log(`
Platform Detector
=================

Analyzes a recreation website to detect which platform/technology it uses.

Usage:
  node detectPlatform.js <url>

Example:
  node detectPlatform.js "https://cityofcoquitlam.perfectmind.com"
`);
    process.exit(0);
  }

  await detectPlatform(url);
}

main();
