# Activity Filtering Architecture

## Overview

This document describes how filters are applied across different screens when searching for activities.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FILTER SOURCES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │   GLOBAL FILTERS     │  │   CHILD FILTERS      │  │  SCREEN-SPECIFIC     │  │
│  │   (FiltersScreen)    │  │   (Child Profiles)   │  │  (Route Params)      │  │
│  │                      │  │                      │  │                      │  │
│  │  Stored in:          │  │  Stored in:          │  │  Passed via:         │  │
│  │  PreferencesService  │  │  Redux + API         │  │  navigation.params   │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ActivityService.searchActivitiesPaginated()              │
│                                                                                  │
│    searchActivitiesPaginated(baseParams, childFilters?)                         │
│                                                                                  │
│    baseParams: {                     childFilters: {                            │
│      // Global + Screen filters        filterMode: 'or' | 'and',               │
│      categories, ageMin, ageMax,       mergedFilters: {                        │
│      maxCost, dayOfWeek, city,           ageMin, ageMax, gender,               │
│      province, userLat, userLon,         activityTypes, daysOfWeek,            │
│      radiusKm, environment,              latitude, longitude,                   │
│      startDateAfter, startDateBefore,    distanceRadiusKm, ...                 │
│      hideFullActivities, ...           }                                        │
│    }                                 }                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  API SERVER                                      │
│                           /api/v1/activities/search                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Filter Sources Detail

### 1. Global Filters (PreferencesService)

Set via **FiltersScreen** and stored in `PreferencesService.preferences`:

| Property | Type | API Parameter | Description |
|----------|------|---------------|-------------|
| `preferredActivityTypes` | `string[]` | `categories` | Activity type names |
| `ageRanges` | `{min, max}[]` | `ageMin`, `ageMax` | Age range (uses first range) |
| `priceRange` | `{min, max}` | `maxCost` | Max cost filter |
| `daysOfWeek` | `string[]` | `dayOfWeek` | Days of week |
| `savedAddress.city` | `string` | `city` | City name |
| `savedAddress.province` | `string` | `province` | Province/state |
| `savedAddress.latitude` | `number` | `userLat` | Latitude for distance |
| `savedAddress.longitude` | `number` | `userLon` | Longitude for distance |
| `distanceFilterEnabled` | `boolean` | - | Enable distance filtering |
| `distanceRadiusKm` | `number` | `radiusKm` | Distance radius in km |
| `environmentFilter` | `'indoor'│'outdoor'│'all'` | `environment` | Indoor/outdoor |
| `dateFilter` | `'any'│'range'` | - | Date filter mode |
| `dateRange` | `{start, end}` | `startDateAfter`, `startDateBefore` | Date range |
| `hideFullActivities` | `boolean` | `hideFullActivities` | Hide full activities |
| `hideClosedActivities` | `boolean` | `hideClosedActivities` | Hide closed activities |

### 2. Child Filters (childPreferencesService)

Derived from **selected children's profiles** via `childPreferencesService.getMergedFilters()`:

**From Child Profile (Friends & Family screen - create/edit child):**
| Property | Source | Description |
|----------|--------|-------------|
| `ageMin`, `ageMax` | Child's `dateOfBirth` | Calculated age ± 1 year |
| `genders` | Child's `gender` | Filter by child's gender(s) |
| `latitude`, `longitude` | Child's `location` | Child's home location |
| `city`, `province` | Child's `location` | Child's city (fallback) |

**From Child Preferences (Preferences tab - per-child settings):**
| Property | Source | Description |
|----------|--------|-------------|
| `activityTypes` | `preferences.preferredActivityTypes` | Preferred activity types |
| `excludedCategories` | `preferences.excludedCategories` | Activity types to exclude |
| `daysOfWeek` | `preferences.daysOfWeek` | Available days |
| `timePreferences` | `preferences.timePreferences` | Morning/afternoon/evening |
| `dayTimeSlots` | `preferences.dayTimeSlots` | Granular day+time slots |
| `priceRangeMin` | `preferences.priceRangeMin` | Minimum budget |
| `priceRangeMax` | `preferences.priceRangeMax` | Maximum budget |
| `distanceRadiusKm` | `preferences.distanceRadiusKm` | Distance radius |
| `environmentFilter` | `preferences.environmentFilter` | Indoor/outdoor/all |

