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
  Dimensions,
  ImageBackground,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import { Activity } from '../types';
import { ActivitySearchParams } from '../types/api';
import ActivityCard from '../components/ActivityCard';
import { useTheme } from '../contexts/ThemeContext';
import { safeToISOString } from '../utils/safeAccessors';

const SearchHeaderImage = require('../assets/images/search-header.png');

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
      console.log('🔍 [SearchResultsScreen] loadInitialResults called');
      console.log('🔍 [SearchResultsScreen] filters received:', JSON.stringify(filters, null, 2));
      console.log('🔍 [SearchResultsScreen] searchQuery received:', searchQuery);
      
      const searchParams = {
        ...filters,
        limit: 20,
        offset: 0,
      };
      
      console.log('🔍 [SearchResultsScreen] searchParams to API:', JSON.stringify(searchParams, null, 2));
      
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
        <ActivityIndicator size="small" color="#E8638B" />
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
          <ActivityIndicator size="large" color="#E8638B" />
          <Text style={styles.loadingText}>Finding activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <ImageBackground
        source={SearchHeaderImage}
        style={styles.heroSection}
        imageStyle={styles.heroImageStyle}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
          style={styles.heroGradient}
        >
          {/* Back Button and Filter */}
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backButtonHero} onPress={handleBackToSearch}>
              <View style={styles.backButtonInner}>
                <Icon name="arrow-left" size={22} color="#333" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterButtonHero} onPress={handleBackToSearch}>
              <View style={styles.backButtonInner}>
                <Icon name="tune" size={22} color="#E8638B" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Title and Count */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Search Results</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countNumber}>{totalCount.toLocaleString()}</Text>
              <Text style={styles.countLabel}>activities</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Results list */}
      {activities.length === 0 ? (
        <>
          {renderHeader()}
          {renderEmptyState()}
        </>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={activities.length > 1 ? styles.columnWrapper : undefined}
          ListHeaderComponent={renderHeader}
          renderItem={({ item, index }) => (
            <ActivityCard
              activity={item}
              onPress={() => handleActivityPress(item)}
              isFavorite={favoriteIds.has(item.id)}
              onFavoritePress={() => toggleFavorite(item)}
              containerStyle={{
                width: CARD_WIDTH,
                marginRight: index % 2 === 0 ? CARD_GAP : 0,
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#E8638B"
              colors={['#E8638B']}
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
    backgroundColor: '#F8FAFC',
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
  headerContainer: {
    marginBottom: 12,
  },
  heroSection: {
    height: height * 0.28,
    width: '100%',
  },
  heroImageStyle: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroGradient: {
    flex: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonHero: {},
  filterButtonHero: {},
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E8638B',
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
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
    backgroundColor: '#E8638B',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: '#E8638B',
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