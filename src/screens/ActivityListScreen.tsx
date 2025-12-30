import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import ActivityCard from '../components/ActivityCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors, Theme } from '../theme';
import { Activity } from '../types';
import { safeToISOString } from '../utils/safeAccessors';

const ActivityListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as { category?: string; filters?: any; isActivityType?: boolean } | undefined;
  const category = params?.category ?? 'All';
  const filters = params?.filters;
  const isActivityType = params?.isActivityType ?? false;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  const [filteredOutCount, setFilteredOutCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

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
      
      let searchParams: any = {
        limit: 50,
        offset: reset ? 0 : currentOffset
      };
      
      // Add filter based on activity type (use new ActivityType system)
      if (category !== 'All' && category !== 'Budget Friendly') {
        // Always use activityType filter for precise categorization
        searchParams.activityType = category;
      }
      
      // Apply additional filters if provided
      if (filters) {
        console.log('ActivityListScreen: Applying filters from route params:', filters);
        searchParams = { ...searchParams, ...filters };
      }
      
      // Apply ALL global filters to match other screens
      if (preferences.hideClosedActivities) {
        searchParams.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        searchParams.hideFullActivities = true;
      }
      
      // Apply location filters
      if (preferences.locations && preferences.locations.length > 0) {
        searchParams.locations = preferences.locations;
      }
      
      // Apply price range filter (don't override Budget Friendly maxCost)
      if (preferences.priceRange && !searchParams.maxCost) {
        searchParams.maxCost = preferences.priceRange.max;
      }
      
      // Apply age range filter
      if (preferences.ageRanges && preferences.ageRanges.length > 0) {
        const ageRange = preferences.ageRanges[0];
        searchParams.ageMin = ageRange.min;
        searchParams.ageMax = ageRange.max;
      }
      
      // Apply schedule preferences
      if (preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) {
        searchParams.daysOfWeek = preferences.daysOfWeek;
      }
      
      // Apply time preferences
      if (preferences.timePreferences) {
        searchParams.timePreferences = preferences.timePreferences;
      }
      
      console.log('ActivityListScreen: Final searchParams being sent to API:', searchParams);
      const result = await activityService.searchActivitiesPaginated(searchParams);
      
      if (reset) {
        setActivities(result.items);
        
        // If ANY global filters are applied, get unfiltered count to show difference
        const hasGlobalFilters = preferences.hideClosedActivities || 
                                preferences.hideFullActivities ||
                                (preferences.locations && preferences.locations.length > 0) ||
                                (preferences.ageRanges && preferences.ageRanges.length > 0) ||
                                preferences.priceRange ||
                                (preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) ||
                                preferences.timePreferences;
        
        if (hasGlobalFilters) {
          let unfilteredParams: any = {
            limit: 1,  // We only need the count
            offset: 0
          };

          // Only include category/type filters, not global preference filters
          if (category !== 'All' && category !== 'Budget Friendly') {
            unfilteredParams.activityType = category;
          }

          // Include route-specific filters (like Budget Friendly maxCost)
          if (filters) {
            unfilteredParams = { ...unfilteredParams, ...filters };
          }
          
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
      setError(err.message || 'Failed to load activities. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    await loadActivities(false);
  };

  useEffect(() => {
    let title = category;
    
    // Update title based on filters
    if (filters?.maxCost) {
      title = `Budget Friendly (Under $${filters.maxCost})`;
    }
    
    navigation.setOptions({
      title: title,
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadActivities(true);
  }, [category, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivities(true);
  };

  const renderActivity = ({ item, index }: { item: Activity; index: number }) => (
    <ActivityCard
      activity={item}
      onPress={() => {
        // Convert Date objects to ISO strings to avoid non-serializable warning
        const serializedActivity = {
          ...item,
          dateRange: item.dateRange ? {
            start: safeToISOString(item.dateRange.start),
            end: safeToISOString(item.dateRange.end),
          } : null,
          scrapedAt: safeToISOString(item.scrapedAt),
        };
        navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
      }}
      containerStyle={{
        width: CARD_WIDTH,
        marginRight: index % 2 === 0 ? CARD_GAP : 0,
      }}
    />
  );

  const renderHeader = () => (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryDark]}
      style={styles.header}
    >
      <Text style={styles.categoryTitle}>{category}</Text>
      <Text style={styles.categorySubtitle}>
        {filteredOutCount > 0 ? (
          `${totalCount} ${totalCount === 1 ? 'activity' : 'activities'} (${filteredOutCount} filtered out from global settings)`
        ) : (
          `${totalCount} ${totalCount === 1 ? 'activity' : 'activities'} found`
        )}
      </Text>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading {category} activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadActivities(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="emoticon-sad" size={60} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>No {category} activities found</Text>
        <Text style={styles.emptySubtext}>Check back later for new activities!</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={activities.length > 1 ? styles.columnWrapper : undefined}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  header: {
    padding: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  categorySubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 18,
    color: Colors.text.primary,
    fontWeight: '600',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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

export default ActivityListScreen;