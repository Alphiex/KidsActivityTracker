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
import ScreenBackground from '../components/ScreenBackground';
import EmptyState from '../components/EmptyState';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityCard from '../components/ActivityCard';
import { Activity } from '../types';
import ActivityService, { ChildBasedFilterParams } from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import childPreferencesService from '../services/childPreferencesService';
import { selectAllChildren, selectSelectedChildIds, selectFilterMode, fetchChildren } from '../store/slices/childrenSlice';
import { fetchChildFavorites, fetchChildWatching } from '../store/slices/childFavoritesSlice';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import FavoritesService from '../services/favoritesService';
import { useAppSelector, useAppDispatch } from '../store';
import TopTabNavigation from '../components/TopTabNavigation';
import useWaitlistSubscription from '../hooks/useWaitlistSubscription';
import UpgradePromptModal from '../components/UpgradePromptModal';

// Header images with fallback
const HeaderImages: Record<string, any> = {
  search: require('../assets/images/search-header.png'),
  recommended: require('../assets/images/recommended-header.jpg'),
  favorites: require('../assets/images/favorites-header.png'),
  new: require('../assets/images/new-header.png'),
  browse: require('../assets/images/browse-header.png'),
  budget: require('../assets/images/budget-friendly-header.jpg'),
  activityType: require('../assets/images/browse-activity-types-header.png'),
  ageGroup: require('../assets/images/browse-age-groups-header.jpg'),
  ai: require('../assets/images/recommended-header.jpg'),
};

// Default fallback image
const DefaultHeaderImage = require('../assets/images/browse-header.png');

const { width, height } = Dimensions.get('window');

type RouteParams = {
  UnifiedResults: {
    type?: 'budget' | 'new' | 'recommended' | 'activityType' | 'ageGroup' | 'favorites' | 'ai';
    title?: string;
    subtitle?: string;
    activityType?: string;
    subtype?: string;
    ageMin?: number;
    ageMax?: number;
    ageGroupName?: string;
    activityIds?: string[]; // For AI recommendations
    fromScreen?: string; // Track where we came from for back navigation
  };
};

