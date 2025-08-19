# Kids Activity Tracker - Remaining Tasks

## Overview
The scraper has been updated to extract detailed activity information including dates, instructor, description, and registration status. However, several issues remain that need to be addressed.

## Completed Tasks ✅
- [x] Fixed budget filter (now correctly shows activities <= threshold)
- [x] Added `dates` field for human-readable date ranges
- [x] Added `registrationStatus` field
- [x] Added `instructor` field extraction
- [x] Added `fullDescription` extraction from "About this Course" section
- [x] Implemented change detection (only updates `updatedAt` when details change)
- [x] Added `lastSeenAt` field (updates every time activity is seen)
- [x] Deployed all schema changes to production database
- [x] Successfully scraped and updated 50 activities with new fields

## Critical Issues to Fix 🚨

### 1. API Deployment Issue
- **Problem**: Cloud Build fails with "reserved env names were provided: PORT"
- **Solution**: 
  - [ ] Remove PORT from `.env.production` or `cloudbuild.yaml`
  - [ ] Update deployment configuration to use Cloud Run's automatic PORT assignment
  - [ ] Redeploy API to Cloud Run

### 2. Limited Scraping Scope
- **Problem**: Only 50 activities were scraped instead of all 2100+
- **Current Behavior**: Scraper stops after first batch
- **Solution**:
  - [ ] Fix the scraper to process ALL activities, not just first 50
  - [ ] Check `nvrcEnhancedParallelScraper.js` enhancement limit
  - [ ] Ensure all sections are being processed

### 3. Missing Database Tables in Production
- **Problem**: ActivitySession and ActivityPrerequisite tables don't exist
- **Solution**:
  - [ ] Run the existing `update-schema-production.js` to create these tables
  - [ ] Or modify scraper to skip session/prerequisite creation in production

## Remaining Development Tasks 📝

### 1. Complete Activity Data Extraction
- [ ] Fix spots available parsing (showing 0 when should be 7)
- [ ] Ensure registration status is properly set based on button text
- [ ] Parse and store tax information correctly
- [ ] Extract location coordinates (latitude/longitude) if available

### 2. Fix Date Parsing Issues
- [ ] Some activities showing "TBD" for dates when dates are available
- [ ] Ensure MM/DD/YY dates are parsed correctly with year 2025
- [ ] Handle date ranges that span multiple years

### 3. UI Updates (Mobile App)
- [ ] Display instructor name in activity detail screen
- [ ] Show human-readable dates instead of "TBD"
- [ ] Display registration status with appropriate styling
- [ ] Show "Open" in green, "Waitlist" in orange, "Closed" in red
- [ ] Add last updated timestamp to activity cards

### 4. Scraper Improvements
- [ ] Add retry logic for failed activity detail fetches
- [ ] Implement better error handling and logging
- [ ] Add progress indicators showing X of Y activities processed
- [ ] Store scraper execution logs in database for monitoring

### 5. Change Detection Enhancements
- [ ] Track which specific fields changed (for audit trail)
- [ ] Send notifications when popular activities have spots available
- [ ] Create activity change history table

## Deployment Steps 🚀

### 1. Fix and Deploy API
```bash
# Fix the PORT issue in deployment config
# Then rebuild and deploy
gcloud builds submit --config cloudbuild.yaml
```

### 2. Create Missing Tables
```bash
node update-schema-production.js
```

### 3. Run Full Scraper
```bash
# Modify scraper to process all activities
# Then run the production scraper
node run-production-scraper.js
```

### 4. Verify Results
```bash
# Check activity count with new data
node -e "
require('dotenv').config({ path: '.env.production' });
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();
prisma.activity.count({
  where: { 
    instructor: { not: null },
    dates: { not: null },
    fullDescription: { not: null }
  }
}).then(count => {
  console.log('Activities with complete data:', count);
  prisma.\$disconnect();
});
"
```

## Monitoring & Maintenance 🔍

### Regular Tasks
- [ ] Set up Cloud Scheduler to run scraper daily
- [ ] Monitor for activities with changing spots
- [ ] Alert on scraper failures
- [ ] Track registration status changes

### Performance Optimization
- [ ] Add database indexes for new fields
- [ ] Implement caching for frequently accessed activities
- [ ] Optimize detail scraper for parallel processing

## Testing Checklist ✓

### Before Production Release
- [ ] Test all API endpoints return new fields
- [ ] Verify mobile app displays all new data correctly
- [ ] Confirm change detection only updates when needed
- [ ] Test scraper handles all edge cases (missing data, errors)
- [ ] Verify performance with full dataset

### Sample Test URLs
- Course with all details: `courseId=00370392`
- Test registration status parsing
- Test date extraction edge cases
- Test instructor name extraction

## Notes
- The comprehensive detail scraper is working but needs to run on ALL activities
- Change detection is implemented but showing false positives on date comparisons
- All schema changes are deployed, but API needs redeployment
- Mobile app TypeScript types are updated and ready for new fields