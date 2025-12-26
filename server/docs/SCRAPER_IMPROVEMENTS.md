# Metro Vancouver Scraper Improvement Plan

## Executive Summary

This plan outlines the comprehensive improvements needed to achieve 2000+ activities per city across all Metro Vancouver municipalities. The work is divided into 4 phases:

1. **Phase 1: Schema & Data Model Improvements** - Support many-to-many activity types, add new categories
2. **Phase 2: Scraper Fixes** - Fix low-count sites, improve extraction
3. **Phase 3: Validation & Quality** - Verify links, status, completeness
4. **Phase 4: Custom Scrapers** - Lions Bay, Anmore, and other custom calendar sites

---

## Current State Analysis

### Activity Counts (as of now)
| Provider | Count | Expected | Platform | Issue |
|----------|-------|----------|----------|-------|
| Burnaby | 5,869 | 5,000+ | ActiveNet | ✅ Good |
| North Vancouver | 5,735 | 5,000+ | PerfectMind | ✅ Good |
| Richmond | 4,241 | 4,000+ | PerfectMind | ✅ Good |
| West Vancouver | 3,934 | 4,000+ | ActiveNet | ✅ Good |
| Vancouver | 1,998 | 8,000+ | ActiveNet | ⚠️ Timed out |
| Port Coquitlam | 1,762 | 2,000+ | ActiveNet | ✅ Good |
| City of Langley | 1,697 | 1,500+ | ActiveNet | ✅ Good |
| New Westminster | 1,597 | 1,500+ | PerfectMind | ✅ Good |
| Coquitlam | 1,409 | 3,000+ | PerfectMind | ⚠️ Low |
| Delta | 1,178 | 2,000+ | PerfectMind | ⚠️ Low |
| Abbotsford | 658 | 2,000+ | PerfectMind | ❌ Very Low |
| Township of Langley | 563 | 1,500+ | PerfectMind | ❌ Very Low |
| Port Moody | 538 | 1,000+ | PerfectMind | ❌ Very Low |
| Surrey | 204 | 5,000+ | PerfectMind | ❌ Critical |
| Maple Ridge | 165 | 1,500+ | PerfectMind | ❌ Critical |
| Bowen Island | 158 | 200 | ActiveNet | ✅ Good (small) |
| White Rock | 123 | 500+ | PerfectMind | ❌ Wrong Widget |
| Pitt Meadows | 30 | 500+ | Intelligenz | ❌ Critical |

### Root Causes Identified

1. **White Rock**: Using Richmond's widget ID (config error)
2. **Maple Ridge**: Uses `/Reports/` path instead of `/Clients/`
3. **Surrey**: Link discovery failing - different HTML structure
4. **Pitt Meadows**: Intelligenz scraper not finding all course types
5. **Abbotsford, Township of Langley, Port Moody**: Overly restrictive filtering

---

## Phase 1: Schema & Data Model Improvements

### 1.1 Support Many-to-Many Activity Types

**Current Limitation**: Activities can only belong to ONE ActivityType and ONE ActivitySubtype.

**Problem**: "Basketball Camp" should be both `team-sports/basketball` AND `camps/sports-camps`

**Solution**: Create a junction table for many-to-many relationships.

```prisma
// New model in schema.prisma
model ActivityTypeAssignment {
  id              String          @id @default(uuid())
  activityId      String
  activityTypeId  String
  activitySubtypeId String?
  isPrimary       Boolean         @default(false)  // Primary type for display
  confidence      Float           @default(1.0)    // 0-1 confidence score
  source          String          @default("auto") // "auto", "manual", "learned"
  createdAt       DateTime        @default(now())

  activity        Activity        @relation(fields: [activityId], references: [id], onDelete: Cascade)
  activityType    ActivityType    @relation(fields: [activityTypeId], references: [id])
  activitySubtype ActivitySubtype? @relation(fields: [activitySubtypeId], references: [id])

  @@unique([activityId, activityTypeId, activitySubtypeId])
  @@index([activityId])
  @@index([activityTypeId])
  @@index([activitySubtypeId])
}
```

**Migration Strategy**:
1. Create new junction table
2. Migrate existing `activityTypeId`/`activitySubtypeId` to junction table with `isPrimary=true`
3. Keep original fields for backward compatibility during transition
4. Update mapActivityType() to return array of types

### 1.2 Add New Activity Types & Subtypes

