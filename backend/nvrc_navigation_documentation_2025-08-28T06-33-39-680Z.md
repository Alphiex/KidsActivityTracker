# NVRC Scraper Navigation Documentation

Generated: 2025-08-28T06:33:39.681Z

## Overview
This document describes how the NVRC scraper navigates the website to capture all activities.

## Navigation Flow

### Approach 1: Main Website Form
1. **Starting URL**: https://www.nvrc.ca/programs-memberships/find-program
2. **Step 1 - Age Group Selection**:
   - Select checkboxes for age groups:
     - "0 - 6 years, Parent Participation"
     - "0 - 6 years, On My Own"  
     - "5 - 13 years, School Age"
     - "10 - 18 years, Youth"
     - "Adult" (if activities for adults are needed)
   
3. **Step 2 - Activity Selection** (appears dynamically after Step 1):
   - The form dynamically loads activity checkboxes
   - Select all activity types that appear, including:
     - Movement & Fitness: Dance, Spin, Strength & Cardio, Yoga
     - Activities: Aquatic Leadership, Camps, Certifications, Cooking, etc.
     - Sports: Climbing, Gymnastics, Multisport, Racquet Sports, Team Sports
     - Arts & Culture: Dance, Music, Pottery, Visual Arts
   
4. **Step 3 - Location Selection** (appears after Step 2):
   - Click "Select all locations" checkbox if available
   - Otherwise select individual locations
   
5. **Submit Form**:
   - Click "Show Results" button
   - Results page loads with activities in iframes

### Approach 2: Direct PerfectMind Widget Access
1. **Direct URL**: https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a
2. **Navigation**:
   - Click on each program category link:
     - "All Ages & Family"
     - "Early Years: On My Own"
     - "Early Years: Parent Participation"
     - "School Age"
     - "Youth"
     - "Adult"
3. **Expand Activities**:
   - Click "Show" links to expand activity groups
   - Activities are displayed in tables with registration links

## Key Findings

### Activity Summary
- Total activities found: 0
- Unique activities: 0
- Activities by source:

## Detailed Navigation Log

```json
[
  {
    "timestamp": "2025-08-28T06:33:01.362Z",
    "message": "🚀 Starting NVRC Comprehensive Scraper...",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:01.706Z",
    "message": "\n📍 APPROACH 1: Using NVRC main website form",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:01.706Z",
    "message": "Navigating to NVRC find program page...",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:03.553Z",
    "message": "PAGE LOG: Failed to load resource: the server responded with a status of 404 ()",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:05.112Z",
    "message": "PAGE LOG: The keyword 'push-button' used on the 'appearance' property was deprecated and has now been removed. It will no longer have any effect.",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:05.646Z",
    "message": "Waiting for form to load...",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:09.220Z",
    "message": "\n📋 STEP 1: Selecting age groups",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:09.227Z",
    "message": "Selected 5 age groups:",
    "data": [
      "Adult",
      "0 - 6 years, On My Own",
      "0 - 6 years, Parent Participation",
      "5 - 13 years, School Age",
      "10 - 18 years, Youth"
    ]
  },
  {
    "timestamp": "2025-08-28T06:33:11.229Z",
    "message": "\n🎯 STEP 2: Waiting for activities to appear",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:25.247Z",
    "message": "Selected 34 activities:",
    "data": [
      "All Ages & Family",
      "Senior",
      "Health Management",
      "Movement & Fitness Dance",
      "Pilates",
      "Pre & Post Natal",
      "Spin",
      "Strength & Cardio",
      "Stretching",
      "Workshops",
      "Yoga",
      "Aquatic Leadership",
      "Camps",
      "Certifications and Leadership",
      "Cooking",
      "Early Years Playtime",
      "Kids Night Out",
      "Learn and Play",
      "Martial Arts",
      "School Programs",
      "Skating",
      "Special Events",
      "Swimming",
      "Climbing",
      "Gymnastics",
      "Multisport",
      "Racquet Sports",
      "Team Sports",
      "Dance",
      "Drama",
      "Music",
      "Pottery",
      "Visual Arts",
      "Woodworking"
    ]
  },
  {
    "timestamp": "2025-08-28T06:33:28.045Z",
    "message": "\n📍 STEP 3: Selecting locations",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:28.046Z",
    "message": "Location selection:",
    "data": {
      "method": "individual",
      "count": 0
    }
  },
  {
    "timestamp": "2025-08-28T06:33:30.047Z",
    "message": "\n🔍 Clicking Show Results button",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:30.048Z",
    "message": "\n📍 APPROACH 2: Using PerfectMind widget directly",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:30.048Z",
    "message": "Navigating to PerfectMind widget directly...",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:33.936Z",
    "message": "PAGE LOG: Failed to load resource: net::ERR_NETWORK_CHANGED",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:39.678Z",
    "message": "\n📂 Processing section: All Ages & Family",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:39.679Z",
    "message": "\n📂 Processing section: Early Years: On My Own",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:39.679Z",
    "message": "\n📂 Processing section: Early Years: Parent Participation",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:39.680Z",
    "message": "\n📂 Processing section: School Age",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:39.680Z",
    "message": "\n📂 Processing section: Youth",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:39.680Z",
    "message": "\n📂 Processing section: Adult",
    "data": null
  },
  {
    "timestamp": "2025-08-28T06:33:39.681Z",
    "message": "\n💾 Results saved to nvrc_comprehensive_results_2025-08-28T06-33-39-680Z.json",
    "data": null
  }
]
```
