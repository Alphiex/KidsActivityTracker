# Closed Activities Filter Implementation

## Summary
Added a user preference to filter out closed/full activities by default, while ensuring enrolled activities still show for children.

## Changes Made

### 1. Frontend Changes

#### Preferences Types (`src/types/preferences.ts`)
- Added `hideClosedActivities: boolean` field to UserPreferences interface

#### Filter Type (`src/types/index.ts`)
- Added `hideClosedActivities?: boolean` to Filter interface

#### Preferences Service (`src/services/preferencesService.ts`)
- Set `hideClosedActivities: true` as default (enabled by default)

#### Settings Screen (`src/screens/SettingsScreen.tsx`)
- Added new "Activity Filters" section with toggle for "Hide Closed Activities"
- Subtitle: "Don't show activities that are full or closed"

#### Activity Service (`src/services/activityService.ts`)
- Updated searchActivities to pass `exclude_closed: true` when filter is enabled

#### Screen Updates
All screens now respect the hideClosedActivities preference:
- **ActivityTypeScreen.tsx** - Category browsing
- **LocationBrowseScreen.tsx** - Location browsing  
- **SearchScreen.tsx** - Search results
- **NewActivitiesScreen.tsx** - New activities listing

### 2. Backend Changes

#### API Server (`backend/api/server.js`)
- Updated `/api/v1/activities` endpoint to accept `exclude_closed` parameter
- Added to filters object: `excludeClosed: req.query.exclude_closed === 'true'`

#### Activity Service (`backend/database/services/activityService.js`)
- Added `excludeClosed` parameter to searchActivities function
- When enabled, filters out activities where registrationStatus contains:
  - "closed" (case insensitive)
  - "full" (case insensitive)
  - "cancelled" (case insensitive)

### 3. Special Handling

#### Child Enrolled Activities
- Child profile screen (`ChildProfileScreen.tsx`) loads activities through `childrenService.getChildActivities()`
- This endpoint does NOT apply the closed filter, ensuring children see all their enrolled activities
- Parents can always see activities their children are enrolled in, regardless of closed status

## How It Works

1. **Default Behavior**: New users have "Hide Closed Activities" enabled by default
2. **Quick Search**: All browse buttons from home screen apply the filter automatically
3. **Search**: The search screen respects the user's preference
4. **Toggle**: Users can disable the filter in Settings > Activity Filters
5. **Child Activities**: Enrolled activities always show on child profiles

## Testing

1. Go to Settings > Activity Filters
2. Toggle "Hide Closed Activities" on/off
3. Browse activities - closed ones should be hidden when enabled
4. Check child profile - enrolled closed activities should still appear

## API Usage

To exclude closed activities:
```
GET /api/v1/activities?exclude_closed=true
```

The API filters out activities with registration status containing "closed", "full", or "cancelled".