import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import aiService from '../services/aiService';
import { AIRecommendation, AIRecommendationResponse, AISourceType } from '../types/ai';
import { Activity } from '../types';
import {
  AIRecommendButton,
  AIRecommendationCard,
  AISourceBadge,
  AILoadingState,
  AIErrorState,
} from '../components/ai';

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

      // Get AI recommendations
      const result = await aiService.getRecommendations({
        search_intent: searchIntent,
        filters,
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
  
  // Render search intent banner
  const renderSearchIntent = () => (
    <View style={[styles.intentBanner, { backgroundColor: colors.primary + '10' }]}>
      <Icon name="format-quote-open" size={16} color={colors.primary} />
      <Text style={[styles.intentText, { color: colors.text }]} numberOfLines={2}>
        {searchIntent}
      </Text>
    </View>
  );
  
  // Render assumptions
  const renderAssumptions = () => {
    if (!response?.assumptions?.length) return null;
    
    return (
      <View style={[styles.assumptionsSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Assumptions made:
        </Text>
        {response.assumptions.map((assumption, index) => (
          <View key={index} style={styles.assumptionItem}>
            <Icon name="information-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.assumptionText, { color: colors.textSecondary }]}>
              {assumption}
            </Text>
          </View>
        ))}
      </View>
    );
  };
  
  // Render recommendations list
  const renderRecommendations = () => {
    if (!response?.recommendations?.length) {
      return (
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
    }
    
    return (
      <View style={styles.recommendationsList}>
        {response.recommendations.map((rec) => {
          const activity = activities.get(rec.activity_id);
          if (!activity) return null;
          
          return (
            <AIRecommendationCard
              key={rec.activity_id}
              recommendation={rec}
              activity={activity}
              source={source}
              onPress={() => handleActivityPress(rec.activity_id)}
            />
          );
        })}
      </View>
    );
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {renderHeader()}
      
      {loading ? (
        <AILoadingState message="Finding the best activities for you..." />
      ) : error ? (
        <AIErrorState
          message={error}
          onRetry={handleRetry}
          onDismiss={handleDismiss}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {renderSearchIntent()}
          {renderAssumptions()}
          {renderRecommendations()}
          
          {/* Footer with result count */}
          {response?.recommendations?.length ? (
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Showing {response.recommendations.length} personalized results
              </Text>
            </View>
          ) : null}
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  intentBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  intentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  assumptionsSection: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  assumptionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  assumptionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