**New Types to Add**:
```javascript
{
  code: 'birthday-parties',
  name: 'Birthday Parties',
  subtypes: [
    'pool-party', 'sports-party', 'arts-party', 'dance-party',
    'skating-party', 'gymnastics-party', 'adventure-party', 'themed-party'
  ]
},
{
  code: 'drop-in-programs',
  name: 'Drop-In Programs',
  subtypes: [
    'drop-in-sports', 'drop-in-swim', 'drop-in-skating',
    'drop-in-fitness', 'open-gym', 'public-skate'
  ]
},
{
  code: 'lessons-instruction',
  name: 'Private Lessons & Instruction',
  subtypes: [
    'private-swim', 'private-skating', 'private-music',
    'private-sports', 'tutoring', 'coaching'
  ]
},
{
  code: 'certifications',
  name: 'Certifications & Training',
  subtypes: [
    'lifeguard-certification', 'first-aid', 'babysitter-training',
    'coaching-certification', 'referee-training', 'instructor-training'
  ]
}
```

**New Subtypes for Existing Types**:
```javascript
// Add to 'camps'
'spring-break-camps', 'winter-camps', 'pa-day-camps', 'holiday-camps'

// Add to 'swimming-aquatics'
'parent-tot-swim', 'preschool-swim', 'adult-swim', 'lane-swim', 'water-safety'

// Add to 'skating-wheels'
'learn-to-skate', 'power-skating', 'hockey-skating', 'stick-and-puck'

// Add to 'fitness-wellness'
'kids-fitness', 'family-fitness', 'mindfulness', 'nutrition'
```

### 1.3 Dynamic Activity Type Discovery

**Goal**: Allow scrapers to suggest new activity types when they encounter unrecognized categories.

**Implementation**:

```javascript
// New file: server/utils/activityTypeDiscovery.js

class ActivityTypeDiscovery {
  constructor() {
    this.pendingTypes = [];
    this.confidenceThreshold = 0.7;
  }

  /**
   * When scraper finds an activity that doesn't match existing patterns
   */
  async suggestNewType(activity, context) {
    const suggestion = {
      suggestedTypeName: this.inferTypeName(activity),
      suggestedSubtypeName: this.inferSubtypeName(activity),
      sampleActivities: [activity.name],
      providerSource: context.providerName,
      frequency: 1,
      createdAt: new Date()
    };

    // Check if we've seen this pattern before
    const existing = this.pendingTypes.find(p =>
      p.suggestedTypeName === suggestion.suggestedTypeName
    );

    if (existing) {
      existing.frequency++;
      existing.sampleActivities.push(activity.name);
    } else {
      this.pendingTypes.push(suggestion);
    }

    // Auto-create if seen frequently across multiple providers
    if (existing && existing.frequency >= 10 && existing.providerSources.size >= 2) {
      await this.createNewType(existing);
    }
  }

  inferTypeName(activity) {
    // Use activity category/subcategory as hints
    const text = `${activity.name} ${activity.category}`.toLowerCase();

    // Common patterns to detect
    if (/birthday|party|celebration/i.test(text)) return 'birthday-parties';
    if (/drop.?in|open\s*(gym|swim|skate)/i.test(text)) return 'drop-in-programs';
    if (/private\s*(lesson|instruction)/i.test(text)) return 'lessons-instruction';
    if (/certif|training|license/i.test(text)) return 'certifications';

    return null; // Can't infer
  }
}
```

---

## Phase 2: Scraper Fixes

### 2.1 Fix White Rock Widget ID

**File**: `server/scrapers/configs/providers/white-rock.json`

**Action**: Find and verify correct widget ID from White Rock's actual website.

```bash
# Debug script to find correct widget ID
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.whiterockcity.ca/recreation');
  // Look for PerfectMind iframe or widget links
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*=\"perfectmind\"]'))
      .map(a => a.href)
  );
  console.log('PerfectMind links:', links);
  await browser.close();
})();
"
```

### 2.2 Fix PerfectMind Link Discovery

**Problem**: Many sites use different HTML structures that the current scraper doesn't recognize.

**Solution**: Improve `discoverActivityLinks()` in PerfectMindScraper.js:

