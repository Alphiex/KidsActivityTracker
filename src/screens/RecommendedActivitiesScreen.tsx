import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import LoadingIndicator from '../components/LoadingIndicator';
import ActivityCard from '../components/ActivityCard';
import { Colors } from '../theme';
import { Activity } from '../types';
import { safeToISOString } from '../utils/safeAccessors';

const RecommendedActivitiesScreen = () => {
  const navigation = useNavigation();
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
  
  const preferencesService = PreferencesService.getInstance();
  const preferences = preferencesService.getPreferences();
  const ITEMS_PER_PAGE = 50;

  const buildFilters = () => {
    const filters: any = {};
    
    // Apply user preference filters
    if (preferences.hideClosedActivities) {
      filters.hideClosedActivities = true;
    }
    if (preferences.hideFullActivities) {
      filters.hideFullActivities = true;
    }
    
    // Apply activity type filters from preferredCategories
    // preferredCategories contains activity type names like "Swimming & Aquatics", "Dance", etc.
    if (preferences.preferredCategories && preferences.preferredCategories.length > 0) {
      filters.activityTypes = preferences.preferredCategories;
    }
    
    if (preferences.locations && preferences.locations.length > 0) {
      filters.locations = preferences.locations;
    }
    if (preferences.priceRange) {
      filters.maxCost = preferences.priceRange.max;
    }
    
    // Apply age range if set
    if (preferences.ageRanges && preferences.ageRanges.length > 0) {
      const ageRange = preferences.ageRanges[0];
      filters.ageMin = ageRange.min;
      filters.ageMax = ageRange.max;
    }
    
    // Apply time preferences to match dashboard behavior
    if (preferences.timePreferences) {
      filters.timePreferences = preferences.timePreferences;
    }
    
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
      
      console.log('Loading recommended activities with filters:', filters);
      
      const response = await activityService.searchActivitiesPaginated(filters);
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

  const renderActivity = ({ item }: { item: Activity }) => (
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
        {preferences.preferredCategories && preferences.preferredCategories.length > 0 && (
          <View style={styles.preferenceChip}>
            <Icon name="tag" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              {preferences.preferredCategories.length} categories
            </Text>
          </View>
        )}
        {preferences.locations && preferences.locations.length > 0 && (
          <View style={styles.preferenceChip}>
            <Icon name="location-on" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              {preferences.locations.length} locations
            </Text>
          </View>
        )}
        {preferences.priceRange && (
          <View style={styles.preferenceChip}>
            <Icon name="attach-money" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              Max ${preferences.priceRange.max}
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
        <TouchableOpacity style={styles.retryButton} onPress={loadRecommendedActivities}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isLoading && activities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="search-off" size={60} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>No activities match your preferences</Text>
        <Text style={styles.emptySubtext}>
          {preferences.preferredCategories?.length > 0 
            ? `Looking for: ${preferences.preferredCategories.join(', ')}` 
            : 'No categories selected'}
        </Text>
        {preferences.priceRange && (
          <Text style={styles.emptySubtext}>Max price: ${preferences.priceRange.max}</Text>
        )}
        {preferences.ageRanges && preferences.ageRanges[0] && (
          <Text style={styles.emptySubtext}>
            Age range: {preferences.ageRanges[0].min}-{preferences.ageRanges[0].max} years
          </Text>
        )}
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => navigation.navigate('Profile' as never)}
        >
          <Text style={styles.settingsButtonText}>Adjust Preferences</Text>
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
    paddingBottom: 20,
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
    color: Colors.text,
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