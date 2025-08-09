# NVRC Activity Scraper - Complete Documentation

## Overview
The NVRC (North Vancouver Recreation Centre) uses PerfectMind booking system. The scraper navigates directly to the PerfectMind URL and processes specific activity sections by clicking through category links and expanding hidden activities. The implementation is fully generic and will automatically capture new activities as they are added.

## Current Implementation Status

**Working Scraper**: `scrapers/nvrcDirectScraper.js`
- Successfully extracts activities from all sections
- Handles dynamic content expansion
- Stores data in normalized PostgreSQL database
- Captures all activity metadata (dates, times, prices, age ranges, etc.)

## Navigation Flow

### Step 1: Navigate to PerfectMind URL
**URL**: `https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a`

This loads a page with activity categories listed as clickable links in the navigation menu.

### Step 2: Process Target Sections
The scraper processes these specific sections:
- "Early Years: On My Own"
- "All Ages & Family"
- "Early Years: Parent Participation"
- "School Age"
- "Youth"

For each section, the scraper:
1. Finds all activity links within the section (e.g., "Arts Dance (0-6yrs)", "Swimming (0-6yrs PP)")
2. Clicks each activity link to navigate to its detail page
3. Expands all activities by clicking "Show" links to reveal hidden sessions

### Step 3: Expand Hidden Activities
On each category page:
- Activities are initially collapsed with only the title visible
- Each activity has a "Show" link that must be clicked
- Clicking "Show" reveals the full activity details including:
  - Session dates (e.g., "Jan 6 - Mar 27")
  - Days and times
  - Location
  - Price
  - Registration status (Sign Up, Waitlist, Closed)
  - Course ID

## Implementation Details

### Finding and Clicking Section Links
```javascript
const sectionClicked = await page.evaluate((section) => {
  const links = Array.from(document.querySelectorAll('a'));
  const sectionLink = links.find(link => 
    link.textContent?.trim() === section
  );
  
  if (sectionLink) {
    sectionLink.click();
    return true;
  }
  return false;
}, sectionName);
```

### Expanding Activities with "Show" Links
```javascript
const expanded = await page.evaluate(() => {
  const expandButtons = Array.from(document.querySelectorAll('a, button, span'))
    .filter(el => {
      const text = el.textContent?.trim().toLowerCase();
      return text === 'show' || text === 'show more';
    });
  
  expandButtons.forEach(btn => btn.click());
  return expandButtons.length;
});
```

### Extracting Activity Data
The scraper uses PerfectMind's div-based structure (not tables):
- Finds `.bm-group-title-row` elements for activity names
- Finds `.bm-group-item-row` elements for individual sessions
- Extracts from each session:
  - Activity name (from nearest group title)
  - Date range (e.g., "Jul 12 - Aug 16")
  - Days of the week
  - Time slots (e.g., "10:00 am - 10:30 am")
  - Age range (parsed from text)
  - Location (when available)
  - Price
  - Registration status (Open/Waitlist/Closed)
  - Course ID (from registration URL)

## Data Structure

Each activity contains:
```javascript
{
  id: "Early Years: On My Own_item_7",
  section: "Early Years: On My Own",
  activityType: "Arts Dance (0-6yrs)",
  name: "ICanDance! Leaping Ladybug Ballet 3-4yrs",
  dates: null,  // or "Jul 12 - Aug 16"
  daysOfWeek: ["Sat"],
  time: "10:00 am - 10:30 am",
  ageRange: { min: 3, max: 4 },
  location: null,  // or "Recreation Centre"
  price: 53.75,
  availability: "Closed",  // or "Open", "Waitlist"
  spotsAvailable: null,  // or number
  registrationUrl: "https://nvrc.perfectmind.com/.../courseId=...",
  rawText: "original text for debugging"
}
```

## Generic Design Features

1. **Dynamic Activity Discovery**: Finds activity links by pattern matching (e.g., text containing "(0-6yrs)")
2. **Automatic Section Detection**: No hardcoded activity names - finds all links within target sections
3. **Automatic Expansion**: Clicks all "Show" links to reveal hidden content
4. **Flexible Data Extraction**: Uses PerfectMind's div structure (.bm-group-item-row)
5. **Error Resilience**: Continues if a section or activity fails
6. **Future-Proof**: Will automatically capture new activities as they're added

## Running the Scraper

### Headless Mode (Default)
```bash
node scrapers/nvrcDirectScraper.js
```

### Debug Mode (See Browser)
```bash
node scrapers/nvrcDirectScraper.js --debug
```

## Database Integration

The scraper includes full database integration:
- **Provider Management**: Creates/updates NVRC provider record
- **Location Management**: Creates location records with facility type detection
- **Activity Storage**: Upserts activities with proper deduplication
- **Scrape Job Tracking**: Records each scraping run with statistics

## Key Points

- The scraper navigates to the main PerfectMind page
- Finds all activity links within each target section dynamically
- Clicks each activity link to navigate to its detail page
- Expands all collapsed activities by clicking "Show" links
- Extracts detailed information from PerfectMind's div-based structure
- Returns to the main page before processing the next section
- Stores all data in a normalized PostgreSQL database

This approach ensures all activities are captured by systematically:
1. Finding activity links by pattern (no hardcoding)
2. Opening each activity page
3. Expanding all hidden content
4. Extracting comprehensive activity data
5. Storing in a well-structured database