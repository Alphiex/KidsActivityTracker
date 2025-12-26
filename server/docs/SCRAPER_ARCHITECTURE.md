# Comprehensive Scraper Enhancement Plan

## Objective
Ensure every activity is extracted from each site with **100% coverage of critical fields**:
- **Dates** (dateStart, dateEnd)
- **Times** (startTime, endTime)
- **Days of Week** (dayOfWeek)
- **Location** (locationName, fullAddress, latitude, longitude)
- **Age Range** (ageMin, ageMax)
- **Cost** (cost)
- **Registration Status** (registrationStatus, spotsAvailable)

No duplicates, proper update tracking, and complete data for every activity.

---

## CRITICAL FIELDS - Required for 100% Coverage

| Field | Description | Source | Target |
|-------|-------------|--------|--------|
| **dateStart** | Program start date | Detail page | 100% |
| **dateEnd** | Program end date | Detail page | 100% |
| **startTime** | Daily start time | Detail page / listing | 100% |
| **endTime** | Daily end time | Detail page / listing | 100% |
| **dayOfWeek** | Days program runs | Detail page / listing | 100% |
| **locationName** | Facility/venue name | Detail page | 95%+ |
| **latitude** | GPS latitude | Embedded JSON / geocoding | 90%+ |
| **longitude** | GPS longitude | Embedded JSON / geocoding | 90%+ |
| **fullAddress** | Street address | Detail page | 85%+ |
| **ageMin** | Minimum age | Detail page / listing | 95%+ |
| **ageMax** | Maximum age | Detail page / listing | 95%+ |
| **cost** | Program fee | Detail page / listing | 95%+ |
| **registrationStatus** | Open/Full/Waitlist/Closed | Detail page | 90%+ |

---

## Current State Analysis (Updated)

### Database Coverage (47,453 activities)
| Provider | Total | Dates | Times | DayOfWeek | Location | Cost |
|----------|-------|-------|-------|-----------|----------|------|
| Vancouver | 9,863 | 0% | 0% | 0% | 0% | 33% |
| Burnaby | 5,808 | 0% | 0% | 0% | 0% | 52% |
| Richmond | 4,241 | 0% | 100% | 81% | 0% | 99% |
| North Vancouver | 4,045 | 37% | 39% | 0% | 39% | 39% |
| Surrey | 3,917 | 0% | 100% | 98% | 0% | 99% |
| West Vancouver | 3,869 | 0% | 0% | 0% | 0% | 78% |
| Coquitlam | 3,089 | 0% | 100% | 78% | 0% | 99% |
| Maple Ridge | 2,088 | 0% | 100% | 90% | 0% | 99% |
| **Average** | - | **3%** | **45%** | **35%** | **3%** | **68%** |

### Key Issues Identified
1. **Dates**: Only 3% coverage - ActiveNetwork scrapers not extracting dates
2. **Location**: Only 3% coverage - Only NVRC extracting location names
3. **Coordinates**: 0% coverage - Not being extracted from detail pages
4. **Times/Days**: 35-45% coverage - PerfectMind sites have data, ActiveNetwork doesn't

---

## Phase 1: Detail Page Extraction (COMPLETED)

### 1.1 PerfectMind Detail Extraction ✅
Enhanced `enhanceWithLocationData()` method to extract ALL fields:
- [x] Dates (StartDate, EndDate from JSON)
- [x] Times (StartTime, EndTime from JSON/text)
- [x] Days of week (DayOfWeek from JSON/text)
- [x] Location (ActualLocation, Street, City, PostalCode)
- [x] Coordinates (Latitude, Longitude from embedded JSON)
- [x] Age range (MinAge, MaxAge from JSON/text)
- [x] Cost (Fee, Price from JSON/text)
- [x] Instructor
- [x] Sessions count
- [x] Registration status

### 1.2 ActiveNetwork Detail Extraction ✅
Enhanced `enhanceWithLocationData()` method to extract ALL fields:
- [x] Dates (date range from page text "Jan 10, 2026 - Mar 21, 2026")
- [x] Times (schedule patterns "Sat 12:55 PM - 1:55 PM")
- [x] Days of week (extracted from schedule)
- [x] Location (facility name from breadcrumb/text)
- [x] Coordinates (from Google Maps iframe/data attributes)
- [x] Age range (from text patterns)
- [x] Cost (from fee display)
- [x] Instructor
- [x] Sessions count
- [x] Registration status

### 1.3 Field Mapping Updates ✅
Updated field mappings in both scrapers to include:
- dateStart, dateEnd
- startTime, endTime
- dayOfWeek
- locationName, latitude, longitude, fullAddress
- instructor, sessionCount, hasMultipleSessions

---

## Phase 2: Location & Geocoding (IN PROGRESS)

### 2.1 Location Builder Script ✅
Created `scrapers/scripts/locationBuilder.js`:
- Extracts unique location names from activities
- Creates/updates Location records
- Links activities to Location records
- Reports on coordinate coverage

### 2.2 Geocoding Script ✅
Created `scrapers/scripts/geocodeLocations.js`:
- Geocodes locations without coordinates using Google Maps API
- Batch processing with rate limiting
- Propagates coordinates to activities
- Dry-run mode for testing

