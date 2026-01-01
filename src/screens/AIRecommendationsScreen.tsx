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
import { useAppSelector } from '../store';
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

  // Get children from Redux store
  const children = useAppSelector((state) => state.children?.children || []);

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AIRecommendationResponse | null>(null);
  const [activities, setActivities] = useState<Map<string, Activity>>(new Map());
  const [source, setSource] = useState<AISourceType>('heuristic');
  const [userLocation, setUserLocation] = useState<{ city?: string; latitude?: number; longitude?: number } | null>(null);

  // Get params from route - use useMemo to prevent new object references on every render
  const searchIntent = route.params?.search_intent || 'Find the best activities for my family';
  const filters = useMemo(() => route.params?.filters || {}, [route.params?.filters]);

  // Calculate age range from children
  const childrenAgeRange = useMemo(() => {
    if (!children || children.length === 0) return null;

    const ages = children.map(child => {
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

    return {
      min: Math.max(0, Math.min(...ages) - 1), // Allow 1 year younger
      max: Math.min(18, Math.max(...ages) + 1), // Allow 1 year older
    };
  }, [children]);
  
  /**
   * Fetch AI recommendations
   */
  const fetchRecommendations = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      // Get user preferences for family context
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

      // Store location for display
      setUserLocation({
        ...locationData,
        city: preferences.preferredLocation,
      });

      // Use children's age range if available, otherwise fall back to preferences
      const ageMin = childrenAgeRange?.min ?? preferences.ageRanges?.[0]?.min ?? preferences.ageRange?.min;
      const ageMax = childrenAgeRange?.max ?? preferences.ageRanges?.[0]?.max ?? preferences.ageRange?.max;

      // Merge user preferences with route filters
      const enrichedFilters = {
        ...filters,
        // Add age range from children or preferences
        ageMin: filters.ageMin ?? ageMin,
        ageMax: filters.ageMax ?? ageMax,
        // Add location from preferences if available
        city: filters.city ?? preferences.preferredLocation,
        // Add GPS coordinates if available (for 20km radius filtering)
        ...(locationData.latitude && locationData.longitude ? {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          radiusKm: 20, // Default 20km radius for AI recommendations
        } : {}),
        // Add preferred activity types if not specified
        activityTypes: filters.activityTypes ?? preferences.preferredActivityTypes,
        // Add day preferences - only if user has specific preferences set
        dayOfWeek: filters.dayOfWeek ?? (preferences.daysOfWeek?.length < 7 ? preferences.daysOfWeek : undefined),
        // Add price preferences
        costMax: filters.costMax ?? preferences.priceRange?.max,
      };

      console.log('[AIRecommendationsScreen] Enriched filters with preferences:', enrichedFilters);

      // Get AI recommendations
      const result = await aiService.getRecommendations({
        search_intent: searchIntent,
        filters: enrichedFilters,
        include_explanations: true,
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
  }, [searchIntent, filters, childrenAgeRange]);
  
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
  
  // Render search context (what we're searching for)
  const renderSearchContext = () => {
    // Get user preferences to show family context
    const preferencesService = PreferencesService.getInstance();
    const preferences = preferencesService.getPreferences();

    // Build context from preferences and filters
    const contextItems: string[] = [];

    // Age range - prefer children's ages, then preferences, then filters
    if (childrenAgeRange) {
      // Show children's names if available
      const childNames = children.slice(0, 2).map(c => c.name).join(', ');
      if (childNames) {
        contextItems.push(`For ${childNames}${children.length > 2 ? ` +${children.length - 2}` : ''}`);
      }
      if (childrenAgeRange.min === childrenAgeRange.max) {
        contextItems.push(`Age ${childrenAgeRange.min}`);
      } else {
        contextItems.push(`Ages ${childrenAgeRange.min}-${childrenAgeRange.max}`);
      }
    } else {
      // Fall back to preferences
      const ageMin = preferences.ageRanges?.[0]?.min ?? preferences.ageRange?.min ?? filters.ageMin;
      const ageMax = preferences.ageRanges?.[0]?.max ?? preferences.ageRange?.max ?? filters.ageMax;
      if (ageMin !== undefined && ageMax !== undefined && !(ageMin === 0 && ageMax === 18)) {
        if (ageMin === ageMax) {
          contextItems.push(`Age ${ageMin}`);
        } else {
          contextItems.push(`Ages ${ageMin}-${ageMax}`);
        }
      }
    }

    // Preferred activity types
    if (preferences.preferredActivityTypes?.length > 0) {
      const typeLabel = preferences.preferredActivityTypes.slice(0, 2).join(', ');
      contextItems.push(typeLabel);
    } else if (filters.categories || filters.category) {
      const cat = filters.categories?.split(',')[0] || filters.category;
      if (cat) contextItems.push(cat);
    }

    // Days of week - only show if not all days selected
    const days = filters.dayOfWeek || (preferences.daysOfWeek?.length < 7 ? preferences.daysOfWeek : null);
    if (days && days.length > 0 && days.length < 7) {
      if (days.length === 2 && days.includes('Saturday') && days.includes('Sunday')) {
        contextItems.push('Weekends');
      } else if (days.length <= 2) {
        contextItems.push(days.join(', '));
      } else {
        contextItems.push(`${days.length} days/week`);
      }
    }

    // Location - show city from preferences or GPS
    const location = userLocation?.city || preferences.preferredLocation || filters.location || filters.city;
    if (location) {
      contextItems.push(location);
    }

    // Show 20km radius indicator if using GPS
    if (userLocation?.latitude && userLocation?.longitude) {
      contextItems.push('Within 20km');
    }

    return (
      <View style={[styles.contextBanner, { backgroundColor: colors.primary + '08' }]}>
        <View style={styles.contextHeader}>
          <Icon name="auto-fix" size={20} color={colors.primary} />
          <Text style={[styles.contextTitle, { color: colors.text }]}>
            Personalized for you
          </Text>
        </View>
        {contextItems.length > 0 && (
          <View style={styles.contextTags}>
            {contextItems.map((item, index) => (
              <View key={index} style={[styles.contextTag, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.contextTagText, { color: colors.primary }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {response?.recommendations?.length ? (
          <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
            Found {response.recommendations.length} great matches
          </Text>
        ) : null}
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
              ListHeaderComponent={renderSearchContext}
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
  contextBanner: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  contextTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  contextTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  contextTagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultCount: {
    fontSize: 13,
    marginTop: 4,
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