```javascript
// Enhanced link discovery - server/scrapers/platforms/PerfectMindScraper.js

async discoverActivityLinks(page) {
  return await page.evaluate(() => {
    const links = [];

    // Strategy 1: Standard section-based discovery (existing)
    // ... existing code ...

    // Strategy 2: Grid/card-based layouts (Abbotsford style)
    document.querySelectorAll('.grid-item, .card, .tile, [class*="category"]').forEach(card => {
      const link = card.querySelector('a');
      const text = card.textContent?.trim();
      if (link && text) {
        links.push({ url: link.href, text, section: 'grid' });
      }
    });

    // Strategy 3: Accordion sections (Surrey style)
    document.querySelectorAll('[data-toggle="collapse"], .accordion-item, details').forEach(accordion => {
      const header = accordion.querySelector('.accordion-header, summary, button');
      const content = accordion.querySelector('.accordion-body, .collapse');
      if (header && content) {
        content.querySelectorAll('a').forEach(link => {
          links.push({
            url: link.href,
            text: link.textContent?.trim(),
            section: header.textContent?.trim()
          });
        });
      }
    });

    // Strategy 4: Data attribute discovery
    document.querySelectorAll('[data-category], [data-activity-type]').forEach(el => {
      const category = el.dataset.category || el.dataset.activityType;
      const link = el.querySelector('a') || (el.tagName === 'A' ? el : null);
      if (link && category) {
        links.push({ url: link.href, text: category, section: 'data-attr' });
      }
    });

    // Strategy 5: Navigation menu items (sometimes activities are in menus)
    document.querySelectorAll('nav a, .nav-item a, .menu a').forEach(link => {
      const text = link.textContent?.trim();
      if (text && text.length > 2 && text.length < 50) {
        links.push({ url: link.href, text, section: 'navigation' });
      }
    });

    return links;
  });
}
```

### 2.3 Remove Overly Restrictive Filters

**Current Problem**: `filterActivityLinks()` skips links that don't match kids-related patterns.

**Solution**: Be more inclusive, filter later based on actual activity age data.

```javascript
// Updated filterActivityLinks() - less restrictive
filterActivityLinks(links) {
  // Only skip obvious adult-only programs
  const adultOnlyPatterns = [
    /55\+|older\s*adult|senior|seniors\s*only/i,
    /adult\s*only|19\+|21\+/i,
    /wine|beer|cocktail|pub/i
  ];

  // Skip non-activity links
  const skipPatterns = [
    /login|sign.?in|register|my.?account|cart|checkout/i,
    /privacy|terms|contact.?us|about.?us|careers/i,
    /facebook|twitter|instagram|youtube/i
  ];

  return links.filter(link => {
    const text = (link.text || '').toLowerCase();
    const url = (link.url || '').toLowerCase();

    // Skip adult-only
    if (adultOnlyPatterns.some(p => p.test(text))) return false;

    // Skip non-activity links
    if (skipPatterns.some(p => p.test(text) || p.test(url))) return false;

    // Must be a PerfectMind activity link
    if (!url.includes('perfectmind') && !url.includes('bookme')) return false;

    // Include everything else - filter by age data later
    return true;
  });
}
```

### 2.4 Fix Activity Extraction - Don't Require Price

**Current Problem**: Activities without visible price are skipped.

```javascript
// Current code (too restrictive)
if (!rawText.includes('$') && !rawText.includes('#')) {
  return; // Skips free activities!
}

// Fixed code
// Remove this check entirely - many activities are free or show price differently
```

### 2.5 Improve Intelligenz Scraper (Pitt Meadows)

**Problem**: Only finding 30 activities when there should be 500+.

**Solution**: Search ALL course types, not just filtered ones:

```javascript
// server/scrapers/platforms/IntelligenzScraper.js

async discoverCourseTypes(page) {
  return await page.evaluate(() => {
    const courseTypes = [];
    const select = document.querySelector('#CourseTypes');

    if (select) {
      // Get ALL options, not just filtered ones
      Array.from(select.options).forEach(option => {
        if (option.value && option.text.trim()) {
          courseTypes.push({
            value: option.value,
            name: option.text.trim()
          });
        }
      });
    }

    return courseTypes;
  });
}
```

### 2.6 Fix Vancouver Timeout

**Problem**: Vancouver has so many activities it times out.

**Solution**: Process in batches with progress saving:

```javascript
// Add to ActiveNetworkScraper.js
async extractActiveNetworkActivities() {
  // ... existing code ...

  // Save progress periodically
  if (activities.length % 500 === 0) {
    this.logProgress(`Checkpoint: ${activities.length} activities extracted`);
    // Save partial results to temp file
    await this.saveCheckpoint(activities);
  }

  // Increase timeout for large cities
  const timeout = this.config.scraperConfig.timeout || 90000;
  const largeTimeout = Math.max(timeout, 300000); // 5 minutes minimum
}
```

---

## Phase 3: Validation & Quality Assurance

### 3.1 Activity Property Extraction Checklist

Each activity MUST have these properties extracted:

| Property | Required | Validation |
|----------|----------|------------|
| name | Yes | Non-empty, 3-200 chars |
| externalId | Yes | Unique per provider |
| category | Yes | Non-empty |
| description | Preferred | Extract from detail page if needed |
| dateStart | Preferred | Valid date |
| dateEnd | Preferred | Valid date >= dateStart |
| startTime | Preferred | Valid time format |
| endTime | Preferred | Valid time format |
| dayOfWeek | Preferred | Array of valid days |
| ageMin | Preferred | 0-18 integer |
| ageMax | Preferred | ageMin <= ageMax <= 99 |
| cost | Preferred | Number >= 0 |
| registrationUrl | Required | Valid URL, returns 200 |
| registrationStatus | Preferred | Open/Full/Closed/Waitlist |
| locationName | Preferred | Non-empty |
| spotsAvailable | Optional | Integer >= 0 |
| instructor | Optional | Non-empty if present |

