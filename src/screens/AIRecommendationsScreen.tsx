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

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import aiService from '../services/aiService';
import PreferencesService from '../services/preferencesService';
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

      // Merge user preferences with route filters
      const enrichedFilters = {
        ...filters,
        // Add age range from preferences if not already set
        ageMin: filters.ageMin ?? (preferences.ageRanges?.[0]?.min ?? preferences.ageRange?.min),
        ageMax: filters.ageMax ?? (preferences.ageRanges?.[0]?.max ?? preferences.ageRange?.max),
        // Add location from preferences if available
        city: filters.city ?? preferences.preferredLocation,
        // Add preferred activity types if not specified
        activityTypes: filters.activityTypes ?? preferences.preferredActivityTypes,
        // Add day preferences
        dayOfWeek: filters.dayOfWeek ?? preferences.daysOfWeek,
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
  }, [searchIntent, filters]);
  
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

    // Age range - prefer preferences, fall back to filters
    const ageMin = preferences.ageRanges?.[0]?.min ?? preferences.ageRange?.min ?? filters.ageMin;
    const ageMax = preferences.ageRanges?.[0]?.max ?? preferences.ageRange?.max ?? filters.ageMax;
    if (ageMin !== undefined || ageMax !== undefined) {
      const min = ageMin ?? 0;
      const max = ageMax ?? 18;
      if (min === max) {
        contextItems.push(`Age ${min}`);
      } else {
        contextItems.push(`Ages ${min}-${max}`);
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

    // Days of week - prefer preferences
    const days = preferences.daysOfWeek?.length > 0 ? preferences.daysOfWeek : filters.dayOfWeek;
    if (days?.length > 0) {
      if (days.includes('Saturday') && days.includes('Sunday')) {
        contextItems.push('Weekends');
      } else if (days.length <= 2) {
        contextItems.push(days.join(', '));
      } else {
        contextItems.push(`${days.length} days/week`);
      }
    }

    // Location - prefer preferences
    const location = preferences.preferredLocation || filters.location || filters.city;
    if (location) {
      contextItems.push(location);
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
        showExplanation={false}
        containerStyle={{
          width: CARD_WIDTH,
          marginRight: index % 2 === 0 ? CARD_GAP : 0,
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Tab Navigation */}
      <TopTabNavigation />

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
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={recommendationsData.length > 1 ? styles.columnWrapper : undefined}
          ListHeaderComponent={renderSearchContext}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
