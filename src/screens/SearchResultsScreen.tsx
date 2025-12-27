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
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import { Activity } from '../types';
import { ActivitySearchParams } from '../types/api';
import ActivityCard from '../components/ActivityCard';
import { useTheme } from '../contexts/ThemeContext';
import { safeToISOString } from '../utils/safeAccessors';

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
  const { colors, isDark } = useTheme();
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
      
      const searchParams = {
        ...filters,
        limit: 20,
        offset: 0,
      };
      
      const results = await activityService.searchActivitiesPaginated(searchParams);
      
      if (results && results.items) {
        setActivities(results.items);
        setTotalCount(results.total || 0);
        setHasMore(results.items.length >= 20);
        setPage(1);
        console.log(`Loaded ${results.items.length} activities, total: ${results.total}`);
      } else {
        setActivities([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setActivities([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreResults = async () => {
    if (!hasMore || loadingMore || refreshing) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const searchParams = {
        ...filters,
        limit: 20,
        offset: (nextPage - 1) * 20,
      };
      
      const results = await activityService.searchActivitiesPaginated(searchParams);
      
      if (results && results.items && results.items.length > 0) {
        setActivities(prev => [...prev, ...results.items]);
        setPage(nextPage);
        setHasMore(results.items.length >= 20);
        console.log(`Loaded ${results.items.length} more activities, total loaded: ${activities.length + results.items.length}`);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Load more error:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
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
    // Serialize dates for navigation (safely handle undefined/null dates)
    const serializedActivity = {
      ...activity,
      dateRange: activity.dateRange ? {
        start: safeToISOString(activity.dateRange.start),
        end: safeToISOString(activity.dateRange.end),
      } : null,
      scrapedAt: safeToISOString(activity.scrapedAt),
    };

    navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
  };

  const handleBackToSearch = () => {
    navigation.goBack();
  };

  const getActiveFiltersText = () => {
    const activeFilters = [];
    
    if (searchQuery && searchQuery.trim()) {
      activeFilters.push(`"${searchQuery.trim()}"`);
    }
    
    if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
      activeFilters.push(filters.daysOfWeek.join(', '));
    }
    
    if (filters.activityTypes && filters.activityTypes.length > 0) {
      const count = filters.activityTypes.length;
      activeFilters.push(`${count} activity type${count > 1 ? 's' : ''}`);
    }
    
    if (filters.costMin !== undefined || filters.costMax !== undefined) {
      if (filters.costMin && filters.costMax) {
        activeFilters.push(`$${filters.costMin}-$${filters.costMax}`);
      } else if (filters.costMin) {
        activeFilters.push(`$${filters.costMin}+`);
      } else if (filters.costMax) {
        activeFilters.push(`Under $${filters.costMax}`);
      }
    }
    
    if (filters.location || (filters.locations && filters.locations.length > 0)) {
      const locations = filters.location ? [filters.location] : (filters.locations || []);
      if (locations.length === 1) {
        activeFilters.push(locations[0]);
      } else if (locations.length > 1) {
        activeFilters.push(`${locations.length} cities`);
      }
    }
    
    if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
      if (filters.ageMin && filters.ageMax) {
        activeFilters.push(`Ages ${filters.ageMin}-${filters.ageMax}`);
      }
    }
    
    return activeFilters.length > 0 ? activeFilters.join(' • ') : 'All activities';
  };

  const renderLoadingFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FF385C" />
        <Text style={styles.loadingFooterText}>Loading more activities...</Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="magnify-close" size={80} color="#DDDDDD" />
      <Text style={styles.emptyTitle}>No activities found</Text>
      <Text style={styles.emptySubtitle}>
        Try adjusting your search filters or search for different activities
      </Text>
      <TouchableOpacity style={styles.refineSearchButton} onPress={handleBackToSearch}>
        <Text style={styles.refineSearchButtonText}>Refine Search</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF385C" />
          <Text style={styles.loadingText}>Finding activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button and title */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToSearch} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#222222" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Search Results</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {getActiveFiltersText()}
          </Text>
        </View>
        
        <TouchableOpacity onPress={handleBackToSearch} style={styles.filterButton}>
          <Icon name="tune" size={24} color="#FF385C" />
        </TouchableOpacity>
      </View>

      {/* Results count bar */}
      <View style={styles.resultsCountBar}>
        <Text style={styles.resultsCount}>
          {totalCount.toLocaleString()} {totalCount === 1 ? 'activity' : 'activities'} found
        </Text>
      </View>

      {/* Results list */}
      {activities.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.activityCardContainer}>
              <ActivityCard
                activity={item}
                onPress={() => handleActivityPress(item)}
                isFavorite={favoriteIds.has(item.id)}
                onFavoritePress={() => toggleFavorite(item)}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF385C"
              colors={['#FF385C']}
            />
          }
          onEndReached={loadMoreResults}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderLoadingFooter}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
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
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#717171',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 18,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  resultsCountBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  listContent: {
    paddingBottom: 20,
  },
  activityCardContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingFooterText: {
    fontSize: 14,
    color: '#717171',
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#222222',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  refineSearchButton: {
    backgroundColor: '#FF385C',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: '#FF385C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  refineSearchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SearchResultsScreen;