### 3.2 Link Validation Script

```javascript
// server/scrapers/scripts/validateActivityLinks.js

const { PrismaClient } = require('../generated/prisma');
const axios = require('axios');

async function validateActivityLinks() {
  const prisma = new PrismaClient();

  // Get all active activities with registration URLs
  const activities = await prisma.activity.findMany({
    where: {
      isActive: true,
      registrationUrl: { not: null }
    },
    select: {
      id: true,
      name: true,
      registrationUrl: true,
      provider: { select: { name: true } }
    }
  });

  const results = {
    valid: 0,
    invalid: [],
    errors: []
  };

  for (const activity of activities) {
    try {
      const response = await axios.head(activity.registrationUrl, {
        timeout: 10000,
        maxRedirects: 5
      });

      if (response.status === 200) {
        results.valid++;
      } else {
        results.invalid.push({
          id: activity.id,
          name: activity.name,
          provider: activity.provider.name,
          url: activity.registrationUrl,
          status: response.status
        });
      }
    } catch (error) {
      results.errors.push({
        id: activity.id,
        name: activity.name,
        provider: activity.provider.name,
        url: activity.registrationUrl,
        error: error.message
      });
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('Validation Results:');
  console.log(`Valid: ${results.valid}`);
  console.log(`Invalid: ${results.invalid.length}`);
  console.log(`Errors: ${results.errors.length}`);

  // Save results
  await fs.writeFile(
    'validation-results.json',
    JSON.stringify(results, null, 2)
  );
}
```

### 3.3 Data Completeness Report

```javascript
// server/scrapers/scripts/dataCompletenessReport.js

async function generateCompletenessReport() {
  const prisma = new PrismaClient();

  const providers = await prisma.provider.findMany({
    include: {
      activities: {
        where: { isActive: true }
      }
    }
  });

  const report = providers.map(provider => {
    const activities = provider.activities;
    const total = activities.length;

    return {
      provider: provider.name,
      totalActivities: total,
      completeness: {
        hasDescription: activities.filter(a => a.description).length / total * 100,
        hasDateRange: activities.filter(a => a.dateStart && a.dateEnd).length / total * 100,
        hasTimeRange: activities.filter(a => a.startTime && a.endTime).length / total * 100,
        hasAgeRange: activities.filter(a => a.ageMin !== null && a.ageMax !== null).length / total * 100,
        hasCost: activities.filter(a => a.cost !== null).length / total * 100,
        hasRegistrationUrl: activities.filter(a => a.registrationUrl).length / total * 100,
        hasDaysOfWeek: activities.filter(a => a.dayOfWeek?.length > 0).length / total * 100,
        hasLocation: activities.filter(a => a.locationId || a.locationName).length / total * 100
      }
    };
  });

  console.table(report);
}
```

---

## Phase 3.4: Provider Extension Architecture [IMPLEMENTED]

### 3.4.1 Overview

When a provider's website has unique characteristics that require different behavior from the base platform scraper, we use **Provider Extensions** instead of adding conditionals to the core scraper code.

**Files Created**:
- `scrapers/base/ProviderExtension.js` - Base class for all extensions
- `scrapers/base/ExtensionLoader.js` - Auto-loads extensions by provider code
- `scrapers/providers/{platform}/{ProviderCode}Extension.js` - Provider-specific extensions

### 3.4.2 Extension Hooks

Extensions can override these methods:

```javascript
class MyProviderExtension extends ProviderExtension {
  // Navigation hooks
  async beforeNavigate(page) {}
  async afterNavigate(page) {}

  // Link discovery hooks
  async beforeDiscoverLinks(page) {}
  async discoverLinks(page) {} // Return null for default, or custom links
  async afterDiscoverLinks(page, links) {}

  // Activity extraction hooks
  async handleLinkClick(page, link) {} // Return true if handled
  async parseActivity(page, rawActivity) {}
  async afterParseActivity(activity) {}
  async normalizeActivity(activity) {}

  // Config overrides
  getWaitTime() {}     // Return number or null for default
  getWaitSelector() {} // Return string or null for default
  getTimeout() {}      // Return number or null for default
  getSelectors() {}    // Return object with CSS selectors

  // Filtering & error handling
  async filterActivities(activities) {}
  async handleError(error, context) {}
}
```

