import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityCard from '../components/ActivityCard';
import { Activity } from '../types';
import ActivityService from '../services/activityService';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import FavoritesService from '../services/favoritesService';
import { useAppSelector } from '../store';

// Header images
const HeaderImages = {
  search: require('../assets/images/search-header.png'),
  recommended: require('../assets/images/recommended-header.png'),
  favorites: require('../assets/images/favorites-header.png'),
  new: require('../assets/images/new-header.png'),
  browse: require('../assets/images/browse-header.png'),
};

const { width, height } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2; // 16px padding on each side, gap between cards

type RouteParams = {
  UnifiedResults: {
    type: 'budget' | 'new' | 'recommended' | 'activityType' | 'ageGroup' | 'favorites';
    title?: string;
    subtitle?: string;
    activityType?: string;
    subtype?: string;
    ageMin?: number;
    ageMax?: number;
    ageGroupName?: string;
  };
};

const UnifiedResultsScreenTest: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'UnifiedResults'>>();

  const type = route?.params?.type || 'budget';
  const customTitle = route?.params?.title;
  const customSubtitle = route?.params?.subtitle;
  const activityType = route?.params?.activityType;
  const subtype = route?.params?.subtype;
  const ageMin = route?.params?.ageMin;
  const ageMax = route?.params?.ageMax;
  const ageGroupName = route?.params?.ageGroupName;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const ITEMS_PER_PAGE = 50;

  const user = useAppSelector((state) => state.auth?.user);

  const getConfig = () => {
    if (type === 'favorites') {
      return {
        title: 'Your Favorites',
        image: HeaderImages.favorites,
        isFavorites: true,
      };
    }

    if (type === 'activityType') {
      return {
        title: customTitle || subtype || activityType || 'Activities',
        image: HeaderImages.browse,
      };
    }

    if (type === 'ageGroup') {
      return {
        title: customTitle || ageGroupName || 'Age Group',
        image: HeaderImages.browse,
      };
    }

    const configMap: Record<string, { title: string; image: any }> = {
      budget: {
        title: 'Budget Friendly',
        image: HeaderImages.browse,
      },
      new: {
        title: 'New This Week',
        image: HeaderImages.new,
      },
      recommended: {
        title: 'Recommended for You',
        image: HeaderImages.recommended,
      },
    };

    return configMap[type] || configMap.budget;
  };

  const config = getConfig();

  const loadActivities = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
        setCurrentOffset(0);
      } else {
        setLoadingMore(true);
      }

      if (type === 'favorites') {
        // Load favorite activities (no pagination for favorites)
        if (!user) {
          setActivities([]);
          setTotalCount(0);
          setHasMore(false);
          return;
        }

        const favoritesService = FavoritesService.getInstance();
        const favorites = await favoritesService.getFavorites();
        const activityService = ActivityService.getInstance();

        // Load full activity details for each favorite
        const activityPromises = favorites.map(async (fav) => {
          try {
            const activity = await activityService.getActivityDetails(fav.activityId);
            return activity;
          } catch (error) {
            console.error(`Error loading activity ${fav.activityId}:`, error);
            return null;
          }
        });
        const favoriteActivities = await Promise.all(activityPromises);
        const validActivities = favoriteActivities.filter((a): a is Activity => a !== null);

        setActivities(validActivities);
        setTotalCount(validActivities.length);
        setHasMore(false); // Favorites don't paginate
        // All favorites screen activities are already favorites
        setFavoriteIds(new Set(validActivities.map(a => a.id)));
      } else {
        const offset = isLoadMore ? currentOffset : 0;
        const baseParams: any = {
          limit: ITEMS_PER_PAGE,
          offset: offset,
          hideFullActivities: true,
        };

        if (type === 'budget') {
          baseParams.maxCost = 20;
        } else if (type === 'new') {
          baseParams.sortBy = 'createdAt';
          baseParams.sortOrder = 'desc';
        } else if (type === 'activityType') {
          if (activityType) {
            baseParams.activityType = activityType;
          }
          if (subtype) {
            baseParams.subtype = subtype;
          }
        } else if (type === 'ageGroup') {
          if (ageMin !== undefined) {
            baseParams.ageMin = ageMin;
          }
          if (ageMax !== undefined) {
            baseParams.ageMax = ageMax;
          }
        }

        const activityService = ActivityService.getInstance();
        const response = await activityService.searchActivitiesPaginated(baseParams);

        if (response && response.items) {
          if (isLoadMore) {
            setActivities(prev => [...prev, ...response.items]);
          } else {
            setActivities(response.items);
          }
          setTotalCount(response.total || 0);
          setHasMore(response.hasMore);
          setCurrentOffset(offset + response.items.length);
        } else {
          if (!isLoadMore) {
            setActivities([]);
            setTotalCount(0);
          }
          setHasMore(false);
        }
      }
    } catch (error) {
      if (!isLoadMore) {
        setActivities([]);
        setTotalCount(0);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadActivities(true);
    }
  };

  // Use focus effect to reload favorites when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      if (type === 'favorites') {
        loadActivities();
      }
      loadFavorites();
    }, [type])
  );

  // Initial load
  useEffect(() => {
    loadActivities();
    loadFavorites();
  }, [type]);

  const loadFavorites = async () => {
    if (!user) return;
    try {
      const favoritesService = FavoritesService.getInstance();
      const favorites = await favoritesService.getFavorites();
      setFavoriteIds(new Set(favorites.map(f => f.activityId)));
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = (activity: Activity) => {
    if (!user) return;
    try {
      const favoritesService = FavoritesService.getInstance();
      const isFavorite = favoriteIds.has(activity.id);

      if (isFavorite) {
        favoritesService.removeFavorite(activity.id);
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(activity.id);
          return newSet;
        });

        // If we're on the favorites screen, remove the activity from the list
        if (type === 'favorites') {
          setActivities(prev => prev.filter(a => a.id !== activity.id));
          setTotalCount(prev => prev - 1);
        }
      } else {
        favoritesService.addFavorite(activity);
        setFavoriteIds(prev => new Set(prev).add(activity.id));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadActivities();
    } finally {
      setRefreshing(false);
    }
  };

  const renderActivity = ({ item, index }: { item: Activity; index: number }) => {
    if (!item || !item.id) return null;
    const isFavorite = favoriteIds.has(item.id);
    return (
      <ActivityCard
        activity={item}
        onPress={() => navigation.navigate('ActivityDetail', { activity: item })}
        variant="default"
        isFavorite={isFavorite}
        onFavoritePress={() => toggleFavorite(item)}
        containerStyle={{
          width: CARD_WIDTH,
          marginRight: index % 2 === 0 ? CARD_GAP : 0,
        }}
      />
    );
  };

  const renderHeader = () => {
    if (!config) return null;

    return (
      <View style={styles.headerContainer}>
        <ImageBackground
          source={config.image}
          style={styles.heroSection}
          imageStyle={styles.heroImageStyle}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
            style={styles.heroGradient}
          >
            {/* Back Button */}
            <TouchableOpacity style={styles.backButtonHero} onPress={() => navigation.goBack()}>
              <View style={styles.backButtonInner}>
                <Icon name="arrow-left" size={22} color="#333" />
              </View>
            </TouchableOpacity>

            {/* Title and Count */}
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{String(config.title || '')}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countNumber}>{totalCount.toLocaleString()}</Text>
                <Text style={styles.countLabel}>activities</Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Finding activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={ModernColors.primary} />
          <Text style={styles.loadingMoreText}>Loading more activities...</Text>
        </View>
      );
    }
    if (!hasMore && activities.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>All {totalCount} activities loaded</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ModernColors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="magnify-off" size={80} color={ModernColors.border} />
            <Text style={styles.emptyTitle}>No activities found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  headerContainer: {
    marginBottom: ModernSpacing.md,
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
    paddingTop: ModernSpacing.xl,
    paddingHorizontal: ModernSpacing.lg,
    paddingBottom: ModernSpacing.lg,
    justifyContent: 'space-between',
  },
  backButtonHero: {
    alignSelf: 'flex-start',
  },
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: ModernSpacing.md,
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.textSecondary,
  },
  emptyContainer: {
    padding: ModernSpacing.xxl * 2,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: ModernSpacing.lg,
  },
  footerLoader: {
    paddingVertical: ModernSpacing.lg,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: ModernSpacing.sm,
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
  footerContainer: {
    paddingVertical: ModernSpacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
});

export default UnifiedResultsScreenTest;