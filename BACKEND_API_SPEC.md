# Backend API Specification

## Overview

The mobile app requires a backend API to handle web scraping and automation tasks that cannot be performed directly from the mobile device.

## Required Endpoints

### 1. Camp Scraping

#### GET /api/scrape/nvrc
Scrapes NVRC website for camps

Query Parameters:
- `programs[]`: Array of program types
- `activities[]`: Array of activity types  
- `locations[]`: Array of location IDs
- `dateFrom`: Start date filter
- `dateTo`: End date filter

Response:
```json
{
  "camps": [
    {
      "id": "string",
      "name": "string",
      "provider": "NVRC",
      "description": "string",
      "activityType": ["camps", "swimming"],
      "ageRange": { "min": 6, "max": 12 },
      "dateRange": {
        "start": "2024-07-01",
        "end": "2024-07-05"
      },
      "schedule": {
        "days": ["Monday", "Tuesday"],
        "startTime": "9:00 AM",
        "endTime": "4:00 PM"
      },
      "location": {
        "name": "string",
        "address": "string"
      },
      "cost": 250,
      "spotsAvailable": 5,
      "totalSpots": 20,
      "registrationUrl": "string",
      "scrapedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 2. Camp Registration

#### POST /api/register
Automates camp registration

Request Body:
```json
{
  "campId": "string",
  "childId": "string",
  "siteAccount": {
    "provider": "NVRC",
    "username": "string",
    "password": "string"
  }
}
```

Response:
```json
{
  "success": true,
  "confirmationNumber": "string",
  "message": "string"
}
```

### 3. Search Camps

#### GET /api/camps/search
Search camps with filters

Query Parameters:
- `activityTypes[]`: Filter by activity types
- `minAge`: Minimum age
- `maxAge`: Maximum age
- `dateFrom`: Start date
- `dateTo`: End date
- `maxCost`: Maximum cost
- `locations[]`: Location filters
- `providers[]`: Provider filters

### 4. Monitor Availability

#### POST /api/monitor
Set up monitoring for camp availability

Request Body:
```json
{
  "campId": "string",
  "userId": "string",
  "notifyWhen": "available" | "price_drop"
}
```

## Implementation Notes

### Web Scraping Strategy

1. Use Puppeteer or Playwright for JavaScript-rendered sites
2. Implement rate limiting to avoid being blocked
3. Cache results for 15 minutes to reduce load
4. Handle pagination automatically

### Security Considerations

1. Encrypt stored credentials
2. Use secure communication (HTTPS)
3. Implement API authentication
4. Rate limit API requests
5. Validate all input data

### Technology Recommendations

- **Node.js + Express** or **Python + FastAPI**
- **Puppeteer/Playwright** for web scraping
- **Redis** for caching
- **PostgreSQL** for data storage
- **JWT** for authentication

### Example NVRC Scraper Logic

```javascript
async function scrapeNVRC(filters) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Build URL with filters
  const url = buildNVRCUrl(filters);
  await page.goto(url);
  
  // Wait for results to load
  await page.waitForSelector('.program-list');
  
  // Extract camp data
  const camps = await page.evaluate(() => {
    const items = document.querySelectorAll('.program-item');
    return Array.from(items).map(item => ({
      name: item.querySelector('.program-name')?.textContent,
      description: item.querySelector('.program-description')?.textContent,
      // ... extract other fields
    }));
  });
  
  await browser.close();
  return camps;
}
```