### 3.4.3 Example: Surrey Extension

Surrey's PerfectMind site uses JavaScript click handlers and requires longer wait times:

```javascript
// scrapers/providers/perfectmind/SurreyExtension.js
class SurreyExtension extends ProviderExtension {
  getWaitTime() { return 15000; } // 15 seconds for Angular
  getWaitSelector() { return 'a.bm-category-calendar-link.enabled'; }
  getTimeout() { return 120000; }

  async discoverLinks(page) {
    // Custom discovery for Surrey's 143 category links
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.bm-category-calendar-link.enabled'))
        .map((link, index) => ({
          text: link.textContent.trim(),
          index,
          section: 'Children'
        }));
    });
    return links;
  }
}
```

### 3.4.4 When to Create an Extension

Create a provider extension when:
1. The site requires significantly different wait times
2. Link discovery fails with default logic
3. Activity parsing needs custom selectors
4. Data needs provider-specific cleanup
5. The site uses JavaScript navigation instead of href links

**Don't** create an extension for:
- Simple config changes (put in JSON config instead)
- Changes that would benefit all providers on the platform

---

## Phase 3.5: Parallelization & Concurrency

### 3.5.1 Overview

Currently, scrapers process activities linearly (one page at a time, one category at a time). This is slow and inefficient. Implementing parallelization can significantly speed up scraping while respecting rate limits.

**Current Problem**: Vancouver takes 8+ minutes because it processes each page sequentially.

**Goal**: Process multiple pages/categories concurrently while respecting rate limits.

### 3.5.2 Worker Pool Architecture

```javascript
// server/scrapers/utils/WorkerPool.js

class WorkerPool {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.delayBetweenRequests = options.delayBetweenRequests || 500;
    this.activeWorkers = 0;
    this.queue = [];
    this.results = [];
    this.errors = [];
  }

  async addTask(taskFn, context = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: taskFn,
        context,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  async addTasks(tasks) {
    return Promise.all(tasks.map(task => this.addTask(task.fn, task.context)));
  }

  async processQueue() {
    while (this.queue.length > 0 && this.activeWorkers < this.maxConcurrent) {
      const task = this.queue.shift();
      this.activeWorkers++;

      this.executeTask(task)
        .then(result => {
          this.results.push(result);
          task.resolve(result);
        })
        .catch(error => {
          this.errors.push({ error, context: task.context });
          task.reject(error);
        })
        .finally(() => {
          this.activeWorkers--;
          this.processQueue();
        });

      // Delay before starting next worker
      await this.delay(this.delayBetweenRequests);
    }
  }

  async executeTask(task) {
    try {
      return await task.fn();
    } catch (error) {
      console.error(`Worker error for ${task.context.name}:`, error.message);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      completed: this.results.length,
      failed: this.errors.length,
      pending: this.queue.length,
      active: this.activeWorkers
    };
  }
}

module.exports = WorkerPool;
```

### 3.5.3 Parallel Browser Page Pool

For Puppeteer-based scrapers, maintain a pool of browser pages:

```javascript
// server/scrapers/utils/BrowserPagePool.js

class BrowserPagePool {
  constructor(browser, options = {}) {
    this.browser = browser;
    this.maxPages = options.maxPages || 5;
    this.availablePages = [];
    this.inUsePages = new Set();
    this.waitingQueue = [];
  }

  async initialize() {
    // Pre-create pages
    for (let i = 0; i < this.maxPages; i++) {
      const page = await this.browser.newPage();
      await this.configurePage(page);
      this.availablePages.push(page);
    }
  }

  async configurePage(page) {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setDefaultTimeout(30000);
    // Set user agent, cookies, etc.
  }

  async acquire() {
    if (this.availablePages.length > 0) {
      const page = this.availablePages.pop();
      this.inUsePages.add(page);
      return page;
    }

    // Wait for a page to become available
    return new Promise(resolve => {
      this.waitingQueue.push(resolve);
    });
  }

  release(page) {
    this.inUsePages.delete(page);

    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      this.inUsePages.add(page);
      waiting(page);
    } else {
      this.availablePages.push(page);
    }
  }

  async closeAll() {
    const allPages = [...this.availablePages, ...this.inUsePages];
    await Promise.all(allPages.map(page => page.close().catch(() => {})));
    this.availablePages = [];
    this.inUsePages.clear();
  }
}

module.exports = BrowserPagePool;
```

### 3.5.4 Implementing Parallel Scraping in PerfectMindScraper

