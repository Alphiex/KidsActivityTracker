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
│   ├── AutoFixPipeline.js          # AI-powered auto-fix orchestrator
│   ├── DiscrepancyAnalyzer.js      # Analyzes validation discrepancies
│   ├── SelectorDiscoveryAgent.js   # Uses Claude to find CSS selectors
│   ├── HTMLCapture.js              # Captures sample HTML pages
│   ├── FixValidator.js             # Tests fixes before applying
│   ├── PlatformAnalyzer.js         # Routes fixes to correct scrapers
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
│   ├── runValidation.js            # Run validation check
│   └── runAutoFix.js               # Run AI auto-fix pipeline
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

## AI-Powered Auto-Fix Pipeline

The Auto-Fix Pipeline uses Claude AI to automatically detect and fix scraper extraction issues. It analyzes validation discrepancies, discovers new CSS selectors, validates fixes, and applies patches to scraper code autonomously.

### How It Works

```
1. Analyze Discrepancies
   ├── Parse validation reports
   ├── Identify patterns (missing fields, wrong values)
   └── Prioritize by severity and frequency

2. Route Fixes
   ├── Determine if fix applies to platform or provider
   ├── Platform fix: >50% of providers affected
   └── Provider fix: Specific to one provider

3. Capture HTML Samples
   ├── Navigate to activity pages
   ├── Capture raw HTML (not screenshots)
   └── Collect 3-5 samples per field

4. Discover Selectors (Claude AI)
   ├── Send HTML samples to Claude
   ├── Ask for CSS selectors that extract the field
   └── Get confidence score and alternatives

5. Validate Fixes
   ├── Test selectors against sample pages
   ├── Compare extracted values to expected
   └── Require ≥70% accuracy to proceed

6. Apply Patches
   ├── Insert extraction code into scraper
   ├── Place inside page.evaluate() block
   └── Create backup before patching
```

### Running the Auto-Fix Pipeline

```bash
# Analyze only (no changes)
node server/scrapers/scripts/runAutoFix.js --analyze

# Dry run - preview what would be fixed
node server/scrapers/scripts/runAutoFix.js --max=5 --verbose

# Apply fixes
node server/scrapers/scripts/runAutoFix.js --max=5 --verbose --apply

# Fix specific field only
node server/scrapers/scripts/runAutoFix.js --field=registrationStatus --apply
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--analyze` | Only analyze discrepancies, no fixes |
| `--max=N` | Limit to N fields to fix |
| `--field=name` | Fix specific field only |
| `--verbose` | Show detailed output |
| `--apply` | Actually apply fixes (default is dry run) |
| `--skip-validation` | Skip fix validation (not recommended) |

### Pipeline Components

| Component | File | Purpose |
|-----------|------|---------|
| AutoFixPipeline | `AutoFixPipeline.js` | Main orchestrator |
| DiscrepancyAnalyzer | `DiscrepancyAnalyzer.js` | Parses validation reports |
| PlatformAnalyzer | `PlatformAnalyzer.js` | Routes fixes to correct scraper |
| HTMLCapture | `HTMLCapture.js` | Captures sample HTML pages |
| SelectorDiscoveryAgent | `SelectorDiscoveryAgent.js` | Uses Claude to find selectors |
| FixValidator | `FixValidator.js` | Tests selectors before applying |
| ScraperPatcher | `ScraperPatcher.js` | Applies code patches |

### Supported Fields

The pipeline can auto-fix extraction for these fields:

| Field | Description |
|-------|-------------|
| `registrationStatus` | Open, Full, Waitlist, Closed |
| `sessionCount` | Number of sessions |
| `spotsAvailable` | Available spots |
| `instructor` | Instructor/staff name |
| `ageMin` / `ageMax` | Age requirements |
| `cost` | Activity price |

### Fix Validation

Before applying any fix, the pipeline validates it:

1. **Selector Testing**: Run selector against 5 sample pages
2. **Value Extraction**: Extract field value from each page
3. **Accuracy Check**: Compare to expected values from validation
4. **Threshold**: Require ≥70% accuracy to apply

### Patch Format

Auto-fixes are inserted inside `page.evaluate()` blocks using DOM API:

```javascript
// AUTO-FIX: Extract registration status
if (!data.registrationStatus) {
  const statusSelectors = [".activity-status", ".spots span"];
  for (const sel of statusSelectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim()?.toLowerCase();
        if (text?.includes('waitlist')) data.registrationStatus = 'Waitlist';
        else if (text?.includes('full')) data.registrationStatus = 'Full';
        // ... more conditions
        if (data.registrationStatus) break;
      }
    } catch (e) {}
  }
}
```

### Output & Results

Results are saved to `server/scrapers/validation/autofix-results/`:

```json
{
  "timestamp": "2026-01-02T19:00:00.000Z",
  "mode": "LIVE",
  "duration": 285000,
  "patternsAnalyzed": 74,
  "selectorsDiscovered": 3,
  "fixesValidated": 2,
  "fixesApplied": 4,
  "apiCost": "$0.47",
  "fixes": [
    {
      "field": "registrationStatus",
      "selector": ".activity-status",
      "confidence": 95,
      "validationAccuracy": 100,
      "affectedProviders": 40
    }
  ]
}
```

