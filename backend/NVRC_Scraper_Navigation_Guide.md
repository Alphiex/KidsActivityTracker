# NVRC Activity Scraper Navigation Guide

## Overview
This guide documents the exact navigation flow for scraping NVRC activities from the PerfectMind booking system.

## Navigation Steps

### Step 1: Access PerfectMind Booking System
**URL**: `https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a`

**What you see**: A page with activity category links in the left sidebar, including:
- Drop-In Schedules
- Book A Visit
- Book Court Times
- Early Years: On My Own
- All Ages & Family
- Adult
- And many sub-categories under each

### Step 2: Click Target Section Links
The scraper clicks on these specific sections:
1. **"Early Years: On My Own"**
   - Contains activities like Arts Dance (0-6yrs), Arts Music (0-6yrs), Camps Part Day (0-6yrs), etc.

2. **"All Ages & Family"**
   - Contains activities like Arts Dance (All Ages), Arts Music, Arts Pottery (Family), etc.

3. **"Early Years: Parent Participation"**
   - Contains parent-child activities

4. **"School Age"**
   - Contains activities for school-aged children

5. **"Youth"**
   - Contains activities for teenagers

### Step 3: Expand Activities on Each Page
After clicking a section link:
1. The page shows a list of activities
2. Each activity initially shows only:
   - Activity name (e.g., "Ballet Pink Pearl Parent Participation")
   - A "Show" link
3. The scraper clicks all "Show" links to expand the activities

### Step 4: Extract Activity Details
Once expanded, each activity displays:
- **Sessions table** with columns for:
  - Date range (e.g., "Jan 6 - Mar 27")
  - Days of week
  - Time (e.g., "09:30 am - 10:00 am")
  - Location
  - Age range
  - Price
  - Registration button (Sign Up/Waitlist/Closed)

## Example Activity Expansion

**Before clicking "Show"**:
```
Arts Dance (0-6yrs PP)
Ballet Pink Pearl Parent Participation
[Show]
```

**After clicking "Show"**:
```
Ballet Pink Pearl Parent Participation
┌─────────────┬────────┬───────────────┬──────────────────────────┬────────┬────────┬─────────┐
│ Jan 6-Mar 27│ Monday │ 09:30am-10:00am│ Lynn Valley Village Complex│ 2-5 yrs│ $63.75 │ [Closed]│
└─────────────┴────────┴───────────────┴──────────────────────────┴────────┴────────┴─────────┘
```

## Navigation Sequence Diagram

```
1. Go to PerfectMind URL
   └─> Main page with category links loads

2. Click "Early Years: On My Own"
   └─> Page shows list of activities with "Show" links
   
3. Click all "Show" links on the page
   └─> Each activity expands to show session details
   
4. Extract data from expanded activities
   └─> Capture dates, times, locations, prices, etc.
   
5. Navigate back to main page
   └─> Click browser back or navigate to main URL
   
6. Repeat for next section
```

## Key Implementation Points

1. **Wait after navigation** - Allow time for page to load
2. **Click all "Show" links** - May need multiple passes as new ones appear
3. **Extract from tables** - Data is in table format after expansion
4. **Return to main page** - Must go back before clicking next section

## Generic Approach

The scraper is generic because it:
- Looks for any link with text "Show" to expand
- Extracts data from any table structure
- Processes whatever activities are present
- Works with any number of activities per section

This ensures new activities added by NVRC are automatically captured without code changes.