```javascript
// Updated PerfectMindScraper.js - parallel category processing

async scrapeWithParallelization() {
  const browser = await puppeteer.launch(this.launchOptions);
  const pagePool = new BrowserPagePool(browser, {
    maxPages: this.config.scraperConfig.maxConcurrency || 5
  });
  await pagePool.initialize();

  const workerPool = new WorkerPool({
    maxConcurrent: this.config.scraperConfig.concurrentRequests || 3,
    delayBetweenRequests: this.config.scraperConfig.delayBetweenPages || 2000
  });

  try {
    // Step 1: Discover all category/section links (single page)
    const mainPage = await pagePool.acquire();
    await mainPage.goto(this.config.baseUrl, { waitUntil: 'networkidle2' });
    const categoryLinks = await this.discoverCategoryLinks(mainPage);
    pagePool.release(mainPage);

    this.logProgress(`Found ${categoryLinks.length} categories to scrape`);

    // Step 2: Process categories in parallel
    const categoryTasks = categoryLinks.map(category => ({
      fn: async () => {
        const page = await pagePool.acquire();
        try {
          const activities = await this.scrapeCategoryPage(page, category);
          return { category: category.name, activities };
        } finally {
          pagePool.release(page);
        }
      },
      context: { name: category.name }
    }));

    const categoryResults = await workerPool.addTasks(categoryTasks);

    // Step 3: Aggregate results
    const allActivities = categoryResults.flatMap(r => r.activities || []);

    this.logProgress(`Scraped ${allActivities.length} total activities from ${categoryResults.length} categories`);

    return allActivities;

  } finally {
    await pagePool.closeAll();
    await browser.close();
  }
}

async scrapeCategoryPage(page, category) {
  const activities = [];

  await page.goto(category.url, { waitUntil: 'networkidle2' });

  // Handle pagination within category
  let hasNextPage = true;
  let pageNum = 1;

  while (hasNextPage && pageNum <= 50) {
    const pageActivities = await this.extractActivitiesFromPage(page);
    activities.push(...pageActivities);

    hasNextPage = await this.goToNextPage(page);
    pageNum++;
  }

  return activities;
}
```

### 3.5.5 Implementing Parallel Scraping in ActiveNetworkScraper

```javascript
// Updated ActiveNetworkScraper.js - parallel batch processing

async scrapeWithParallelization() {
  const browser = await puppeteer.launch(this.launchOptions);
  const pagePool = new BrowserPagePool(browser, { maxPages: 3 });
  await pagePool.initialize();

  const workerPool = new WorkerPool({
    maxConcurrent: 3,
    delayBetweenRequests: 2000
  });

  try {
    // Step 1: Get total activity count
    const mainPage = await pagePool.acquire();
    await mainPage.goto(this.config.baseUrl + '/activity/search', { waitUntil: 'networkidle2' });

    const totalCount = await this.getTotalActivityCount(mainPage);
    pagePool.release(mainPage);

    this.logProgress(`Total activities to scrape: ${totalCount}`);

    // Step 2: Calculate page ranges for parallel processing
    const pageSize = 20;
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagesPerWorker = Math.ceil(totalPages / 3);

    // Create page range tasks
    const rangeTasks = [];
    for (let i = 0; i < 3; i++) {
      const startPage = i * pagesPerWorker + 1;
      const endPage = Math.min((i + 1) * pagesPerWorker, totalPages);

      if (startPage <= totalPages) {
        rangeTasks.push({
          fn: async () => {
            const page = await pagePool.acquire();
            try {
              return await this.scrapePageRange(page, startPage, endPage, pageSize);
            } finally {
              pagePool.release(page);
            }
          },
          context: { name: `Pages ${startPage}-${endPage}` }
        });
      }
    }

    const rangeResults = await workerPool.addTasks(rangeTasks);
    return rangeResults.flat();

  } finally {
    await pagePool.closeAll();
    await browser.close();
  }
}

async scrapePageRange(page, startPage, endPage, pageSize) {
  const activities = [];

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const offset = (pageNum - 1) * pageSize;
    const url = `${this.config.baseUrl}/activity/search?skip=${offset}&take=${pageSize}`;

    await page.goto(url, { waitUntil: 'networkidle2' });
    const pageActivities = await this.extractActivitiesFromPage(page);
    activities.push(...pageActivities);

    // Rate limiting
    await this.delay(1000);
  }

  return activities;
}
```

### 3.5.6 Rate Limiting & Throttling

