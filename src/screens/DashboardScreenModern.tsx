import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Animated,
  Share,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import { Activity } from '../types';
import { ActivitySearchParams } from '../types/api';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey, aiRobotImage } from '../assets/images';
import { formatActivityPrice, cleanActivityName } from '../utils/formatters';
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
import { useSelector } from 'react-redux';
import { selectIsTrialing, selectTrialDaysRemaining } from '../store/slices/subscriptionSlice';
import { useAppSelector } from '../store';
import AddToCalendarModal from '../components/AddToCalendarModal';

const DashboardScreenModern = () => {
  const navigation = useNavigation<any>();
  const isTrialing = useSelector(selectIsTrialing);
  const trialDaysRemaining = useSelector(selectTrialDaysRemaining);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [sponsoredActivities, setSponsoredActivities] = useState<Activity[]>([]);
  const [recommendedActivities, setRecommendedActivities] = useState<Activity[]>([]);
  const [budgetFriendlyActivities, setBudgetFriendlyActivities] = useState<Activity[]>([]);
  const [newActivities, setNewActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [ageGroups, setAgeGroups] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistAvailableCount, setWaitlistAvailableCount] = useState(0);
  const [calendarModalActivity, setCalendarModalActivity] = useState<Activity | null>(null);
  const [scrollY] = useState(new Animated.Value(0));
  const activityService = ActivityService.getInstance();
  const favoritesService = FavoritesService.getInstance();
  const waitlistService = WaitlistService.getInstance();
  const scrollViewRef = useRef<ScrollView>(null);
  const isInitialMount = useRef(true);

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

  // Get all activity-children mappings for calendar indicator
  const activityChildrenMap = useAppSelector(state => state.childActivities?.activityChildren || {});

  // Shuffle array using Fisher-Yates algorithm for randomization
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Reload dashboard data when screen comes into focus (e.g., returning from Filters)
  // Skip on initial mount since useEffect already loads data
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      // Reload all dashboard data when returning to the screen
      const reloadData = async () => {
        console.log('[Dashboard] Reloading data on focus...');
        setReloading(true);
        try {
          await Promise.all([
            loadSponsoredActivities(),
            loadRecommendedActivities(),
            loadBudgetFriendlyActivities(),
            loadNewActivities(),
          ]);
          console.log('[Dashboard] Data reload complete');
        } catch (error) {
          console.error('[Dashboard] Error reloading data:', error);
        } finally {
          setReloading(false);
        }
      };

      reloadData();

      return () => {
        // Cleanup if needed
      };
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    loadDashboardData();
    loadFavorites();
    loadWaitlistCount();
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

  const loadWaitlistCount = async () => {
    try {
      await waitlistService.getWaitlist(true); // Force refresh
      setWaitlistCount(waitlistService.getWaitlistCount());
      setWaitlistAvailableCount(waitlistService.getAvailableCount());
    } catch (error) {
      console.error('Error loading waitlist count:', error);
    }
  };

  const toggleFavorite = (activity: Activity) => {
    try {
      const isCurrentlyFavorite = favoriteIds.has(activity.id);

      if (isCurrentlyFavorite) {
        favoritesService.removeFavorite(activity.id);
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(activity.id);
          return newSet;
        });
      } else {
        // Check subscription limit before adding
        if (!canAddFavorite) {
          onFavoriteLimitReached();
          return;
        }
        favoritesService.addFavorite(activity);
        setFavoriteIds(prev => new Set([...prev, activity.id]));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Starting to load dashboard data...');

      // Load all data in parallel
      const results = await Promise.allSettled([
        loadSponsoredActivities(),
        loadRecommendedActivities(),
        loadBudgetFriendlyActivities(),
        loadNewActivities(),
        loadActivityTypes(),
        loadAgeGroups(),
      ]);

      // Log results of each promise
      results.forEach((result, index) => {
        const names = ['Sponsored', 'Recommended', 'Budget', 'New', 'ActivityTypes', 'AgeGroups'];
        if (result.status === 'rejected') {
          console.error(`Failed to load ${names[index]}:`, result.reason);
        } else {
          console.log(`Successfully loaded ${names[index]}`);
        }
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSponsoredActivities = async () => {
    try {
      console.log('[Dashboard] Loading sponsored activities...');
      const sponsors = await activityService.getSponsoredActivities(6);
      console.log(`[Dashboard] Found ${sponsors.length} sponsored activities`);
      setSponsoredActivities(sponsors);
    } catch (error) {
      console.error('Error loading sponsored activities:', error);
      setSponsoredActivities([]);
    }
  };

  const loadRecommendedActivities = async () => {
    try {
      // Get user preferences for filtering
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();

      // Build filter params from preferences
      const filterParams: any = {
        limit: 6,
        offset: 0,
        hideFullActivities: true
      };

      // Apply global active filters first (from search screen)
      const activeFilters = preferencesService.getActiveFilters();
      if (activeFilters && Object.keys(activeFilters).length > 0) {
        Object.assign(filterParams, activeFilters);
        console.log('[Dashboard] Applying global active filters:', activeFilters);
      }

      // Apply activity type preferences (if not already set by global filters)
      if (!filterParams.activityTypes && preferences.preferredActivityTypes && preferences.preferredActivityTypes.length > 0) {
        filterParams.activityTypes = preferences.preferredActivityTypes;
      }

      // Apply age range preferences (only if changed from defaults and not already set)
      if (filterParams.ageMin === undefined && filterParams.ageMax === undefined && preferences.ageRanges && preferences.ageRanges.length > 0) {
        const ageRange = preferences.ageRanges[0];
        if (ageRange.min > 0 || ageRange.max < 18) {
          filterParams.ageMin = ageRange.min;
          filterParams.ageMax = ageRange.max;
        }
      }

      // Apply price range preferences (only if not unlimited - 10000+ means unlimited and not already set)
      if (filterParams.costMin === undefined && filterParams.costMax === undefined && preferences.priceRange && preferences.priceRange.max < 10000) {
        filterParams.costMin = preferences.priceRange.min;
        filterParams.costMax = preferences.priceRange.max;
      }

      // Apply location preferences (if not already set)
      if (!filterParams.locations && preferences.locations && preferences.locations.length > 0) {
        filterParams.locations = preferences.locations;
      }

      // Apply days of week preferences (only if not all 7 days selected and not already set)
      if (!filterParams.daysOfWeek && preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) {
        filterParams.daysOfWeek = preferences.daysOfWeek;
      }

      let response = await activityService.searchActivitiesPaginated(filterParams);
      console.log('Recommended activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        firstItem: response?.items?.[0]?.name
      });

      // If no results with preferences, try a broader search (location only, then no filters)
      if (!response?.items || response.items.length === 0) {
        console.log('No results with preferences, trying broader search...');

        // First fallback: just location filter
        if (preferences.locations && preferences.locations.length > 0) {
          const locationOnlyParams = {
            limit: 6,
            offset: 0,
            hideFullActivities: true,
            locations: preferences.locations
          };
          response = await activityService.searchActivitiesPaginated(locationOnlyParams);
          console.log('Location-only search result:', response?.items?.length, 'items');
        }

        // Second fallback: no filters at all - just get popular activities
        if (!response?.items || response.items.length === 0) {
          console.log('Still no results, fetching without filters...');
          const noFilterParams = {
            limit: 6,
            offset: 0,
            hideFullActivities: true,
            sortBy: 'createdAt',
            sortOrder: 'desc'
          };
          response = await activityService.searchActivitiesPaginated(noFilterParams);
          console.log('No-filter search result:', response?.items?.length, 'items');
        }
      }

      if (response?.items && Array.isArray(response.items) && response.items.length > 0) {
        // Shuffle results for variety on each load
        setRecommendedActivities(shuffleArray(response.items));
        console.log('Set recommended activities (shuffled):', response.items.length);
      } else {
        // Truly no activities found - set empty array to show empty state
        setRecommendedActivities([]);
        console.log('Recommended activities: No activities found even with fallback');
      }
    } catch (error) {
      console.error('Error loading recommended activities:', error);
      // On error, set empty to show error state
      setRecommendedActivities([]);
      console.log('Recommended activities: Error occurred');
    }
  };

  const loadBudgetFriendlyActivities = async () => {
    try {
      // Get user preferences
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      const maxBudgetAmount = preferences.maxBudgetFriendlyAmount || 20;

      // Build filter params from preferences
      const filterParams: any = {
        limit: 6,
        offset: 0,
        maxCost: maxBudgetAmount,  // Budget friendly limit
        hideFullActivities: true
      };

      // Apply global active filters first (from search screen)
      const activeFilters = preferencesService.getActiveFilters();
      if (activeFilters && Object.keys(activeFilters).length > 0) {
        Object.assign(filterParams, activeFilters);
        filterParams.maxCost = maxBudgetAmount; // Preserve budget limit
      }

      // Apply activity type preferences
      if (preferences.preferredActivityTypes && preferences.preferredActivityTypes.length > 0) {
        filterParams.activityTypes = preferences.preferredActivityTypes;
      }

      // Apply age range preferences (only if changed from defaults)
      if (preferences.ageRanges && preferences.ageRanges.length > 0) {
        const ageRange = preferences.ageRanges[0];
        if (ageRange.min > 0 || ageRange.max < 18) {
          filterParams.ageMin = ageRange.min;
          filterParams.ageMax = ageRange.max;
        }
      }

      // Apply location preferences
      if (preferences.locations && preferences.locations.length > 0) {
        filterParams.locations = preferences.locations;
      }

      // Apply days of week preferences (only if not all 7 days selected)
      if (preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) {
        filterParams.daysOfWeek = preferences.daysOfWeek;
      }

      const response = await activityService.searchActivitiesPaginated(filterParams);
      console.log('Budget friendly activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        maxBudget: maxBudgetAmount,
        firstItem: response?.items?.[0]?.name
      });
      if (response?.items && Array.isArray(response.items)) {
        // Shuffle results for variety on each load
        setBudgetFriendlyActivities(shuffleArray(response.items));
        console.log('Set budget friendly activities (shuffled):', response.items.length);
      }
    } catch (error) {
      console.error('Error loading budget activities:', error);
      setBudgetFriendlyActivities([]); // Set empty array on error
    }
  };

  const loadNewActivities = async () => {
    try {
      // Get user preferences
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();

      // Build filter params from preferences
      const filterParams: any = {
        limit: 6,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        hideFullActivities: true
      };

      // Apply global active filters first (from search screen)
      const activeFilters = preferencesService.getActiveFilters();
      if (activeFilters && Object.keys(activeFilters).length > 0) {
        Object.assign(filterParams, activeFilters);
      }

      // Apply activity type preferences
      if (preferences.preferredActivityTypes && preferences.preferredActivityTypes.length > 0) {
        filterParams.activityTypes = preferences.preferredActivityTypes;
      }

      // Apply age range preferences (only if changed from defaults)
      if (preferences.ageRanges && preferences.ageRanges.length > 0) {
        const ageRange = preferences.ageRanges[0];
        if (ageRange.min > 0 || ageRange.max < 18) {
          filterParams.ageMin = ageRange.min;
          filterParams.ageMax = ageRange.max;
        }
      }

      // Apply price range preferences (only if not unlimited - 10000+ means unlimited)
      if (preferences.priceRange && preferences.priceRange.max < 10000) {
        filterParams.costMin = preferences.priceRange.min;
        filterParams.costMax = preferences.priceRange.max;
      }

      // Apply location preferences
      if (preferences.locations && preferences.locations.length > 0) {
        filterParams.locations = preferences.locations;
      }

      // Apply days of week preferences (only if not all 7 days selected)
      if (preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) {
        filterParams.daysOfWeek = preferences.daysOfWeek;
      }

      const response = await activityService.searchActivitiesPaginated(filterParams);
      console.log('New activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        firstItem: response?.items?.[0]?.name
      });
      if (response?.items && Array.isArray(response.items)) {
        // Shuffle results for variety on each load
        setNewActivities(shuffleArray(response.items));
        console.log('Set new activities (shuffled):', response.items.length);
      }
    } catch (error) {
      console.error('Error loading new activities:', error);
      setNewActivities([]); // Set empty array on error
    }
  };

  const loadActivityTypes = async () => {
    try {
      console.log('Loading activity types from database...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/activity-types`);
      const result = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data)) {
        type ActivityTypeData = { code: string; name: string; iconName?: string; activityCount: number };
        let allTypes: ActivityTypeData[] = result.data;
        console.log('Found', allTypes.length, 'activity types in database');

        // Get user preferences to show preferred types first
        const preferencesService = PreferencesService.getInstance();
        const preferences = preferencesService.getPreferences();
        const preferredTypes = preferences.preferredActivityTypes || [];

        console.log('User preferred activity types:', preferredTypes);

        let selectedTypes: ActivityTypeData[] = [];

        // First, add user's preferred activity types
        if (preferredTypes.length > 0) {
          const preferred = allTypes.filter((type: ActivityTypeData) =>
            preferredTypes.some((pref: string) =>
              pref.toLowerCase() === type.name.toLowerCase() ||
              pref.toLowerCase() === type.code.toLowerCase()
            )
          );
          selectedTypes = [...preferred];
          console.log('Added', preferred.length, 'preferred types');
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
        setActivityTypes(selectedTypes);
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
      // Fallback to default types
      setActivityTypes([
        { id: 1, name: 'Swimming & Aquatics', code: 'swimming-aquatics', activityCount: 0 },
        { id: 2, name: 'Team Sports', code: 'team-sports', activityCount: 0 },
        { id: 3, name: 'Visual Arts', code: 'visual-arts', activityCount: 0 },
        { id: 4, name: 'Dance', code: 'dance', activityCount: 0 },
        { id: 5, name: 'Music', code: 'music', activityCount: 0 },
        { id: 6, name: 'Martial Arts', code: 'martial-arts', activityCount: 0 },
      ]);
    }
  };

  const loadAgeGroups = async () => {
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

  const renderActivityCard = (activity: Activity) => {
    // Get image based on activityType or category
    const activityTypeName = Array.isArray(activity.activityType)
      ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
      : (activity.activityType as any)?.name || activity.category || 'general';
    const subcategory = activity.activitySubtype?.name || activity.subcategory;
    const imageKey = getActivityImageKey(activityTypeName, subcategory, activity.name);
    const imageSource = getActivityImageByKey(imageKey, activityTypeName);
    const isFavorite = favoriteIds.has(activity.id);
    const isOnCalendar = (activityChildrenMap[activity.id] || []).length > 0;

    // Format date range display
    let dateRangeText = null;
    if (activity.dateRange && activity.dateRange.start && activity.dateRange.end) {
      const start = new Date(activity.dateRange.start);
      const end = new Date(activity.dateRange.end);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateRangeText = `${startStr} - ${endStr}`;
    } else if (activity.startDate && activity.endDate) {
      const start = new Date(activity.startDate);
      const end = new Date(activity.endDate);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateRangeText = `${startStr} - ${endStr}`;
    } else if (activity.dates) {
      dateRangeText = activity.dates;
    }

    // Check if activity is in progress
    const isInProgress = (() => {
      const now = new Date();
      if (activity.dateRange && activity.dateRange.start && activity.dateRange.end) {
        const start = new Date(activity.dateRange.start);
        const end = new Date(activity.dateRange.end);
        return now >= start && now <= end;
      }
      if (activity.startDate && activity.endDate) {
        const start = new Date(activity.startDate);
        const end = new Date(activity.endDate);
        return now >= start && now <= end;
      }
      return false;
    })();

    // Extract days of week from sessions, schedule object, or schedule string
    const getDaysOfWeek = (): string | null => {
      const daysSet = new Set<string>();
      const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      // Extract from sessions array
      if (activity.sessions && activity.sessions.length > 0) {
        activity.sessions.forEach(session => {
          if (session.dayOfWeek) {
            const day = session.dayOfWeek.substring(0, 3);
            const normalized = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
            if (dayOrder.includes(normalized)) {
              daysSet.add(normalized);
            }
          }
        });
      }

      // Extract from schedule object with days array
      if (activity.schedule && typeof activity.schedule === 'object' && !Array.isArray(activity.schedule)) {
        const scheduleObj = activity.schedule as { days?: string[] };
        if (scheduleObj.days && Array.isArray(scheduleObj.days)) {
          scheduleObj.days.forEach(day => {
            const abbrev = day.substring(0, 3);
            const normalized = abbrev.charAt(0).toUpperCase() + abbrev.slice(1).toLowerCase();
            if (dayOrder.includes(normalized)) {
              daysSet.add(normalized);
            }
          });
        }
      }

      // Extract from schedule string (e.g., "Mon, Wed, Fri 9:00am - 10:00am")
      if (typeof activity.schedule === 'string' && activity.schedule) {
        const dayPatterns = [
          /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi,
          /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
          /\b(Mons|Tues|Weds|Thurs|Fris|Sats|Suns)\b/gi
        ];

        dayPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(activity.schedule as string)) !== null) {
            const day = match[1].substring(0, 3);
            const normalized = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
            if (dayOrder.includes(normalized)) {
              daysSet.add(normalized);
            }
          }
        });
      }

      if (daysSet.size === 0) return null;

      // Sort days in order
      const sortedDays = Array.from(daysSet).sort((a, b) =>
        dayOrder.indexOf(a) - dayOrder.indexOf(b)
      );

      // Check for common patterns
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const weekend = ['Sat', 'Sun'];

      if (sortedDays.length === 5 && weekdays.every(d => sortedDays.includes(d))) {
        return 'Weekdays';
      }
      if (sortedDays.length === 2 && weekend.every(d => sortedDays.includes(d))) {
        return 'Weekends';
      }
      if (sortedDays.length === 7) {
        return 'Daily';
      }

      return sortedDays.join(', ');
    };

    const daysOfWeekText = getDaysOfWeek();

    // Format time only
    let timeText = null;
    if (activity.sessions && Array.isArray(activity.sessions) && activity.sessions.length > 0) {
      const firstSession = activity.sessions[0];
      if (firstSession.startTime || firstSession.endTime) {
        timeText = `${firstSession.startTime || ''}${firstSession.startTime && firstSession.endTime ? ' - ' : ''}${firstSession.endTime || ''}`;
      }
    } else if (activity.startTime || activity.endTime) {
      timeText = `${activity.startTime || ''}${activity.startTime && activity.endTime ? ' - ' : ''}${activity.endTime || ''}`;
    }
    
    // Format age display
    let ageText = 'All ages';
    if (activity.ageRange) {
      if (activity.ageRange.min && activity.ageRange.max) {
        ageText = `Ages ${activity.ageRange.min}-${activity.ageRange.max}`;
      } else if (activity.ageRange.min) {
        ageText = `Ages ${activity.ageRange.min}+`;
      }
    } else if (activity.ageMin && activity.ageMax) {
      ageText = `Ages ${activity.ageMin}-${activity.ageMax}`;
    } else if (activity.ageMin) {
      ageText = `Ages ${activity.ageMin}+`;
    }
    
    // Get price - check both cost and price fields
    const price = activity.cost || activity.price;
    
    // Format spots remaining
    let spotsText = '';
    if (activity.spotsAvailable !== undefined && activity.spotsAvailable !== null) {
      if (activity.spotsAvailable === 0) {
        spotsText = 'Full';
      } else if (activity.spotsAvailable === 1) {
        spotsText = 'Only 1 spot left!';
      } else if (activity.spotsAvailable <= 5) {
        spotsText = `Only ${activity.spotsAvailable} spots left!`;
      } else {
        spotsText = `${activity.spotsAvailable} spots available`;
      }
    }

    const handleShare = async () => {
      try {
        const locationName = typeof activity.location === 'string'
          ? activity.location
          : activity.location?.name || activity.locationName || '';

        const message = `Check out this activity: ${activity.name}${locationName ? ` at ${locationName}` : ''}`;

        await Share.share({
          message,
          title: activity.name,
        });
      } catch (error) {
        console.error('Error sharing activity:', error);
      }
    };

    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.card}
        onPress={() => handleNavigate('ActivityDetail', { activity })}
      >
        <View style={styles.cardImageContainer}>
          <Image source={imageSource} style={styles.cardImage} />

          {/* Action buttons row - favorites, waitlist, share, calendar */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleFavorite(activity);
              }}
            >
              <Icon
                name={isFavorite ? "heart" : "heart-outline"}
                size={16}
                color={isFavorite ? "#E8638B" : "#FFF"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={async (e) => {
                e.stopPropagation();
                const isOnWaitlist = waitlistService.isOnWaitlist(activity.id);
                if (!isOnWaitlist && !canAddToWaitlist) {
                  onWaitlistLimitReached();
                  return;
                }
                await waitlistService.toggleWaitlist(activity);
                syncWaitlistCount();
                loadWaitlistCount();
              }}
            >
              <Icon
                name={waitlistService.isOnWaitlist(activity.id) ? "bell-ring" : "bell-outline"}
                size={16}
                color={waitlistService.isOnWaitlist(activity.id) ? "#FFB800" : "#FFF"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Icon name="share-variant" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                setCalendarModalActivity(activity);
              }}
            >
              <Icon
                name={isOnCalendar ? "calendar-check" : "calendar-plus"}
                size={16}
                color={isOnCalendar ? "#4ECDC4" : "#FFF"}
              />
            </TouchableOpacity>
          </View>

          {/* Price overlay */}
          <View style={styles.priceOverlay}>
            <Text style={styles.priceText}>{formatActivityPrice(price)}</Text>
            {price && price > 0 && <Text style={styles.perChildText}>per child</Text>}
          </View>
          
          {/* NEW badge if recently added */}
          {activity.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}

          {/* Featured badge for featured partner activities */}
          {activity.isFeatured && (
            <View style={styles.featuredBadge}>
              <Icon name="star" size={10} color="#FFF" />
              <Text style={styles.featuredBadgeText}>FEATURED</Text>
            </View>
          )}

          {/* On Calendar badge */}
          {isOnCalendar && (
            <View style={styles.calendarBadge}>
              <Icon name="calendar-check" size={10} color="#FFF" />
              <Text style={styles.calendarBadgeText}>ON CALENDAR</Text>
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{cleanActivityName(activity.name)}</Text>
          
          <View style={styles.cardLocationRow}>
            <Icon name="map-marker" size={12} color="#717171" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {typeof activity.location === 'string' ? activity.location : activity.location?.name || activity.locationName || 'Location TBD'}
            </Text>
          </View>
          
          {isInProgress && dateRangeText && (
            <View style={styles.cardInfoRow}>
              <Icon name="calendar" size={12} color="#4CAF50" />
              <Text style={[styles.cardDetails, { color: '#4CAF50', fontWeight: '600' }]}>In Progress</Text>
              <Text style={styles.cardDetails}> • {dateRangeText}</Text>
            </View>
          )}

          {!isInProgress && dateRangeText && (
            <View style={styles.cardInfoRow}>
              <Icon name="calendar" size={12} color="#717171" />
              <Text style={styles.cardDetails}>{dateRangeText}</Text>
            </View>
          )}

          {/* Combined days and time row */}
          {(daysOfWeekText || timeText) && (
            <View style={styles.daysRow}>
              <Icon name="calendar-week" size={12} color="#E8638B" />
              <Text style={styles.daysText}>
                {daysOfWeekText}{daysOfWeekText && timeText ? ' • ' : ''}{timeText ? timeText : ''}
              </Text>
            </View>
          )}
          
          <View style={styles.cardInfoRow}>
            <Icon name="account-child" size={12} color="#717171" />
            <Text style={styles.cardDetails}>{ageText}</Text>
          </View>
          
          {/* Spots remaining */}
          {spotsText && (
            <View style={[styles.spotsContainer, (activity.spotsAvailable ?? 0) <= 5 ? styles.spotsUrgent : styles.spotsNormal]}>
              <Icon
                name={(activity.spotsAvailable ?? 0) === 0 ? "close-circle" : "information"}
                size={12}
                color={(activity.spotsAvailable ?? 0) <= 5 ? "#D93025" : "#717171"}
              />
              <Text style={[styles.spotsText, (activity.spotsAvailable ?? 0) <= 5 ? styles.spotsTextUrgent : styles.spotsTextNormal]}>
                {spotsText}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Tab Navigation - Fixed at top */}
        <TopTabNavigation />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E8638B" />
          </View>
        ) : (
          <>
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
      >
        {/* Trial Countdown Banner - shown when user is trialing */}
        <TrialCountdownBanner
          isTrialing={isTrialing}
          daysRemaining={trialDaysRemaining ?? 0}
        />

        {/* Featured Partners / Sponsor Section - only shown when sponsors exist */}
        {sponsoredActivities.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => handleNavigate('FeaturedPartners')}
            >
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>Featured Partners</Text>
                <Icon name="chevron-right" size={20} color="#222" style={styles.chevronIcon} />
              </View>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {sponsoredActivities.map(renderActivityCard)}
            </ScrollView>
          </View>
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
                <Text style={styles.aiBannerSubtitle}>Get personalized activity suggestions</Text>
              </View>
              <Icon name="chevron-right" size={22} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          {/* Robot image overlapping outside the banner */}
          <Image source={aiRobotImage} style={styles.aiRobotImageOverlay} />
        </View>

        {/* Waiting List Banner - only shown when user has items on waitlist */}
        {waitlistCount > 0 && (
          <TouchableOpacity
            style={styles.waitlistBanner}
            onPress={() => navigation.navigate('WaitingList')}
          >
            <View style={styles.waitlistBannerContent}>
              <View style={styles.waitlistBannerLeft}>
                <Icon name="bell-ring" size={24} color="#FFB800" />
                <View style={styles.waitlistBannerText}>
                  <Text style={styles.waitlistBannerTitle}>
                    Your Waiting List
                    {waitlistAvailableCount > 0 && (
                      <Text style={styles.waitlistBannerAvailable}> • {waitlistAvailableCount} available!</Text>
                    )}
                  </Text>
                  <Text style={styles.waitlistBannerSubtitle}>
                    {waitlistCount} {waitlistCount === 1 ? 'activity' : 'activities'} being monitored
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={20} color="#222" />
            </View>
          </TouchableOpacity>
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
            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="small" color="#E8638B" />
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            ) : reloading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#E8638B" />
                <Text style={styles.emptyText}>Refreshing...</Text>
              </View>
            ) : recommendedActivities.length > 0 ? (
              recommendedActivities.map(renderActivityCard)
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
            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="small" color="#E8638B" />
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            ) : newActivities.length > 0 ? (
              newActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No new activities</Text>
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
            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="small" color="#E8638B" />
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            ) : budgetFriendlyActivities.length > 0 ? (
              budgetFriendlyActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No budget friendly activities</Text>
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
            {activityTypes.map((type) => {
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
            })}
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
            {ageGroups.map((group) => {
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
            })}
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

      {/* Upgrade Modal for waitlist limit */}
      <UpgradePromptModal
        visible={showWaitlistUpgradeModal}
        feature="waitlist"
        onClose={hideWaitlistUpgradeModal}
        currentCount={subscriptionWaitlistCount}
        limit={waitlistLimit}
      />

      {/* Add to Calendar Modal */}
      {calendarModalActivity && (
        <AddToCalendarModal
          visible={!!calendarModalActivity}
          activity={calendarModalActivity}
          onClose={() => setCalendarModalActivity(null)}
        />
      )}
          </>
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
  aiRobotImageOverlay: {
    position: 'absolute',
    right: 0,
    top: -15,
    width: 75,
    height: 75,
    resizeMode: 'contain',
  },
  waitlistBanner: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FFB800',
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  waitlistBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  waitlistBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  waitlistBannerText: {
    flex: 1,
  },
  waitlistBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  waitlistBannerAvailable: {
    color: '#22C55E',
    fontWeight: '700',
  },
  waitlistBannerSubtitle: {
    fontSize: 13,
    color: '#717171',
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
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
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
    backgroundColor: '#E8638B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  sponsoredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  featuredBadge: {
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
  featuredBadgeText: {
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
});

export default DashboardScreenModern;