import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import { Activity } from '../types';
import { ActivitySearchParams } from '../types/api';
import ActivityCard from '../components/ActivityCard';

type SearchResultsRouteProp = RouteProp<{
  SearchResults: {
    filters: ActivitySearchParams;
    searchQuery?: string;
  };
}, 'SearchResults'>;

const SearchResultsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<SearchResultsRouteProp>();
  const { filters, searchQuery } = route.params;
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  
  const activityService = ActivityService.getInstance();
  const favoritesService = FavoritesService.getInstance();

  useEffect(() => {
    loadInitialResults();
    loadFavorites();
  }, []);

  const loadFavorites = () => {
    try {
      const favorites = favoritesService.getFavorites();
      const ids = new Set(favorites.map(fav => fav.activityId));
      setFavoriteIds(ids);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadInitialResults = async () => {
    try {
      setLoading(true);
      console.log('Searching with filters:', filters);
      
      const results = await activityService.searchActivitiesPaginated(filters, 1, 20);
      setActivities(results.activities || []);
      setTotalCount(results.total || 0);
      setHasMore((results.activities?.length || 0) >= 20);
      setPage(1);
    } catch (error) {
      console.error('Search error:', error);
      setActivities([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreResults = async () => {
    if (!hasMore || refreshing) return;

    try {
      setRefreshing(true);
      const nextPage = page + 1;
      const results = await activityService.searchActivitiesPaginated(filters, nextPage, 20);
      
      if (results.activities && results.activities.length > 0) {
        setActivities(prev => [...prev, ...results.activities]);
        setPage(nextPage);
        setHasMore(results.activities.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Load more error:', error);
      setHasMore(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitialResults();
    setRefreshing(false);
  };

  const toggleFavorite = async (activity: Activity) => {
    try {
      const isCurrentlyFavorite = favoriteIds.has(activity.id);
      
      if (isCurrentlyFavorite) {
        await favoritesService.removeFavorite(activity.id);
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(activity.id);
          return newSet;
        });
      } else {
        await favoritesService.addFavorite(activity);
        setFavoriteIds(prev => new Set([...prev, activity.id]));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleActivityPress = (activity: Activity) => {
    // Serialize dates for navigation
    const serializedActivity = {
      ...activity,
      dateRange: activity.dateRange ? {
        start: activity.dateRange.start.toISOString(),
        end: activity.dateRange.end.toISOString(),
      } : null,
      scrapedAt: activity.scrapedAt.toISOString(),
    };
    
    navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
  };

  const handleBackToSearch = () => {
    // Navigate back to dashboard
    navigation.goBack();
    
    // Use a timeout to ensure we're back on dashboard before opening search modal
    setTimeout(() => {
      // Emit event to re-open search modal
      // This would require implementing an event system or navigation params
      // For now, user can tap search again to re-open
    }, 100);
  };

  const getSearchSummary = () => {
    const parts = [];
    
    if (filters.search) {
      parts.push(`"${filters.search}"`);
    }
    
    if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
      parts.push(`${filters.daysOfWeek.join(', ')}`);
    }
    
    if (filters.location) {
      parts.push(filters.location);
    }
    
    if (filters.costMin !== undefined || filters.costMax !== undefined) {
      if (filters.costMin && filters.costMax) {
        parts.push(`$${filters.costMin}-$${filters.costMax}`);
      } else if (filters.costMin) {
        parts.push(`$${filters.costMin}+`);
      } else if (filters.costMax) {
        parts.push(`Under $${filters.costMax}`);
      }
    }
    
    if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
      if (filters.ageMin && filters.ageMax) {
        parts.push(`Ages ${filters.ageMin}-${filters.ageMax}`);
      }
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'All activities';
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="magnify" size={64} color="#CCCCCC" />
      <Text style={styles.emptyTitle}>No activities found</Text>
      <Text style={styles.emptySubtitle}>
        Try adjusting your search filters or search for different activities
      </Text>
      <TouchableOpacity style={styles.newSearchButton} onPress={handleBackToSearch}>
        <Text style={styles.newSearchButtonText}>Refine Search</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingFooter = () => {
    if (!refreshing) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FF385C" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF385C" />
          <Text style={styles.loadingText}>Searching activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToSearch} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#222222" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Search Results</Text>
          <Text style={styles.headerSubtitle}>{getSearchSummary()}</Text>
        </View>
        
        <TouchableOpacity onPress={handleBackToSearch} style={styles.editButton}>
          <Icon name="tune" size={24} color="#FF385C" />
        </TouchableOpacity>
      </View>

      {/* Results Count */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsCount}>
          {totalCount} {totalCount === 1 ? 'activity' : 'activities'} found
        </Text>
      </View>

      {/* Results List */}
      {activities.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.activityCardWrapper}>
              <ActivityCard
                activity={item}
                onPress={() => handleActivityPress(item)}
                isFavorite={favoriteIds.has(item.id)}
                onToggleFavorite={() => toggleFavorite(item)}
                showPrice={true}
                showLocation={true}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing && page === 1}
              onRefresh={handleRefresh}
              tintColor="#FF385C"
              colors={['#FF385C']}
            />
          }
          onEndReached={loadMoreResults}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderLoadingFooter}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222222',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#717171',
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  resultsInfo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F7F7F7',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  listContainer: {
    paddingBottom: 20,
  },
  activityCardWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#222222',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  newSearchButton: {
    backgroundColor: '#FF385C',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  newSearchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
});

export default SearchResultsScreen;