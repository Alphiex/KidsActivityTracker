# Activity Cost Debug Summary

## Issue
Activity costs are being correctly scraped and stored in the database, but there appears to be a mismatch in how activities are identified and updated.

## Current Status

### 1. Database Check Results
- Activity with courseId "00369211" exists in the database
- Name: "Swim Private Lessons"
- Cost: $163.76 (correctly stored)
- External ID: 635a6639-666a-447e-991b-0e021ccded83 (UUID)
- Last updated: 2025-08-19T04:41:54.247Z

### 2. Scraper Test Results
- The scraper correctly extracts cost information from activity detail pages
- Test showed it can extract $2642.50 from a sample activity page
- The nvrcFixedDetailScraper.js has robust cost extraction logic with multiple fallback patterns

### 3. Data Flow Issues Identified

#### Problem 1: ID Mismatch
- The scraper (nvrcEnhancedParallelScraper.js) generates externalId from the registration URL (line 777), which gives a UUID
- The actual course ID (like "00369211") is saved to the `courseId` field
- The activityService.js expects activities to have an `id` field (line 129: `externalId: activity.id`)

#### Problem 2: Duplicate Activities
- Found 1,562 course IDs with duplicate entries in the database
- Many activities have both an old entry (with "ProgramsEvent" prefix) and a new entry
- This suggests the scraper ran multiple times with different ID generation logic

## Root Cause
The main issue is not with cost extraction or database updates, but with how activities are identified during the upsert process. The activityService is looking for `activity.id` but the scraper is providing the course ID in `activity.courseId`.

## Recommended Fixes

### 1. Update activityService.js
Change line 129 from:
```javascript
externalId: activity.id
```
To:
```javascript
externalId: activity.courseId || activity.id
```

### 2. Clean up duplicate activities
Remove inactive duplicate activities with the "ProgramsEvent" prefix in their externalId.

### 3. Update the scraper to use consistent IDs
Modify nvrcEnhancedParallelScraper.js to use the courseId as the primary identifier instead of the URL-based UUID.

## Verification Steps
1. The cost is correctly stored: ✓
2. The scraper extracts costs correctly: ✓
3. The update logic works when IDs match: ✓
4. The ID mismatch prevents proper updates: ✗ (needs fix)