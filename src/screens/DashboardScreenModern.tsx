import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Animated,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService, { ChildBasedFilterParams } from '../services/activityService';
import childPreferencesService from '../services/childPreferencesService';
import { Activity } from '../types';
import { ActivitySearchParams } from '../types/api';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey, aiRobotImage, collectionButtonImage } from '../assets/images';
import { API_CONFIG } from '../config/api';
import PreferencesService from '../services/preferencesService';
import FavoritesService from '../services/favoritesService';
import WaitlistService from '../services/waitlistService';
import TopTabNavigation from '../components/TopTabNavigation';
import useFavoriteSubscription from '../hooks/useFavoriteSubscription';
import useWaitlistSubscription from '../hooks/useWaitlistSubscription';
import UpgradePromptModal from '../components/UpgradePromptModal';
import LinearGradient from 'react-native-linear-gradient';
import TrialCountdownBanner from '../components/TrialCountdownBanner';
import ScreenBackground from '../components/ScreenBackground';
import ChildFilterSelector from '../components/ChildFilterSelector';
import { ChildAvatar } from '../components/children';
import { useSelector } from 'react-redux';
import { selectIsTrialing, selectTrialDaysRemaining } from '../store/slices/subscriptionSlice';
import { selectAllChildren, selectSelectedChildIds, selectFilterMode, ChildFilterMode, fetchChildren } from '../store/slices/childrenSlice';
import { useAppSelector, useAppDispatch } from '../store';
import AddToCalendarModal from '../components/AddToCalendarModal';
import ActivityCard from '../components/ActivityCard';
import {
  fetchChildFavorites,
  fetchChildWatching,
  fetchChildWaitlist,
  selectWatchingByChild,
  selectWaitlistByChild,
} from '../store/slices/childFavoritesSlice';