### 3. Screen-Specific Filters (Route Params)

Passed via **navigation** when navigating to a screen:

| Screen Type | Parameters | Description |
|-------------|------------|-------------|
| `activityType` | `activityType`, `subtype` | Filter by activity type |
| `ageGroup` | `ageMin`, `ageMax` | Filter by age group |
| `budget` | `maxCost` (fixed) | Budget-friendly filter |
| `new` | `createdAfter` (7 days) | New activities |
| `favorites` | User's favorites | Show favorited activities |
| `ai` | `activityIds` | AI recommended activities |

---

## Screen-by-Screen Filter Application

### UnifiedResultsScreen

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           UnifiedResultsScreen                                   │
│                                                                                  │
│  Route Params:                                                                   │
│    type: 'budget' | 'new' | 'activityType' | 'ageGroup' | 'favorites' | 'ai'   │
│    activityType?, subtype?, ageMin?, ageMax?, activityIds?                      │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  FILTER LAYERS APPLIED:                                                          │
│                                                                                  │
│  Layer 1: View Settings (always applied)                                        │
│  ├── hideFullActivities                                                         │
│  ├── hideClosedActivities                                                       │
│  └── hideClosedOrFull                                                           │
│                                                                                  │
│  Layer 2: Active Filters (from SearchScreen, if set)                            │
│  └── activeFilters object (search, activityTypes, etc.)                         │
│                                                                                  │
│  Layer 3: Global Preferences (from FiltersScreen)                               │
│  ├── preferredActivityTypes → categories    [if type !== 'activityType']        │
│  ├── ageRanges[0] → ageMin, ageMax          [if type !== 'ageGroup']            │
│  ├── priceRange.max → maxCost               [if type !== 'budget']              │
│  ├── daysOfWeek → dayOfWeek                                                     │
│  ├── savedAddress.city → city                                                   │
│  ├── savedAddress.province → province                                           │
│  ├── savedAddress coords → userLat, userLon, radiusKm  [if distanceEnabled]     │
│  ├── environmentFilter → environment                                            │
│  └── dateRange → startDateAfter, startDateBefore                                │
│                                                                                  │
│  Layer 4: Screen-Specific (based on type)                                       │
│  ├── type='budget'      → maxCost = maxBudgetFriendlyAmount (fixed)            │
│  ├── type='new'         → sortBy='createdAt', createdAfter=7daysAgo            │
│  ├── type='activityType'→ categories=activityType, activitySubtype=subtype     │
│  └── type='ageGroup'    → ageMin, ageMax from route params                      │
│                                                                                  │
│  Layer 5: Child Filters (via childFilters param)                                │
│  └── Passed to searchActivitiesPaginated() as second argument                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### ActivityListScreen

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ActivityListScreen                                    │
│                                                                                  │
│  Route Params:                                                                   │
│    category: string (activity type name or 'All' or 'Budget Friendly')          │
│    filters?: object (additional filters)                                        │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  FILTER LAYERS APPLIED:                                                          │
│                                                                                  │
│  Layer 1: Route Filters                                                          │
│  ├── category → activityType              [if category !== 'All']               │
│  └── filters object merged into params                                          │
│                                                                                  │
│  Layer 2: View Settings                                                          │
│  ├── hideClosedActivities                                                       │
│  └── hideFullActivities                                                         │
│                                                                                  │
│  Layer 3: Global Preferences (from FiltersScreen)                               │
│  ├── preferredActivityTypes → categories  [if category === 'All']               │
│  ├── ageRanges[0] → ageMin, ageMax                                              │
│  ├── priceRange.max → maxCost             [if category !== 'Budget Friendly']   │
│  ├── daysOfWeek → dayOfWeek                                                     │
│  ├── savedAddress.city → city                                                   │
│  ├── savedAddress.province → province                                           │
│  ├── savedAddress coords → userLat, userLon, radiusKm  [if distanceEnabled]     │
│  ├── environmentFilter → environment                                            │
│  └── dateRange → startDateAfter, startDateBefore                                │
│                                                                                  │
│  Layer 4: Child Filters (via childFilters param)                                │
│  └── Passed to searchActivitiesPaginated() as second argument                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### ActivityTypeDetailScreen

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ActivityTypeDetailScreen                                 │
│                                                                                  │
│  Route Params:                                                                   │
│    activityType: { code, name } or typeName, typeCode                           │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PURPOSE: Shows subtypes for an activity type with filtered counts              │
│                                                                                  │
│  FILTER LAYERS APPLIED (for count queries):                                     │
│                                                                                  │
│  Layer 1: Global Preferences (from FiltersScreen)                               │
│  ├── ageRanges[0] → ageMin, ageMax                                              │
│  ├── priceRange.max → maxCost                                                   │
│  ├── daysOfWeek → dayOfWeek                                                     │
│  ├── savedAddress.city → city                                                   │
│  ├── savedAddress.province → province                                           │
│  ├── savedAddress coords → userLat, userLon, radiusKm  [if distanceEnabled]     │
│  ├── environmentFilter → environment                                            │
│  ├── dateRange → startDateAfter, startDateBefore                                │
│  ├── hideFullActivities                                                         │
│  └── hideClosedActivities                                                       │
│                                                                                  │
│  Layer 2: Screen-Specific                                                        │
│  └── activityType = typeName                                                    │
│                                                                                  │
│  Layer 3: Child Filters (via childFilters param)                                │
│  └── Passed to searchActivitiesPaginated() as second argument                   │
│                                                                                  │
│  NOTE: Does NOT apply preferredActivityTypes since this screen IS for a         │
│        specific activity type already                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Filter Overlap Analysis

