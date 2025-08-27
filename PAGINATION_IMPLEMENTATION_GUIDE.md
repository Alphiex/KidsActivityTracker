# Pagination Implementation Guide

## Overview
This guide documents the standardized pagination approach used throughout the Kids Activity Tracker app. All screens that display lists of activities must follow this pattern to ensure a consistent user experience.

## Core Principles

### 1. Always Show True Total Count
- Display the actual total number of activities available, not just what's currently loaded
- Users should know upfront how many activities match their criteria

### 2. Transparent Filtering
- When global filters (hideClosedActivities, hideFullActivities) are applied, show both:
  - The filtered count (activities after filters)
  - The number filtered out
- Format: `"X activities (Y filtered out from global settings)"`

### 3. Efficient Loading
- Load 50 activities initially
- Load additional batches of 50 as user scrolls
- Show loading indicators during pagination

## Implementation Pattern

### State Management
Every activity listing screen needs these state variables:

```typescript
const [activities, setActivities] = useState<Activity[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState<string | null>(null);

// Pagination states
const [totalCount, setTotalCount] = useState(0);
const [unfilteredCount, setUnfilteredCount] = useState(0);
const [filteredOutCount, setFilteredOutCount] = useState(0);
const [hasMore, setHasMore] = useState(false);
const [currentOffset, setCurrentOffset] = useState(0);
```

### Loading Activities Function

```typescript
const loadActivities = async (reset = false) => {
  try {
    if (reset) {
      setActivities([]);
      setCurrentOffset(0);
    }
    
    setError(null);
    const activityService = ActivityService.getInstance();
    const preferencesService = PreferencesService.getInstance();
    const preferences = preferencesService.getPreferences();
    
    // Build search parameters
    const searchParams: any = {
      limit: 50,
      offset: reset ? 0 : currentOffset,
      // ... your specific filters
    };
    
    // Apply global filters
    if (preferences.hideClosedActivities) {
      searchParams.hideClosedActivities = true;
    }
    if (preferences.hideFullActivities) {
      searchParams.hideFullActivities = true;
    }
    
    // Fetch paginated results
    const result = await activityService.searchActivitiesPaginated(searchParams);
    
    if (reset) {
      setActivities(result.items);
      
      // Get unfiltered count if global filters are active
      if (preferences.hideClosedActivities || preferences.hideFullActivities) {
        const unfilteredParams: any = { ...searchParams };
        delete unfilteredParams.hideClosedActivities;
        delete unfilteredParams.hideFullActivities;
        unfilteredParams.limit = 1; // Only need count
        unfilteredParams.offset = 0;
        
        try {
          const unfilteredResult = await activityService.searchActivitiesPaginated(unfilteredParams);
          setUnfilteredCount(unfilteredResult.total);
          setFilteredOutCount(unfilteredResult.total - result.total);
        } catch (error) {
          console.error('Error fetching unfiltered count:', error);
          setUnfilteredCount(result.total);
          setFilteredOutCount(0);
        }
      } else {
        setUnfilteredCount(result.total);
        setFilteredOutCount(0);
      }
    } else {
      setActivities(prev => [...prev, ...result.items]);
    }
    
    setTotalCount(result.total);
    setHasMore(result.hasMore);
    setCurrentOffset(prev => prev + result.items.length);
  } catch (err: any) {
    console.error('Error loading activities:', err);
    setError(err.message || 'Failed to load activities');
  } finally {
    setIsLoading(false);
    setRefreshing(false);
    setIsLoadingMore(false);
  }
};
```

### Load More Function

```typescript
const loadMore = async () => {
  if (!hasMore || isLoadingMore) return;
  
  setIsLoadingMore(true);
  await loadActivities(false);
};
```

### Display Component