```javascript
// server/scrapers/utils/RateLimiter.js

class RateLimiter {
  constructor(options = {}) {
    this.requestsPerMinute = options.requestsPerMinute || 30;
    this.requestsThisMinute = 0;
    this.minuteStart = Date.now();
    this.queue = [];
  }

  async throttle() {
    const now = Date.now();
    const elapsed = now - this.minuteStart;

    // Reset counter if minute has passed
    if (elapsed >= 60000) {
      this.requestsThisMinute = 0;
      this.minuteStart = now;
    }

    // If at limit, wait until next minute
    if (this.requestsThisMinute >= this.requestsPerMinute) {
      const waitTime = 60000 - elapsed + 100;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestsThisMinute = 0;
      this.minuteStart = Date.now();
    }

    this.requestsThisMinute++;
  }

  getStats() {
    return {
      requestsThisMinute: this.requestsThisMinute,
      limit: this.requestsPerMinute,
      timeUntilReset: Math.max(0, 60000 - (Date.now() - this.minuteStart))
    };
  }
}

module.exports = RateLimiter;
```

### 3.5.7 Progress Tracking Across Parallel Workers

```javascript
// server/scrapers/utils/ProgressTracker.js

class ProgressTracker {
  constructor(totalItems, options = {}) {
    this.totalItems = totalItems;
    this.completedItems = 0;
    this.errors = [];
    this.startTime = Date.now();
    this.checkpointInterval = options.checkpointInterval || 100;
    this.onCheckpoint = options.onCheckpoint || (() => {});
  }

  increment(count = 1, context = {}) {
    this.completedItems += count;

    if (this.completedItems % this.checkpointInterval === 0) {
      this.checkpoint(context);
    }
  }

  addError(error, context = {}) {
    this.errors.push({ error, context, timestamp: Date.now() });
  }

  checkpoint(context = {}) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.completedItems / elapsed;
    const remaining = this.totalItems - this.completedItems;
    const eta = remaining / rate;

    const stats = {
      completed: this.completedItems,
      total: this.totalItems,
      percent: (this.completedItems / this.totalItems * 100).toFixed(1),
      elapsed: elapsed.toFixed(1),
      rate: rate.toFixed(1),
      eta: eta.toFixed(1),
      errors: this.errors.length
    };

    console.log(`Progress: ${stats.completed}/${stats.total} (${stats.percent}%) - ${stats.rate}/sec - ETA: ${stats.eta}s`);
    this.onCheckpoint(stats, context);
  }

  getStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return {
      completed: this.completedItems,
      total: this.totalItems,
      percent: (this.completedItems / this.totalItems * 100).toFixed(1),
      elapsed,
      errors: this.errors.length
    };
  }
}

module.exports = ProgressTracker;
```

### 3.5.8 Config Updates for Parallelization

Update provider configs to include concurrency settings:

```json
// Example: server/scrapers/configs/providers/vancouver.json
{
  "scraperConfig": {
    "type": "search",
    "parallelization": {
      "enabled": true,
      "maxConcurrentPages": 3,
      "maxConcurrentCategories": 5,
      "batchSize": 50
    },
    "rateLimits": {
      "requestsPerMinute": 30,
      "concurrentRequests": 3,
      "delayBetweenPages": 2000
    }
  }
}
```

### 3.5.9 Expected Performance Improvements

| Provider | Current Time | Parallel Time | Improvement |
|----------|--------------|---------------|-------------|
| Vancouver | 8+ min | ~3 min | 60% faster |
| Burnaby | 5+ min | ~2 min | 60% faster |
| Richmond | 4+ min | ~1.5 min | 62% faster |
| North Vancouver | 4+ min | ~1.5 min | 62% faster |

### 3.5.10 New Files to Create for Parallelization

1. `server/scrapers/utils/WorkerPool.js` - Task queue management
2. `server/scrapers/utils/BrowserPagePool.js` - Puppeteer page management
3. `server/scrapers/utils/RateLimiter.js` - Request throttling
4. `server/scrapers/utils/ProgressTracker.js` - Progress monitoring

---

## Phase 4: Custom Scrapers

### 4.1 FullCalendar Scraper (Lions Bay, Anmore)

Both sites use CivicWeb/FullCalendar. Create a dedicated scraper:

