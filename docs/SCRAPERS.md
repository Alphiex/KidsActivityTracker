# Web Scraper Guide

Automated web scraping system for collecting activity data from recreation center websites.

## Overview

| | |
|---|---|
| **Cloud Run Job** | `kids-activity-scraper-job` |
| **Schedule** | Tiered (3x daily, daily, weekly) |
| **Region** | us-central1 |
| **Timeout** | 30 minutes |
| **Memory** | 2GB |
| **Platforms** | 11 scraper types |
| **Providers** | 80 active |
| **Cities** | 81 supported |
| **Activities** | 117,700+ |

## Scraper Platforms

The system supports 11 different recreation website platforms:

| Platform | File | Used By |
|----------|------|---------|
| PerfectMind | `PerfectMindScraper.js` | NVRC, Richmond, Coquitlam, many BC/ON cities |
| ActiveNetwork | `ActiveNetworkScraper.js` | Toronto, Vancouver, Ottawa, Mississauga |
| REGPROG | `REGPROGScraper.js` | Calgary (Live and Play) |
| COE | `COEScraper.js` | Edmonton |
| FullCalendar | `FullCalendarScraper.js` | Lions Bay |
| WebTrac | `WebTracScraper.js` | Saskatoon |
| IC3 | `IC3Scraper.js` | Montreal, Gatineau |
| Intelligenz | `IntelligenzScraper.js` | Kelowna, Oshawa, Pitt Meadows |
| Amilia | `AmiliaScraper.js` | Quebec City, Laval, Dorval |
| LooknBook | `LooknBookScraper.js` | Red Deer, Strathcona County |
| Qidigo | `QidigoScraper.js` | Sherbrooke |

## Architecture

### File Structure

```
server/scrapers/
├── base/
│   ├── BaseScraper.js              # Abstract base class
│   ├── ScraperOrchestrator.js      # Coordinates multiple scrapers
│   ├── ScraperMonitor.js           # Monitoring & alerts
│   └── DataNormalizer.js           # Data standardization
├── platforms/
│   ├── PerfectMindScraper.js       # PerfectMind implementation
│   ├── ActiveNetworkScraper.js     # ActiveNetwork implementation
│   ├── AmiliaScraper.js            # Amilia implementation
│   ├── REGPROGScraper.js           # REGPROG implementation
│   ├── COEScraper.js               # COE implementation
│   ├── IC3Scraper.js               # IC3 implementation
│   ├── IntelligenzScraper.js       # Intelligenz implementation
│   ├── LooknBookScraper.js         # LooknBook implementation
│   └── ...                         # Other platforms
├── validation/
│   ├── ValidationRunner.js         # Orchestrates validation
│   ├── ScreenshotCapture.js        # Puppeteer screenshot
│   ├── ClaudeVisionExtractor.js    # Claude Vision API
│   ├── DataComparator.js           # Compare scraped vs visible
│   ├── ReportGenerator.js          # HTML report output
│   └── prompts/                    # Vision extraction prompts
├── utils/
│   ├── stableIdGenerator.js        # External ID generation (IMPORTANT)
│   ├── KidsActivityFilter.js       # Age-based filtering
│   └── activityTypeParser.js       # Category parsing
├── configs/
│   └── providers/                  # Provider configurations (80 files)
│       ├── vancouver.json
│       ├── toronto.json
│       ├── calgary.json
│       └── ...
├── scripts/
│   ├── runAllScrapers.js           # Run all providers
│   ├── runByTier.js                # Run by schedule tier
│   ├── runSingleScraper.js         # Run single provider
│   └── runValidation.js            # Run validation check
└── scraperJob.js                   # Cloud Run entry point
```

### Base Scraper Pattern

All scrapers extend the base class:

```javascript
class BaseScraper {
  async run() {
    await this.initialize();    // Load config, create browser
    await this.preProcess();    // Mark activities inactive
    const data = await this.scrapeData();  // Extract from website
    await this.processData(data);          // Transform & load
    await this.postProcess();   // Deactivate stale, log metrics
  }
}
```

