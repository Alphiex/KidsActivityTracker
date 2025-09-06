import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import PreferencesService from '../services/preferencesService';
import ActivityService from '../services/activityService';
import ActivityTypeService from '../services/activityTypeService';
import FavoritesService from '../services/favoritesService';
import { Colors } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getActivityTypeIcon } from '../utils/activityTypeIcons';
import { Alert, ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const [preferences, setPreferences] = useState(preferencesService.getPreferences());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { colors, isDark } = useTheme();
  const { isConnected } = useNetworkStatus();
  const [recommendedCount, setRecommendedCount] = useState(0);
  console.log('Dashboard: Component rendering, recommendedCount state:', recommendedCount);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  const [stats, setStats] = useState({
    matchingActivities: 0,
    newThisWeek: 0,
    savedFavorites: 0,
    upcomingEvents: 0,
    budgetFriendly: 0,
    budgetFriendlyUnfiltered: 0,
    budgetFriendlyFilteredOut: 0,
  });
  const [categories, setCategories] = useState<Array<{ id: string; name: string; count: number; icon: string }>>([]);
  const [activityTypes, setActivityTypes] = useState<Array<{ code: string; name: string; count: number; icon: string }>>([]);

  // Define category icons for age-based categories (NOT activity types)
  const categoryIcons = {
    'Early Years: Parent Participation': 'account-child',
    'Early Years: On My Own': 'baby-face',
    'School Age': 'school',
    'Youth': 'account-group',
    'All Ages & Family': 'family'
  };

  // Define activity type icons (for Browse by Activity Type section)
  const activityTypeIcons = {
    'Sports': 'basketball',
    'Arts': 'palette',
    'Music': 'music-note',
    'Science': 'flask',
    'Dance': 'dance-ballroom',
    'Education': 'school',
    'Outdoor': 'tree',
    'Indoor': 'home',
    'Swimming': 'swim',
    'Martial Arts': 'karate',
    'Drama': 'drama-masks',
    'Technology': 'laptop',
    'Team Sports': 'basketball',
    'Racquet Sports': 'tennis',
    'Aquatic Leadership': 'pool',
    'Camps': 'tent',
  };

  const loadRecommendedCount = async () => {
    console.log('****** DASHBOARD loadRecommendedCount CALLED ******');
    try {
      setLoadingRecommended(true);
      const activityService = ActivityService.getInstance();
      
      // Use the state preferences to match RecommendedActivitiesScreen behavior
      // RecommendedActivitiesScreen uses preferences from component level, not fresh ones
      const currentPreferences = preferences; // Use state, not fresh
      console.log('Dashboard: Current preferences:', JSON.stringify({
        preferredCategories: currentPreferences.preferredCategories,
        priceRange: currentPreferences.priceRange,
        ageRanges: currentPreferences.ageRanges,
        hideClosedActivities: currentPreferences.hideClosedActivities,
        hideFullActivities: currentPreferences.hideFullActivities
      }));
      
      // Create filters based on user preferences - MUST match RecommendedActivitiesScreen exactly
      // Use limit: 1 for efficiency - we only need the total count, not the items
      // The backend should return the FULL total regardless of limit
      const filters: any = {
        limit: 1,  // Small limit for efficiency - backend returns full total in pagination.total
        offset: 0
      };
      
      // Apply user preference filters
      if (currentPreferences.hideClosedActivities) {
        filters.hideClosedActivities = true;
      }
      if (currentPreferences.hideFullActivities) {
        filters.hideFullActivities = true;
      }
      
      // Apply activity type filters from preferredCategories
      // preferredCategories contains activity type names like "Swimming & Aquatics", "Dance", etc.
      if (currentPreferences.preferredCategories && currentPreferences.preferredCategories.length > 0) {
        filters.activityTypes = currentPreferences.preferredCategories;
      }
      
      if (currentPreferences.locations && currentPreferences.locations.length > 0) {
        filters.locations = currentPreferences.locations;
      }
      
      if (currentPreferences.priceRange) {
        filters.maxCost = currentPreferences.priceRange.max;
      }
      
      // Apply age range if set - THIS WAS MISSING!
      if (currentPreferences.ageRanges && currentPreferences.ageRanges.length > 0) {
        const ageRange = currentPreferences.ageRanges[0];
        filters.ageRange = {
          min: ageRange.min,
          max: ageRange.max
        };
      }
      
      // Apply schedule preferences
      if (currentPreferences.daysOfWeek && currentPreferences.daysOfWeek.length > 0 && currentPreferences.daysOfWeek.length < 7) {
        filters.daysOfWeek = currentPreferences.daysOfWeek;
      }
      
      if (currentPreferences.timePreferences) {
        filters.timePreferences = currentPreferences.timePreferences;
      }
      
      // Use searchActivitiesPaginated to get the EXACT same count as RecommendedActivitiesScreen
      console.log('DASHBOARD: Filters being sent:', JSON.stringify(filters, null, 2));
      const response = await activityService.searchActivitiesPaginated(filters);
      console.log('DASHBOARD: API Response:', {
        total: response.total,
        itemsReturned: response.items?.length || 0,
        hasMore: response.hasMore
      });
      const countToSet = response.total || 0;
      console.log('****** DASHBOARD: Setting recommendedCount to:', countToSet, '******');
      setRecommendedCount(countToSet);
    } catch (error) {
      console.error('Error loading recommended count:', error);
      setRecommendedCount(0);
    } finally {
      setLoadingRecommended(false);
    }
  };

  const loadDashboardData = async () => {
    console.log('====== DASHBOARD: Starting loadDashboardData ======');
    try {
      setError(null);
      
      // Check network status first
      if (isConnected === false) {
        setError('No internet connection');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Refresh preferences to ensure we have the latest
      const latestPreferences = preferencesService.getPreferences();
      setPreferences(latestPreferences);
      console.log('DASHBOARD: Preferences loaded:', JSON.stringify({
        preferredCategories: latestPreferences.preferredCategories,
        priceRange: latestPreferences.priceRange,
        ageRanges: latestPreferences.ageRanges
      }));
      
      const activityService = ActivityService.getInstance();
      const favoritesService = FavoritesService.getInstance();
      
      // Load recommended count
      console.log('DASHBOARD: About to call loadRecommendedCount');
      await loadRecommendedCount();
      // Don't log recommendedCount here - it won't be updated yet due to React's async state
      
      // Fetch age-based categories for Browse by Category section
      try {
        console.log('DASHBOARD: Fetching categories...');
        const response = await fetch('http://localhost:3000/api/v1/categories');
        const categoriesData = await response.json();
        
        if (categoriesData.success) {
          const categoriesWithIcons = categoriesData.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            count: cat.activityCount,
            icon: categoryIcons[cat.name] || 'tag'
          }));
          setCategories(categoriesWithIcons);
          console.log('DASHBOARD: Categories loaded:', categoriesWithIcons.length);
        }
      } catch (catError) {
        console.error('Error fetching categories:', catError);
      }
      
      // Fetch activity types with counts (apply user's hide filters)
      try {
        const types = await activityService.getActivityTypesWithCounts(true);
        
        // Use the counts from the API directly - they're already correct
        const typesWithCounts = types.map((type) => ({
          code: type.code,
          name: type.name,
          count: type.activityCount || 0,  // Use the count from API
          icon: getActivityTypeIcon(type.name),
        }));
        
        // Sort by user preferences first, then by count
        const preferredTypes = preferences.preferredActivityTypes || preferences.preferredCategories || [];
        const sortedTypes = typesWithCounts.sort((a, b) => {
          const aPreferred = preferredTypes.includes(a.name);
          const bPreferred = preferredTypes.includes(b.name);
          
          if (aPreferred && !bPreferred) return -1;
          if (!aPreferred && bPreferred) return 1;
          
          // If both are preferred or neither, sort by preference order then count
          if (aPreferred && bPreferred) {
            const aIndex = preferredTypes.indexOf(a.name);
            const bIndex = preferredTypes.indexOf(b.name);
            return aIndex - bIndex;
          }
          
          return b.count - a.count;
        });
        
        // Show first 6 activity types
        setActivityTypes(sortedTypes.slice(0, 6));
      } catch (typeError) {
        console.error('Error fetching activity types:', typeError);
      }
      
      // Get favorites count
      const favorites = await favoritesService.getFavorites();
      
      // Get matching activities count using API filtering
      const preferencesFilters: any = {};
      if (preferences.preferredCategories && preferences.preferredCategories.length > 0) {
        preferencesFilters.activityTypes = preferences.preferredCategories;
      }
      if (preferences.ageRanges && preferences.ageRanges.length > 0) {
        // Use the first age range for simplicity
        const ageRange = preferences.ageRanges[0];
        preferencesFilters.ageMin = ageRange.min;
        preferencesFilters.ageMax = ageRange.max;
      }
      if (preferences.locations && preferences.locations.length > 0) {
        preferencesFilters.locations = preferences.locations;
      }
      if (preferences.priceRange) {
        preferencesFilters.maxCost = preferences.priceRange.max;
      }
      if (preferences.hideClosedActivities) {
        preferencesFilters.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        preferencesFilters.hideFullActivities = true;
      }
      
      // Apply time preferences to match RecommendedActivitiesScreen behavior
      if (preferences.timePreferences) {
        preferencesFilters.timePreferences = preferences.timePreferences;
      }
      
      // Get matching activities count
      const matchingParams = { ...preferencesFilters, limit: 1, offset: 0 };
      const matchingResult = await activityService.searchActivitiesPaginated(matchingParams);
      const matchingActivities = matchingResult.total || 0;

      // Get new activities count (activities added to database in the last week)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newActivitiesParams: any = {
        createdAfter: oneWeekAgo.toISOString(),  // Use createdAfter for truly new activities
        limit: 1,
        offset: 0
      };
      if (preferences.hideClosedActivities) {
        newActivitiesParams.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        newActivitiesParams.hideFullActivities = true;
      }
      
      const newActivitiesResult = await activityService.searchActivitiesPaginated(newActivitiesParams);
      const newThisWeek = newActivitiesResult.total || 0;

      // Get upcoming events count using API date filtering
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const upcomingParams: any = {
        startDateAfter: today.toISOString(),
        startDateBefore: nextWeek.toISOString(),
        limit: 1,
        offset: 0
      };
      if (preferences.hideClosedActivities) {
        upcomingParams.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        upcomingParams.hideFullActivities = true;
      }
      
      const upcomingResult = await activityService.searchActivitiesPaginated(upcomingParams);
      const upcomingEvents = upcomingResult.total || 0;

      // Get budget-friendly activities count - both filtered and unfiltered
      // Must match EXACTLY what ActivityTypeScreen applies for Budget Friendly
      const budgetFriendlyParams: any = {
        maxCost: preferences.maxBudgetFriendlyAmount || 20,
        limit: 1,
        offset: 0
      };
      
      // Apply ALL global filters to match ActivityTypeScreen exactly
      if (preferences.hideClosedActivities) {
        budgetFriendlyParams.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        budgetFriendlyParams.hideFullActivities = true;
      }
      
      // Apply location filters (ActivityTypeScreen applies these)
      if (preferences.locations && preferences.locations.length > 0) {
        budgetFriendlyParams.locations = preferences.locations;
      }
      
      // Apply age range filter (ActivityTypeScreen applies these)
      if (preferences.ageRanges && preferences.ageRanges.length > 0) {
        const ageRange = preferences.ageRanges[0];
        budgetFriendlyParams.ageMin = ageRange.min;
        budgetFriendlyParams.ageMax = ageRange.max;
      }
      
      // Apply schedule preferences (ActivityTypeScreen applies these)
      if (preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) {
        budgetFriendlyParams.daysOfWeek = preferences.daysOfWeek;
      }
      
      // Apply time preferences (ActivityTypeScreen applies these)
      if (preferences.timePreferences) {
        budgetFriendlyParams.timePreferences = preferences.timePreferences;
      }
      
      const budgetFriendlyResult = await activityService.searchActivitiesPaginated(budgetFriendlyParams);
      const budgetFriendly = budgetFriendlyResult.total || 0;

      // Also get unfiltered count for Budget Friendly if global filters are active
      // "Unfiltered" means without hideClosedActivities/hideFullActivities, but keeping user preference filters
      let budgetFriendlyUnfiltered = budgetFriendly;
      let budgetFriendlyFilteredOut = 0;
      
      if (preferences.hideClosedActivities || preferences.hideFullActivities) {
        try {
          const unfilteredBudgetParams = {
            maxCost: preferences.maxBudgetFriendlyAmount || 20,
            limit: 1,
            offset: 0
          };
          
          // Keep user preference filters (these are not "global settings")
          if (preferences.locations && preferences.locations.length > 0) {
            unfilteredBudgetParams.locations = preferences.locations;
          }
          if (preferences.ageRanges && preferences.ageRanges.length > 0) {
            const ageRange = preferences.ageRanges[0];
            unfilteredBudgetParams.ageMin = ageRange.min;
            unfilteredBudgetParams.ageMax = ageRange.max;
          }
          if (preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) {
            unfilteredBudgetParams.daysOfWeek = preferences.daysOfWeek;
          }
          if (preferences.timePreferences) {
            unfilteredBudgetParams.timePreferences = preferences.timePreferences;
          }
          
          const unfilteredBudgetResult = await activityService.searchActivitiesPaginated(unfilteredBudgetParams);
          budgetFriendlyUnfiltered = unfilteredBudgetResult.total || 0;
          budgetFriendlyFilteredOut = budgetFriendlyUnfiltered - budgetFriendly;
        } catch (error) {
          console.error('Error fetching unfiltered budget friendly count:', error);
          budgetFriendlyUnfiltered = budgetFriendly;
          budgetFriendlyFilteredOut = 0;
        }
      }

      setStats({
        matchingActivities,
        newThisWeek,
        savedFavorites: favorites.length,
        upcomingEvents,
        budgetFriendly,
        budgetFriendlyUnfiltered,
        budgetFriendlyFilteredOut,
      });
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setError(error.message || 'Failed to load activities');
      // Set default stats on error
      setStats({
        matchingActivities: 0,
        newThisWeek: 0,
        savedFavorites: 0,
        upcomingEvents: 0,
        budgetFriendly: 0,
        budgetFriendlyUnfiltered: 0,
        budgetFriendlyFilteredOut: 0,
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Dashboard: Initial useEffect triggered');
    loadDashboardData();
  }, []);

  // Add a separate effect to reload count when preferences change
  useEffect(() => {
    console.log('Dashboard: Preferences changed, reloading count');
    loadRecommendedCount();
  }, [preferences.preferredCategories?.join(','), preferences.priceRange?.max, preferences.ageRanges?.[0]?.min, preferences.ageRanges?.[0]?.max]);

  // Refresh dashboard when screen comes into focus (e.g., returning from favorites)
  useFocusEffect(
    React.useCallback(() => {
      console.log('Dashboard: Screen focused, refreshing data');
      loadDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const navigateToRecommended = () => {
    navigation.navigate('RecommendedActivities');
  };

  const navigateToActivityType = (type: { code: string; name: string }) => {
    navigation.navigate('ActivityTypeDetail', { 
      typeCode: type.code,
      typeName: type.name
    });
  };

  const navigateToAllActivityTypes = () => {
    navigation.navigate('AllActivityTypes');
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.greeting}>Discover Activities</Text>
          <Text style={styles.subtitle}>
            Find the perfect activities for your kids
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Icon name="cog" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderRecommended = () => {
    console.log('Dashboard: Rendering recommended section, count:', recommendedCount, 'loading:', loadingRecommended);
    return (
    <TouchableOpacity onPress={navigateToRecommended} activeOpacity={0.8}>
      <LinearGradient
        colors={['#9C27B0', '#7B1FA2']}
        style={styles.recommendedCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.recommendedContent}>
          <View style={styles.recommendedLeft}>
            <Icon name="star" size={40} color="#fff" />
            <View style={styles.recommendedTextContainer}>
              <Text style={styles.recommendedTitle}>Recommended for You</Text>
              <Text style={styles.recommendedCount}>
                {loadingRecommended ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  (() => {
                    console.log('Dashboard: Rendering count text, recommendedCount is:', recommendedCount);
                    return `${recommendedCount} ${recommendedCount === 1 ? 'activity matches' : 'activities match'} your preferences`;
                  })()
                )}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={30} color="#fff" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
  };

  const renderQuickActions = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('CityBrowse')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#2196F3', '#1976D2']}
            style={styles.quickActionGradient}
          >
            <Icon name="map-marker" size={30} color="#fff" />
            <Text style={styles.quickActionText}>Browse by Location</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('Favorites')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#FF5722', '#E64A19']}
            style={styles.quickActionGradient}
          >
            <Icon name="heart" size={30} color="#fff" />
            <Text style={styles.quickActionText}>Favourites</Text>
            <Text style={styles.quickActionCount}>{stats.savedFavorites} activities</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDiscoverActivities = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Discover Activities</Text>
      
      {/* New This Week Card */}
      <TouchableOpacity onPress={() => navigation.navigate('NewActivities')} activeOpacity={0.8}>
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.discoverCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.discoverContent}>
            <View style={styles.discoverLeft}>
              <Icon name="new-box" size={35} color="#fff" />
              <View style={styles.discoverTextContainer}>
                <Text style={styles.discoverTitle}>New This Week</Text>
                <Text style={styles.discoverSubtext}>{stats.newThisWeek} new activities</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color="#fff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Budget Friendly Card */}
      <TouchableOpacity 
        onPress={() => navigation.navigate('ActivityType', { 
          category: 'Budget Friendly',
          filters: { maxCost: preferences.maxBudgetFriendlyAmount || 20 }
        })} 
        activeOpacity={0.8} 
        style={styles.discoverCardWrapper}
      >
        <LinearGradient
          colors={['#FFC107', '#F57C00']}
          style={styles.discoverCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.discoverContent}>
            <View style={styles.discoverLeft}>
              <Icon name="cash" size={35} color="#fff" />
              <View style={styles.discoverTextContainer}>
                <Text style={styles.discoverTitle}>Budget Friendly</Text>
                <Text style={styles.discoverSubtext}>
                  {stats.budgetFriendlyFilteredOut > 0 ? (
                    `${stats.budgetFriendly} activities under $${preferences.maxBudgetFriendlyAmount || 20} (${stats.budgetFriendlyFilteredOut} filtered out)`
                  ) : (
                    `${stats.budgetFriendly} activities under $${preferences.maxBudgetFriendlyAmount || 20}`
                  )}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color="#fff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderActivityTypes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Activity Type</Text>
        <TouchableOpacity onPress={navigateToAllActivityTypes}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.categoriesGrid}>
        {activityTypes.map((type, index) => (
          <TouchableOpacity
            key={index}
            style={styles.categoryCard}
            onPress={() => navigateToActivityType(type)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.cardBackground, colors.background]}
              style={styles.categoryGradient}
            >
              <Icon name={type.icon} size={40} color={colors.primary} />
              <Text style={[styles.categoryName, { color: colors.text }]}>{type.name}</Text>
              <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                {type.count} activities
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Category</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AllCategories')}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.categoriesGrid}>
        {categories.map((category, index) => (
          <TouchableOpacity
            key={index}
            style={styles.categoryCard}
            onPress={() => navigation.navigate('CategoryDetail', { 
              categoryId: category.id,
              categoryName: category.name 
            })}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.cardBackground, colors.background]}
              style={styles.categoryGradient}
            >
              <Icon name={category.icon} size={40} color={colors.primary} />
              <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
              <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                {category.count} activities
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading activities...</Text>
      </View>
    );
  }

  if (error && !refreshing) {
    const isOffline = isConnected === false;
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Icon 
          name={isOffline ? "wifi-off" : "alert-circle"} 
          size={60} 
          color={isOffline ? colors.textSecondary : colors.error} 
        />
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={loadDashboardData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {renderHeader()}
      {renderRecommended()}
      {renderQuickActions()}
      {renderDiscoverActivities()}
      {renderActivityTypes()}
      {renderCategories()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  settingsButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  recommendedCard: {
    margin: 20,
    marginBottom: 10,
    padding: 20,
    borderRadius: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recommendedContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommendedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recommendedTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  recommendedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  recommendedCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    marginTop: 25,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  quickActionCard: {
    width: '48%',
  },
  quickActionGradient: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    height: 110,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },
  quickActionCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  discoverCardWrapper: {
    marginTop: 12,
  },
  discoverCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  discoverContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discoverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  discoverTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  discoverTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  discoverSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    marginBottom: 15,
  },
  categoryGradient: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  categoryCount: {
    fontSize: 14,
    marginTop: 5,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DashboardScreen;