### Duplicate Detection

The pipeline automatically skips fields that have already been patched:

- Looks for `// AUTO-FIX: Extract {field}` comments
- Checks for existing selector arrays (e.g., `statusSelectors`)
- Reports "⊘ Skipped (already patched)" in output

### Backup & Rollback

Before any patch is applied:

1. Backup created at `validation/backups/{Scraper}.js.{timestamp}.backup`
2. Original file preserved with timestamp
3. To rollback: `cp backups/ScraperName.js.{timestamp}.backup platforms/ScraperName.js`

### API Cost

The pipeline uses Claude API for selector discovery:

- ~$0.10-0.20 per field analyzed
- ~$0.40-0.60 for typical 3-field run
- Cost logged in results JSON

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

## Performance Optimizations

### Multi-Browser Parallelization

Large scrapers (500+ activities) use browser pools for parallel processing during the detail enhancement phase:

| Platform | 500+ Activities | 200-500 Activities | <200 Activities |
|----------|-----------------|--------------------|-----------------|
| ActiveNetwork | 3 browsers | 2 browsers | 1 browser |
| PerfectMind | 3 browsers | 1 browser | 1 browser |

**How it works:**
- Multiple browser instances process detail pages concurrently
- Work is distributed via a shared queue pattern
- Each browser processes 10-15 pages in parallel batches
- Results are aggregated after all workers complete

**Expected speedups for large providers:**
- Burnaby (~5,500 activities): ~120 min → ~40-50 min
- Mississauga (~7,800 activities): ~150 min → ~50-60 min
- Toronto (~12,000 activities): ~200 min → ~70-80 min

### Browser Restart Logic

To prevent memory leaks and browser crashes during long scraping sessions:

```javascript
// Browser restarts every 50 pages processed
const browserRestartInterval = 50;

if (pageCounters[browserIndex] >= browserRestartInterval) {
  await browsers[browserIndex].close();
  browsers[browserIndex] = await puppeteer.launch({...});
  pageCounters[browserIndex] = 0;
}
```

This prevents the "Protocol error: Connection closed" errors that occurred when browsers accumulated too many pages without restart.

### Transaction Timeout Configuration

Database batch saves use extended transaction timeouts to handle large datasets:

```javascript
await prisma.$transaction(async (tx) => {
  // Batch operations...
}, {
  timeout: 30000,  // 30 seconds (up from 5s default)
  maxWait: 60000   // 60 seconds to acquire connection
});
```

### Chrome Executable Path Fallback

Scrapers automatically detect Chrome installation:

```javascript
const getChromePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // macOS fallback to system Chrome
  const macOSChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (process.platform === 'darwin' && fs.existsSync(macOSChrome)) {
    return macOSChrome;
  }
  return undefined; // Use Puppeteer's bundled Chrome
};
```

This fixes "Could not find Chrome" errors when Puppeteer's bundled Chrome is unavailable.

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
- **Extract gender from activity name** (see Gender Detection below)
- Standardize time formats (HH:mm)
- Calculate dayOfWeek from schedule
- Extract location from address
- Geocode addresses (lat/lng)

### Gender Detection
The DataNormalizer automatically detects gender-specific activities from names:

| Pattern | Result | Examples |
|---------|--------|----------|
| `boys`, `boy's`, `male`, `men's` | `'male'` | "Boys Basketball", "Men's Hockey" |
| `girls`, `girl's`, `female`, `women's`, `ladies` | `'female'` | "Girls Softball", "Ladies Fitness" |
| `co-ed`, `mixed`, `all genders` | `null` | "Co-ed Soccer", "Mixed Martial Arts" |
| No gender keywords | `null` | "Swimming Lessons", "Piano Class" |

Activities with `gender: null` are available to all children.

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
  gender: null,  // 'male', 'female', or null (all)
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
- Browser restarts automatically every 50 pages to prevent memory buildup

**Protocol error: Connection closed**
- Pages now properly closed in `finally` blocks
- Browser restart logic prevents stale connections
- Multi-browser pool distributes load across instances

**Transaction timeout errors**
- Transaction timeout increased to 30 seconds
- Connection acquisition timeout set to 60 seconds
- Large batches processed in smaller chunks

**Chrome not found errors**
- Scrapers now fall back to system Chrome on macOS
- Set `PUPPETEER_EXECUTABLE_PATH` environment variable if needed
- Verify Chrome is installed at `/Applications/Google Chrome.app`

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

**Document Version**: 8.0
**Last Updated**: January 2026

### Changelog
- v8.0: Added Performance Optimizations section (multi-browser parallelization, browser restart logic, transaction timeouts, Chrome fallback)
- v7.0: Added AI-Powered Auto-Fix Pipeline documentation
- v6.0: Added Claude Vision validation system documentation
- v5.0: Added External ID Generation section with guidelines for stable IDs
- v4.0: Initial comprehensive documentation
