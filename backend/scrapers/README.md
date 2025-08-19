# Activity Scrapers Documentation

## Overview

This directory contains web scrapers for collecting activity data from various recreation providers. Each provider has ONE dedicated scraper that handles all data collection needs.

## Current Scrapers

### 1. NVRC (North Vancouver Recreation Commission)
- **File**: `nvrcEnhancedParallelScraper.js`
- **URL**: `https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a`
- **Status**: Production Ready

## IMPORTANT: Scraper Development Guidelines

⚠️ **DO NOT CREATE NEW SCRAPERS FOR EXISTING PROVIDERS** ⚠️

We maintain ONE scraper per provider. If you need to modify or enhance a scraper:

1. **Always modify the existing scraper** - Do not create new variations
2. **Test locally first** before deploying
3. **Ensure backward compatibility** with existing data structures
4. **Document any significant changes** in this README

## NVRC Enhanced Parallel Scraper

### Features
- Parallel processing of activity sections for faster scraping
- Enhanced detail fetching from registration pages
- Session and prerequisite information extraction
- Automatic retry and error handling
- Progress tracking and detailed reporting

### Data Collected
- Basic activity information (name, category, schedule, cost)
- Age ranges and location details
- Registration URLs and course IDs
- Enhanced details:
  - Multiple sessions with dates/times
  - Prerequisites with links
  - Instructor information
  - Full descriptions
  - What to bring information

### Architecture
1. **Main Page Navigation**: Accesses the PerfectMind widget
2. **Section Discovery**: Identifies activity sections (Early Years, Youth, etc.)
3. **Parallel Processing**: Processes multiple sections concurrently
4. **Activity Extraction**: Extracts all activities from each section
5. **Detail Enhancement**: Visits registration pages for additional details
6. **Database Storage**: Saves to PostgreSQL with proper relations

### Usage

#### Local Development
```bash
node scrapers/nvrcEnhancedParallelScraper.js
```

#### Production Deployment
```bash
# The scraper is deployed as a Cloud Run Job
node scraper-job.js
```

### Configuration
The scraper accepts these options:
- `headless`: Run browser in headless mode (default: true)
- `maxConcurrency`: Number of parallel browser instances (default: 3)

### Database Schema
The scraper populates these tables:
- `Activity`: Main activity records
- `ActivitySession`: Multiple sessions per activity
- `ActivityPrerequisite`: Prerequisites with URLs
- `Location`: Activity locations
- `Provider`: Recreation providers
- `ScrapeJob`: Scraping job history

### Error Handling
- Automatic retries for network failures
- Graceful degradation if detail pages fail
- Comprehensive error logging
- Job status tracking in database

## Adding New Providers

When adding a scraper for a NEW provider:

1. Create ONE scraper file: `{provider}Scraper.js`
2. Follow the pattern of `nvrcEnhancedParallelScraper.js`
3. Document the scraper in this README
4. Test thoroughly before deployment
5. Update `scraper-job.js` if needed

## Deployment

### Building the Docker Image
```bash
gcloud builds submit --config cloudbuild-scraper.yaml
```

### Creating a Cloud Run Job
```bash
gcloud run jobs replace scraper-job.yaml --region us-west1
```

### Running Manually
```bash
gcloud run jobs execute scraper-detailed-job --region us-west1
```

### Setting up Cron Schedule
```bash
gcloud scheduler jobs create http scraper-schedule \
  --location us-west1 \
  --schedule "0 6 * * *" \
  --http-method POST \
  --uri "https://us-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/kids-activity-tracker-2024/jobs/scraper-detailed-job:run" \
  --oauth-service-account-email scraper-sa@kids-activity-tracker-2024.iam.gserviceaccount.com
```

## Archive

Old scraper versions are archived in `archive-nvrc-old/`. These should NOT be used and are kept only for reference.

## Troubleshooting

### Common Issues

1. **Puppeteer Launch Errors**
   - Ensure Chrome/Chromium is installed
   - Check Docker has required dependencies

2. **Timeout Errors**
   - Increase timeout values
   - Check network connectivity
   - Verify target website is accessible

3. **Database Connection Issues**
   - Verify DATABASE_URL is set
   - Check network access to Cloud SQL
   - Ensure proper authentication

### Debug Mode
Set environment variables for debugging:
```bash
export NODE_ENV=development
export DEBUG=true
```

## Contact

For questions or issues with scrapers, please create a GitHub issue or contact the development team.