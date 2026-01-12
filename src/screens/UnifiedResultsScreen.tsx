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
import SearchFilterInput from '../components/SearchFilterInput';
import { Activity } from '../types';
import ActivityService, { ChildBasedFilterParams } from '../services/activityService';
import { Aggregations } from '../types/aggregations';
import PreferencesService from '../services/preferencesService';
import childPreferencesService from '../services/childPreferencesService';
import { selectAllChildren, selectSelectedChildIds, selectFilterMode, fetchChildren, ChildWithPreferences } from '../store/slices/childrenSlice';
import { fetchChildFavorites, fetchChildWatching } from '../store/slices/childFavoritesSlice';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import FavoritesService from '../services/favoritesService';
import { useAppSelector, useAppDispatch } from '../store';
import TopTabNavigation from '../components/TopTabNavigation';
import useWaitlistSubscription from '../hooks/useWaitlistSubscription';
import UpgradePromptModal from '../components/UpgradePromptModal';
import {
  ContextualFilters,
  createEmptyContextualFilters,
  hasActiveContextualFilters,
  applyContextualFiltersToParams,
} from '../types/filters';

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
    // Contextual filters returned from FiltersScreen
    appliedFilters?: ContextualFilters;
    returnKey?: string;
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
  const [aggregations, setAggregations] = useState<Aggregations | undefined>(undefined);
  const [filterText, setFilterText] = useState('');

  // Filter activities by search text (client-side filtering)
  const filteredActivities = useMemo(() => {
    if (!filterText.trim()) {
      return activities;
    }
    const searchLower = filterText.toLowerCase().trim();
    return activities.filter(activity => {
      const name = activity.name?.toLowerCase() || '';
      const location = activity.location?.toLowerCase() || '';
      const provider = activity.providerName?.toLowerCase() || '';
      const description = activity.description?.toLowerCase() || '';
      return (
        name.includes(searchLower) ||
        location.includes(searchLower) ||
        provider.includes(searchLower) ||
        description.includes(searchLower)
      );
    });
  }, [activities, filterText]);

  // Contextual filters - temporary filters for this screen only (NOT persisted to PreferencesService)
  // These are applied on top of child preferences to further filter results
  const [contextualFilters, setContextualFilters] = useState<ContextualFilters>(
    route?.params?.appliedFilters || createEmptyContextualFilters()
  );

  // Track if user has visited FiltersScreen to apply filters on subsequent loads
  const hasVisitedFiltersRef = React.useRef(false);

  // Track the last applied filters to detect changes and trigger reload
  const lastAppliedFiltersRef = React.useRef<string | null>(null);
  const [filtersChangedTrigger, setFiltersChangedTrigger] = React.useState(0);

  // Update contextual filters when they're returned from FiltersScreen
  useEffect(() => {
    if (route?.params?.appliedFilters) {
      const filtersKey = JSON.stringify(route.params.appliedFilters);
      // Only update and reload if filters actually changed
      if (filtersKey !== lastAppliedFiltersRef.current) {
        console.log('[UnifiedResults] Received NEW contextual filters from FiltersScreen:', route.params.appliedFilters);
        lastAppliedFiltersRef.current = filtersKey;
        setContextualFilters(route.params.appliedFilters);
        hasVisitedFiltersRef.current = true;
        // Trigger a reload by incrementing the trigger
        setFiltersChangedTrigger(prev => prev + 1);
      }
    }
  }, [route?.params?.appliedFilters]);


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

    console.log('[UnifiedResults] Child-based filters:', {
      selectedChildrenCount: selectedChildren.length,
      childPreferencesCount: childPreferences.length,
      childAges,
      calculatedAgeRange: `${mergedFilters.ageMin}-${mergedFilters.ageMax}`,
      activityTypes: mergedFilters.activityTypes?.length || 0,
      activityTypesRaw: mergedFilters.activityTypes,
      hasLocation: !!(mergedFilters.latitude && mergedFilters.longitude),
      city: mergedFilters.city,
      filterMode,
    });

    // Debug: Log each child's location data
    selectedChildren.forEach(c => {
      const addr = c.preferences?.savedAddress;
      let parsed = addr;
      if (typeof addr === 'string') {
        try { parsed = JSON.parse(addr); } catch (e) {}
      }
      console.log(`[UnifiedResults] 📍 ${c.name} location:`, {
        hasPrefs: !!c.preferences,
        rawType: typeof addr,
        city: (parsed as any)?.city,
        hasCoords: !!((parsed as any)?.latitude && (parsed as any)?.longitude),
        lat: (parsed as any)?.latitude,
        lng: (parsed as any)?.longitude,
        activityTypes: c.preferences?.preferredActivityTypes,
      });
    });

    // Debug: Log each child's preferences
    console.log('[UnifiedResults] 🔍 Child preferences detail:', selectedChildren.map(c => ({
      name: c.name,
      hasPrefs: !!c.preferences,
      prefActivityTypes: c.preferences?.preferredActivityTypes || 'NO_PREFS',
    })));

    return {
      filterMode,
      mergedFilters,
      children: selectedChildren,      // Pass children for per-child location search
      usePerChildLocation: true,       // Enable per-child search when children are in different cities
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

        // Apply global hide preferences (view settings - always applied)
        if (preferences.hideFullActivities) {
          baseParams.hideFullActivities = true;
        }
        if (preferences.hideClosedActivities) {
          baseParams.hideClosedActivities = true;
        }
        if (preferences.hideClosedOrFull) {
          baseParams.hideClosedOrFull = true;
        }

        // Apply CONTEXTUAL filters (from FiltersScreen in contextual mode)
        // These are temporary filters for THIS SCREEN ONLY - not persisted globally
        // Child preferences are applied separately via childFilters
        const hasContextualFilters = hasActiveContextualFilters(contextualFilters);

        if (hasContextualFilters) {
          console.log('[UnifiedResults] Applying contextual filters:', contextualFilters);

          // Activity types filter (only if not already specified by screen type)
          if (type !== 'activityType' && contextualFilters.activityTypes && contextualFilters.activityTypes.length > 0) {
            baseParams.categories = contextualFilters.activityTypes.join(',');
          }

          // Age range filter (only if not already an age group screen)
          // Always set both min and max when age filter is applied (not default 0-18)
          if (type !== 'ageGroup' && contextualFilters.ageRange) {
            const isDefaultRange = contextualFilters.ageRange.min === 0 && contextualFilters.ageRange.max === 18;
            console.log('🔍 [UnifiedResults] Age filter check:', {
              ageRange: contextualFilters.ageRange,
              isDefaultRange,
              willApply: !isDefaultRange
            });
            if (!isDefaultRange) {
              baseParams.ageMin = contextualFilters.ageRange.min;
              baseParams.ageMax = contextualFilters.ageRange.max;
              console.log('🔍 [UnifiedResults] Applied age filter:', { ageMin: baseParams.ageMin, ageMax: baseParams.ageMax });
            }
          }

          // Price range filter (only if not already a budget screen)
          if (type !== 'budget' && contextualFilters.priceRange) {
            if (contextualFilters.priceRange.max < 999999) {
              baseParams.maxCost = contextualFilters.priceRange.max;
            }
          }

          // Days of week filter
          if (contextualFilters.daysOfWeek && contextualFilters.daysOfWeek.length > 0 && contextualFilters.daysOfWeek.length < 7) {
            baseParams.dayOfWeek = contextualFilters.daysOfWeek;
          }

          // Environment filter (indoor/outdoor)
          if (contextualFilters.environment && contextualFilters.environment !== 'all') {
            baseParams.environment = contextualFilters.environment;
          }
        }

        // Note: Location/distance filters are NOT applied from contextual filters
        // They come from child preferences (handled by childFilters below)

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
        // Child-based filters represent children's preferences (age, activity types, location)
        // These are ALWAYS applied as the base filtering for personalization
        const hasContextual = hasActiveContextualFilters(contextualFilters);

        // Get child-based filters - these are ALWAYS applied as they represent the children's preferences
        const childFilters = getChildBasedFilters();

        // Get merged activity types for the API call
        const mergedActivityTypes = childFilters?.mergedFilters?.activityTypes || [];

        console.log(`🔍 [UnifiedResults] Loading ${type}:`, {
          baseParams,
          hasContextualFilters: hasContextual,
          hasVisitedFilters: hasVisitedFiltersRef.current,
          childFiltersExists: !!childFilters,
          mergedFilters: childFilters?.mergedFilters ? {
            latitude: childFilters.mergedFilters.latitude,
            longitude: childFilters.mergedFilters.longitude,
            city: childFilters.mergedFilters.city,
            ageMin: childFilters.mergedFilters.ageMin,
            ageMax: childFilters.mergedFilters.ageMax,
            activityTypes: childFilters.mergedFilters.activityTypes,
          } : 'NO MERGED FILTERS',
          selectedChildrenCount: selectedChildren.length,
        });

        const activityService = ActivityService.getInstance();
        // Include aggregations on first page load for FiltersScreen
        const includeAggregations = offset === 0;
        // Skip location fallback if user hasn't visited filters yet (show more results initially)
        const skipLocationFallback = !hasVisitedFiltersRef.current && !hasContextual;

        // CRITICAL: Add activity types directly to baseParams for recommended screen
        // This ensures the filter is applied regardless of the search path taken
        if (type === 'recommended' && mergedActivityTypes.length > 0 && !baseParams.categories) {
          baseParams.categories = mergedActivityTypes.join(',');
          console.log('[UnifiedResults] Added categories to baseParams:', baseParams.categories);
        }

        let response = await activityService.searchActivitiesPaginated(
          baseParams,
          childFilters,
          { includeAggregations, skipLocationFallback }
        );

        // Fallback: If service returned 0 results for recommended/new, try direct fetch with simpler filters
        // This mirrors Dashboard's fallback behavior to ensure consistency
        if ((!response?.items || response.items.length === 0) && (type === 'recommended' || type === 'new') && !isLoadMore) {
          console.log(`[UnifiedResults] Service returned 0 for ${type}, trying direct fetch...`);
          try {
            const merged = childFilters?.mergedFilters;
            let url = `https://kids-activity-api-4ev6yi22va-uc.a.run.app/api/v1/activities?limit=${ITEMS_PER_PAGE}`;

            // Add location filter - use coordinates if available, otherwise city
            if (merged?.latitude && merged?.longitude) {
              url += `&userLat=${merged.latitude}&userLon=${merged.longitude}&radiusKm=${merged.distanceRadiusKm || 25}`;
            } else if (merged?.city) {
              url += `&city=${encodeURIComponent(merged.city)}`;
              if (merged.province) {
                url += `&province=${encodeURIComponent(merged.province)}`;
              }
            }

            // Add age filter
            if (merged?.ageMin !== undefined) {
              url += `&ageMin=${merged.ageMin}`;
            }
            if (merged?.ageMax !== undefined) {
              url += `&ageMax=${merged.ageMax}`;
            }

            // Add activity types filter (OR mode union of children's preferences)
            if (merged?.activityTypes && merged.activityTypes.length > 0) {
              url += `&categories=${encodeURIComponent(merged.activityTypes.join(','))}`;
            }

            // Add type-specific filters
            if (type === 'new') {
              const oneWeekAgo = new Date();
              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
              url += `&createdAfter=${encodeURIComponent(oneWeekAgo.toISOString())}`;
              url += `&sortBy=createdAt&sortOrder=desc`;
            }

            console.log('[UnifiedResults] Direct fetch URL:', url);
            const directResp = await fetch(url);
            const data = await directResp.json();
            console.log('[UnifiedResults] Direct fetch result:', data?.success, data?.activities?.length, 'activities');

            if (data.success && data.activities?.length > 0) {
              response = {
                items: data.activities,
                total: data.total || data.activities.length,
                limit: ITEMS_PER_PAGE,
                offset: 0,
                hasMore: data.hasMore || false,
                pages: data.pagination?.pages || 1,
                aggregations: data.aggregations,
              };
            }
          } catch (fetchErr) {
            console.error('[UnifiedResults] Direct fetch failed:', fetchErr);
          }
        }

        if (response && response.items) {
          if (isLoadMore) {
            setActivities(prev => [...prev, ...response.items]);
          } else {
            setActivities(response.items);
            // Store aggregations from first page response (from service or fallback)
            if ((response as any).aggregations) {
              const aggs = (response as any).aggregations;
              console.log('📋 [UnifiedResults] Setting aggregations:', {
                hasActivityTypes: !!aggs.activityTypes,
                activityTypesCount: aggs.activityTypes?.length || 0,
                sample: aggs.activityTypes?.slice(0, 3).map((t: any) => t.name) || [],
              });
              setAggregations(aggs);
            }
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

  // Use focus effect to reload activities when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      // Reload activities when returning to this screen
      loadActivities();
      loadFavorites();
      // Refresh child favorites/watching data for icon colors
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        dispatch(fetchChildFavorites(childIds));
        dispatch(fetchChildWatching(childIds));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, children.length, dispatch])
  );

  // Reload when contextual filters change (triggered by FiltersScreen)
  useEffect(() => {
    if (filtersChangedTrigger > 0) {
      console.log('[UnifiedResults] Contextual filters changed, reloading with new filters:', contextualFilters);
      loadActivities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersChangedTrigger]);

  // Initial load - also reload when children change (handles async child loading)
  useEffect(() => {
    loadActivities();
    loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, selectedChildren.length]);

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
    // 'locations' (Where) and 'distance' are hidden on list screens - child location is used instead
    const baseHidden = ['aiMatch', 'locations', 'distance'];

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
        // For recommended, new, ai screens: use child location for filtering
        return baseHidden;
    }
  };

  const handleFilterPress = () => {
    // Mark that user has visited filters - after returning, apply their filter choices
    hasVisitedFiltersRef.current = true;
    navigation.navigate('Filters' as never, {
      mode: 'contextual', // Use contextual mode - filters are NOT persisted globally
      hiddenSections: getHiddenFilterSections(),
      screenTitle: config?.title || 'Filters',
      aggregations: aggregations, // Pass aggregations for dynamic filter options
      initialFilters: contextualFilters, // Pass current contextual filters
      returnScreen: 'UnifiedResults', // Return to this screen with filters
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
                    {hasActiveContextualFilters(contextualFilters) && (
                      <View style={styles.filterBadge}>
                        <View style={styles.filterBadgeDot} />
                      </View>
                    )}
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
                <Text style={styles.countNumber}>
                  {filterText.trim()
                    ? filteredActivities.length.toLocaleString()
                    : totalCount.toLocaleString()}
                </Text>
                <Text style={styles.countLabel}>
                  {filterText.trim() && filteredActivities.length !== totalCount
                    ? `of ${totalCount.toLocaleString()}`
                    : 'activities'}
                </Text>
              </View>
            </View>
{/* Debug removed - per-child search working */}
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

        {/* Search Filter */}
        <SearchFilterInput
          value={filterText}
          onChangeText={setFilterText}
          placeholder="Filter activities..."
        />

        <FlatList
          data={filteredActivities}
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
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8638B',
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