**IMPORTANT: Global Filters and Child Filters have overlapping properties!**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OVERLAPPING FILTER PROPERTIES                                 │
│                                                                                  │
│  Property           │ Global (FiltersScreen)    │ Child (Preferences)           │
│  ───────────────────┼───────────────────────────┼──────────────────────────────│
│  Activity Types     │ preferredActivityTypes    │ preferredActivityTypes        │
│  Age Range          │ ageRanges                 │ (from dateOfBirth)            │
│  Budget/Cost        │ priceRange                │ priceRangeMin/Max             │
│  Days of Week       │ daysOfWeek                │ daysOfWeek                    │
│  Location           │ savedAddress              │ savedAddress (from profile)   │
│  Distance           │ distanceRadiusKm          │ distanceRadiusKm              │
│  Indoor/Outdoor     │ environmentFilter         │ environmentFilter             │
│  Date Range         │ dateRange                 │ (not in child prefs)          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Current Behavior (After Recent Changes)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FILTER APPLICATION LOGIC                                 │
│                                                                                  │
│  IF selectedChildren.length > 0:                                                │
│    → Child preferences ARE applied (merged based on filterMode: OR/AND)         │
│    → Global filters ARE ALSO applied (INTERSECTION with child filters)          │
│                                                                                  │
│  IF selectedChildren.length === 0 (all children deselected):                    │
│    → Child preferences NOT applied (getChildBasedFilters returns undefined)     │
│    → ONLY Global filters (from FiltersScreen) applied                           │
│    → This allows users to browse without child-specific restrictions            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**User can deselect all children in the ChildFilterSelector to disable child-based filtering.**

**When both apply (children selected), result is INTERSECTION:**

```
Example:
  Child Preference:    Activity Types = [Swimming, Soccer]
  Global Filter:       Activity Types = [Soccer, Basketball]

  Result: Only Soccer activities shown (intersection)
```

### Potential Issues

1. **Conflicting filters can result in no results:**
   - Child wants Swimming only, Global filter set to Soccer → 0 results

2. **User confusion:**
   - User sets global filters, doesn't realize child filters also restrict results

