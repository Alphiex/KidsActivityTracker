# NVRC Scraper Summary

## Correct Approach

The NVRC scraper uses the **direct PerfectMind URL** and navigates through specific sections:

### URL
`https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a`

### Navigation Flow
1. **Navigate** to PerfectMind URL
2. **Click** section links: "Early Years: On My Own", "All Ages & Family", "Early Years: Parent Participation", "School Age", "Youth"
3. **Expand** activities by clicking all "Show" links
4. **Extract** data from expanded tables
5. **Return** to main page and repeat

### Key Features
- **No iframes** - Direct access to content
- **Works headless** - Confirmed working in cloud environments
- **Generic expansion** - Clicks all "Show" links automatically
- **Complete extraction** - Gets all activity details from tables

## Implementation

The scraper is implemented in: `scrapers/nvrcDirectScraper.js`

### Running the Scraper
```bash
# Headless mode (default)
node scrapers/nvrcDirectScraper.js

# Debug mode (see browser)
node scrapers/nvrcDirectScraper.js --debug
```

## Data Captured

Each activity includes:
- Activity name
- Section/Category
- Date range
- Days and times
- Age range
- Location
- Price
- Registration status (Sign Up/Waitlist/Closed)
- Course ID
- Registration URL

## Generic Design

The scraper automatically captures new activities because it:
- Processes all specified sections
- Clicks ALL "Show" links found
- Extracts from any table structure
- Doesn't hardcode specific activity names

This ensures the scraper continues working as NVRC adds new programs.