```typescript
const renderHeader = () => (
  <View>
    <Text style={styles.headerTitle}>Your Title</Text>
    <Text style={styles.headerSubtitle}>
      {filteredOutCount > 0 ? (
        `${totalCount} ${totalCount === 1 ? 'activity' : 'activities'} (${filteredOutCount} filtered out from global settings)`
      ) : (
        `${totalCount} ${totalCount === 1 ? 'activity' : 'activities'} found`
      )}
    </Text>
  </View>
);
```

### FlatList Configuration

```typescript
<FlatList
  data={activities}
  renderItem={renderActivity}
  keyExtractor={(item) => item.id}
  ListHeaderComponent={renderHeader}
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={() => loadActivities(true)} />
  }
  contentContainerStyle={styles.listContent}
  showsVerticalScrollIndicator={false}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
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
/>
```

## Required Styles

```typescript
const styles = StyleSheet.create({
  // ... your existing styles
  
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  endOfList: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
```

## API Requirements

The backend API must support:
1. `limit` and `offset` parameters for pagination
2. Return structure with:
   - `items` or `activities`: Array of activities
   - `total`: Total count (regardless of pagination)
   - `hasMore`: Boolean indicating if more pages exist
   - `pagination.total`: Alternative location for total count

## Screens Using This Pattern

The following screens implement this pagination pattern:
- **RecommendedActivitiesScreen**: Shows personalized recommendations
- **LocationBrowseScreen**: Browse activities by location
- **NewActivitiesScreen**: Shows recently added activities
- **ActivityTypeScreen**: Shows activities by category/type
- **SearchScreen**: Search results (uses PaginatedActivityList component)

## Best Practices

### 1. Performance
- Only fetch unfiltered count on initial load (reset=true)
- Use limit=1 when only needing count to minimize data transfer
- Implement proper cleanup in useEffect to cancel pending requests

### 2. User Experience
- Always show loading states (initial, more, refreshing)
- Provide clear error messages with retry options
- Show "All activities loaded" when list is complete
- Display empty states when no activities match criteria

### 3. Consistency
- Use the same wording across all screens
- Maintain consistent loading indicators
- Keep the same pagination threshold (0.5)
- Always load 50 items per page

### 4. Error Handling
- Gracefully handle network failures
- Provide retry mechanisms
- Fall back to showing filtered count if unfiltered fetch fails
- Log errors for debugging but show user-friendly messages

## Testing Checklist

When implementing pagination on a new screen:
- [ ] Shows correct total count on initial load
- [ ] Displays filter message when global filters active
- [ ] Loads more activities when scrolling to bottom
- [ ] Shows "Loading more..." indicator
- [ ] Shows "All activities loaded" when complete
- [ ] Pull-to-refresh works correctly
- [ ] Error states display with retry option
- [ ] Empty state shows when no activities found
- [ ] Memory efficient (doesn't load all at once)
- [ ] Smooth scrolling performance

## Migration Guide

To update an existing screen to use this pattern:

1. Add the required state variables
2. Replace `searchActivities` with `searchActivitiesPaginated`
3. Implement the unfiltered count fetching logic
4. Update the header to show filter message
5. Add onEndReached and ListFooterComponent to FlatList
6. Add the required styles
7. Test all scenarios listed in the checklist

## Common Issues and Solutions

### Issue: Count shows as 0 initially
**Solution**: Ensure you're accessing `response.total` or `response.pagination.total` correctly

### Issue: Infinite loading loop
**Solution**: Check that `hasMore` is properly set and `isLoadingMore` guard is in place

### Issue: Filter message not showing
**Solution**: Verify that preferences are being checked and unfiltered count is fetched

### Issue: Duplicate activities in list
**Solution**: Ensure you're not calling loadActivities multiple times simultaneously

## Code Review Checklist

When reviewing pagination implementations:
- [ ] All required state variables present
- [ ] Unfiltered count fetched when filters active
- [ ] Proper error handling implemented
- [ ] Loading states correctly managed
- [ ] Memory efficient (incremental loading)
- [ ] Consistent UI/UX with other screens
- [ ] No unnecessary API calls
- [ ] Proper cleanup in useEffect