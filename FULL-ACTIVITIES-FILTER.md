# Full Activities Filter Implementation

## Summary
Added a user preference to filter out full activities from search results, similar to the closed activities filter. By default, full activities are shown (filter is disabled).

## Changes Made

### 1. Frontend Changes

#### Preferences Types (`src/types/preferences.ts`)
- Added `hideFullActivities: boolean` field to UserPreferences interface

#### Filter Type (`src/types/index.ts`)
- Added `hideFullActivities?: boolean` to Filter interface

#### Preferences Service (`src/services/preferencesService.ts`)
- Set `hideFullActivities: false` as default (showing full activities by default)

#### Settings Screen (`src/screens/SettingsScreen.tsx`)
- Added new toggle under "Activity Filters" section for "Hide Full Activities"
- Subtitle: "Don't show activities that are full"
- Icon: 'account-multiple-remove'

#### Activity Service (`src/services/activityService.ts`)
- Updated searchActivities to pass `exclude_full: true` when filter is enabled

#### Screen Updates
All screens now respect the hideFullActivities preference:
- **ActivityTypeScreen.tsx** - Category browsing
- **LocationBrowseScreen.tsx** - Location browsing  
- **SearchScreen.tsx** - Search results
- **NewActivitiesScreen.tsx** - New activities listing

### 2. Backend Changes

#### API Server (`backend/api/server.js`)
- Updated `/api/v1/activities` endpoint to accept `exclude_full` parameter
- Added to filters object: `excludeFull: req.query.exclude_full === 'true'`

#### Activity Service (`backend/database/services/activityService.js`)
- Added `excludeFull` parameter to searchActivities function
- Updated filter logic to handle excludeFull separately from excludeClosed
- When excludeFull is true (and excludeClosed is false), only filters activities where registrationStatus contains "full"
- Maintains backward compatibility: excludeClosed still filters out full activities along with closed/cancelled

## How It Works

1. **Default Behavior**: New users have "Hide Full Activities" disabled by default (showing full activities)
2. **Toggle Control**: Users can enable/disable the filter in Settings > Activity Filters
3. **Search Impact**: When enabled, all activity searches exclude activities with "full" in registrationStatus
4. **Independence**: This filter works independently from the "Hide Closed Activities" filter
5. **Backward Compatibility**: The excludeClosed filter continues to exclude full activities for consistency

## Differences from Closed Activities Filter

1. **Default State**: 
   - hideClosedActivities: true (enabled by default)
   - hideFullActivities: false (disabled by default)

2. **Scope**:
   - hideClosedActivities: Filters out closed, full, and cancelled activities
   - hideFullActivities: Only filters out full activities

## Testing

1. Go to Settings > Activity Filters
2. Toggle "Hide Full Activities" on
3. Browse activities - full activities should be hidden
4. Toggle it off - full activities should appear again
5. Test independence from "Hide Closed Activities" toggle

## API Usage

To exclude only full activities:
```
GET /api/v1/activities?exclude_full=true
```

To exclude closed activities (includes full):
```
GET /api/v1/activities?exclude_closed=true
```

To exclude both independently:
```
GET /api/v1/activities?exclude_closed=true&exclude_full=true
```