## Claude Vision Validation System

The validation system uses Claude Vision to verify scraped data against what's actually visible on recreation websites. This helps detect scraping errors without relying on brittle CSS selectors.

### How It Works

```
1. Capture Screenshot
   ├── Navigate to activity page
   ├── Wait for content to load
   └── Capture full-page screenshot

2. Claude Vision Extraction
   ├── Send screenshot to Claude Vision API
   ├── Use structured prompts for extraction
   └── Return visible activity data as JSON

3. Comparison
   ├── Match activities by name/ID
   ├── Compare field by field
   └── Calculate discrepancy score

4. Report Generation
   ├── Generate HTML report
   ├── Highlight discrepancies
   └── Include recommendations
```

### Running Validation

```bash
# Validate specific provider with sample
node server/scrapers/scripts/runValidation.js --provider=vancouver --sample=5

# Validate all active providers
node server/scrapers/scripts/runValidation.js --all

# Validate specific activity
node server/scrapers/scripts/runValidation.js --provider=vancouver --activityId=abc123
```

### Validation Output

Reports are generated at `server/scrapers/validation/reports/`:

- `vancouver-validation-2024-12-30.html` - HTML report with visual diff
- `vancouver-validation-2024-12-30.json` - Raw comparison data

### Discrepancy Types

| Type | Severity | Description |
|------|----------|-------------|
| Missing Field | Warning | Scraped data missing visible field |
| Wrong Value | Error | Field value doesn't match visible |
| Extra Field | Info | Scraped field not visible on page |
| Date Mismatch | Error | Start/end date incorrect |
| Price Mismatch | Error | Cost differs from visible |

## Scraping Lifecycle

### 1. Pre-Processing

Before scraping, mark all existing activities as inactive:

```javascript
await prisma.activity.updateMany({
  where: { providerId: provider.id },
  data: { isActive: false }
});
```

### 2. Data Extraction

Navigate website with Puppeteer and extract activity data:

```javascript
// For each category page
await page.goto(categoryUrl);
await page.waitForSelector('.activity-card');

// Extract activity details
const activities = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.activity-card')).map(card => ({
    name: card.querySelector('.name')?.textContent,
    courseId: card.dataset.courseId,
    // ... other fields
  }));
});
```

### 3. Deduplication

Use `courseId` as unique identifier:

```javascript
const existing = await prisma.activity.findUnique({
  where: {
    providerId_externalId: {
      providerId: provider.id,
      externalId: activity.courseId
    }
  }
});

if (existing) {
  await prisma.activity.update({ ... });  // Update
} else {
  await prisma.activity.create({ ... });  // Create
}
```

### 4. Post-Processing

Activities not seen during scrape remain `isActive: false` and won't appear in search results.

## Scraping Schedule

### Tier 1: High Volume (3x Daily)
Scraped at 7:00 AM, 1:00 PM, 7:00 PM local time

- Toronto, Vancouver, Ottawa
- North Vancouver, Burnaby, Mississauga
- Surrey, Brampton, Edmonton

### Tier 2: Standard (Daily)
Scraped at 6:00 AM local time

- All providers with 100+ activities

### Tier 3: Low Priority (Weekly)
Scraped on Sundays

- Providers with fewer than 100 activities

## Provider Configuration

Each provider has a JSON config file:

```json
{
  "id": "calgary-liveandplay",
  "name": "Calgary Live and Play",
  "code": "calgary",
  "platform": "regprog",
  "region": "Alberta",
  "city": "Calgary",
  "baseUrl": "https://liveandplay.calgary.ca/REGPROG",
  "isActive": true,
  "scraperConfig": {
    "type": "category-browse",
    "entryPoints": ["/youth", "/camps", "/aquatics"],
    "ageFilters": { "min": 0, "max": 18 },
    "fetchDetailPages": true,
    "rateLimit": {
      "requestsPerMinute": 25,
      "concurrentRequests": 3
    },
    "timeout": 60000,
    "retries": 3
  },
  "schedule": {
    "tier": "standard",
    "frequency": "daily",
    "timezone": "America/Edmonton"
  },
  "metadata": {
    "population": 1306784,
    "expectedActivities": 500,
    "notes": "Major city, high activity volume"
  }
}
```

