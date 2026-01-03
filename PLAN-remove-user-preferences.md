# Plan: Remove User Preferences and Use Child-Based Preferences Only

## Overview

Currently the app has two parallel preference systems:
1. **User Preferences** (`preferencesService.ts`) - global preferences stored locally
2. **Child Preferences** (`childPreferencesService.ts`) - per-child preferences stored on server

This plan removes user preferences entirely. All filtering/personalization should be based on selected children's preferences.

## Current User Preferences (to be removed)

From `preferencesService.ts`:
- `ageRanges` - Replace with selected children's ages
- `priceRange` - Replace with child preferences `maxPrice`
- `locations` - Replace with child preferences `savedAddress`
- `preferredActivityTypes` - Replace with child preferences `preferredActivityTypes`
- `daysOfWeek` - Replace with child preferences `availableDays`
- `distanceRadius` - Replace with child preferences `distanceRadiusKm`
- `viewSettings` - Keep as user-level (affects UI, not filtering)
- `hasCompletedOnboarding` - Keep as user-level (app state)
- `notificationSettings` - Keep as user-level (device settings)

## Files to Modify

### High Priority (Core Filtering)

1. **`src/services/activityService.ts`**
   - Remove `getGlobalFilterParams()`
   - Remove calls to `preferencesService.getPreferences()`
   - Use only child-based filters from `applyChildFilters()`

2. **`src/screens/DashboardScreenModern.tsx`**
   - Already partially migrated (uses `getSelectedChildrenAgeRange()`)
   - Remove remaining calls to `preferencesService.getPreferences()`
   - Use child preferences for all sections

3. **`src/screens/SearchScreen.tsx`**
   - Replace user preferences with child filter state
   - Auto-populate filters from selected children

4. **`src/screens/FiltersScreen.tsx`**
   - Change to show/edit child preferences instead of user preferences
   - Or remove entirely and use child preferences UI

5. **`src/screens/MapSearchScreen.tsx`**
   - Use selected children's location/radius for map centering
   - Apply child age filters

6. **`src/screens/UnifiedResultsScreen.tsx`**
   - Use child-based filters only

7. **`src/screens/ActivityListScreen.tsx`**
   - Use child-based filters only

### Medium Priority (AI Features)

8. **`src/screens/AIChatScreen.tsx`**
   - Pass child context instead of user preferences

9. **`src/screens/AIRecommendationsScreen.tsx`**
   - Already uses child selection - verify no user prefs

10. **`src/screens/WeeklyPlannerScreen.tsx`**
    - Uses child availability - verify no user prefs

### Lower Priority (Secondary Screens)

11. **`src/screens/NewActivitiesScreen.tsx`**
    - Use child-based filters

12. **`src/screens/ActivityTypeDetailScreen.tsx`**
    - Use child-based filters

13. **`src/screens/LocationBrowseScreen.tsx`**
    - Use child-based location

14. **`src/screens/RecommendedActivitiesScreen.tsx`**
    - Use child-based filters

### Preference Screens to Migrate (Edit Child Preferences)

15. **`src/screens/preferences/AgePreferencesScreen.tsx`** - MIGRATE
    - Show selected children's ages (read-only, derived from DOB)
    - Or remove if not needed (age comes from child profile)

16. **`src/screens/preferences/ActivityTypePreferencesScreen.tsx`** - MIGRATE
    - Edit selected children's `preferredActivityTypes`
    - Show child selector at top if multiple children
    - Save to child preferences via `childPreferencesService`

17. **`src/screens/preferences/BudgetPreferencesScreen.tsx`** - MIGRATE
    - Edit selected children's `maxPrice`
    - Show child selector at top
    - Save to child preferences

18. **`src/screens/preferences/DistancePreferencesScreen.tsx`** - MIGRATE
    - Edit selected children's `distanceRadiusKm`
    - Show child selector at top
    - Save to child preferences

19. **`src/screens/preferences/LocationPreferencesScreen.tsx`** - MIGRATE
    - Edit selected children's `savedAddress`
    - Show child selector at top
    - Save to child preferences

20. **`src/screens/preferences/SchedulePreferencesScreen.tsx`** - MIGRATE
    - Edit selected children's `availableDays`
    - Show child selector at top
    - Save to child preferences

### Files to Keep (User-level settings only)

21. **`src/screens/preferences/ViewSettingsScreen.tsx`** - KEEP
    - Card display settings are user preference (UI, not filtering)

22. **`src/screens/SettingsScreen.tsx`** - MODIFY
    - Remove preference links, keep account/app settings

23. **`src/screens/NotificationPreferencesScreenModern.tsx`** - KEEP
    - Notifications are device/user level

24. **`src/services/preferencesService.ts`** - MODIFY
    - Keep only: `hasCompletedOnboarding`, `viewSettings`, `notificationSettings`
    - Remove all filter-related preferences

### Navigation Updates

25. **Keep in navigation but update behavior:**
    - All preference screens now edit child preferences
    - Add child selector component to each screen
    - Pass selected child ID(s) as route params

### Supporting Changes

26. **`src/services/locationService.ts`**
    - Get default location from first child's saved address

27. **`src/navigation/RootNavigator.tsx`**
    - Update onboarding flow (no user preferences to set)
    - Navigate to child setup instead

28. **`src/store/slices/childrenSlice.ts`**
    - Add selectors for merged child preferences

## Migration Strategy

### Phase 1: Core Filtering (This Sprint)
1. Update `activityService.ts` to only use child filters
2. Update DashboardScreenModern to use child preferences
3. Update SearchScreen to use child filters
4. Test thoroughly

### Phase 2: Migrate Preference Screens to Child Preferences
1. Add child selector component to each preference screen
2. Update each screen to load/save child preferences instead of user preferences
3. Update Settings screen to reflect child-based preferences

### Phase 3: Clean Up
1. Slim down `preferencesService.ts`
2. Remove unused code
3. Update tests

## Child Preference Structure (Reference)

```typescript
interface ChildPreferences {
  preferredActivityTypes: string[];  // Activity type codes
  availableDays: string[];           // Days of week
  maxPrice: number | null;           // Budget limit
  distanceRadiusKm: number;          // Search radius
  savedAddress: {                    // Home location
    formattedAddress: string;
    latitude: number;
    longitude: number;
    city: string;
    province: string;
  } | null;
}
```

## Merging Multiple Children's Preferences

When multiple children are selected, use the `ChildFilterSelector` component's logic:
- **Age Range**: Union of all children's ages (min to max)
- **Activity Types**: Intersection (activities that work for all) or Union (OR mode)
- **Location**: Use first child's location, or family default
- **Days**: Intersection of available days
- **Budget**: Minimum of all max prices

## Testing Checklist

- [ ] Dashboard loads with child filters only
- [ ] Search uses child filters
- [ ] Map centers on child location
- [ ] AI recommendations use child context
- [ ] No errors when no children exist (show empty state)
- [ ] Filters update when child selection changes
- [ ] Multiple child selection works correctly

## Risks

1. **Users with no children**: Show prompt to add children before browsing
2. **Data loss**: User preferences will be lost - acceptable since we're migrating to child-based
3. **Breaking changes**: Need thorough testing of all search flows

## Timeline Estimate

- Phase 1: 2-3 days
- Phase 2: 1 day
- Phase 3: 1 day
- Testing: 1-2 days

Total: ~1 week of focused development