3. **Double filtering:**
   - Both systems apply location/distance filtering

## Filter Priority / Override Rules

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FILTER PRIORITY                                        │
│                                                                                  │
│  Current Implementation:                                                         │
│                                                                                  │
│  1. Global filters from FiltersScreen applied to baseParams                     │
│  2. Screen-specific filters OVERRIDE global (e.g., ageGroup screen)             │
│  3. Child filters applied via childFilters param (INTERSECTS with above)        │
│                                                                                  │
│  Order of application:                                                           │
│    baseParams = screenParams + globalFilters                                    │
│    finalParams = applyChildFilters(baseParams, childFilters)                    │
│                                                                                  │
│  Conditional skipping prevents double-filtering:                                │
│    - preferredActivityTypes: NOT applied if type === 'activityType'            │
│    - ageRanges: NOT applied if type === 'ageGroup'                             │
│    - priceRange: NOT applied if type === 'budget'                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Future Improvement

Consider one of these approaches:

1. **Global filters only when no children selected:**
   - If children selected → use only child filters
   - If no children → use global filters

2. **Global filters as refinement only:**
   - Global filters only apply if MORE restrictive than child filters
   - E.g., smaller distance radius, fewer activity types

3. **Clear UI indication:**
   - Show active filters from both sources
   - Warning when filters conflict

---

## Data Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Filters    │     │   Child     │     │   Browse    │
│   Screen    │     │  Profile    │     │   Screen    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Preferences │     │   Redux     │     │   Route     │
│  Service    │     │   Store     │     │   Params    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │                   ▼                   │
       │           ┌─────────────┐             │
       │           │  childPref  │             │
       │           │  Service    │             │
       │           └──────┬──────┘             │
       │                   │                   │
       └───────────┬───────┴───────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Results Screen │
         │                 │
         │  loadActivities │
         └────────┬────────┘
                  │
                  ▼
    ┌─────────────────────────┐
    │   Build API Params:     │
    │                         │
    │   baseParams = {        │
    │     ...globalFilters,   │
    │     ...screenFilters    │
    │   }                     │
    │                         │
    │   childFilters = {      │
    │     filterMode,         │
    │     mergedFilters       │
    │   }                     │
    └────────────┬────────────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │  ActivityService        │
    │  .searchActivities      │
    │  Paginated(             │
    │    baseParams,          │
    │    childFilters         │
    │  )                      │
    └────────────┬────────────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │  API: POST /activities  │
    │  /search                │
    └─────────────────────────┘
```

---

## Screen Refresh on Filter Change

All results screens use `useFocusEffect` to reload when returning from FiltersScreen:

```typescript
useFocusEffect(
  useCallback(() => {
    loadActivities();  // Re-fetches with current preferences
  }, [dependencies])
);
```

This ensures:
1. User opens FiltersScreen from results screen
2. User changes filters and taps "Apply"
3. User returns to results screen
4. Screen reloads with new filters applied

---

## API Parameter Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `categories` | `string` | Comma-separated activity type names |
| `activitySubtype` | `string` | Activity subtype name |
| `ageMin` | `number` | Minimum age |
| `ageMax` | `number` | Maximum age |
| `maxCost` | `number` | Maximum cost |
| `dayOfWeek` | `string[]` | Days of week filter |
| `city` | `string` | City name |
| `province` | `string` | Province/state |
| `userLat` | `number` | User latitude |
| `userLon` | `number` | User longitude |
| `radiusKm` | `number` | Search radius in km |
| `environment` | `string` | 'indoor' or 'outdoor' |
| `startDateAfter` | `string` | ISO date string |
| `startDateBefore` | `string` | ISO date string |
| `hideFullActivities` | `boolean` | Hide activities with no spots |
| `hideClosedActivities` | `boolean` | Hide closed registration |
| `sortBy` | `string` | Sort field |
| `sortOrder` | `string` | 'asc' or 'desc' |
| `limit` | `number` | Page size |
| `offset` | `number` | Pagination offset |
