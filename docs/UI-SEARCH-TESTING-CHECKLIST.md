# Mobile App Search Filter Testing Checklist

This document provides a manual testing checklist to verify that the mobile app's search and filter functionality displays results that match the backend API.

## Pre-requisites

- Mobile app running on simulator or device
- App connected to production API (`https://kids-activity-api-205843686007.us-central1.run.app`)
- Backend API tests have passed (run `scripts/test-search-filters.sh`)

## API Reference Values

Use these values to cross-reference with the app's displayed results:

| Query | Expected Total |
|-------|----------------|
| `search=skating` | ~6,979 |
| `search=skating&location=Vancouver` | ~1,289 |
| `categories=team-sports&location=Toronto` | ~908 |
| `search=swim&categories=swimming-aquatics&location=Vancouver&ageMin=4&ageMax=12&costMax=200` | ~754 |

---

## SearchScreen Tests (Search Tab)

### TC-UI-01: Text Search Only

**Steps:**
1. Open the Search tab
2. Enter "skating" in the search bar
3. Tap the Search button

**Expected:**
- [ ] All displayed activities contain "skating" in title or description
- [ ] Result count should be approximately 6,979

**Actual Results:**
- Result Count: _______
- Sample Activities: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-02: Text Search + City Filter

**Steps:**
1. Open the Search tab
2. Enter "skating" in the search bar
3. Select "Vancouver" from the city dropdown
4. Tap the Search button

**Expected:**
- [ ] All results contain "skating" in title or description
- [ ] All results show Vancouver, North Vancouver, or West Vancouver as location
- [ ] Result count should be approximately 1,289

**Actual Results:**
- Result Count: _______
- Sample Locations: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-03: Text Search + Activity Type

**Steps:**
1. Open the Search tab
2. Enter "swim" in the search bar
3. Select "Swimming & Aquatics" activity type
4. Tap the Search button

**Expected:**
- [ ] All results contain "swim" in title or description
- [ ] All results show "Swimming & Aquatics" type badge
- [ ] Result count should be approximately 37,368

**Actual Results:**
- Result Count: _______
- Activity Types Displayed: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-04: Text Search + Age Range

**Steps:**
1. Open the Search tab
2. Enter "dance" in the search bar
3. Set age filter to 5-8 years
4. Tap the Search button

**Expected:**
- [ ] All results contain "dance" in title or description
- [ ] All results are appropriate for ages 5-8 (ageMin <= 8, ageMax >= 5)
- [ ] No "teen only" or "adult only" activities should appear

**Actual Results:**
- Result Count: _______
- Age Ranges Displayed: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-05: Text Search + Cost Filter

**Steps:**
1. Open the Search tab
2. Enter "music" in the search bar
3. Set max cost to $50
4. Tap the Search button

**Expected:**
- [ ] All results contain "music" in title or description
- [ ] All results show cost <= $50 (or "Free")

**Actual Results:**
- Result Count: _______
- Costs Displayed: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-06: Text Search + Day of Week

**Steps:**
1. Open the Search tab
2. Enter "hockey" in the search bar
3. Select "Saturday" as day filter
4. Tap the Search button

**Expected:**
- [ ] All results contain "hockey" in title or description
- [ ] All results have Saturday sessions available

**Actual Results:**
- Result Count: _______
- Days Displayed: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-07: Multiple Filters Combined

**Steps:**
1. Open the Search tab
2. Enter "swim" in the search bar
3. Select "Swimming & Aquatics" activity type
4. Select "Vancouver" as city
5. Set age range to 4-12 years
6. Set max cost to $200
7. Tap the Search button

**Expected:**
- [ ] All results contain "swim" in title or description
- [ ] All results are "Swimming & Aquatics" type
- [ ] All results are in Vancouver area
- [ ] All results are age-appropriate (4-12)
- [ ] All results cost <= $200
- [ ] Result count should be approximately 754

**Actual Results:**
- Result Count: _______
- Sample Activity: ___________________________________
- Pass/Fail: [ ]

---

## FiltersScreen Tests (Preferences)

### TC-UI-08: Activity Type Filter from Preferences

**Steps:**
1. Go to Filters/Preferences screen
2. Deselect all activity types
3. Select only "Dance"
4. Save preferences
5. View "Recommended for You" on Dashboard

**Expected:**
- [ ] All recommended activities show "Dance" type

**Actual Results:**
- Activity Types Displayed: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-09: Location Preference

**Steps:**
1. Go to Filters/Preferences screen
2. Set preferred city to "Toronto"
3. Save preferences
4. View "Recommended for You" on Dashboard

**Expected:**
- [ ] All recommended activities are in Toronto area

**Actual Results:**
- Locations Displayed: ___________________________________
- Pass/Fail: [ ]

---

### TC-UI-10: Age Preference

**Steps:**
1. Go to Filters/Preferences screen
2. Set child age to 7 years
3. Save preferences
4. View "Recommended for You" on Dashboard

**Expected:**
- [ ] All recommended activities are appropriate for age 7
- [ ] No teen-only or adult activities should appear

**Actual Results:**
- Age Ranges Displayed: ___________________________________
- Pass/Fail: [ ]

---

## Cross-Verification Tests

### TC-UI-11: API vs UI Count Match

For each major test above, compare the result count:

| Test | API Count | UI Count | Match? |
|------|-----------|----------|--------|
| skating | ~6,979 | | [ ] |
| skating + Vancouver | ~1,289 | | [ ] |
| team-sports + Toronto | ~908 | | [ ] |
| All filters combined | ~754 | | [ ] |

**Notes:** Counts may vary slightly due to real-time data updates. A difference of <5% is acceptable.

---

### TC-UI-12: First 5 Results Match

**Steps:**
1. Run search in app: "skating" + Vancouver
2. Note the first 5 activity names displayed
3. Run API query: `curl "API_URL/activities?search=skating&location=Vancouver&limit=5"`
4. Compare the activity names

**Expected:**
- [ ] First 5 activity names are identical (same sort order)

**API Results:**
1. ___________________________________
2. ___________________________________
3. ___________________________________
4. ___________________________________
5. ___________________________________

**UI Results:**
1. ___________________________________
2. ___________________________________
3. ___________________________________
4. ___________________________________
5. ___________________________________

**Pass/Fail:** [ ]

---

## Test Summary

| Category | Total Tests | Passed | Failed |
|----------|-------------|--------|--------|
| SearchScreen | 7 | | |
| FiltersScreen | 3 | | |
| Cross-Verification | 2 | | |
| **TOTAL** | **12** | | |

## Issues Found

List any discrepancies between UI and API results:

1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

## Tester Information

- **Tester Name:** ___________________
- **Test Date:** ___________________
- **Device/Simulator:** ___________________
- **App Version:** ___________________
- **API Revision:** kids-activity-api-00213-96c
