# Activity Listing Standards - Quick Reference

## Required for ALL Activity Listing Screens

### 1. State Setup
```typescript
// Core states
const [activities, setActivities] = useState<Activity[]>([]);
const [totalCount, setTotalCount] = useState(0);
const [unfilteredCount, setUnfilteredCount] = useState(0);
const [filteredOutCount, setFilteredOutCount] = useState(0);
const [hasMore, setHasMore] = useState(false);
const [currentOffset, setCurrentOffset] = useState(0);

// Loading states
const [isLoading, setIsLoading] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [refreshing, setRefreshing] = useState(false);
```

### 2. Display Format

#### With Global Filters Active:
```
"347 activities (52 filtered out from global settings)"
```

#### Without Global Filters:
```
"347 activities available"
```

### 3. API Calls Pattern

#### Initial Load:
1. Fetch activities with filters + limit: 50
2. IF global filters active:
   - Fetch unfiltered count (limit: 1)
   - Calculate filtered out count
3. Display total with appropriate message

#### Load More:
- Triggered at 50% scroll (onEndReachedThreshold: 0.5)
- Load next 50 activities
- Append to existing list

### 4. Required UI Elements

```typescript
// Header
<Text style={styles.headerSubtitle}>
  {filteredOutCount > 0 ? (
    `${totalCount} activities (${filteredOutCount} filtered out from global settings)`
  ) : (
    `${totalCount} activities available`
  )}
</Text>

// Footer
<ListFooterComponent>
  - "Loading more activities..." (when loading)
  - "All activities loaded" (when complete)
</ListFooterComponent>
```

## Implementation Checklist

### Essential Features
- [ ] Shows TRUE total count (not just loaded count)
- [ ] Shows filter message when applicable
- [ ] Loads 50 items initially
- [ ] Paginates in batches of 50
- [ ] Shows loading indicators
- [ ] Pull-to-refresh support

### Global Filters to Check
```typescript
const preferences = preferencesService.getPreferences();
if (preferences.hideClosedActivities) { /* apply filter */ }
if (preferences.hideFullActivities) { /* apply filter */ }
```

### API Service Method
```typescript
// Always use paginated version:
activityService.searchActivitiesPaginated(params)

// NOT:
activityService.searchActivities(params)  // ❌ Old method
```

## Quick Copy-Paste Templates

### Unfiltered Count Logic
```typescript
if (reset && (preferences.hideClosedActivities || preferences.hideFullActivities)) {
  const unfilteredParams = { ...searchParams };
  delete unfilteredParams.hideClosedActivities;
  delete unfilteredParams.hideFullActivities;
  unfilteredParams.limit = 1;
  
  try {
    const unfilteredResult = await activityService.searchActivitiesPaginated(unfilteredParams);
    setUnfilteredCount(unfilteredResult.total);
    setFilteredOutCount(unfilteredResult.total - result.total);
  } catch (error) {
    setUnfilteredCount(result.total);
    setFilteredOutCount(0);
  }
}
```

### FlatList Footer
```typescript
ListFooterComponent={() => {
  if (isLoadingMore) {
    return (
      <View style={styles.loadingMore}>
        <Text style={styles.loadingMoreText}>Loading more activities...</Text>
      </View>
    );
  }
  if (!hasMore && activities.length > 0) {
    return (
      <View style={styles.endOfList}>
        <Text style={styles.endOfListText}>All activities loaded</Text>
      </View>
    );
  }
  return null;
}}
```

## Examples of Correct Implementation

### Good ✅
```
Location: "Parkgate Community Center"
Display: "347 activities (52 filtered out from global settings)"
Behavior: Loads 50, then paginates rest
```

### Bad ❌
```
Location: "Parkgate Community Center"
Display: "50 activities available"  // Wrong! Shows loaded count not total
Behavior: Only loads 50 activities
```

## Screens Currently Implementing This Standard

1. **RecommendedActivitiesScreen** ✅
2. **LocationBrowseScreen** ✅
3. **NewActivitiesScreen** ✅
4. **ActivityTypeScreen** ✅
5. **SearchScreen** ✅ (via PaginatedActivityList)

## Need Updates
- ActivityHistoryScreen
- SharedActivitiesScreen
- Any new activity listing screens

## Key Files

- **Pattern Reference**: `src/screens/RecommendedActivitiesScreen.tsx`
- **Service**: `src/services/activityService.ts` (searchActivitiesPaginated method)
- **Component**: `src/components/PaginatedActivityList.tsx` (reusable component)

## Testing Your Implementation

1. **Without Filters**: Should show total count
2. **With hideClosedActivities**: Should show reduced count + filter message
3. **With hideFullActivities**: Should show reduced count + filter message
4. **Scroll to 50%**: Should trigger load more
5. **Scroll to end**: Should show "All activities loaded"
6. **Pull to refresh**: Should reset and reload

## Common Mistakes to Avoid

1. **Showing loaded count instead of total** ❌
   ```typescript
   `${activities.length} activities`  // Wrong!
   `${totalCount} activities`         // Correct!
   ```

2. **Not fetching unfiltered count** ❌
   ```typescript
   // Missing the unfiltered count fetch when filters active
   ```

3. **Using wrong API method** ❌
   ```typescript
   searchActivities()          // Old method, limited to 50
   searchActivitiesPaginated() // Correct method
   ```

4. **Loading all at once** ❌
   ```typescript
   limit: 1000  // Bad for performance
   limit: 50    // Good, paginate the rest
   ```