### Configuration Fields

| Field | Description |
|-------|-------------|
| `platform` | Scraper type to use |
| `baseUrl` | Website base URL |
| `scraperConfig.type` | `category-browse` or `search` |
| `scraperConfig.entryPoints` | Starting URLs/paths |
| `scraperConfig.rateLimit` | Request throttling |
| `scraperConfig.timeout` | Page load timeout (ms) |
| `schedule.tier` | `critical` (3x daily), `standard` (daily), or `low` (weekly) |

## Rate Limiting

Each provider is configured with rate limits:

| Setting | Default | Description |
|---------|---------|-------------|
| `requestsPerMinute` | 25-30 | Max requests per minute |
| `concurrentRequests` | 3 | Parallel page loads |
| `delay` | 2000-2500ms | Delay between pages |
| `timeout` | 60000-90000ms | Page load timeout |
| `retries` | 3 | Retry attempts on failure |
| `initialWait` | 5000ms | Browser startup wait |

## Data Transformation

### Input (from website)
```
- Activity name
- Date/time information
- Age requirements
- Cost
- Location details
- Registration URL
- Sessions (if multi-session)
- Prerequisites
```

### Normalization
- Parse dates to ISO format
- Extract age ranges (min/max)
- Standardize time formats (HH:mm)
- Calculate dayOfWeek from schedule
- Extract location from address
- Geocode addresses (lat/lng)

### Output (to database)
```javascript
{
  providerId: "uuid",
  externalId: "courseId",
  name: "Swimming Lessons - Level 3",
  category: "Aquatics",
  subcategory: "Group Lessons",
  dateStart: DateTime,
  dateEnd: DateTime,
  startTime: "09:30",
  endTime: "10:30",
  dayOfWeek: ["Monday", "Wednesday"],
  ageMin: 5,
  ageMax: 10,
  cost: 75.00,
  spotsAvailable: 3,
  totalSpots: 15,
  registrationUrl: "https://...",
  fullDescription: "...",
  instructor: "Jane Smith",
  isActive: true
}
```

## External ID Generation (CRITICAL)

The `externalId` field is **critical** for proper change detection. It must be **stable** across scrape runs so the system can:
- Detect when activities are **updated** (vs creating duplicates)
- Track activity **history** over time
- Avoid **duplicate** activities in the database

### ID Priority Order

When generating external IDs, follow this priority:

1. **Native ID from source** (BEST) - courseId, activityId, programId from the website
2. **ID from URL** - Extract from registration URL patterns like `courseId=12345`
3. **Stable hash** (FALLBACK) - Hash of name + location only

### Using the Centralized Utility

All scrapers should use the centralized ID generator:

```javascript
const { generateExternalId } = require('../utils/stableIdGenerator');

// In your scraper's field mapping or parsing function:
const externalId = generateExternalId(activity, {
  platform: 'yourplatform',
  providerCode: 'yp',      // 2-3 letter prefix
  hashPrefix: 'yp'         // Prefix for fallback hash
});
```

The utility will:
1. Try to extract native ID from common fields (`courseId`, `activityId`, `id`, etc.)
2. Try to extract ID from URL patterns (`courseId=`, `activityId=`, etc.)
3. Fall back to stable hash using ONLY name + location

### DO and DON'T

| DO | DON'T |
|----|-------|
| Use `courseId` from source | Use `Date.now()` |
| Use `activityId` from API | Use `Math.random()` |
| Extract ID from URL | Use array `index` |
| Hash name + location only | Include `cost` in hash |
| | Include `dateStart` in hash |
| | Include `startTime` in hash |

### Why Volatile Fields Are Bad

