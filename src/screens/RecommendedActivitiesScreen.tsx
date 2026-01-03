import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService, { ChildBasedFilterParams } from '../services/activityService';
import childPreferencesService from '../services/childPreferencesService';
import PreferencesService from '../services/preferencesService';
import LoadingIndicator from '../components/LoadingIndicator';
import ActivityCard from '../components/ActivityCard';
import { Colors } from '../theme';
import { Activity } from '../types';
import { safeToISOString } from '../utils/safeAccessors';
import { useAppSelector, useAppDispatch } from '../store';
import { selectAllChildren, selectSelectedChildIds, selectFilterMode, fetchChildren } from '../store/slices/childrenSlice';
import { fetchChildFavorites, fetchChildWatching } from '../store/slices/childFavoritesSlice';

const RecommendedActivitiesScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  // Ensure children are loaded into Redux on mount
  useEffect(() => {
    dispatch(fetchChildren());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  const [filteredOutCount, setFilteredOutCount] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Get children from Redux
  const children = useAppSelector(selectAllChildren);

  // Refresh child favorites/watching data on screen focus for icon colors
  useFocusEffect(
    useCallback(() => {
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        dispatch(fetchChildFavorites(childIds));
        dispatch(fetchChildWatching(childIds));
      }
    }, [children, dispatch])
  );
  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const filterMode = useAppSelector(selectFilterMode);

  // Get selected children for child-based filters
  const selectedChildren = useMemo(() => {
    if (selectedChildIds.length === 0) {
      return children; // If none selected, use all children
    }
    return children.filter(c => selectedChildIds.includes(c.id));
  }, [children, selectedChildIds]);

  // Calculate child-based filters
  const getChildBasedFilters = useCallback((): ChildBasedFilterParams | undefined => {
    if (selectedChildren.length === 0) {
      return undefined;
    }

    // Get preferences for selected children
    const childPreferences = selectedChildren
      .filter(c => c.preferences)
      .map(c => c.preferences!);

    // Calculate ages from birth dates
    const today = new Date();
    const childAges = selectedChildren.map(child => {
      const birthDate = new Date(child.dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }).filter(age => age >= 0 && age <= 18);

    const childGenders = selectedChildren.map(child => child.gender ?? null);

    // Get merged filters using childPreferencesService
    const mergedFilters = childPreferencesService.getMergedFilters(
      childPreferences,
      childAges,
      childGenders,
      filterMode
    );

    return {
      selectedChildIds: selectedChildren.map(c => c.id),
      filterMode,
      mergedFilters,
    };
  }, [selectedChildren, filterMode]);

  const preferencesService = PreferencesService.getInstance();
  const preferences = preferencesService.getPreferences();
  const ITEMS_PER_PAGE = 50;

  const buildFilters = () => {
    const filters: any = {};

    // Apply view settings only (user-level, not filtering preferences)
    if (preferences.hideClosedActivities) {
      filters.hideClosedActivities = true;
    }
    if (preferences.hideFullActivities) {
      filters.hideFullActivities = true;
    }

    // Child-based filters handle all filtering preferences (activity types, age, location, days, price)
    return filters;
  };

  const loadRecommendedActivities = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setCurrentOffset(0);
        setActivities([]);
      } else if (!isRefresh && !hasMore) {
        return;
      }
      
      setError(null);
      const activityService = ActivityService.getInstance();
      
      const filters = buildFilters();
      filters.limit = ITEMS_PER_PAGE;
      filters.offset = isRefresh ? 0 : currentOffset;

      // Get child-based filters
      const childFilters = getChildBasedFilters();
      console.log('Loading recommended activities with filters:', filters, 'childFilters:', childFilters ? 'yes' : 'no');

      const response = await activityService.searchActivitiesPaginated(filters, childFilters);
      console.log(`Fetched ${response.items.length} activities, total: ${response.total}`);
      
      // If global filters are applied, also get unfiltered count to show difference
      if (isRefresh && (preferences.hideClosedActivities || preferences.hideFullActivities)) {
        const unfilteredFilters = { ...filters };
        delete unfilteredFilters.hideClosedActivities;
        delete unfilteredFilters.hideFullActivities;
        unfilteredFilters.limit = 1; // We only need the count
        
        try {
          const unfilteredResponse = await activityService.searchActivitiesPaginated(unfilteredFilters);
          setUnfilteredCount(unfilteredResponse.total);
          setFilteredOutCount(unfilteredResponse.total - response.total);
        } catch (error) {
          console.error('Error fetching unfiltered count:', error);
          setUnfilteredCount(response.total);
          setFilteredOutCount(0);
        }
      } else {
        setUnfilteredCount(response.total);
        setFilteredOutCount(0);
      }
      
      if (isRefresh) {
        setActivities(response.items);
        setCurrentOffset(ITEMS_PER_PAGE);
      } else {
        setActivities(prev => [...prev, ...response.items]);
        setCurrentOffset(prev => prev + ITEMS_PER_PAGE);
      }
      
      setTotalCount(response.total);
      setHasMore(response.hasMore);
    } catch (err: any) {
      console.error('Error loading recommended activities:', err);
      setError(err.message || 'Failed to load recommended activities. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = async () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      await loadRecommendedActivities(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'Recommended for You',
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadRecommendedActivities(true);
  }, [navigation]);

  const onRefresh = () => {
    loadRecommendedActivities(true);
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
      colors={['#9C27B0', '#7B1FA2']}
      style={styles.header}
    >
      <Icon name="star" size={50} color="#fff" />
      <Text style={styles.headerTitle}>Recommended Activities</Text>
      <Text style={styles.headerSubtitle}>
        {filteredOutCount > 0 ? (
          `${totalCount} activities (${filteredOutCount} filtered out from global settings)`
        ) : (
          `${totalCount} activities based on your preferences`
        )}
      </Text>
      <View style={styles.preferencesInfo}>
        {selectedChildren.length > 0 && (
          <View style={styles.preferenceChip}>
            <Icon name="child-care" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              {selectedChildren.length} {selectedChildren.length === 1 ? 'child' : 'children'}
            </Text>
          </View>
        )}
        {preferences.hideClosedActivities && (
          <View style={styles.preferenceChip}>
            <Icon name="event-available" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              Hide closed
            </Text>
          </View>
        )}
        {preferences.hideFullActivities && (
          <View style={styles.preferenceChip}>
            <Icon name="people-outline" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              Hide full
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding activities for you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadRecommendedActivities()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get child-based filter info for empty state
  const childFilters = getChildBasedFilters();
  const childActivityTypes = childFilters?.mergedFilters?.activityTypes || [];
  const childMaxPrice = childFilters?.mergedFilters?.priceRangeMax;

  if (!isLoading && activities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="search-off" size={60} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>No activities match your preferences</Text>
        {selectedChildren.length > 0 && (
          <Text style={styles.emptySubtext}>
            Filtering for: {selectedChildren.map(c => c.name).join(', ')}
          </Text>
        )}
        <Text style={styles.emptySubtext}>
          {childActivityTypes.length > 0
            ? `Looking for: ${childActivityTypes.slice(0, 3).join(', ')}${childActivityTypes.length > 3 ? '...' : ''}`
            : 'No activity types selected'}
        </Text>
        {childMaxPrice && (
          <Text style={styles.emptySubtext}>Max price: ${childMaxPrice}</Text>
        )}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Profile' as never)}
        >
          <Text style={styles.settingsButtonText}>Adjust Child Preferences</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingsButton, { marginTop: 10 }]}
          onPress={onRefresh}
        >
          <Text style={styles.settingsButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <LoadingIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingMoreText}>Loading more activities...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>
          Showing {activities.length} of {totalCount} activities
        </Text>
        {!hasMore && activities.length > 0 && (
          <Text style={styles.endText}>All activities loaded</Text>
        )}
      </View>
    );
  };

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
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
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
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
  },
  preferencesInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  preferenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 4,
  },
  preferenceText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
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
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 20,
    marginBottom: 30,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  endText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default RecommendedActivitiesScreen;