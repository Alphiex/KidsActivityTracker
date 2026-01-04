# Search Filtering Analysis & Issues

## Executive Summary

The "Budget Friendly" and "New This Week" sections on the Dashboard are returning activities from all cities because **location filtering relies entirely on latitude/longitude coordinates**, not city names. If a child's `savedAddress` doesn't have `latitude` and `longitude` populated, no location filtering occurs.

---

## Key Finding: No City-Based Filtering

### Current Location Filtering Flow

```
Child Preferences
     │
     ▼
savedAddress: {
  city: "Vancouver",        ← NOT USED for filtering
  province: "BC",           ← NOT USED for filtering
  latitude: 49.2827,        ← REQUIRED for filtering
  longitude: -123.1207,     ← REQUIRED for filtering
}
     │
     ▼
getMergedFilters() extracts lat/lng
     │
     ▼
applyChildFilters() sets:
  - userLat = latitude
  - userLon = longitude
  - radiusKm = distanceRadiusKm
     │
     ▼
Backend: getBoundingBox(lat, lon, radius)
     │
     ▼
WHERE latitude BETWEEN minLat AND maxLat
  AND longitude BETWEEN minLon AND maxLon
```

### The Problem

1. **No City Parameter**: The API doesn't accept or filter by `city` or `province` names
2. **Missing Coordinates**: If `savedAddress.latitude` is null/undefined, the entire location block is skipped
3. **Silent Failure**: When location filtering fails, the search returns ALL activities (no error)

---

## Screens & Their Filtering Behavior

### Dashboard Sections

| Section | Location Filtering | Child Filters | Issue |
|---------|-------------------|---------------|-------|
| Recommended | Lat/Lng only | Yes | Returns all cities if no lat/lng |
| Budget Friendly | Lat/Lng only | Yes | Returns all cities if no lat/lng |
| New Activities | Lat/Lng only | Yes | Returns all cities if no lat/lng |

### Code Locations

1. **getChildBasedFilters()**: `DashboardScreenModern.tsx:203-233`
2. **getMergedFilters()**: `childPreferencesService.ts:243-271`
3. **applyChildFilters()**: `activityService.ts:135-189`
4. **buildActivityWhereClause()**: `server/src/utils/activityFilters.ts:28-219`

---

## Child Preferences Fields

### Used for Filtering

| Field | Used In | Applied To API |
|-------|---------|----------------|
| `savedAddress.latitude` | getMergedFilters | `userLat` |
| `savedAddress.longitude` | getMergedFilters | `userLon` |
| `distanceRadiusKm` | getMergedFilters | `radiusKm` |
| `preferredActivityTypes` | getMergedFilters | `categories` |
| `daysOfWeek` | getMergedFilters | `dayOfWeek` |
| `priceRangeMin/Max` | getMergedFilters | `costMin/costMax` |
| `environmentFilter` | getMergedFilters | `environment` |

### NOT Used for Filtering

| Field | Why Not Used |
|-------|--------------|
| `savedAddress.city` | Backend doesn't support city-based filtering |
| `savedAddress.province` | Backend doesn't support province-based filtering |
| `distanceFilterEnabled` | Not checked in getMergedFilters |

---

## API Parameters Reference

### Frontend → Backend Parameter Mapping

| Frontend (childFilters) | API Parameter | Backend Service |
|------------------------|---------------|-----------------|
| `mergedFilters.latitude` | `userLat` | ✓ Used in bounding box |
| `mergedFilters.longitude` | `userLon` | ✓ Used in bounding box |
| `mergedFilters.distanceRadiusKm` | `radiusKm` | ✓ Used in bounding box |
| `mergedFilters.activityTypes` | `categories` | ✓ Filters by activity type |
| `mergedFilters.ageMin` | `ageMin` | ✓ Filters by age range |
| `mergedFilters.ageMax` | `ageMax` | ✓ Filters by age range |
| `mergedFilters.daysOfWeek` | `dayOfWeek` | ✓ Filters by day |
| `mergedFilters.priceRangeMin` | `costMin` | ✓ Filters by cost |
| `mergedFilters.priceRangeMax` | `costMax` | ✓ Filters by cost |
| `mergedFilters.environmentFilter` | `environment` | ✓ Filters indoor/outdoor |
| `mergedFilters.genders` | N/A | ✗ NOT PASSED TO API |

---

## Recommended Fixes

### Option 1: Add City-Based Filtering (Backend Change)

Add `city` and `province` parameters to the backend:

```typescript
// server/src/services/activityService.enhanced.ts
if (city) {
  where.location = {
    city: { contains: city, mode: 'insensitive' }
  };
}
```

**Pros**: Direct city filtering, no geocoding needed
**Cons**: Requires backend changes, city name matching can be inconsistent

### Option 2: Ensure Coordinates Are Always Set (Data Fix)

When saving a child's address, always geocode to get lat/lng:

```typescript
// When setting child location
const coords = await geocodeAddress(address);
await updateChildPreferences(childId, {
  savedAddress: {
    ...address,
    latitude: coords.latitude,
    longitude: coords.longitude
  }
});
```

**Pros**: Uses existing distance filtering
**Cons**: Requires geocoding API call, may fail for some addresses

### Option 3: Fallback to City Filtering (Hybrid)

If no lat/lng, fall back to city-based filtering:

```typescript
// In getMergedFilters or applyChildFilters
if (!latitude || !longitude) {
  // Fallback to city filtering
  if (savedAddress?.city) {
    params.city = savedAddress.city;
  }
}
```

**Pros**: Handles both cases
**Cons**: Requires backend to support city parameter

---

## Immediate Actions Needed

1. **Verify Child Data**: Check if children have `savedAddress.latitude/longitude` populated
2. **Add Logging**: Log the child filters being applied to identify where filtering fails
3. **Backend Enhancement**: Add city/province filtering support to the API
4. **UI Feedback**: Show users when location filtering is not applied

---

## Files to Modify

| File | Change Needed |
|------|---------------|
| `server/src/services/activityService.enhanced.ts` | Add city/province filtering |
| `server/src/routes/activities.ts` | Parse city/province params |
| `src/services/childPreferencesService.ts` | Pass city/province to merged filters |
| `src/services/activityService.ts` | Pass city/province to API |
| `src/screens/DashboardScreenModern.tsx` | Add logging for debugging |

---

## Testing Checklist

- [ ] Create child with city but no coordinates - verify filtering fails
- [ ] Create child with coordinates - verify filtering works
- [ ] Add city filtering to backend - verify city-based filtering works
- [ ] Test Budget Friendly with child in Vancouver - only Vancouver activities
- [ ] Test New This Week with child in Toronto - only Toronto activities
