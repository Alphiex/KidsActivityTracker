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
import childFavoritesService from '../services/childFavoritesService';
import childActivityService from '../services/childActivityService';
import { geocodeAddressWithCache } from '../utils/geocoding';
import { useAppSelector, useAppDispatch } from '../store';
import {
  selectAllChildren,
  selectSelectedChildIds,
  selectFilterMode,
  fetchChildren,
  updateChildPreferences,
} from '../store/slices/childrenSlice';
import { AIRecommendation, AIRecommendationResponse, AISourceType, ChildAIProfile } from '../types/ai';
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
  const { colors } = useTheme();
  const dispatch = useAppDispatch();

  // Ensure children are loaded into Redux on mount - force refresh to get latest preferences
  useEffect(() => {
    console.log('[AIRecommendationsScreen] Fetching fresh children data...');
    dispatch(fetchChildren());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // AND (Together): activities must accept ALL children
      // Activity's age range must span from youngest to oldest child
      return {
        min: Math.max(0, Math.min(...ages) - 1), // Must accept youngest child
        max: Math.min(18, Math.max(...ages) + 1), // Must accept oldest child
      };
    }
  }, [selectedChildren, filterMode]);
  
  /**
   * Calculate age from date of birth
   */
  const calculateAge = (dateOfBirth: string): number => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, Math.min(18, age));
  };

  /**
   * Fetch AI recommendations
   *
   * NEW ARCHITECTURE:
   * - Each child is searched INDEPENDENTLY using their own:
   *   - Location (coordinates from saved address)
   *   - Preferences (activity types, days, price, distance, environment)
   *   - History (enrolled, favorites, watching)
   * - Results are merged (OR) across all children
   * - Sponsored activities get priority
   */
  const fetchRecommendations = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      if (selectedChildren.length === 0) {
        setError('Please select at least one child');
        setLoading(false);
        return;
      }

      const childIds = selectedChildren.map(c => c.id);
      console.log('[AIRecommendationsScreen] Building profiles for children:', childIds);

      // Debug: Log what location data each child has
      for (const child of selectedChildren) {
        console.log(`[AIRecommendationsScreen] Child ${child.name}:`, {
          hasPreferences: !!child.preferences,
          savedAddress: child.preferences?.savedAddress,
          locationDetails: child.locationDetails,
          location: child.location,
        });
      }

      // Fetch history for all children in parallel
      const [allFavorites, allWatching, allActivitiesMap] = await Promise.all([
        childFavoritesService.getFavoritesForChildren(childIds).catch(() => []),
        childFavoritesService.getWatchingForChildren(childIds).catch(() => []),
        // Get enrolled activities for each child
        Promise.all(childIds.map(id =>
          childActivityService.getChildActivities(id).catch(() => [])
        )).then(results => {
          const map: Record<string, string[]> = {};
          childIds.forEach((id, idx) => {
            map[id] = results[idx]?.map(a => a.activityId) || [];
          });
          return map;
        }),
      ]);

      // Group favorites and watching by child
      const favoritesByChild: Record<string, string[]> = {};
      const watchingByChild: Record<string, string[]> = {};

      allFavorites.forEach(f => {
        if (!favoritesByChild[f.childId]) favoritesByChild[f.childId] = [];
        favoritesByChild[f.childId].push(f.activityId);
      });

      allWatching.forEach(w => {
        if (!watchingByChild[w.childId]) watchingByChild[w.childId] = [];
        watchingByChild[w.childId].push(w.activityId);
      });

      // Get GPS location as fallback (only used if child has no saved address)
      let gpsLocation: { latitude: number; longitude: number } | null = null;
      try {
        const effectiveLocation = await locationService.getEffectiveLocation();
        if (effectiveLocation?.latitude && effectiveLocation?.longitude) {
          gpsLocation = {
            latitude: effectiveLocation.latitude,
            longitude: effectiveLocation.longitude,
          };
        }
      } catch (locError) {
        console.warn('[AIRecommendationsScreen] Could not get GPS location:', locError);
      }

      // Build ChildAIProfile for each child
      const childrenProfiles: ChildAIProfile[] = [];

      for (const child of selectedChildren) {
        const age = calculateAge(child.dateOfBirth);
        const prefs = child.preferences;

        // Get child's location - check multiple sources:
        // 1. preferences.savedAddress with coordinates
        // 2. child.locationDetails with coordinates
        // 3. Geocode city name if available (preferences.savedAddress.city or child.location)
        // 4. GPS fallback
        let childLocation: { latitude: number; longitude: number; city?: string } | null = null;

        // First try preferences.savedAddress with coordinates
        if (prefs?.savedAddress?.latitude && prefs?.savedAddress?.longitude) {
          childLocation = {
            latitude: prefs.savedAddress.latitude,
            longitude: prefs.savedAddress.longitude,
            city: prefs.savedAddress.city,
          };
          console.log(`[AIRecommendationsScreen] Child ${child.name} using preferences.savedAddress:`, childLocation);
        }
        // Then try child.locationDetails with coordinates
        else if (child.locationDetails?.latitude && child.locationDetails?.longitude) {
          childLocation = {
            latitude: child.locationDetails.latitude,
            longitude: child.locationDetails.longitude,
            city: child.locationDetails.city,
          };
          console.log(`[AIRecommendationsScreen] Child ${child.name} using locationDetails:`, childLocation);
        }
        // Try to geocode city name from preferences
        else if (prefs?.savedAddress?.city) {
          console.log(`[AIRecommendationsScreen] Child ${child.name} geocoding city: ${prefs.savedAddress.city}`);
          const coords = await geocodeAddressWithCache(`${prefs.savedAddress.city}, Canada`);
          if (coords) {
            childLocation = {
              latitude: coords.latitude,
              longitude: coords.longitude,
              city: prefs.savedAddress.city,
            };
            console.log(`[AIRecommendationsScreen] Child ${child.name} geocoded to:`, childLocation);

            // SAVE the geocoded coordinates back to child preferences so we don't geocode again
            const updatedAddress = {
              ...prefs.savedAddress,
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
            dispatch(updateChildPreferences({
              childId: child.id,
              updates: { savedAddress: updatedAddress },
            }));
            console.log(`[AIRecommendationsScreen] Saved coordinates for ${child.name}`);
          }
        }
        // Try to geocode from child.location (string city name)
        else if (child.location) {
          console.log(`[AIRecommendationsScreen] Child ${child.name} geocoding location: ${child.location}`);
          const coords = await geocodeAddressWithCache(`${child.location}, Canada`);
          if (coords) {
            childLocation = {
              latitude: coords.latitude,
              longitude: coords.longitude,
              city: child.location,
            };
            console.log(`[AIRecommendationsScreen] Child ${child.name} geocoded to:`, childLocation);

            // SAVE the geocoded coordinates as a new savedAddress so we don't geocode again
            const newAddress = {
              city: child.location,
              province: '',
              formattedAddress: child.location,
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
            dispatch(updateChildPreferences({
              childId: child.id,
              updates: { savedAddress: newAddress, locationSource: 'saved_address' },
            }));
            console.log(`[AIRecommendationsScreen] Saved new address with coordinates for ${child.name}`);
          }
        }
        // Finally fall back to GPS
        if (!childLocation && gpsLocation) {
          childLocation = gpsLocation;
          console.log(`[AIRecommendationsScreen] Child ${child.name} using GPS fallback:`, childLocation);
        }

        if (!childLocation) {
          console.warn(`[AIRecommendationsScreen] Child ${child.name} has no location - skipping`);
          continue;
        }

        const profile: ChildAIProfile = {
          child_id: child.id,
          name: child.name,
          age,
          gender: child.gender as 'male' | 'female' | null,
          location: childLocation,
          preferences: {
            distance_radius_km: prefs?.distanceRadiusKm ?? 25,
            activity_types: prefs?.preferredActivityTypes,
            days_of_week: prefs?.daysOfWeek,
            price_min: prefs?.priceRangeMin,
            price_max: prefs?.priceRangeMax,
            environment: prefs?.environmentFilter === 'all' ? undefined : prefs?.environmentFilter,
          },
          history: {
            enrolled_activity_ids: allActivitiesMap[child.id] || [],
            favorited_activity_ids: favoritesByChild[child.id] || [],
            watching_activity_ids: watchingByChild[child.id] || [],
          },
        };

        childrenProfiles.push(profile);
        console.log(`[AIRecommendationsScreen] Built profile for ${child.name}:`, {
          location: profile.location,
          preferences: profile.preferences,
          historyCount: {
            enrolled: profile.history.enrolled_activity_ids.length,
            favorited: profile.history.favorited_activity_ids.length,
            watching: profile.history.watching_activity_ids.length,
          },
        });
      }

      if (childrenProfiles.length === 0) {
        setError('No children with valid locations. Please set addresses in child profiles.');
        setLoading(false);
        return;
      }

      console.log('[AIRecommendationsScreen] Sending', childrenProfiles.length, 'child profiles to AI');
      console.log('[AIRecommendationsScreen] Profiles being sent:', JSON.stringify(childrenProfiles.map(p => ({
        name: p.name,
        location: p.location,
      })), null, 2));

      // Send request with children_profiles - server searches each child independently
      const result = await aiService.getRecommendations({
        search_intent: searchIntent,
        filters: filters,
        include_explanations: true,
        childIds: childIds,
        filterMode: filterMode,
        children_profiles: childrenProfiles,
      });

      if (!result.success && result.error) {
        setError(result.error);
        return;
      }

      const allRecommendations = result.recommendations || [];
      const allActivities = result.activities || {};

      console.log('[AIRecommendationsScreen] Final result:', {
        recCount: allRecommendations.length,
        activitiesCount: Object.keys(allActivities).length,
      });

      setResponse(result);
      setSource(result._meta?.source || 'heuristic');

      // Use activities included in response
      if (Object.keys(allActivities).length > 0) {
        const activityMap = new Map<string, Activity>();
        for (const [id, activity] of Object.entries(allActivities)) {
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
  }, [searchIntent, filters, selectedChildIds, filterMode, selectedChildren]);
  
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
  
  // Check if children have coordinates loaded
  const childrenHaveCoordinates = useMemo(() => {
    if (selectedChildren.length === 0) return false;
    return selectedChildren.some(child => {
      const prefs = child.preferences;
      return (prefs?.savedAddress?.latitude && prefs?.savedAddress?.longitude) ||
             (child.locationDetails?.latitude && child.locationDetails?.longitude);
    });
  }, [selectedChildren]);

  // Fetch on mount - but only after children have valid location data
  useEffect(() => {
    console.log('[AIRecommendationsScreen] Children ready check:', {
      count: selectedChildren.length,
      haveCoordinates: childrenHaveCoordinates,
    });
    if (childrenHaveCoordinates) {
      fetchRecommendations();
    }
  }, [fetchRecommendations, childrenHaveCoordinates, selectedChildren.length]);
  
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
        <StatusBar barStyle="dark-content" />

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
