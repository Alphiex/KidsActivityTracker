# Filter Testing Checklist

Comprehensive manual testing guide for validating filter functionality across FiltersScreen (Preferences) and SearchScreen.

---

## Table of Contents

1. [FiltersScreen (Preferences) Testing](#filtersscreen-preferences-testing)
2. [SearchScreen Testing](#searchscreen-testing)
3. [Filter Result Verification Matrix](#filter-result-verification-matrix)
4. [Cross-Screen Consistency](#cross-screen-consistency)
5. [Edge Cases and Error Handling](#edge-cases-and-error-handling)

---

## FiltersScreen (Preferences) Testing

### Activity Types Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| AT-01 | Activity types load from API | Open Filters screen, expand Activity Type section | All activity types displayed with counts | |
| AT-02 | Activity counts display correctly | Check activity counts next to each type | Counts should be >= 0 and realistic | |
| AT-03 | Subtypes expand/collapse | Tap chevron next to type with subtypes | Subtypes appear/hide smoothly | |
| AT-04 | Select single activity type | Tap on "Sports" | Chip becomes highlighted/selected | |
| AT-05 | Select multiple activity types | Tap on "Sports", then "Music", then "Dance" | All three chips highlighted | |
| AT-06 | Deselect activity type | Tap selected "Sports" again | Chip deselects, returns to default state | |
| AT-07 | Select subtype | Expand "Sports", tap "Swimming" | Subtype chip highlighted | |
| AT-08 | Selection persists | Select types, collapse section, re-expand | Same types still selected | |
| AT-09 | Selection persists across sessions | Select types, close app, reopen | Types still selected | |

### Age Range Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| AGE-01 | Default range is 0-18 | Open Age section fresh | Shows "0 - 18 years" | |
| AGE-02 | Min age slider works | Drag minimum age slider right | Min value increases, label updates | |
| AGE-03 | Max age slider works | Drag maximum age slider left | Max value decreases, label updates | |
| AGE-04 | Min cannot exceed max | Try to drag min slider past max | Slider stops at max value | |
| AGE-05 | Max cannot go below min | Try to drag max slider below min | Slider stops at min value | |
| AGE-06 | Quick select "Toddler (3-5)" | Tap "Toddler" chip | Range updates to 3-5 | |
| AGE-07 | Quick select "Early Elementary" | Tap "Early Elementary" chip | Range updates to 6-8 | |
| AGE-08 | Quick select "All Ages" | Tap "All Ages" chip | Range updates to 0-18 | |
| AGE-09 | Age range visual updates | Change age range | Visual bar reflects selected range | |

### Locations Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| LOC-01 | Hierarchical picker loads | Expand Locations section | Province > City > Location structure shown | |
| LOC-02 | Provinces display correctly | Check province list | BC, AB, ON, etc. as applicable | |
| LOC-03 | Cities expand under province | Tap on "BC" | Cities like Vancouver, Burnaby appear | |
| LOC-04 | Locations expand under city | Tap on "Vancouver" | Venues/locations appear | |
| LOC-05 | Search filters locations | Type "Pool" in search | Only pool locations shown | |
| LOC-06 | Multi-select locations | Select multiple venues | All show as selected | |
| LOC-07 | Selection count updates | Select 3 locations | Summary shows "3 selected" | |
| LOC-08 | Clear search | Clear search box | Full hierarchy restored | |
| LOC-09 | No results search | Search "xyznonexistent" | "No results" message shown | |

### Distance Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| DIST-01 | Distance disabled by default | Open Distance section | Toggle is off | |
| DIST-02 | Enable distance filter | Toggle distance on | Location source options appear | |
| DIST-03 | Radius selector appears | Enable distance filter | Radius chips shown (5/10/25/50/100 km) | |
| DIST-04 | Select radius | Tap "50 km" chip | Chip highlights, radius updates | |
| DIST-05 | GPS option works | Tap "Use GPS Location" | Permission prompt if not granted | |
| DIST-06 | GPS permission granted | Grant location permission | GPS option shows "Location access granted" | |
| DIST-07 | GPS permission denied | Deny location permission | Message shows "Tap to enable" | |
| DIST-08 | GPS permission blocked | Block permission in settings | Message shows "Permission blocked - tap to open settings" | |
| DIST-09 | Saved address option | Tap "Use Saved Address" | Address autocomplete section appears | |
| DIST-10 | Distance disabled state | Toggle off | Location options hidden | |

### Address Autocomplete Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| ADDR-01 | Autocomplete loads | Select "Use Saved Address" | Address input appears with search icon | |
| ADDR-02 | Typing shows suggestions | Type "123 Main" | Dropdown with address suggestions appears | |
| ADDR-03 | Suggestions debounced | Type rapidly | Suggestions appear after typing stops (300ms) | |
| ADDR-04 | Minimum 3 characters | Type "12" | No suggestions shown | |
| ADDR-05 | Select address from dropdown | Tap on suggestion | Address selected, input shows formatted address | |
| ADDR-06 | Address details parsed | Select address | City, province, postal code extracted correctly | |
| ADDR-07 | Coordinates captured | Select address | Latitude/longitude stored | |
| ADDR-08 | Selected address display | After selection | Shows address with checkmark icon and clear button | |
| ADDR-09 | Clear selected address | Tap X button on selected address | Address cleared, input returns | |
| ADDR-10 | Manual entry fallback | Tap "Enter address manually" | Manual entry form appears | |
| ADDR-11 | Manual entry geocoding | Enter address manually, tap Verify | Address geocoded and saved | |
| ADDR-12 | Manual entry back button | In manual mode, tap Back | Returns to autocomplete view | |
| ADDR-13 | API error handling | Disconnect network, type | "Address search is currently unavailable" shown | |
| ADDR-14 | No results message | Search gibberish like "xyzabc123" | "No addresses found" message shown | |
| ADDR-15 | Address persists | Select address, leave screen, return | Same address still selected | |
| ADDR-16 | Canada/US restriction | Type "London, UK" | No UK results, only Canada/US | |

### Budget Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| BUD-01 | Slider works (0-500 range) | Drag budget slider | Value updates correctly | |
| BUD-02 | Quick select $25 | Tap "$25" chip | Budget updates to $25 max | |
| BUD-03 | Quick select $50 | Tap "$50" chip | Budget updates to $50 max | |
| BUD-04 | Quick select $100 | Tap "$100" chip | Budget updates to $100 max | |
| BUD-05 | Quick select $200 | Tap "$200" chip | Budget updates to $200 max | |
| BUD-06 | Quick select $500 | Tap "$500" chip | Budget updates to $500 max | |
| BUD-07 | Quick select "No Limit" | Tap "No Limit" chip | Shows "No Limit", slider hidden | |
| BUD-08 | PRO badge for free users | View as free user | PRO badge visible on Budget section | |
| BUD-09 | Upgrade prompt on tap (free) | Free user taps budget | Upgrade modal appears | |

### Schedule Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| SCH-01 | All 7 days visible | Expand Schedule section | Mon-Sun chips visible | |
| SCH-02 | Toggle single day | Tap "Saturday" | Chip highlights | |
| SCH-03 | Toggle multiple days | Tap "Saturday", then "Sunday" | Both highlighted | |
| SCH-04 | Deselect day | Tap selected day again | Day deselects | |
| SCH-05 | Morning toggle works | Toggle "Morning (6AM-12PM)" | Toggle on/off correctly | |
| SCH-06 | Afternoon toggle works | Toggle "Afternoon (12PM-5PM)" | Toggle on/off correctly | |
| SCH-07 | Evening toggle works | Toggle "Evening (5PM-9PM)" | Toggle on/off correctly | |
| SCH-08 | Multiple time selections | Select Morning + Evening | Both toggles on | |

### Dates Section

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| DATE-01 | Default is "Any Dates" | Expand Dates section | "Any Dates" radio selected | |
| DATE-02 | Switch to date range | Select "Specific Date Range" | Date picker options appear | |
| DATE-03 | Start date picker opens | Tap start date button | Date picker modal opens | |
| DATE-04 | Select start date | Pick a date | Date shown on button | |
| DATE-05 | End date picker opens | Tap end date button | Date picker modal opens | |
| DATE-06 | End date after start | Select end date before start | Should prevent or show error | |
| DATE-07 | Clear end date | Tap clear button on end date | End date cleared | |
| DATE-08 | Match mode "Partial" | Select "Partially Overlap" | Radio selected | |
| DATE-09 | Match mode "Full" | Select "Fully Between" | Radio selected | |
| DATE-10 | Switch back to "Any Dates" | Select "Any Dates" | Date pickers hidden, filter cleared | |

### Global Preference Toggle

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| GLOB-01 | Hide Closed/Full toggle | Toggle on | Activities with no spots hidden | |
| GLOB-02 | PRO badge shown (free user) | View as free user | PRO badge visible | |
| GLOB-03 | Upgrade prompt (free user) | Free user toggles | Upgrade modal appears | |

---

## SearchScreen Testing

### What Section (Text Search)

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| SRCH-01 | Text input works | Type "swimming" | Text appears in field | |
| SRCH-02 | Clears on "Clear All" | Type text, tap Clear All | Text field empties | |
| SRCH-03 | Keyboard behavior | Tap input field | Keyboard appears | |

### Day of Week

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| DAY-01 | All 7 days visible | Expand section | Mon-Sun chips visible | |
| DAY-02 | Select single day | Tap "Sat" | Chip highlights | |
| DAY-03 | Multi-select works | Tap "Sat" then "Sun" | Both highlighted | |
| DAY-04 | Deselect works | Tap selected day | Deselects | |

### Activity Type

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| TYPE-01 | Types load from API | Expand section | Activity types listed | |
| TYPE-02 | Select type | Tap "Sports" | Button highlights | |
| TYPE-03 | Multi-select | Select multiple types | All highlighted | |

### Time

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| TIME-01 | Predefined times shown | Expand section | 6 time options visible | |
| TIME-02 | Select predefined time | Tap "Morning" | Button highlights with time range | |
| TIME-03 | Custom time toggle | Tap "Custom Time Range" | Sliders appear | |
| TIME-04 | Custom start slider | Drag start slider | Time updates | |
| TIME-05 | Custom end slider | Drag end slider | Time updates | |
| TIME-06 | Mode switch clears other | Switch from predefined to custom | Predefined selections clear | |

### Cost

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| COST-01 | Min slider works | Drag min cost slider | Value updates | |
| COST-02 | Max slider works | Drag max cost slider | Value updates | |
| COST-03 | "Unlimited" toggle | Tap Unlimited | Max slider disabled, "Unlimited" shown | |

### Where (Cities)

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| WHERE-01 | Popular cities listed | Expand section | 9 cities visible | |
| WHERE-02 | Select city | Tap "Vancouver" | Chip highlights | |
| WHERE-03 | Multi-select cities | Select multiple | All highlighted | |

### Age

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| AGE-S01 | Min age slider | Drag slider | Value updates (0-17) | |
| AGE-S02 | Max age slider | Drag slider | Value updates (1-18) | |
| AGE-S03 | Min <= Max enforced | Try to set min > max | Prevented | |

### Search Actions

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| ACT-01 | "Search" button | Set filters, tap Search | Navigate to results with filters | |
| ACT-02 | "AI Match" button | Set filters, tap AI Match | Navigate to AI recommendations | |
| ACT-03 | "Clear All" button | Set filters, tap Clear All | All filters reset to default | |
| ACT-04 | Close button | Tap X | Returns to previous screen | |

---

## Filter Result Verification Matrix

Test that applying filters returns correct activity results.

| # | Filters Applied | Steps | Expected Behavior | Pass/Fail |
|---|----------------|-------|-------------------|-----------|
| 1 | Activity Type: Swimming | Set filter, search | Only swimming activities shown | |
| 2 | Age: 3-5 years | Set filter, search | Activities for toddlers only | |
| 3 | Cost: Free only ($0) | Set filter, search | Only $0 activities | |
| 4 | Location: Vancouver | Set filter, search | Only Vancouver activities | |
| 5 | Day: Saturday + Sunday | Set filter, search | Weekend activities only | |
| 6 | Swimming + Ages 6-10 | Combine filters, search | Swimming for school-age kids | |
| 7 | Free + Vancouver | Combine filters, search | Free activities in Vancouver | |
| 8 | Sports + Saturday + Morning | Combine filters, search | Weekend morning sports | |
| 9 | Distance: 10km from address | Enter address via autocomplete, set 10km | Only nearby activities | |
| 10 | Distance: GPS + 25km | Enable GPS, set 25km | Activities within GPS radius | |
| 11 | Address + Swimming | Enter address, select Swimming | Nearby swimming activities | |
| 12 | All filters active | Set all filters, search | Highly filtered results (may be 0) | |
| 13 | Clear all + verify reset | Clear all, search | All activities shown | |

---

## Cross-Screen Consistency

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| CROSS-01 | Preferences affect Dashboard | Set preferences, go to Dashboard | Dashboard shows filtered activities | |
| CROSS-02 | Search filters are independent | Use Search, return to Dashboard | Dashboard preferences unchanged | |
| CROSS-03 | Activity type lists match | Compare FiltersScreen and SearchScreen | Same activity types in both | |
| CROSS-04 | Age range behavior consistent | Compare age sliders in both screens | Same min/max constraints | |
| CROSS-05 | Address syncs from Onboarding | Set address in Onboarding | Same address in Distance Preferences | |
| CROSS-06 | Address syncs to Preferences | Change address in Preferences | Used for distance filtering in Dashboard | |
| CROSS-07 | Onboarding address autocomplete | Go through Onboarding, enter address | Autocomplete works same as Preferences | |

---

## Edge Cases and Error Handling

| Test ID | Test Case | Steps | Expected Result | Pass/Fail |
|---------|-----------|-------|-----------------|-----------|
| EDGE-01 | Offline mode - filter load | Turn off network, open filters | Cached data shown or graceful error | |
| EDGE-02 | Slow network | Throttle network, load filters | Loading indicator, then data | |
| EDGE-03 | Empty results | Apply very restrictive filters | "No results" message | |
| EDGE-04 | Rapid filter changes | Quickly toggle multiple filters | No crashes, correct final state | |
| EDGE-05 | Long text in search | Enter 100+ character search | Text handled, no crash | |
| EDGE-06 | Special characters in search | Search "swimming & art's" | Handled correctly | |
| EDGE-07 | Filter persistence after crash | Set filters, force close app | Filters restored on reopen | |
| EDGE-08 | Address offline | Type address while offline | "Address search unavailable" message | |
| EDGE-09 | Rapid address typing | Type very fast in autocomplete | Debounce prevents excessive API calls | |
| EDGE-10 | Very long address | Enter 200+ character address manually | Address truncated or handled gracefully | |
| EDGE-11 | Address with special chars | Enter "123 St. Mary's Rd #5" | Handled correctly | |
| EDGE-12 | Legacy address migration | User with old address format | Migrated to EnhancedAddress format | |

---

## Testing Notes

### Before Testing

1. Ensure app is connected to production or staging API
2. Clear app cache/data for fresh state tests
3. Note: Budget filter requires PRO subscription

### During Testing

- Mark each test as Pass (✓) or Fail (✗)
- Note any bugs or unexpected behavior
- Take screenshots of failures

### After Testing

- File bugs for any failures with:
  - Test ID
  - Steps to reproduce
  - Expected vs. actual behavior
  - Screenshots/recordings

---

**Document Version**: 1.1
**Created**: December 2025
**Last Updated**: December 2025
**Changes in 1.1**: Added Address Autocomplete testing section