```javascript
// server/scrapers/platforms/FullCalendarScraper.js

class FullCalendarScraper extends BaseScraper {
  constructor(config) {
    super(config);
    this.platformName = 'FullCalendar';
  }

  async scrape() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(this.config.baseUrl, { waitUntil: 'networkidle2' });

    // Wait for FullCalendar to initialize
    await page.waitForSelector('.fc-event, .fc-daygrid-event', { timeout: 10000 });

    // Extract events from FullCalendar's internal data
    const events = await page.evaluate(() => {
      // FullCalendar stores events in window.__CALENDAR_EVENTS__ or similar
      // Or we can extract from the DOM
      const eventElements = document.querySelectorAll('.fc-event, .fc-daygrid-event');
      return Array.from(eventElements).map(el => ({
        title: el.querySelector('.fc-event-title, .fc-title')?.textContent,
        url: el.href || el.querySelector('a')?.href,
        start: el.dataset.start || el.getAttribute('data-start'),
        end: el.dataset.end || el.getAttribute('data-end')
      }));
    });

    // Navigate through months to get full year
    const allEvents = [...events];
    for (let month = 0; month < 12; month++) {
      await page.click('.fc-next-button');
      await page.waitForTimeout(1000);

      const monthEvents = await page.evaluate(() => {
        // Same extraction logic
      });

      allEvents.push(...monthEvents);
    }

    // Deduplicate by URL
    const uniqueEvents = [...new Map(allEvents.map(e => [e.url, e])).values()];

    // Get details for each event
    for (const event of uniqueEvents) {
      if (event.url) {
        const details = await this.getEventDetails(browser, event.url);
        Object.assign(event, details);
      }
    }

    await browser.close();
    return this.normalizeActivities(uniqueEvents);
  }

  async getEventDetails(browser, url) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const details = await page.evaluate(() => ({
      description: document.querySelector('.event-description, .entry-content')?.textContent,
      location: document.querySelector('.event-location, [class*="location"]')?.textContent,
      time: document.querySelector('.event-time, [class*="time"]')?.textContent,
      // Extract any other fields
    }));

    await page.close();
    return details;
  }
}
```

### 4.2 Provider Configs for Custom Sites

```json
// server/scrapers/configs/providers/lions-bay.json
{
  "id": "lions-bay-rec",
  "name": "Lions Bay Community Recreation",
  "code": "lionsbay",
  "platform": "fullcalendar",
  "region": "Metro Vancouver",
  "city": "Lions Bay",
  "baseUrl": "https://www.lionsbay.ca/community/community-groups-events-activities/community-calendar",
  "isActive": true,
  "scraperConfig": {
    "type": "calendar",
    "calendarType": "fullcalendar",
    "monthsToScrape": 12
  },
  "metadata": {
    "population": 1334,
    "expectedActivities": 50,
    "notes": "Small community, limited kids programs"
  }
}
```

---

## Implementation Order

### Week 1: Critical Fixes
1. [ ] Fix White Rock widget ID
2. [ ] Remove price requirement filter
3. [ ] Improve link discovery strategies
4. [ ] Re-run Surrey, White Rock, Maple Ridge

### Week 2: Schema Updates
1. [ ] Create ActivityTypeAssignment junction table
2. [ ] Add new activity types (birthday-parties, drop-in, etc.)
3. [ ] Update mapActivityType() for multi-type support
4. [ ] Migrate existing data

### Week 3: Scraper Improvements
1. [ ] Fix Intelligenz scraper (Pitt Meadows)
2. [ ] Fix Vancouver timeout issue
3. [ ] Improve activity detail extraction
4. [ ] Add validation scripts

### Week 4: Custom Scrapers & Validation
1. [ ] Create FullCalendar scraper
2. [ ] Add Lions Bay, Anmore configs
3. [ ] Run full validation suite
4. [ ] Generate completeness report

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Total activities | 50,000+ |
| Activities with description | 90%+ |
| Activities with age range | 85%+ |
| Activities with dates | 95%+ |
| Activities with valid URLs | 99%+ |
| Cities with 2000+ activities | 12+ (major cities) |
| Cities with 500+ activities | 18+ (all but smallest) |

---

## Files to Modify

1. `server/prisma/schema.prisma` - Add junction table
2. `server/utils/activityTypeMapper.js` - Multi-type support
3. `server/scrapers/platforms/PerfectMindScraper.js` - Fix discovery/filters
4. `server/scrapers/platforms/IntelligenzScraper.js` - Fix course type discovery
5. `server/scrapers/platforms/ActiveNetworkScraper.js` - Fix timeout
6. `server/scrapers/platforms/FullCalendarScraper.js` - NEW
7. `server/scrapers/base/ScraperFactory.js` - Add FullCalendar
8. `server/scrapers/configs/providers/*.json` - Fix configs

## New Files to Create

1. `server/utils/activityTypeDiscovery.js` - Auto-discovery
2. `server/scrapers/scripts/validateActivityLinks.js` - Validation
3. `server/scrapers/scripts/dataCompletenessReport.js` - Reporting
4. `server/scrapers/configs/providers/lions-bay.json` - Config
5. `server/scrapers/configs/providers/anmore.json` - Config
6. `server/scrapers/utils/WorkerPool.js` - Parallel task queue management
7. `server/scrapers/utils/BrowserPagePool.js` - Puppeteer page pool
8. `server/scrapers/utils/RateLimiter.js` - Request throttling
9. `server/scrapers/utils/ProgressTracker.js` - Progress monitoring