const UnifiedResultsScreenTest: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'UnifiedResults'>>();
  const dispatch = useAppDispatch();

  // Ensure children are loaded into Redux on mount
  useEffect(() => {
    dispatch(fetchChildren());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activityIds = route?.params?.activityIds;
  const fromScreen = route?.params?.fromScreen;
  const type = activityIds ? 'ai' : (route?.params?.type || 'budget');
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

  // Child filter state for consistent filtering
  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const filterMode = useAppSelector(selectFilterMode);

  // Get selected children for filtering
  const selectedChildren = useMemo(() => {
    if (selectedChildIds.length === 0) {
      return children; // If none selected, use all children
    }
    return children.filter(c => selectedChildIds.includes(c.id));
  }, [children, selectedChildIds]);

  // Calculate child-based filters using the shared service
  const getChildBasedFilters = React.useCallback((): ChildBasedFilterParams | undefined => {
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
      filterMode,
      mergedFilters,
    };
  }, [selectedChildren, filterMode]);

  // Subscription-aware waitlist
  const {
    canAddToWaitlist,
    onWaitlistLimitReached,
    showUpgradeModal: showWaitlistUpgradeModal,
    hideUpgradeModal: hideWaitlistUpgradeModal,
  } = useWaitlistSubscription();

  const getConfig = () => {
    if (type === 'favorites') {
      return {
        title: 'Your Favourites',
        image: HeaderImages.favorites || DefaultHeaderImage,
        isFavorites: true,
      };
    }

    if (type === 'activityType') {
      return {
        title: customTitle || subtype || activityType || 'Activities',
        image: HeaderImages.activityType || DefaultHeaderImage,
      };
    }

    if (type === 'ageGroup') {
      return {
        title: customTitle || ageGroupName || 'Age Group',
        image: HeaderImages.ageGroup || DefaultHeaderImage,
      };
    }

    const configMap: Record<string, { title: string; image: any }> = {
      budget: {
        title: 'Budget Friendly',
        image: HeaderImages.budget || DefaultHeaderImage,
      },
      new: {
        title: 'New This Week',
        image: HeaderImages.new || DefaultHeaderImage,
      },
      recommended: {
        title: 'Recommended for You',
        image: HeaderImages.recommended || DefaultHeaderImage,
      },
      ai: {
        title: customTitle || 'AI Recommendations',
        image: HeaderImages.ai || DefaultHeaderImage,
      },
    };

    return configMap[type] || { title: 'Activities', image: DefaultHeaderImage };
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

      // Get global preferences for filtering
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      const activeFilters = preferencesService.getActiveFilters();

      if (type === 'ai' && activityIds && activityIds.length > 0) {
        // Load AI-recommended activities by IDs
        const activityService = ActivityService.getInstance();

        // Fetch full activity details for each ID
        const activityPromises = activityIds.map(async (id) => {
          try {
            const activity = await activityService.getActivityDetails(id);
            return activity;
          } catch (error) {
            console.error(`Error loading activity ${id}:`, error);
            return null;
          }
        });
        const fetchedActivities = await Promise.all(activityPromises);
        const validActivities = fetchedActivities.filter((a): a is Activity => a !== null);

        setActivities(validActivities);
        setTotalCount(validActivities.length);
        setHasMore(false); // AI results don't paginate
      } else if (type === 'favorites') {
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
        };

        // Apply global hide preferences
        if (preferences.hideFullActivities) {
          baseParams.hideFullActivities = true;
        }
        if (preferences.hideClosedActivities) {
          baseParams.hideClosedActivities = true;
        }
        if (preferences.hideClosedOrFull) {
          baseParams.hideClosedOrFull = true;
        }

        // Apply global active filters (from search screen)
        if (activeFilters && Object.keys(activeFilters).length > 0) {
          Object.assign(baseParams, activeFilters);
        }

        // Apply type-specific filters
        if (type === 'budget') {
          // Budget friendly - uses fixed max cost, don't apply price filters
          baseParams.maxCost = preferences.maxBudgetFriendlyAmount || 20;
        } else if (type === 'new') {
          baseParams.sortBy = 'createdAt';
          baseParams.sortOrder = 'desc';
          // New this week - calculate date for one week ago
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          baseParams.createdAfter = oneWeekAgo.toISOString();
        } else if (type === 'activityType') {
          if (activityType) {
            baseParams.categories = activityType;
          }
          if (subtype) {
            baseParams.activitySubtype = subtype;
          }
        } else if (type === 'ageGroup') {
          if (ageMin !== undefined) {
            baseParams.ageMin = ageMin;
          }
          if (ageMax !== undefined) {
            baseParams.ageMax = ageMax;
          }
        }
        // Child-based filters handle all preference filtering (activity types, age, location, etc.)

        console.log(`[UnifiedResults] Loading ${type} with filters:`, baseParams);

        // Get child-based filters for consistent filtering across all screens
        const childFilters = getChildBasedFilters();

        const activityService = ActivityService.getInstance();
        const response = await activityService.searchActivitiesPaginated(baseParams, childFilters);

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
      console.error('[UnifiedResults] Error loading activities:', error);
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
      // Refresh child favorites/watching data for icon colors
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        dispatch(fetchChildFavorites(childIds));
        dispatch(fetchChildWatching(childIds));
      }
    }, [type, children.length, dispatch])
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

  const renderActivity = ({ item }: { item: Activity }) => {
    if (!item || !item.id) return null;
    const isFavorite = favoriteIds.has(item.id);
    return (
      <ActivityCard
        activity={item}
        onPress={() => navigation.navigate('ActivityDetail', { activity: item })}
        variant="default"
        isFavorite={isFavorite}
        onFavoritePress={() => toggleFavorite(item)}
        imageHeight={90}
        canAddToWaitlist={canAddToWaitlist}
        onWaitlistLimitReached={onWaitlistLimitReached}
      />
    );
  };

  // Get hidden filter sections based on screen type
  const getHiddenFilterSections = (): string[] => {
    // AI Match is always hidden on all filter screens
    const baseHidden = ['aiMatch'];

    switch (type) {
      case 'budget':
        // Budget screen: hide cost/budget filter since it's already applied
        return [...baseHidden, 'budget'];
      case 'activityType':
        // Activity type screen: hide activity types filter since it's already applied
        return [...baseHidden, 'activityTypes'];
      case 'ageGroup':
        // Age group screen: hide age filter since it's already applied
        return [...baseHidden, 'age'];
      default:
        // For recommended, new, ai screens: show all except AI Match
        return baseHidden;
    }
  };

  const handleFilterPress = () => {
    navigation.navigate('Filters' as never, {
      hiddenSections: getHiddenFilterSections(),
      screenTitle: config?.title || 'Filters',
    } as never);
  };

  const renderHeader = () => {
    if (!config) return null;

    const isFavoritesScreen = type === 'favorites';

    return (
      <View style={styles.headerContainer}>
        <ImageBackground
          source={config.image}
          style={[styles.heroSection, isFavoritesScreen && styles.heroSectionShort]}
          imageStyle={isFavoritesScreen ? styles.heroImageStyleFlat : styles.heroImageStyle}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
            style={isFavoritesScreen ? styles.heroGradientFlat : styles.heroGradient}
          >
            {/* Back Button and Filter - hidden for favorites since it's accessed from bottom tab */}
            {!isFavoritesScreen && (
              <View style={styles.heroTopRow}>
                <TouchableOpacity style={styles.backButtonHero} onPress={() => navigation.goBack()}>
                  <View style={styles.backButtonInner}>
                    <Icon name="arrow-left" size={22} color="#333" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterButtonHero} onPress={handleFilterPress}>
                  <View style={styles.backButtonInner}>
                    <Icon name="tune" size={22} color="#E8638B" />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Title and Count */}
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{String(config.title || '')}</Text>
            </View>
            <View style={styles.countBadgeRow}>
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

  const isFavoritesScreen = type === 'favorites';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground>
        {/* Show TopTabNavigation for favorites (accessed from bottom tab) */}
        {isFavoritesScreen && <TopTabNavigation />}

        {/* Fixed Header */}
        {renderHeader()}

        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
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
            <EmptyState
              icon="magnify"
              title="No activities found"
              subtitle="Try adjusting your search or filters"
            />
          }
        />
      </ScreenBackground>

      {/* Upgrade Modal for notifications (premium feature) */}
      <UpgradePromptModal
        visible={showWaitlistUpgradeModal}
        feature="notifications"
        onClose={hideWaitlistUpgradeModal}
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
  headerContainer: {
    marginBottom: ModernSpacing.md,
  },
  heroSection: {
    height: height * 0.22,
    width: '100%',
  },
  heroSectionShort: {
    height: height * 0.14,
    marginHorizontal: -16,
    width: width,
  },
  heroImageStyle: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroImageStyleFlat: {
    borderRadius: 0,
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
  heroGradientFlat: {
    flex: 1,
    paddingTop: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    paddingBottom: ModernSpacing.md,
    justifyContent: 'flex-end',
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
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  countBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
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