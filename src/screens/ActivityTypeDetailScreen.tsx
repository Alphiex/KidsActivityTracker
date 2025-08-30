import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import ActivityTypeService from '../services/activityTypeService';
import PreferencesService from '../services/preferencesService';
import LoadingIndicator from '../components/LoadingIndicator';
import ActivityCard from '../components/ActivityCard';
import { Colors } from '../theme';
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
  const { typeCode, typeName } = route.params as { typeCode: string; typeName: string };
  
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
  
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    navigation.setOptions({
      title: typeName,
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('AllActivityTypes')}
          style={{ marginRight: 15 }}
        >
          <Icon name="apps" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
    loadTypeDetails();
  }, [navigation, typeName]);

  // Load activities when selectedSubtype changes (but not on initial mount)
  useEffect(() => {
    if (selectedSubtype !== undefined && !isLoading) {
      loadActivities(true);
    }
  }, [selectedSubtype]);

  const loadTypeDetails = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      
      // Get type details with subtypes from the API
      const types = await activityService.getActivityTypesWithCounts();
      const currentType = types.find(t => t.name === typeName);
      
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
        setTotalCount(currentType.activityCount);
      } else {
        // Fallback to old method if needed
        const activityTypeService = ActivityTypeService.getInstance();
        const typeInfo = await activityTypeService.getActivityTypeWithSubtypes(typeName);
        
        const subtypesWithCounts = typeInfo.subtypes
          .filter(s => s.count > 0)
          .map(subtype => ({
            code: subtype.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name: subtype.name,
            activityCount: subtype.count
          }))
          .sort((a, b) => b.activityCount - a.activityCount);
        
        setSubtypes(subtypesWithCounts);
        setTotalCount(typeInfo.totalCount);
      }
      
      // Don't load activities here - they will be loaded when selectedSubtype is set
    } catch (err: any) {
      console.error('Error loading type details:', err);
      setError(err.message || 'Failed to load activity type details');
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
        activityType: typeName, // Use exact type name from database
        limit: ITEMS_PER_PAGE,
        offset: isRefresh ? 0 : currentOffset,
      };
      
      // Apply global filters
      if (preferences.hideClosedActivities) {
        filters.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        filters.hideFullActivities = true;
      }
      
      // If a subtype is selected, filter by it (using exact subtype name)
      if (selectedSubtype) {
        filters.activitySubtype = selectedSubtype;
      }
      
      console.log('ActivityTypeDetailScreen: Searching with filters:', filters);
      const response = await activityService.searchActivitiesPaginated(filters);
      console.log('ActivityTypeDetailScreen: Response:', {
        itemCount: response.items?.length,
        total: response.total,
        firstItem: response.items?.[0]
      });
      
      if (response.items && response.items.length > 0) {
        allActivities.push(...response.items);
        setTotalCount(response.total || 0);
        setHasMore(response.hasMore);
      }
      
      if (isRefresh) {
        setActivities(allActivities);
        setCurrentOffset(ITEMS_PER_PAGE);
      } else {
        setActivities(prev => [...prev, ...allActivities]);
        setCurrentOffset(prev => prev + ITEMS_PER_PAGE);
      }
    } catch (err: any) {
      console.error('Error loading activities:', err);
      setError(err.message || 'Failed to load activities');
    } finally {
      setRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = async () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      await loadActivities(false);
    }
  };

  const onRefresh = () => {
    loadActivities(true);
  };

  const selectSubtype = (subtypeName: string | null) => {
    setSelectedSubtype(subtypeName);
    if (subtypeName !== undefined) {
      setActivities([]);
      setCurrentOffset(0);
      setHasMore(true);
      // Don't call loadActivities here - it will be called by useEffect
    }
  };

  const renderSubtypeCard = ({ item }: { item: Subtype }) => (
    <TouchableOpacity
      style={styles.subtypeCard}
      onPress={() => selectSubtype(item.name)}
      activeOpacity={0.7}
    >
      <View style={styles.subtypeCardContent}>
        <View style={styles.subtypeCardLeft}>
          <Icon name="category" size={40} color={Colors.primary} />
          <View style={styles.subtypeCardTextContainer}>
            <Text style={styles.subtypeCardTitle}>{item.name}</Text>
            <Text style={styles.subtypeCardCount}>
              {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={24} color={Colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  const renderActivity = ({ item }: { item: Activity }) => (
    <ActivityCard 
      activity={item}
      onPress={() => {
        const serializedActivity = {
          ...item,
          dateRange: item.dateRange ? {
            start: item.dateRange.start.toISOString(),
            end: item.dateRange.end.toISOString(),
          } : null,
          scrapedAt: item.scrapedAt ? item.scrapedAt.toISOString() : null,
        };
        navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
      }}
    />
  );

  const renderHeader = () => {
    // If showing activities list
    if (selectedSubtype !== undefined) {
      return (
        <View>
          <LinearGradient
            colors={['#673AB7', '#512DA8']}
            style={styles.header}
          >
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setSelectedSubtype(undefined)}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {selectedSubtype || `All ${typeName}`}
            </Text>
            <Text style={styles.headerSubtitle}>
              {totalCount} {totalCount === 1 ? 'activity' : 'activities'} available
            </Text>
          </LinearGradient>
        </View>
      );
    }

    // Show subtypes selection
    return (
      <View>
        <LinearGradient
          colors={['#673AB7', '#512DA8']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>{typeName}</Text>
          <Text style={styles.headerSubtitle}>
            Choose a category or view all activities
          </Text>
        </LinearGradient>
        
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => selectSubtype(null)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#4CAF50', '#45a049']}
            style={styles.viewAllGradient}
          >
            <Icon name="view-list" size={30} color="#fff" />
            <View style={styles.viewAllTextContainer}>
              <Text style={styles.viewAllTitle}>View All {typeName}</Text>
              <Text style={styles.viewAllCount}>{totalCount} activities</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

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

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading {typeName} activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadTypeDetails()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show subtypes selection screen
  if (selectedSubtype === undefined) {
    return (
      <View style={styles.container}>
        <FlatList
          data={subtypes}
          renderItem={renderSubtypeCard}
          keyExtractor={(item) => item.code}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTypeDetails()} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  // Show activities list
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
        ListEmptyComponent={
          !isLoading && !refreshing ? (
            <View style={styles.emptyContainer}>
              <Icon name="search-off" size={60} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No activities found</Text>
              {selectedSubtype && (
                <Text style={styles.emptySubtext}>
                  Try selecting a different subtype or view all activities
                </Text>
              )}
            </View>
          ) : null
        }
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  subtypesSection: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subtypesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 16,
    marginBottom: 12,
  },
  subtypesList: {
    paddingHorizontal: 16,
  },
  subtypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subtypeChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  subtypeText: {
    fontSize: 14,
    color: Colors.text,
    marginRight: 6,
  },
  subtypeTextSelected: {
    color: '#fff',
  },
  subtypeCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  subtypeCountSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#fff',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 30,
    padding: 8,
  },
  viewAllButton: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  viewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  viewAllTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  viewAllTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  viewAllCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  subtypeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  subtypeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  subtypeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subtypeCardTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  subtypeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  subtypeCardCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
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
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textSecondary,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ActivityTypeDetailScreen;