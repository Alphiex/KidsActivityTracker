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
import LoadingIndicator from '../components/LoadingIndicator';
import ActivityCard from '../components/ActivityCard';
import { Colors } from '../theme';
import { Activity } from '../types';

interface Subtype {
  code: string;
  name: string;
  activityCount: number;
}

const ActivityTypeDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { typeCode, typeName } = route.params as { typeCode: string; typeName: string };
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [subtypes, setSubtypes] = useState<Subtype[]>([]);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
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
    });
    loadTypeDetails();
  }, [navigation, typeName]);

  const loadTypeDetails = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      
      // Load type details including subtypes
      const details = await activityService.getActivityTypeDetails(typeCode);
      if (details && details.subtypes) {
        setSubtypes(details.subtypes);
        setTotalCount(details.totalActivities);
      }
      
      // Load initial activities
      await loadActivities(true);
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
      
      const filters: any = {
        activityType: typeName,
        limit: ITEMS_PER_PAGE,
        offset: isRefresh ? 0 : currentOffset,
      };
      
      // If a subtype is selected, filter by it
      if (selectedSubtype) {
        filters.activitySubtype = selectedSubtype;
      }
      
      const response = await activityService.searchActivitiesPaginated(filters);
      
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

  const selectSubtype = (subtypeCode: string | null) => {
    setSelectedSubtype(subtypeCode);
    setActivities([]);
    setCurrentOffset(0);
    setHasMore(true);
    loadActivities(true);
  };

  const renderSubtype = ({ item }: { item: Subtype }) => (
    <TouchableOpacity
      style={[
        styles.subtypeChip,
        selectedSubtype === item.name && styles.subtypeChipSelected
      ]}
      onPress={() => selectSubtype(selectedSubtype === item.name ? null : item.name)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.subtypeText,
        selectedSubtype === item.name && styles.subtypeTextSelected
      ]}>
        {item.name}
      </Text>
      <Text style={[
        styles.subtypeCount,
        selectedSubtype === item.name && styles.subtypeCountSelected
      ]}>
        {item.activityCount}
      </Text>
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

  const renderHeader = () => (
    <View>
      <LinearGradient
        colors={['#673AB7', '#512DA8']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>{typeName}</Text>
        <Text style={styles.headerSubtitle}>
          {totalCount} {totalCount === 1 ? 'activity' : 'activities'} available
        </Text>
      </LinearGradient>
      
      {subtypes.length > 0 && (
        <View style={styles.subtypesSection}>
          <Text style={styles.subtypesTitle}>Filter by Subtype</Text>
          <FlatList
            data={[{ code: 'all', name: 'All', activityCount: totalCount }, ...subtypes]}
            renderItem={({ item }) => 
              item.code === 'all' ? (
                <TouchableOpacity
                  style={[
                    styles.subtypeChip,
                    selectedSubtype === null && styles.subtypeChipSelected
                  ]}
                  onPress={() => selectSubtype(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.subtypeText,
                    selectedSubtype === null && styles.subtypeTextSelected
                  ]}>
                    All
                  </Text>
                  <Text style={[
                    styles.subtypeCount,
                    selectedSubtype === null && styles.subtypeCountSelected
                  ]}>
                    {totalCount}
                  </Text>
                </TouchableOpacity>
              ) : renderSubtype({ item })
            }
            keyExtractor={(item) => item.code}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subtypesList}
          />
        </View>
      )}
    </View>
  );

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
                  Try selecting a different subtype or clear the filter
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