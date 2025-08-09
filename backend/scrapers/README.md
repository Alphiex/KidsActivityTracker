# NVRC Enhanced Detail Scraper

This enhanced scraper captures comprehensive activity information from NVRC including registration status, detail pages, and direct signup URLs.

## Features

- **Registration Status Capture**: Identifies if activities are Open, Closed, or WaitList
- **Detail Page Scraping**: Visits individual activity pages for additional information
- **Direct Signup URLs**: Extracts the actual registration links
- **Enhanced Information**: Captures instructor info, prerequisites, what to bring, contact details
- **Location Data**: Extracts full addresses and GPS coordinates when available
- **Batch Processing**: Efficiently processes 4000+ activities with parallel detail fetching

## Installation

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Run Database Migrations**
```bash
npx prisma migrate deploy
npx prisma generate
```

## Usage

### Manual Run

```bash
# Run the enhanced scraper
node scrapers/nvrcEnhancedDetailScraper.js

# Import the scraped data
node import-enhanced-activities.js
```

### Automated Run

```bash
# Use the provided script
./scripts/run-enhanced-scraper.sh
```

### Setup Automatic Daily Scraping

```bash
# Setup cron job for daily updates
./scripts/setup-scraper-cron.sh
```

## Configuration

### Environment Variables

- `HEADLESS`: Set to `false` to see browser (default: `true`)
- `PUPPETEER_EXECUTABLE_PATH`: Custom Chrome/Chromium path
- `DATABASE_URL`: PostgreSQL connection string

### Scraper Options

```javascript
const scraper = new NVRCEnhancedDetailScraper({
  headless: true,           // Run in headless mode
  maxRetries: 3,           // Retry failed detail pages
  detailPageTimeout: 30000 // Timeout for detail pages (ms)
});
```

## Output

The scraper generates a JSON file with the following structure:

```json
{
  "timestamp": "2025-08-09T...",
  "source": "NVRC Enhanced Detail Scraper",
  "totalActivities": 4523,
  "activities": [
    {
      "id": "unique_id",
      "name": "Swimming Lessons",
      "category": "Swimming",
      "subcategory": "Preschool",
      "registrationStatus": "Open",
      "registrationButtonText": "Sign Up Now",
      "detailUrl": "https://...",
      "directRegistrationUrl": "https://...",
      "fullDescription": "...",
      "instructor": "John Doe",
      "prerequisites": "Must be comfortable in water",
      "whatToBring": "Swimsuit, towel, goggles",
      "latitude": 49.123,
      "longitude": -123.456,
      "fullAddress": "123 Main St, North Vancouver, BC",
      "contactInfo": "604-123-4567",
      // ... plus all standard fields
    }
  ]
}
```

## Database Schema

The enhanced fields are stored in the Activity table:

- `registrationStatus`: Current registration status (Open/Closed/WaitList)
- `registrationButtonText`: Exact button text from NVRC
- `detailUrl`: URL to activity detail page
- `fullDescription`: Complete activity description
- `instructor`: Instructor name if available
- `prerequisites`: Requirements to join
- `whatToBring`: Items participants should bring
- `fullAddress`: Complete address
- `latitude`/`longitude`: GPS coordinates for mapping
- `directRegistrationUrl`: Direct link to registration
- `contactInfo`: Phone or email for questions

## Monitoring

### Check Logs

```bash
# View recent scraper logs
tail -f logs/enhanced-scraper-*.log

# Check cron job logs
tail -f logs/cron-scraper-*.log
```

### Verify Activity Count

```bash
# Check database activity count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Activity\" WHERE \"isActive\" = true;"

# Check by provider
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Activity\" WHERE \"providerId\" = (SELECT id FROM \"Provider\" WHERE name = 'NVRC');"
```

## Troubleshooting

### Scraper Fails to Start

1. Check Node.js version (requires 14+)
2. Verify Puppeteer installation: `node -e "require('puppeteer')"`
3. Check Chrome dependencies: `ldd $(which chromium-browser)`

### Low Activity Count

1. Check NVRC website is accessible
2. Verify age groups and categories are being selected
3. Review logs for timeout errors
4. Increase timeout values if needed

### Import Failures

1. Check database connection
2. Verify schema migrations are applied
3. Check for duplicate activities
4. Review import logs for specific errors

## Performance

- Initial scrape: ~15-20 minutes for 4000+ activities
- Detail page fetching: Processes in batches of 10
- Database import: ~2-3 minutes
- Memory usage: ~500MB-1GB during scraping

## Maintenance

- Run daily at off-peak hours (2 AM recommended)
- Monitor for NVRC website changes
- Keep Chrome/Chromium updated
- Archive old JSON files monthly