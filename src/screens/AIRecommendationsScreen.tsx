import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import aiService from '../services/aiService';
import PreferencesService from '../services/preferencesService';
import locationService from '../services/locationService';
import childPreferencesService from '../services/childPreferencesService';
import { useAppSelector } from '../store';
import {
  selectAllChildren,
  selectSelectedChildIds,
  selectFilterMode,
} from '../store/slices/childrenSlice';
import { AIRecommendation, AIRecommendationResponse, AISourceType } from '../types/ai';
import { Activity } from '../types';
import {
  AIRecommendButton,
  AIRecommendationCard,
  AISourceBadge,
  AILoadingState,
  AIErrorState,
} from '../components/ai';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';
import ChildFilterSelector from '../components/ChildFilterSelector';

interface RouteParams {
  search_intent?: string;
  filters?: any;
}

/**
 * AI Recommendations Screen
 * 
 * Full-screen experience for AI-powered activity recommendations
 * Shows personalized results with explanations
 */
const AIRecommendationsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { colors, isDark } = useTheme();

  // Get children and filter state from Redux store
  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const filterMode = useAppSelector(selectFilterMode);

  // Get selected children only
  const selectedChildren = useMemo(() => {
    if (!selectedChildIds || selectedChildIds.length === 0) return children;
    return children.filter(c => selectedChildIds.includes(c.id));
  }, [children, selectedChildIds]);

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AIRecommendationResponse | null>(null);
  const [activities, setActivities] = useState<Map<string, Activity>>(new Map());
  const [source, setSource] = useState<AISourceType>('heuristic');

  // Get params from route - use useMemo to prevent new object references on every render
  const searchIntent = route.params?.search_intent || 'Find the best activities for my family';
  const filters = useMemo(() => route.params?.filters || {}, [route.params?.filters]);

  // Calculate age range from selected children
  const childrenAgeRange = useMemo(() => {
    if (!selectedChildren || selectedChildren.length === 0) return null;

    const ages = selectedChildren.map(child => {
      const birthDate = new Date(child.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }).filter(age => age >= 0 && age <= 18);

    if (ages.length === 0) return null;

    // Apply filter mode logic
    if (filterMode === 'or') {
      // OR: expand range to include all selected children
      return {
        min: Math.max(0, Math.min(...ages) - 1),
        max: Math.min(18, Math.max(...ages) + 1),
      };
    } else {
      // AND: narrow range to overlap (activities all children can do)
      return {
        min: Math.max(...ages),
        max: Math.min(...ages),
      };
    }
  }, [selectedChildren, filterMode]);
  
  /**
   * Fetch AI recommendations
   */
  const fetchRecommendations = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      // Get merged child preferences (combines all selected children's preferences)
      const childIds = selectedChildIds?.length > 0 ? selectedChildIds : children.map(c => c.id);
      const mergedChildPrefs = childPreferencesService.getMergedPreferences(childIds, filterMode || 'or');

      // Get user preferences as fallback
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();

      // Get user's effective location (GPS or saved address)
      let locationData: { city?: string; latitude?: number; longitude?: number } = {};
      try {
        const effectiveLocation = await locationService.getEffectiveLocation();
        if (effectiveLocation) {
          locationData = {
            latitude: effectiveLocation.latitude,
            longitude: effectiveLocation.longitude,
          };
        }
      } catch (locError) {
        console.warn('[AIRecommendationsScreen] Could not get location:', locError);
      }

      // Use children's age range if available, otherwise fall back to preferences
      const ageMin = childrenAgeRange?.min ?? preferences.ageRanges?.[0]?.min ?? preferences.ageRange?.min;
      const ageMax = childrenAgeRange?.max ?? preferences.ageRanges?.[0]?.max ?? preferences.ageRange?.max;

      // Get distance radius from child preferences (default 25km)
      const radiusKm = mergedChildPrefs?.distanceRadiusKm ?? 25;

      // Merge child preferences with route filters
      const enrichedFilters = {
        ...filters,
        // Add age range from children or preferences
        ageMin: filters.ageMin ?? ageMin,
        ageMax: filters.ageMax ?? ageMax,
        // Add location from child preferences or user preferences
        city: filters.city ?? mergedChildPrefs?.city ?? preferences.preferredLocation,
        // Add GPS coordinates if available with child's preferred radius
        ...(locationData.latitude && locationData.longitude ? {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          radiusKm: radiusKm,
        } : {}),
        // Add preferred activity types from child preferences
        activityTypes: filters.activityTypes ?? mergedChildPrefs?.activityTypes ?? preferences.preferredActivityTypes,
        // Add day preferences from child preferences
        dayOfWeek: filters.dayOfWeek ?? mergedChildPrefs?.daysOfWeek,
        // Add price preferences from child preferences
        costMax: filters.costMax ?? mergedChildPrefs?.maxPrice ?? preferences.priceRange?.max,
      };

      console.log('[AIRecommendationsScreen] Enriched filters with preferences:', enrichedFilters);

      // Get AI recommendations with child selection context
      const result = await aiService.getRecommendations({
        search_intent: searchIntent,
        filters: enrichedFilters,
        include_explanations: true,
        childIds: selectedChildIds?.length > 0 ? selectedChildIds : undefined,
        filterMode: filterMode,
      });

      if (!result.success && result.error) {
        setError(result.error);
        return;
      }

      console.log('[AIRecommendationsScreen] Result received:', {
        success: result.success,
        recCount: result.recommendations?.length,
        activitiesCount: result.activities ? Object.keys(result.activities).length : 0,
        error: result.error,
      });

      setResponse(result);
      setSource(result._meta.source);

      // Use activities included in response (avoids rate limiting from individual fetches)
      if (result.activities && Object.keys(result.activities).length > 0) {
        const activityMap = new Map<string, Activity>();
        for (const [id, activity] of Object.entries(result.activities)) {
          activityMap.set(id, activity as Activity);
        }
        console.log('[AIRecommendationsScreen] Activities map created with', activityMap.size, 'entries');
        setActivities(activityMap);
      } else {
        console.log('[AIRecommendationsScreen] No activities in response');
      }

    } catch (err: any) {
      console.error('[AIRecommendationsScreen] Error:', err);
      setError(err?.message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchIntent, filters, childrenAgeRange, selectedChildIds, filterMode]);
  
  /**
   * Handle pull to refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecommendations(true);
  };
  
  /**
   * Handle activity card press
   */
  const handleActivityPress = (activityId: string) => {
    const activity = activities.get(activityId);
    if (activity) {
      (navigation as any).navigate('ActivityDetail', { activity });
    }
  };
  
  /**
   * Handle retry after error
   */
  const handleRetry = () => {
    fetchRecommendations();
  };
  
  /**
   * Handle dismiss error (go back to regular search)
   */
  const handleDismiss = () => {
    navigation.goBack();
  };
  
  // Fetch on mount
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);
  
  // Render header
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color={colors.text} />
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          AI Recommendations
        </Text>
        <View style={styles.headerMeta}>
          <AISourceBadge source={source} />
          {response?._meta?.latency_ms && (
            <Text style={[styles.latencyText, { color: colors.textSecondary }]}>
              {response._meta.latency_ms}ms
            </Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.refreshButton, { backgroundColor: colors.surface }]}
        onPress={handleRefresh}
      >
        <Icon name="refresh" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
  
  // Render results count header
  const renderResultsHeader = () => {
    if (!response?.recommendations?.length) return null;

    return (
      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          Found {response.recommendations.length} great {response.recommendations.length === 1 ? 'match' : 'matches'}
        </Text>
      </View>
    );
  };
  
  // Prepare recommendations data for FlatList
  const recommendationsData = useMemo(() => {
    if (!response?.recommendations?.length) return [];
    return response.recommendations.filter(rec => activities.get(rec.activity_id));
  }, [response?.recommendations, activities]);

  // Render individual recommendation item
  const renderRecommendationItem = ({ item: rec, index }: { item: AIRecommendation; index: number }) => {
    const activity = activities.get(rec.activity_id);
    if (!activity) return null;

    return (
      <AIRecommendationCard
        recommendation={rec}
        activity={activity}
        source={source}
        onPress={() => handleActivityPress(rec.activity_id)}
        showExplanation={true}
        children={selectedChildren}
        containerStyle={{
          width: '100%',
          marginBottom: 16,
        }}
      />
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="magnify-close" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No matches found
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Try adjusting your search or filters
      </Text>
    </View>
  );

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Top Tab Navigation */}
        <TopTabNavigation />

        {/* Child Filter Selector - only show if multiple children */}
        {children.length > 1 && (
          <ChildFilterSelector
            compact
            showModeToggle={true}
            onSelectionChange={() => {
              // Refetch will happen automatically via dependency on selectedChildIds/filterMode
              setLoading(true);
            }}
          />
        )}

        {/* Content area */}
        <View style={styles.contentGradient}>
          {loading ? (
            <AILoadingState message="Finding the best activities for you..." />
          ) : error ? (
            <AIErrorState
              message={error}
              onRetry={handleRetry}
              onDismiss={handleDismiss}
            />
          ) : (
            <FlatList
              data={recommendationsData}
              renderItem={renderRecommendationItem}
              keyExtractor={(item) => item.activity_id}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={renderResultsHeader}
              ListEmptyComponent={renderEmptyState}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#E8638B"
                />
              }
            />
          )}
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentGradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  latencyText: {
    fontSize: 11,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  resultsHeader: {
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  recommendationsList: {
    gap: 0, // Cards have their own margins
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
  },
});

export default AIRecommendationsScreen;