### 2.3 Coordinate Extraction ✅
- PerfectMind: Extracts from embedded JSON (`"Latitude":49.140312`)
- ActiveNetwork: Extracts from Google Maps iframe/data attributes
- Fallback to geocoding for locations without embedded coords

---

## Phase 3: Run Enhanced Scrapers (PENDING)

### 3.1 Scraper Configuration
Enable detail page fetching by setting `fetchDetailPages: true`:
```javascript
// In provider config
scraperConfig: {
  fetchDetailPages: true,  // Enable comprehensive detail extraction
  // ... other config
}
```

### 3.2 Run Order
1. **PerfectMind providers** (have embedded coordinate data):
   - Richmond, Surrey, Coquitlam, Maple Ridge, Delta
   - Abbotsford, New Westminster, Port Moody
   - Township of Langley, White Rock

2. **ActiveNetwork providers** (need detail page scraping):
   - Vancouver, Burnaby, West Vancouver
   - City of Langley, Port Coquitlam, Bowen Island

3. **Intelligenz providers**:
   - Pitt Meadows

### 3.3 Post-Scrape Tasks
- Run `locationBuilder.js` to create Location records
- Run `geocodeLocations.js` to fill in missing coordinates
- Verify field coverage with database queries

---

## Phase 4: Validation & Verification (PENDING)

### 4.1 Field Coverage Verification Query
```sql
SELECT
  p.name as provider,
  COUNT(*) as total,
  COUNT(a."dateStart") as dates,
  COUNT(a."startTime") as times,
  COUNT(CASE WHEN array_length(a."dayOfWeek", 1) > 0 THEN 1 END) as days,
  COUNT(a."locationName") as location,
  COUNT(a.latitude) as coords,
  COUNT(CASE WHEN a.cost > 0 THEN 1 END) as cost
FROM "Activity" a
JOIN "Provider" p ON a."providerId" = p.id
WHERE a."isActive" = true
GROUP BY p.name
ORDER BY total DESC;
```

### 4.2 Target Metrics
| Metric | Current | Target |
|--------|---------|--------|
| Activities with dateStart | 3% | 95%+ |
| Activities with times | 45% | 95%+ |
| Activities with dayOfWeek | 35% | 95%+ |
| Activities with locationName | 3% | 95%+ |
| Activities with coordinates | 0% | 90%+ |
| Activities with cost | 68% | 95%+ |
| Activities with age range | 71% | 95%+ |

---

## Implementation Status

### Completed ✅
- [x] Enhanced nvrcComprehensiveDetailScraper.js for coordinates
- [x] Updated BaseScraper.sanitizeActivityData() with location fields
- [x] Tested coordinate extraction on Richmond detail page
- [x] Created locationBuilder.js script
- [x] Created geocodeLocations.js script
- [x] Enhanced PerfectMindScraper with full detail extraction
- [x] Enhanced ActiveNetworkScraper with full detail extraction
- [x] Updated field mappings for all critical fields

### In Progress 🔄
- [ ] Run enhanced scrapers on all providers
- [ ] Execute geocoding for missing coordinates
- [ ] Verify 100% field coverage

### Pending ⏳
- [ ] Create provider-specific extensions where needed
- [ ] Audit all providers for missed categories
- [ ] Build comprehensive location database

---

## Files Modified/Created

### Modified
- `scrapers/nvrcComprehensiveDetailScraper.js` - Coordinate extraction ✅
- `scrapers/base/BaseScraper.js` - Location fields in sanitize ✅
- `scrapers/base/DataNormalizer.js` - Coordinate normalization ✅
- `scrapers/platforms/PerfectMindScraper.js` - Full detail extraction ✅
- `scrapers/platforms/ActiveNetworkScraper.js` - Full detail extraction ✅

### Created
- `scrapers/scripts/locationBuilder.js` - Build location database ✅
- `scrapers/scripts/geocodeLocations.js` - Geocode missing coords ✅
- `scrapers/scripts/testLocationExtraction.js` - Test extraction ✅

---

## Extraction Patterns by Platform

### PerfectMind JSON Patterns
```javascript
// Coordinates
/"Latitude"\s*:\s*(-?\d+\.\d+)/i
/"Longitude"\s*:\s*(-?\d+\.\d+)/i

// Dates
/"StartDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/i
/"EndDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/i

// Times
/"StartTime"\s*:\s*"([^"]+)"/i
/"EndTime"\s*:\s*"([^"]+)"/i

// Location
/"ActualLocation"\s*:\s*"([^"]+)"/i
/"Street"\s*:\s*"([^"]+)"/i
/"City"\s*:\s*"([^"]+)"/i
```

### ActiveNetwork Text Patterns
```javascript
// Date range
/([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})\s*-\s*([A-Z][a-z]{2}\s+\d{1,2},?\s*\d{4})/

// Schedule (day + time)
/(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i

// Age
/Age\s+(?:at\s+least\s+)?(\d+).*(?:but\s+less\s+than|to|-)\s*(\d+)/i

// Cost (largest fee)
/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g
```

---

## Next Steps

1. **Run Vancouver scraper** with enhanced detail extraction
2. **Verify field coverage** increased from 0% to 90%+
3. **Run remaining ActiveNetwork providers**
4. **Execute geocoding** for locations without coordinates
5. **Generate final coverage report**
