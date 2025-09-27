import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import ActivityTypeService from '../services/activityTypeService';
import PreferencesService from '../services/preferencesService';
import ActivityCard from '../components/ActivityCard';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import { Activity } from '../types';

interface Subtype {
  code: string;
  name: string;
  activityCount: number;
}

// Removed getTypeVariations - now using exact database names

const ActivityTypeDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Handle both old and new parameter formats
  const params = route.params as any;
  const activityType = params?.activityType;
  const typeCode = activityType?.code || params?.typeCode;
  const typeName = activityType?.name || params?.typeName;
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [subtypes, setSubtypes] = useState<Subtype[]>([]);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null | undefined>(undefined); // undefined = show subtypes, null = show all, string = show specific
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [consecutiveEmptyResponses, setConsecutiveEmptyResponses] = useState(0);
  const MAX_EMPTY_RESPONSES = 3;
  
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadTypeDetails();
  }, [typeName]);

  // Load activities when selectedSubtype changes (but not on initial mount)
  useEffect(() => {
    if (selectedSubtype !== undefined && !isLoading) {
      loadActivities(true);
    }
  }, [selectedSubtype]);

  const loadTypeDetails = async () => {
    try {
      setError(null);

      // Validate required parameters
      if (!typeName && !typeCode) {
        setError('Activity type not specified');
        setIsLoading(false);
        return;
      }

      console.log('ActivityTypeDetail: Loading details for type:', typeName, 'with code:', typeCode);
      
      const activityService = ActivityService.getInstance();
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      
      // Get type details with subtypes from the API
      const types = await activityService.getActivityTypesWithCounts();
      console.log('ActivityTypeDetail: Received', types.length, 'activity types from API');
      
      const currentType = types.find(t => t.name === typeName || t.code === typeCode);
      console.log('ActivityTypeDetail: Found matching type:', currentType ? 'Yes' : 'No');
      
      if (currentType && currentType.subtypes) {
        // Use the subtypes from the API which already have counts
        const subtypesWithCounts = currentType.subtypes
          .filter(s => s.activityCount > 0)
          .map(subtype => ({
            code: subtype.code,
            name: subtype.name,
            activityCount: subtype.activityCount
          }))
          .sort((a, b) => b.activityCount - a.activityCount);
        
        setSubtypes(subtypesWithCounts);
        setTotalCount(currentType.activityCount || 0);
        console.log('ActivityTypeDetail: Set subtypes count:', subtypesWithCounts.length, 'total count:', currentType.activityCount);
      } else {
        console.log('ActivityTypeDetail: Current type not found, using fallback method');
        // Fallback to old method if needed
        const activityTypeService = ActivityTypeService.getInstance();
        const typeInfo = await activityTypeService.getActivityTypeWithSubtypes(typeName);
        
        if (typeInfo && typeInfo.subtypes) {
          const subtypesWithCounts = typeInfo.subtypes
            .filter(s => s && s.count > 0 && s.name)
            .map(subtype => ({
              code: subtype.code || (subtype.name ? subtype.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''),
              name: subtype.name || '',
              activityCount: subtype.count || 0
            }))
            .sort((a, b) => b.activityCount - a.activityCount);
          
          setSubtypes(subtypesWithCounts);
          setTotalCount(typeInfo.totalCount || 0);
        } else {
          console.log('ActivityTypeDetail: No type info found, setting empty state');
          setSubtypes([]);
          setTotalCount(0);
        }
      }
      
      // Don't load activities here - they will be loaded when selectedSubtype is set
    } catch (err: any) {
      console.error('ActivityTypeDetail: Error loading type details:', err);
      console.error('ActivityTypeDetail: Full error object:', JSON.stringify(err, null, 2));
      setError(err.message || 'Failed to load activity type details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivities = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setCurrentOffset(0);
        setActivities([]);
      } else if (!isRefresh && !hasMore) {
        return;
      }
      
      const activityService = ActivityService.getInstance();
      const activityTypeService = ActivityTypeService.getInstance();
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      
      // Get activities matching this exact type name from database
      const allActivities: Activity[] = [];

      const filters: any = {
        limit: ITEMS_PER_PAGE,
        offset: isRefresh ? 0 : currentOffset,
      };

      // If a subtype is selected, filter by it
      // Otherwise filter by the main category
      if (selectedSubtype) {
        // When filtering by subtype, we need both the main type and subtype
        filters.categories = typeName;
        filters.activitySubtype = selectedSubtype;
      } else {
        // When showing all activities for a type, just filter by main category
        filters.categories = typeName;
      }

      // DO NOT apply global preference filters here
      // When browsing by activity type, users want to see ALL activities
      // in that category, not filtered by their preferences
      // Only apply basic availability filters if needed

      // Optional: You could apply these minimal filters if desired:
      // filters.hideClosedActivities = true; // Show only activities that are open for registration
      // But for now, show everything to match the expected behavior
      
      console.log('ActivityTypeDetailScreen: Searching with filters:', {
        ...filters,
        selectedSubtype,
        typeName
      });
      const response = await activityService.searchActivitiesPaginated(filters);
      console.log('ActivityTypeDetailScreen: Response:', {
        itemCount: response.items?.length,
        total: response.total,
        hasMore: response.hasMore,
        firstItem: response.items?.[0]?.name
      });
      
      if (response.items && response.items.length > 0) {
        allActivities.push(...response.items);
        setTotalCount(response.total || 0);
        setHasMore(response.hasMore);
        setConsecutiveEmptyResponses(0); // Reset counter on success
      } else {
        // Track consecutive empty responses
        const newEmptyCount = consecutiveEmptyResponses + 1;
        setConsecutiveEmptyResponses(newEmptyCount);
        
        if (response.total === 0 || newEmptyCount >= MAX_EMPTY_RESPONSES) {
          console.log('ActivityTypeDetailScreen: Stopping pagination - total:', response.total, 'empty responses:', newEmptyCount);
          setTotalCount(response.total || 0);
          setHasMore(false);
        }
      }
      
      if (isRefresh) {
        setActivities(allActivities);
        setCurrentOffset(ITEMS_PER_PAGE);
      } else {
        setActivities(prev => [...prev, ...allActivities]);
        setCurrentOffset(prev => prev + ITEMS_PER_PAGE);
      }
    } catch (err: any) {
      console.error('ActivityTypeDetail: Error loading activities:', err);
      console.error('ActivityTypeDetail: Filters used:', JSON.stringify(filters, null, 2));
      setError(err.message || 'Failed to load activities. Please try again.');
    } finally {
      setRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = async () => {
    // Prevent infinite loops with multiple safeguards
    if (consecutiveEmptyResponses >= MAX_EMPTY_RESPONSES || !hasMore || isLoadingMore) {
      console.log('ActivityTypeDetailScreen: Not loading more - consecutive empty:', consecutiveEmptyResponses, 'hasMore:', hasMore);
      return;
    }
    
    // Additional safeguard: if offset is very high and we have no activities, stop
    if (currentOffset > 1000 && activities.length === 0) {
      console.log('ActivityTypeDetailScreen: Stopping pagination - high offset with no results');
      setHasMore(false);
      return;
    }

    setIsLoadingMore(true);
    await loadActivities(false);
  };

  const onRefresh = () => {
    loadActivities(true);
  };

  const selectSubtype = (subtypeName: string | null) => {
    console.log('ActivityTypeDetailScreen: Selecting subtype:', subtypeName);
    setSelectedSubtype(subtypeName);
    setActivities([]);
    setCurrentOffset(0);
    setHasMore(true);
    setConsecutiveEmptyResponses(0);
    // Don't call loadActivities here - it will be called by useEffect
  };

  const renderSubtypeCard = ({ item }: { item: Subtype }) => {
    const imageKey = getActivityImageKey(item.name, item.code);
    const imageSource = getActivityImageByKey(imageKey);

    return (
      <TouchableOpacity
        style={styles.subtypeCard}
        onPress={() => selectSubtype(item.name)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          <Image source={imageSource} style={styles.subtypeImage} />
        </View>
        <View style={styles.subtypeContent}>
          <Text style={styles.subtypeName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.subtypeCount}>
            {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <ActivityCard
      activity={item}
      onPress={() => {
        const serializedActivity = {
          ...item,
          dateRange: item.dateRange ? {
            start: typeof item.dateRange.start === 'string'
              ? item.dateRange.start
              : item.dateRange.start?.toISOString?.() || '',
            end: typeof item.dateRange.end === 'string'
              ? item.dateRange.end
              : item.dateRange.end?.toISOString?.() || '',
          } : null,
          scrapedAt: item.scrapedAt
            ? (typeof item.scrapedAt === 'string'
              ? item.scrapedAt
              : item.scrapedAt?.toISOString?.() || null)
            : null,
        };
        navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
      }}
    />
  );

  const getActiveFilters = () => {
    // Since we're not applying preference filters when browsing by activity type,
    // we don't show them in the UI either
    return [];
  };

  const renderHeader = () => {
    const activeFilters = getActiveFilters();

    // If showing activities list
    if (selectedSubtype !== undefined) {
      return (
        <View style={styles.resultsHeader}>
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsCount}>
              {totalCount} {totalCount === 1 ? 'result' : 'results'}
            </Text>
            <Text style={styles.resultsSubtitle}>
              {selectedSubtype || `All ${typeName}`}
            </Text>
          </View>

          {activeFilters.length > 0 && (
            <View style={styles.filtersContainer}>
              <Icon name="filter-outline" size={16} color="#717171" />
              <Text style={styles.filtersText} numberOfLines={1}>
                {activeFilters.join(' • ')}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Show subtypes selection
    return null;
  };

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#FF385C" />
          <Text style={styles.loadingMoreText}>Loading more activities...</Text>
        </View>
      );
    }

    if (!hasMore && activities.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <Text style={styles.endText}>You've reached the end</Text>
          <Text style={styles.footerText}>
            Showing all {activities.length} activities
          </Text>
        </View>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF385C" />
        <Text style={styles.loadingText}>Loading {typeName} activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={60} color="#FF385C" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadTypeDetails()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show subtypes selection screen
  if (selectedSubtype === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#222222" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{typeName}</Text>
        </View>

        {/* Subtypes Grid */}
        <FlatList
          key="subtypes-grid"
          data={subtypes}
          renderItem={renderSubtypeCard}
          keyExtractor={(item) => item.code}
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTypeDetails()}
              colors={['#FF385C']}
              tintColor="#FF385C"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => selectSubtype(null)}
                activeOpacity={0.7}
              >
                <Icon name="view-list" size={20} color="#FF385C" />
                <Text style={styles.viewAllText}>View All {typeName}</Text>
                <Text style={styles.viewAllCount}>({totalCount} activities)</Text>
                <Icon name="chevron-right" size={20} color="#717171" />
              </TouchableOpacity>
              <Text style={styles.subtitle}>
                Browse by category
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  // Show activities list
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedSubtype(undefined)}
        >
          <Icon name="arrow-left" size={24} color="#222222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {selectedSubtype || `All ${typeName}`}
        </Text>
      </View>

      <FlatList
        key="activities-list"
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF385C']}
            tintColor="#FF385C"
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !isLoading && !refreshing ? (
            <View style={styles.emptyContainer}>
              <Icon name="magnify-remove-outline" size={60} color="#717171" />
              <Text style={styles.emptyText}>No activities found</Text>
              {selectedSubtype && (
                <Text style={styles.emptySubtext}>
                  Try selecting a different category or view all activities
                </Text>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222222',
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginLeft: 12,
    flex: 1,
  },
  viewAllCount: {
    fontSize: 14,
    color: '#717171',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#717171',
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  subtypeCard: {
    width: '48%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F0F0F0',
  },
  subtypeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  subtypeContent: {
    padding: 12,
  },
  subtypeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  subtypeCount: {
    fontSize: 13,
    color: '#717171',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  resultsInfo: {
    marginBottom: 8,
  },
  resultsCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#717171',
    marginTop: 4,
  },
  filtersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  filtersText: {
    fontSize: 13,
    color: '#717171',
    marginLeft: 6,
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 16,
    color: '#717171',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#222222',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF385C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#717171',
    marginTop: 4,
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#717171',
  },
  endText: {
    fontSize: 14,
    color: '#222222',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#222222',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#717171',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ActivityTypeDetailScreen;