```javascript
// BAD - Activity changes from $50 to $55
// Hash changes = NEW activity created, old one deactivated!
const badHash = hash(name + location + cost);

// GOOD - Price change detected as UPDATE
const goodHash = hash(name + location);
```

## Manual Execution

### Run Scraper Manually

```bash
# Execute Cloud Run job
gcloud run jobs execute kids-activity-scraper-job --region=us-central1

# Check execution status
gcloud run jobs executions list \
  --job=kids-activity-scraper-job \
  --region=us-central1

# View logs
gcloud run jobs executions logs \
  --job=kids-activity-scraper-job \
  --region=us-central1
```

### Run Locally

```bash
cd server

# Run single provider
node scrapers/scripts/runSingleScraper.js --provider=vancouver

# Run all scrapers
node scrapers/scripts/runAllScrapers.js

# Run by tier
node scrapers/scripts/runByTier.js --tier=critical
```

## Monitoring & Metrics

### Tracked Metrics

| Metric | Description |
|--------|-------------|
| `activitiesFound` | Total activities discovered |
| `activitiesCreated` | New records created |
| `activitiesUpdated` | Existing records updated |
| `activitiesDeactivated` | Records marked inactive |
| `fieldCoverage` | Data quality by field |
| `avgFieldCoverage` | Overall quality score % |
| `scrapeDuration` | Execution time |

### Alert Thresholds

| Condition | Trigger |
|-----------|---------|
| Activity count change | > 10% difference |
| Field coverage drop | < 85% average |
| Execution time | > 10 minutes |
| Complete failure | Any unhandled error |

### Database Tables

- `ScrapeJob` - Job execution records
- `ScraperRun` - Detailed metrics per run
- `ProviderMetrics` - Historical performance data
- `ScraperHealthCheck` - Health status tracking

## Adding a New Provider

1. **Create config file**: `server/scrapers/configs/providers/cityname.json`
2. **Determine platform**: Check website technology
3. **Configure scraper**: Set entry points, rate limits
4. **Implement stable ID generation** (see [External ID Generation](#external-id-generation-critical)):
   - Extract native ID from source (courseId, activityId, etc.)
   - Use `generateExternalId()` utility from `utils/stableIdGenerator.js`
   - **NEVER** use `Date.now()`, `Math.random()`, or volatile fields
5. **Test locally**: Run with `--provider=cityname`
6. **Verify ID stability**: Run scraper twice, ensure no duplicate activities created
7. **Run validation**: `node scrapers/scripts/runValidation.js --provider=cityname`
8. **Deploy**: Config auto-loads on next scraper run

### New Scraper Checklist

- [ ] Scraper extracts native IDs from source when available
- [ ] Uses `generateExternalId()` utility for fallback
- [ ] Does NOT use `Date.now()` or `Math.random()` in IDs
- [ ] Does NOT include cost, dates, or times in hash
- [ ] Running scraper twice produces same activity count (no duplicates)
- [ ] Changes to activity fields are logged as UPDATES, not NEW
- [ ] Validation report shows < 5% discrepancy rate

## Troubleshooting

### Common Issues

**Timeout errors**
- Increase `timeout` in config
- Check if website is slow/down

**Missing activities**
- Verify `entryPoints` are correct
- Check if website structure changed
- Run validation to compare

**Rate limit errors (429)**
- Reduce `requestsPerMinute`
- Increase delays between requests

**Browser crashes**
- Reduce `concurrentRequests`
- Increase memory allocation

**High validation discrepancy**
- Check if selectors need updating
- Verify website hasn't changed layout
- Compare with Claude Vision extraction

### Debug Mode

```bash
# Run with debug logging
DEBUG=scraper:* node scrapers/scripts/runSingleScraper.js --provider=vancouver
```

---

**Document Version**: 6.0
**Last Updated**: December 2025

### Changelog
- v6.0: Added Claude Vision validation system documentation
- v5.0: Added External ID Generation section with guidelines for stable IDs
- v4.0: Initial comprehensive documentation