const DashboardScreenModern = () => {
  const navigation = useNavigation<any>();
  const isTrialing = useSelector(selectIsTrialing);
  const trialDaysRemaining = useSelector(selectTrialDaysRemaining);
  // Section-level loading states for progressive skeleton loading
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [newLoading, setNewLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [typesLoading, setTypesLoading] = useState(true);
  const [ageGroupsLoading, setAgeGroupsLoading] = useState(true);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false); // Used for pull-to-refresh indicator
  const [recommendedActivities, setRecommendedActivities] = useState<Activity[]>([]);
  const [budgetFriendlyActivities, setBudgetFriendlyActivities] = useState<Activity[]>([]);
  const [newActivities, setNewActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [ageGroups, setAgeGroups] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [waitlistIds, setWaitlistIds] = useState<Set<string>>(new Set());
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistAvailableCount, setWaitlistAvailableCount] = useState(0);
  const [calendarModalActivity, setCalendarModalActivity] = useState<Activity | null>(null);
  const [scrollY] = useState(new Animated.Value(0));
  const dispatch = useAppDispatch();
  const activityService = ActivityService.getInstance();
  const favoritesService = FavoritesService.getInstance();
  const waitlistService = WaitlistService.getInstance();
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);

  // Subscription-aware favorites
  const {
    canAddFavorite,
    onFavoriteLimitReached,
    showUpgradeModal,
    hideUpgradeModal,
    favoritesCount,
    favoritesLimit,
  } = useFavoriteSubscription();

  // Subscription-aware waitlist
  const {
    canAddToWaitlist,
    onWaitlistLimitReached,
    showUpgradeModal: showWaitlistUpgradeModal,
    hideUpgradeModal: hideWaitlistUpgradeModal,
    waitlistCount: subscriptionWaitlistCount,
    waitlistLimit,
    syncWaitlistCount,
  } = useWaitlistSubscription();

  // Child filter state
  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const filterMode = useAppSelector(selectFilterMode);

  // Redux-based watching and waitlist data
  const watchingByChild = useAppSelector(selectWatchingByChild);
  const waitlistByChild = useAppSelector(selectWaitlistByChild);

  // Compute watching and waitlist counts from Redux state
  const watchingData = React.useMemo(() => {
    const uniqueActivityIds = new Set<string>();
    let availableCount = 0;

    for (const childId of selectedChildIds) {
      const childWatching = watchingByChild[childId] || [];
      for (const entry of childWatching) {
        if (!uniqueActivityIds.has(entry.activityId)) {
          uniqueActivityIds.add(entry.activityId);
          if (entry.activity?.spotsAvailable && entry.activity.spotsAvailable > 0) {
            availableCount++;
          }
        }
      }
    }

    return { count: uniqueActivityIds.size, availableCount };
  }, [watchingByChild, selectedChildIds]);

  const waitlistData = React.useMemo(() => {
    const uniqueActivityIds = new Set<string>();
    let availableCount = 0;

    for (const childId of selectedChildIds) {
      const childWaitlist = waitlistByChild[childId] || [];
      for (const entry of childWaitlist) {
        if (!uniqueActivityIds.has(entry.activityId)) {
          uniqueActivityIds.add(entry.activityId);
          if (entry.activity?.spotsAvailable && entry.activity.spotsAvailable > 0) {
            availableCount++;
          }
        }
      }
    }

    return { count: uniqueActivityIds.size, availableCount };
  }, [waitlistByChild, selectedChildIds]);

  // Helper to calculate child age from dateOfBirth
  const calculateAge = useCallback((dateOfBirth: string): number => {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return Math.max(0, Math.min(18, age));
  }, []);

  // Get age range for selected children
  const getSelectedChildrenAgeRange = useCallback((): { ageMin: number; ageMax: number } | null => {
    if (children.length === 0 || selectedChildIds.length === 0) return null;

    const selectedChildren = children.filter(c => selectedChildIds.includes(c.id));
    if (selectedChildren.length === 0) return null;

    const ages = selectedChildren
      .filter(c => c.dateOfBirth)
      .map(c => calculateAge(c.dateOfBirth));

    if (ages.length === 0) return null;

    if (filterMode === 'or') {
      // OR mode: expand age range to include all selected children (with 1 year buffer)
      return {
        ageMin: Math.max(0, Math.min(...ages) - 1),
        ageMax: Math.min(18, Math.max(...ages) + 1),
      };
    } else {
      // AND mode (Together): activities must accept ALL children
      // Activity's age range must span from youngest to oldest child
      return {
        ageMin: Math.max(0, Math.min(...ages) - 1), // Must accept youngest child
        ageMax: Math.min(18, Math.max(...ages) + 1), // Must accept oldest child
      };
    }
  }, [children, selectedChildIds, filterMode, calculateAge]);

  // Handler for child selection changes - the useEffect above handles reload
  const handleChildFilterChange = useCallback((newSelectedIds: string[], newMode: ChildFilterMode) => {
    console.log('[Dashboard] Child filter changed:', { selectedCount: newSelectedIds.length, mode: newMode });
    // The useEffect watching selectedChildIds/filterMode will trigger the reload
  }, []);

  // Get selected children for consistent filtering
  const selectedChildren = React.useMemo(() => {
    if (selectedChildIds.length === 0) {
      return children; // If none selected, use all children
    }
    return children.filter(c => selectedChildIds.includes(c.id));
  }, [children, selectedChildIds]);

  // Calculate child-based filters using the shared service (for consistency with MapSearchScreen)
  const getChildBasedFilters = useCallback((): ChildBasedFilterParams | undefined => {
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

    if (__DEV__) {
      console.log('[Dashboard] Child-based filters:', {
        selectedChildrenCount: selectedChildren.length,
        childPreferencesCount: childPreferences.length,
        childAges,
        calculatedAgeRange: `${mergedFilters.ageMin}-${mergedFilters.ageMax}`,
        activityTypes: mergedFilters.activityTypes?.length || 0,
        hasLocation: !!(mergedFilters.latitude && mergedFilters.longitude),
        latitude: mergedFilters.latitude,
        longitude: mergedFilters.longitude,
        city: mergedFilters.city,
        distanceRadiusKm: mergedFilters.distanceRadiusKm,
        filterMode,
      });
      // Debug: Log each child's preferences
      selectedChildren.forEach(child => {
        console.log(`[Dashboard] Child ${child.name}:`, {
          hasPreferences: !!child.preferences,
          hasSavedAddress: !!(child.preferences?.savedAddress),
          savedAddressType: typeof child.preferences?.savedAddress,
          savedAddressKeys: child.preferences?.savedAddress ? Object.keys(child.preferences.savedAddress) : [],
        });
      });
    }

    return {
      filterMode,
      mergedFilters,
      children: selectedChildren,      // Pass children for per-child location search
      usePerChildLocation: true,       // Enable per-child search when children are in different cities
    };
  }, [selectedChildren, filterMode]);

  // Shuffle array using Fisher-Yates algorithm for randomization
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Track previous selection to detect changes
  const prevSelectionRef = useRef<{ ids: string[]; mode: string }>({ ids: [], mode: 'or' });

  // Reload activities when child selection changes (after initial load)
  useEffect(() => {
    const currentKey = `${selectedChildIds.join(',')}-${filterMode}`;
    const prevKey = `${prevSelectionRef.current.ids.join(',')}-${prevSelectionRef.current.mode}`;

    // Skip on first render or if nothing changed
    if (prevKey === '-or' || currentKey === prevKey) {
      prevSelectionRef.current = { ids: selectedChildIds, mode: filterMode };
      return;
    }

    // Update ref
    prevSelectionRef.current = { ids: selectedChildIds, mode: filterMode };

    // Don't reload if already loading
    if (isLoadingRef.current) return;

    const reloadActivities = async () => {
      console.log('[Dashboard] Reloading due to child selection change:', currentKey);
      isLoadingRef.current = true;
      try {
        await Promise.all([
          loadRecommendedActivities(),
          loadBudgetFriendlyActivities(),
          loadNewActivities(),
        ]);
      } finally {
        isLoadingRef.current = false;
      }
    };

    reloadActivities();
  }, [selectedChildIds, filterMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load dashboard data on mount and when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Prevent concurrent loads
      if (isLoadingRef.current) {
        console.log('[Dashboard] Already loading, skipping...');
        return;
      }

      const loadData = async () => {
        console.log('[Dashboard] Loading data on focus...');
        isLoadingRef.current = true;

        try {
          // Load all data in parallel
          await Promise.all([
            loadRecommendedActivities(),
            loadBudgetFriendlyActivities(),
            loadNewActivities(),
            loadActivityTypes(),
            loadAgeGroups(),
          ]);
          console.log('[Dashboard] Data load complete');
        } catch (error) {
          console.error('[Dashboard] Error loading data:', error);
        } finally {
          isLoadingRef.current = false;
          hasInitialLoadRef.current = true; // Mark initial load as complete
        }
      };

      // Ensure children are synced from server
      dispatch(fetchChildren()).then((result) => {
        // After children are loaded, fetch their favorites, watching, and waitlist data
        if (result.payload && Array.isArray(result.payload) && result.payload.length > 0) {
          const childIds = result.payload.map((c: any) => c.id);
          console.log('[Dashboard] Fetching favorites/watching/waitlist for children:', childIds.length);
          dispatch(fetchChildFavorites(childIds));
          dispatch(fetchChildWatching(childIds));
          dispatch(fetchChildWaitlist(childIds));
        }
      });

      loadData();
      loadFavorites();
      loadWaitlistCount();

      // Note: Don't set isMountedRef to false here - useFocusEffect cleanup
      // runs on blur, not unmount. The useEffect above handles unmount.
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Check if any section is still loading (for shimmer animation)
  const isAnyLoading = recommendedLoading || newLoading || budgetLoading || typesLoading || ageGroupsLoading;

  // Shimmer animation for loading placeholders - runs while any section is loading
  useEffect(() => {
    if (isAnyLoading) {
      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerLoop.start();
      return () => shimmerLoop.stop();
    }
  }, [isAnyLoading, shimmerAnim]);

  const loadFavorites = () => {
    try {
      const favorites = favoritesService.getFavorites();
      const ids = new Set(favorites.map(fav => fav.activityId));
      setFavoriteIds(ids);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadWaitlistCount = async () => {
    try {
      await waitlistService.getWaitlist(true); // Force refresh
      setWaitlistCount(waitlistService.getWaitlistCount());
      setWaitlistAvailableCount(waitlistService.getAvailableCount());
      setWaitlistIds(waitlistService.getWaitlistIds());
    } catch (error) {
      console.error('Error loading waitlist count:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      console.log('Starting to load dashboard data...');

      // Load all data in parallel
      const results = await Promise.allSettled([
        loadRecommendedActivities(),
        loadBudgetFriendlyActivities(),
        loadNewActivities(),
        loadActivityTypes(),
        loadAgeGroups(),
      ]);

      // Log results of each promise
      results.forEach((result, index) => {
        const names = ['Recommended', 'Budget', 'New', 'ActivityTypes', 'AgeGroups'];
        if (result.status === 'rejected') {
          console.error(`Failed to load ${names[index]}:`, result.reason);
        } else {
          console.log(`Successfully loaded ${names[index]}`);
        }
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    console.log('[Dashboard] Pull-to-refresh triggered');
    setRefreshing(true);
    try {
      // Refresh children data first
      await dispatch(fetchChildren()).unwrap();

      // Then refresh all dashboard data
      await loadDashboardData();

      // Also refresh favorites and waitlist
      loadFavorites();
      loadWaitlistCount();

      // Refresh child favorites/watching data
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        dispatch(fetchChildFavorites(childIds));
        dispatch(fetchChildWatching(childIds));
        dispatch(fetchChildWaitlist(childIds));
      }
    } catch (error) {
      console.error('[Dashboard] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, children]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecommendedActivities = async () => {
    try {
      setRecommendedLoading(true);

      // Build filter params with child-based filters
      const filterParams: ActivitySearchParams = {
        limit: 6,
        offset: 0,
        hideFullActivities: true
      };
      const childFilters = getChildBasedFilters();

      console.log('[Dashboard] Loading recommended with child filters:', childFilters?.mergedFilters ? 'yes' : 'no');

      // Try activityService first (wrap in try-catch so errors don't skip fallback)
      let response: any = null;
      try {
        response = await activityService.searchActivitiesPaginated(filterParams, childFilters);
        console.log('[Dashboard] Recommended search result:', response?.items?.length, 'items');
      } catch (serviceErr) {
        console.log('[Dashboard] Service threw error:', serviceErr);
        response = { items: [] };
      }

      // Fallback: Direct fetch WITH child filters if service returned 0
      if (!response?.items || response.items.length === 0) {
        console.log('[Dashboard] Service returned 0, using direct fetch WITH filters...');
        try {
          // Build URL with child's location filters
          const merged = childFilters?.mergedFilters;
          let url = `${API_CONFIG.BASE_URL}/api/v1/activities?limit=6`;

          // Add location filter - use coordinates if available, otherwise city
          if (merged?.latitude && merged?.longitude) {
            url += `&userLat=${merged.latitude}&userLon=${merged.longitude}&radiusKm=${merged.distanceRadiusKm || 25}`;
            console.log('[Dashboard] Using child coordinates:', merged.latitude, merged.longitude);
          } else if (merged?.city) {
            url += `&city=${encodeURIComponent(merged.city)}`;
            if (merged.province) {
              url += `&province=${encodeURIComponent(merged.province)}`;
            }
            console.log('[Dashboard] Using child city:', merged.city);
          }

          // Add age filter
          if (merged?.ageMin !== undefined) {
            url += `&ageMin=${merged.ageMin}`;
          }
          if (merged?.ageMax !== undefined) {
            url += `&ageMax=${merged.ageMax}`;
          }

          // Add activity type filter
          if (merged?.activityTypes && merged.activityTypes.length > 0) {
            url += `&categories=${encodeURIComponent(merged.activityTypes.join(','))}`;
          }

          console.log('[Dashboard] Direct fetch URL:', url);
          const directResp = await fetch(url);
          const data = await directResp.json();
          console.log('[Dashboard] Direct fetch result:', data?.success, data?.activities?.length, 'activities');

          if (data.success && data.activities?.length > 0) {
            response = {
              items: data.activities,
              total: data.activities.length,
              limit: 6,
              offset: 0,
              hasMore: false,
              pages: 1
            };
          }
        } catch (fetchErr) {
          console.error('[Dashboard] Direct fetch failed:', fetchErr);
        }
      }

      if (isMountedRef.current) {
        if (response?.items && Array.isArray(response.items) && response.items.length > 0) {
          // Shuffle results for variety on each load
          setRecommendedActivities(shuffleArray(response.items));
          console.log('[Dashboard] Set recommended activities (shuffled):', response.items.length);
        } else {
          // No activities found - set empty array to show empty state
          setRecommendedActivities([]);
          console.log('[Dashboard] Recommended activities: No activities found');
        }
      }
    } catch (error) {
      console.error('[Dashboard] Error loading recommended activities:', error);
      if (isMountedRef.current) {
        setRecommendedActivities([]);
      }
    } finally {
      if (isMountedRef.current) {
        setRecommendedLoading(false);
      }
    }
  };

  const loadBudgetFriendlyActivities = async () => {
    try {
      setBudgetLoading(true);
      // Get budget-friendly amount setting (this is a view setting, not a filter preference)
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      const maxBudgetAmount = preferences.maxBudgetFriendlyAmount || 20;

      // Build filter params - child-based filters handle everything except budget limit
      const filterParams: any = {
        limit: 6,
        offset: 0,
        maxCost: maxBudgetAmount,  // Budget friendly limit (view setting)
        hideFullActivities: true
      };

      // Get child-based filters (includes age, activity types, location, days from child preferences)
      const childFilters = getChildBasedFilters();
      console.log('[Dashboard] Loading budget-friendly with child filters:', childFilters?.mergedFilters ? 'yes' : 'no');

      const response = await activityService.searchActivitiesPaginated(filterParams, childFilters);
      console.log('Budget friendly activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        maxBudget: maxBudgetAmount,
        firstItem: response?.items?.[0]?.name
      });
      if (isMountedRef.current && response?.items && Array.isArray(response.items)) {
        // Shuffle results for variety on each load
        setBudgetFriendlyActivities(shuffleArray(response.items));
        console.log('Set budget friendly activities (shuffled):', response.items.length);
      }
    } catch (error) {
      console.error('Error loading budget activities:', error);
      if (isMountedRef.current) {
        setBudgetFriendlyActivities([]); // Set empty array on error
      }
    } finally {
      if (isMountedRef.current) {
        setBudgetLoading(false);
      }
    }
  };

  const loadNewActivities = async () => {
    try {
      setNewLoading(true);

      // Build filter params - child-based filters handle everything
      const filterParams: any = {
        limit: 6,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        hideFullActivities: true
      };

      // Get child-based filters (includes age, activity types, price, location, days from child preferences)
      const childFilters = getChildBasedFilters();
      console.log('[Dashboard] Loading new activities with child filters:', childFilters?.mergedFilters ? 'yes' : 'no');

      const response = await activityService.searchActivitiesPaginated(filterParams, childFilters);
      console.log('New activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        firstItem: response?.items?.[0]?.name
      });
      if (isMountedRef.current && response?.items && Array.isArray(response.items)) {
        // Shuffle results for variety on each load
        setNewActivities(shuffleArray(response.items));
        console.log('Set new activities (shuffled):', response.items.length);
      }
    } catch (error) {
      console.error('Error loading new activities:', error);
      if (isMountedRef.current) {
        setNewActivities([]); // Set empty array on error
      }
    } finally {
      if (isMountedRef.current) {
        setNewLoading(false);
      }
    }
  };

  const loadActivityTypes = async () => {
    try {
      setTypesLoading(true);
      console.log('Loading activity types from database...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/activity-types`);
      const result = await response.json();

      if (result.success && result.data && Array.isArray(result.data)) {
        type ActivityTypeData = { code: string; name: string; iconName?: string; activityCount: number };
        let allTypes: ActivityTypeData[] = result.data;
        console.log('Found', allTypes.length, 'activity types in database');

        // Get preferred activity types from selected children's preferences
        const preferredTypes: string[] = [];
        selectedChildren.forEach(child => {
          if (child.preferences?.preferredActivityTypes) {
            child.preferences.preferredActivityTypes.forEach((type: string) => {
              if (!preferredTypes.includes(type)) {
                preferredTypes.push(type);
              }
            });
          }
        });

        console.log('Child preferred activity types:', preferredTypes);

        let selectedTypes: ActivityTypeData[] = [];

        // First, add children's preferred activity types
        if (preferredTypes.length > 0) {
          const preferred = allTypes.filter((type: ActivityTypeData) =>
            preferredTypes.some((pref: string) =>
              pref.toLowerCase() === type.name.toLowerCase() ||
              pref.toLowerCase() === type.code.toLowerCase()
            )
          );
          selectedTypes = [...preferred];
          console.log('Added', preferred.length, 'preferred types from children');
        }

        // If we have less than 6, add more types by activity count (most popular first)
        if (selectedTypes.length < 6) {
          const remaining = allTypes
            .filter((type: ActivityTypeData) => !selectedTypes.some((selected: ActivityTypeData) => selected.code === type.code))
            .sort((a: ActivityTypeData, b: ActivityTypeData) => (b.activityCount || 0) - (a.activityCount || 0));

          const needed = 6 - selectedTypes.length;
          selectedTypes = [...selectedTypes, ...remaining.slice(0, needed)];
          console.log('Added', Math.min(needed, remaining.length), 'additional types by popularity');
        }

        // Ensure we have exactly 6 types
        selectedTypes = selectedTypes.slice(0, 6);

        console.log('Final activity types:', selectedTypes.map(t => `${t.name} (${t.activityCount} activities)`));
        if (isMountedRef.current) {
          setActivityTypes(selectedTypes);
        }
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
      // Fallback to default types
      if (isMountedRef.current) {
        setActivityTypes([
          { id: 1, name: 'Swimming & Aquatics', code: 'swimming-aquatics', activityCount: 0 },
          { id: 2, name: 'Team Sports', code: 'team-sports', activityCount: 0 },
          { id: 3, name: 'Visual Arts', code: 'visual-arts', activityCount: 0 },
          { id: 4, name: 'Dance', code: 'dance', activityCount: 0 },
          { id: 5, name: 'Music', code: 'music', activityCount: 0 },
          { id: 6, name: 'Martial Arts', code: 'martial-arts', activityCount: 0 },
        ]);
      }
    } finally {
      if (isMountedRef.current) {
        setTypesLoading(false);
      }
    }
  };

  const loadAgeGroups = async () => {
    if (!isMountedRef.current) return;
    setAgeGroupsLoading(true);
    // Simulate a small delay to allow skeleton to show (age groups are static data)
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!isMountedRef.current) return;
    setAgeGroups([
      {
        id: 1,
        name: '0-2 years',
        range: '0-2',
        image: require('../assets/images/activities/early_development/toddler_play.jpg'),
      },
      {
        id: 2,
        name: '3-5 years',
        range: '3-5',
        image: require('../assets/images/activities/early_development/preschool.jpg'),
      },
      {
        id: 3,
        name: '6-8 years',
        range: '6-8',
        image: require('../assets/images/activities/early_development/kids_activities.jpg'),
      },
      {
        id: 4,
        name: '9-12 years',
        range: '9-12',
        image: require('../assets/images/activities/other/youth_activities.jpg'),
      },
      {
        id: 5,
        name: '13+ years',
        range: '13+',
        image: require('../assets/images/activities/life_skills/leadership.jpg'),
      },
      {
        id: 6,
        name: 'All Ages',
        range: 'all',
        image: require('../assets/images/activities/other/family_fun.jpg'),
      },
    ]);
    setAgeGroupsLoading(false);
  };

  const handleNavigate = (screen: string, params?: any) => {
    try {
      navigation.navigate(screen as any, params);
    } catch (error) {
      console.log('Navigation error:', error);
    }
  };

  /**
   * Navigate to AI Recommendations screen
   */
  const handleAIRecommendations = useCallback(() => {
    navigation.navigate('AIRecommendations');
  }, [navigation]);

  /**
   * Render skeleton loading card for activity sections
   */
  const renderSkeletonCard = (index: number) => {
    const shimmerOpacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <View key={`skeleton-${index}`} style={styles.skeletonCard}>
        {/* Image placeholder */}
        <Animated.View style={[styles.skeletonImage, { opacity: shimmerOpacity }]} />

        {/* Content placeholders */}
        <View style={styles.skeletonContent}>
          {/* Title placeholder */}
          <Animated.View style={[styles.skeletonTitle, { opacity: shimmerOpacity }]} />

          {/* Location placeholder */}
          <View style={styles.skeletonRow}>
            <Animated.View style={[styles.skeletonIcon, { opacity: shimmerOpacity }]} />
            <Animated.View style={[styles.skeletonText, { opacity: shimmerOpacity }]} />
          </View>

          {/* Date placeholder */}
          <View style={styles.skeletonRow}>
            <Animated.View style={[styles.skeletonIcon, { opacity: shimmerOpacity }]} />
            <Animated.View style={[styles.skeletonTextShort, { opacity: shimmerOpacity }]} />
          </View>

          {/* Days badge placeholder */}
          <Animated.View style={[styles.skeletonBadge, { opacity: shimmerOpacity }]} />
        </View>
      </View>
    );
  };

  /**
   * Render skeleton loading card for type/category sections (smaller cards)
   */
  const renderTypeSkeletonCard = (index: number) => {
    const shimmerOpacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <View key={`type-skeleton-${index}`} style={styles.skeletonTypeCard}>
        <Animated.View style={[styles.skeletonTypeImage, { opacity: shimmerOpacity }]} />
        <Animated.View style={[styles.skeletonTypeTitle, { opacity: shimmerOpacity }]} />
      </View>
    );
  };


  // Render activity cards for dashboard sections using unified ActivityCard
  // Returns a render function for use with .map()
  const renderDashboardCard = (showGreatFor: boolean) => (activity: Activity) => (
    <ActivityCard
      key={activity.id}
      activity={activity}
      onPress={() => handleNavigate('ActivityDetail', { activity })}
      size="dashboard"
      containerStyle={styles.dashboardCard}
      showOnCalendarBadge={true}
      showGreatFor={showGreatFor}
      canAddFavorite={canAddFavorite}
      onFavoriteLimitReached={onFavoriteLimitReached}
      canAddToWaitlist={canAddToWaitlist}
      onWaitlistLimitReached={onWaitlistLimitReached}
    />
  );


  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Tab Navigation - Fixed at top */}
        <TopTabNavigation />

        {/* Fixed Header with Search */}
        <View style={styles.fixedHeader}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => handleNavigate('SearchMain')}
          >
            <View style={styles.searchContent}>
              <Icon name="magnify" size={20} color="#717171" />
              <Text style={styles.searchText}>Search Activities</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E8638B"
            colors={['#E8638B']}
          />
        }
      >
        {/* Trial Countdown Banner - shown when user is trialing */}
        <TrialCountdownBanner
          isTrialing={isTrialing}
          daysRemaining={trialDaysRemaining ?? 0}
        />

        {/* Child Filter Selector - filters activities by selected children */}
        {children.length > 1 && (
          <ChildFilterSelector
            compact
            showModeToggle={true}
            onSelectionChange={handleChildFilterChange}
          />
        )}

        {/* AI Recommendations Banner - with robot overlay */}
        <View style={styles.aiBannerWrapper}>
          <TouchableOpacity
            style={styles.aiBanner}
            onPress={handleAIRecommendations}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FFB5C5', '#E8638B', '#D53F8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiBannerGradient}
            >
              <View style={styles.aiBannerTextContainer}>
                <Text style={styles.aiBannerTitle}>AI Recommendations</Text>
                {(() => {
                  const selectedChildren = children.filter(c => selectedChildIds.includes(c.id));
                  if (selectedChildren.length > 0) {
                    return (
                      <View style={styles.aiBannerChildrenRow}>
                        <Text style={styles.aiBannerSubtitle}>Personalized for </Text>
                        <View style={styles.aiBannerAvatars}>
                          {selectedChildren.slice(0, 3).map((child, index) => (
                            <View key={child.id} style={[styles.aiBannerAvatarWrapper, index > 0 && { marginLeft: -8 }]}>
                              <ChildAvatar child={child} size={24} showBorder={true} borderWidth={2} />
                            </View>
                          ))}
                          {selectedChildren.length > 3 && (
                            <View style={styles.aiBannerMoreBadge}>
                              <Text style={styles.aiBannerMoreText}>+{selectedChildren.length - 3}</Text>
                            </View>
                          )}
                        </View>
                        {filterMode === 'and' && children.length > 1 && (
                          <View style={styles.aiBannerTogetherBadge}>
                            <Icon name="account-group" size={14} color="#FFFFFF" />
                            <Text style={styles.aiBannerTogetherText}>Together</Text>
                          </View>
                        )}
                      </View>
                    );
                  }
                  return <Text style={styles.aiBannerSubtitle}>Get personalized activity suggestions</Text>;
                })()}
              </View>
              <Icon name="chevron-right" size={22} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          {/* Robot image overlapping outside the banner */}
          <Image source={aiRobotImage} style={styles.aiRobotImageOverlay} />
        </View>

        {/* Combined Collection Banner - Watching & Waiting List */}
        {(watchingData.count > 0 || waitlistData.count > 0) && (
          <View style={styles.collectionBannerWrapper}>
            <TouchableOpacity
              style={styles.collectionBanner}
              onPress={() => navigation.navigate('Favorites', { tab: 'watching' })}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#5B9BD5', '#7EC8E3', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.collectionBannerGradient}
              >
                <View style={styles.collectionBannerContent}>
                  <View style={styles.collectionBannerLeft}>
                    <Text style={styles.collectionBannerTitle}>Your Collection</Text>
                    <View style={styles.collectionBannerStats}>
                      {watchingData.count > 0 && (
                        <Text style={styles.collectionBannerCount}>
                          {watchingData.count} watching
                        </Text>
                      )}
                      {watchingData.count > 0 && waitlistData.count > 0 && (
                        <Text style={styles.collectionBannerCount}> · </Text>
                      )}
                      {waitlistData.count > 0 && (
                        <Text style={styles.collectionBannerCount}>
                          {waitlistData.count} waitlist
                        </Text>
                      )}
                      {(watchingData.availableCount > 0 || waitlistData.availableCount > 0) && (
                        <>
                          <Text style={styles.collectionBannerCount}> · </Text>
                          <View style={styles.collectionAvailableBadge}>
                            <Text style={styles.collectionAvailableText}>
                              {watchingData.availableCount + waitlistData.availableCount} available!
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                  <Icon name="chevron-right" size={22} color="#1E3A5F" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            {/* Collection image overlay - positioned on left side */}
            <Image source={collectionButtonImage} style={styles.collectionImageOverlay} />
          </View>
        )}

        {/* Recommended Activities Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => handleNavigate('UnifiedResults', { type: 'recommended' })}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>Recommended for You</Text>
              <Icon name="chevron-right" size={20} color="#222" style={styles.chevronIcon} />
            </View>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedLoading ? (
              // Skeleton loading cards
              <>
                {[0, 1, 2].map(renderSkeletonCard)}
              </>
            ) : recommendedActivities.length > 0 ? (
              recommendedActivities.map(renderDashboardCard(true))
            ) : (
              <TouchableOpacity
                style={styles.adjustFiltersCard}
                onPress={() => navigation.navigate('Profile', { screen: 'Settings' })}
              >
                <Icon name="tune-variant" size={32} color="#E8638B" />
                <Text style={styles.adjustFiltersTitle}>Adjust Your Preferences</Text>
                <Text style={styles.adjustFiltersText}>
                  Update your location or activity preferences to see recommendations
                </Text>
                <View style={styles.adjustFiltersButton}>
                  <Text style={styles.adjustFiltersButtonText}>Open Settings</Text>
                  <Icon name="chevron-right" size={16} color="#FFF" />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* New This Week Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => handleNavigate('UnifiedResults', { type: 'new' })}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>New This Week</Text>
              <Icon name="chevron-right" size={20} color="#222" style={styles.chevronIcon} />
            </View>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {newLoading ? (
              // Skeleton loading cards
              <>
                {[0, 1, 2].map(renderSkeletonCard)}
              </>
            ) : newActivities.length > 0 ? (
              newActivities.map(renderDashboardCard(false))
            ) : (
              <View style={styles.emptyStateCard}>
                <Icon name="calendar-star" size={32} color="#E8638B" style={styles.emptyStateIcon} />
                <Text style={styles.emptyStateText}>No new activities</Text>
                <Text style={styles.emptyStateSubtext}>Check back soon!</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Budget Friendly Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => handleNavigate('UnifiedResults', { type: 'budget' })}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>Budget Friendly</Text>
              <Icon name="chevron-right" size={20} color="#222" style={styles.chevronIcon} />
            </View>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {budgetLoading ? (
              // Skeleton loading cards
              <>
                {[0, 1, 2].map(renderSkeletonCard)}
              </>
            ) : budgetFriendlyActivities.length > 0 ? (
              budgetFriendlyActivities.map(renderDashboardCard(false))
            ) : (
              <View style={styles.emptyStateCard}>
                <Icon name="wallet-outline" size={32} color="#E8638B" style={styles.emptyStateIcon} />
                <Text style={styles.emptyStateText}>No budget activities</Text>
                <Text style={styles.emptyStateSubtext}>Try adjusting filters</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Activity Type Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => handleNavigate('AllActivityTypes')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>Browse by Activity Type</Text>
              <Icon name="chevron-right" size={20} color="#222" style={styles.chevronIcon} />
            </View>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {typesLoading ? (
              // Skeleton loading cards for types
              <>
                {[0, 1, 2, 3, 4, 5].map(renderTypeSkeletonCard)}
              </>
            ) : (
              activityTypes.map((type) => {
                // Use getActivityImageKey with type name to get proper image mapping
                const imageKey = getActivityImageKey(type.name, type.code);
                const imageSource = getActivityImageByKey(imageKey, type.name);
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={styles.typeCard}
                    onPress={() => handleNavigate('ActivityTypeDetail', { activityType: type })}
                  >
                    <Image source={imageSource} style={styles.typeImage} />
                    <Text style={styles.typeTitle}>{type.name}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Age Group Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => handleNavigate('AllAgeGroups')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>Browse by Age Group</Text>
              <Icon name="chevron-right" size={20} color="#222" style={styles.chevronIcon} />
            </View>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ageGroupsLoading ? (
              // Skeleton loading cards for age groups
              <>
                {[0, 1, 2, 3, 4, 5].map(renderTypeSkeletonCard)}
              </>
            ) : (
              ageGroups.map((group) => {
                // Parse age range to get min and max ages
                let ageMin = 0;
                let ageMax = 18;
                let ageGroupName = group.name;

                if (group.range !== 'all') {
                  const parts = group.range.split('-');
                  if (parts.length === 2) {
                    ageMin = parseInt(parts[0]);
                    ageMax = parts[1].includes('+') ? 18 : parseInt(parts[1]);
                  } else if (group.range.includes('+')) {
                    ageMin = parseInt(group.range.replace('+', ''));
                    ageMax = 18;
                  }
                }

                return (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.ageCard}
                    onPress={() => navigation.navigate('UnifiedResults' as never, {
                      type: 'ageGroup',
                      ageMin,
                      ageMax,
                      ageGroupName,
                      title: group.name,
                      subtitle: 'Perfect for this age range',
                    } as never)}
                  >
                    <Image source={group.image} style={styles.ageImage} />
                    <Text style={styles.ageTitle}>{group.name}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* Upgrade Modal for favorites limit */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        feature="favorites"
        onClose={hideUpgradeModal}
        currentCount={favoritesCount}
        limit={favoritesLimit}
      />

      {/* Upgrade Modal for notifications (premium feature) */}
      <UpgradePromptModal
        visible={showWaitlistUpgradeModal}
        feature="notifications"
        onClose={hideWaitlistUpgradeModal}
      />

      {/* Add to Calendar Modal */}
      {calendarModalActivity && (
        <AddToCalendarModal
          visible={!!calendarModalActivity}
          activity={calendarModalActivity}
          onClose={() => setCalendarModalActivity(null)}
        />
      )}

      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  dashboardCard: {
    width: 280,
    marginLeft: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedHeader: {
    backgroundColor: 'transparent',
    paddingBottom: 10,
    zIndex: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 10,
    gap: 10,
    zIndex: 60,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    padding: 15,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#717171',
    fontWeight: '500',
  },
  aiBannerWrapper: {
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 10,
    paddingRight: 30, // Space for robot overflow
  },
  aiBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  aiBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 50, // Extra space for robot
    minHeight: 70,
  },
  aiBannerTextContainer: {
    flex: 1,
  },
  aiBannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  aiBannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  aiBannerChildrenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  aiBannerAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  aiBannerAvatarWrapper: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 14,
  },
  aiBannerMoreBadge: {
    marginLeft: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiBannerMoreText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiBannerTogetherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
  },
  aiBannerTogetherText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiRobotImageOverlay: {
    position: 'absolute',
    right: 0,
    top: -15,
    width: 75,
    height: 75,
    resizeMode: 'contain',
  },
  // Collection Banner styles (blue gradient with image)
  collectionBannerWrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
    position: 'relative',
    paddingLeft: 30, // Space for image overflow on left
  },
  collectionBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#5B9BD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  collectionBannerGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 60, // Space for overlay image on left
  },
  collectionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionBannerLeft: {
    flex: 1,
  },
  collectionBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 2,
  },
  collectionBannerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  collectionBannerCount: {
    fontSize: 13,
    color: '#1E3A5F',
  },
  collectionAvailableBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  collectionAvailableText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  collectionImageOverlay: {
    position: 'absolute',
    left: -5,
    top: -18,
    width: 91,
    height: 91,
    resizeMode: 'contain',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
  },
  chevronIcon: {
    marginLeft: 6,
    marginTop: 2,
  },
  card: {
    width: 280,
    marginLeft: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionButtonsRow: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 14,
    padding: 3,
  },
  actionButton: {
    padding: 5,
    marginHorizontal: 1,
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  perChildText: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    right: 55,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
    lineHeight: 20,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#717171',
    marginLeft: 4,
    flex: 1,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardDetails: {
    fontSize: 11,
    color: '#717171',
    marginLeft: 4,
    flex: 1,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#E8638B' + '15',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  daysText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E8638B',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  spotsNormal: {
    backgroundColor: '#F0F9FF',
  },
  spotsUrgent: {
    backgroundColor: '#FEF2F2',
  },
  spotsText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  spotsTextNormal: {
    color: '#0369A1',
  },
  spotsTextUrgent: {
    color: '#D93025',
  },
  matchingChildrenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  matchingChildrenLabel: {
    fontSize: 11,
    color: '#717171',
    marginRight: 2,
  },
  childMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  childMatchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  childMatchName: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeCard: {
    width: 120,
    marginLeft: 20,
    alignItems: 'center',
  },
  typeImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  typeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  ageCard: {
    width: 120,
    marginLeft: 20,
    alignItems: 'center',
  },
  ageImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  ageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  emptyCard: {
    width: 160,
    height: 160,
    marginLeft: 20,
    backgroundColor: '#FFF5F8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#717171',
  },
  emptyStateCard: {
    width: 200,
    height: 160,
    marginLeft: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE5EC',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#717171',
  },
  adjustFiltersCard: {
    width: 280,
    marginLeft: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E8638B',
    borderStyle: 'dashed',
  },
  adjustFiltersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  adjustFiltersText: {
    fontSize: 13,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  adjustFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8638B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  adjustFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginRight: 4,
  },
  // Sponsor section styles
  sponsoredBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8638B',
  },
  sponsoredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  calendarBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#4ECDC4',
  },
  calendarBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  // Skeleton loading styles
  skeletonCard: {
    width: 280,
    marginLeft: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#FFE5EC',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  skeletonContent: {
    padding: 12,
  },
  skeletonTitle: {
    height: 18,
    width: '80%',
    backgroundColor: '#FFE5EC',
    borderRadius: 6,
    marginBottom: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  skeletonIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#FFE5EC',
    borderRadius: 6,
    marginRight: 8,
  },
  skeletonText: {
    height: 12,
    width: '60%',
    backgroundColor: '#FFE5EC',
    borderRadius: 4,
  },
  skeletonTextShort: {
    height: 12,
    width: '40%',
    backgroundColor: '#FFE5EC',
    borderRadius: 4,
  },
  skeletonBadge: {
    height: 24,
    width: '50%',
    backgroundColor: '#FFE5EC',
    borderRadius: 6,
    marginTop: 4,
  },
  // Skeleton styles for type/category cards
  skeletonTypeCard: {
    width: 120,
    marginLeft: 20,
    alignItems: 'center',
  },
  skeletonTypeImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FFE5EC',
  },
  skeletonTypeTitle: {
    height: 14,
    width: 80,
    backgroundColor: '#FFE5EC',
    borderRadius: 4,
  },
});

export default DashboardScreenModern;