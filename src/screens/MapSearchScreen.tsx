import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Activity } from '../types';
import { ActivitySearchParams } from '../types/api';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import { ClusterMarker } from '../components/map';
import { Colors } from '../theme';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';

type MapSearchRouteProp = RouteProp<{
  MapSearch: {
    filters?: ActivitySearchParams;
    searchQuery?: string;
  };
}, 'MapSearch'>;

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_MARGIN = 8;

// Canada-wide default region (centered on Canada)
const CANADA_REGION: Region = {
  latitude: 56.1304,
  longitude: -106.3468,
  latitudeDelta: 40,
  longitudeDelta: 40,
};

// City-level zoom for user location
const USER_LOCATION_DELTA = 0.15;

// Threshold for grouping activities at "same" location (in degrees, ~100m)
const CLUSTER_THRESHOLD = 0.001;

interface LocationCluster {
  id: string;
  latitude: number;
  longitude: number;
  activities: Activity[];
  locationName: string;
}

/**
 * Group activities into clusters based on location proximity
 */
function clusterActivities(activities: Activity[]): LocationCluster[] {
  const clusters: LocationCluster[] = [];

  activities.forEach((activity) => {
    if (!activity.latitude || !activity.longitude) return;

    // Find existing cluster within threshold
    const existingCluster = clusters.find((cluster) => {
      const latDiff = Math.abs(cluster.latitude - activity.latitude!);
      const lngDiff = Math.abs(cluster.longitude - activity.longitude!);
      return latDiff < CLUSTER_THRESHOLD && lngDiff < CLUSTER_THRESHOLD;
    });

    if (existingCluster) {
      existingCluster.activities.push(activity);
      // Update center to average of all activities
      const allLats = existingCluster.activities.map((a) => a.latitude!);
      const allLngs = existingCluster.activities.map((a) => a.longitude!);
      existingCluster.latitude = allLats.reduce((a, b) => a + b, 0) / allLats.length;
      existingCluster.longitude = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;
    } else {
      // Create new cluster
      const locationName = typeof activity.location === 'string'
        ? activity.location
        : activity.location?.name || activity.locationName || 'Unknown Location';

      clusters.push({
        id: `cluster_${activity.latitude}_${activity.longitude}`,
        latitude: activity.latitude,
        longitude: activity.longitude,
        activities: [activity],
        locationName,
      });
    }
  });

  return clusters;
}

const MapSearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<MapSearchRouteProp>();
  const mapRef = useRef<MapView>(null);
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();

  // State
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialRegion, setInitialRegion] = useState<Region>(CANADA_REGION);
  const [region, setRegion] = useState<Region>(CANADA_REGION);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [visibleActivities, setVisibleActivities] = useState<Activity[]>([]);
  const [totalInViewport, setTotalInViewport] = useState(0);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const regionChangeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search filters state (received from SearchScreen)
  const [searchFilters, setSearchFilters] = useState<ActivitySearchParams | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Get user preferences for filtering
  const preferences = preferencesService.getPreferences();

  // Handle search filters from navigation params
  useEffect(() => {
    if (route.params?.filters) {
      setSearchFilters(route.params.filters);
      setSearchQuery(route.params.searchQuery || '');
      // Reload activities with new filters
      loadActivitiesWithFilters(route.params.filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.filters]);

  // Clear search filters and reload all activities
  const clearSearchFilters = useCallback(() => {
    setSearchFilters(null);
    setSearchQuery('');
  }, []);

  // Reload activities when search filters are cleared
  useEffect(() => {
    if (searchFilters === null && !loading) {
      loadActivities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters]);

  // Navigate to search screen for map-based search
  const handleOpenSearch = useCallback(() => {
    // Pass current map bounds to search screen
    (navigation as any).navigate('Search', {
      returnToMap: true,
      mapBounds: {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
    });
  }, [navigation, region]);

  // Determine initial region based on priority: GPS > preferences > Canada
  useEffect(() => {
    const determineInitialRegion = async () => {
      // Priority 1: Try to get user's current GPS location
      Geolocation.getCurrentPosition(
        (position) => {
          const userRegion: Region = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            latitudeDelta: USER_LOCATION_DELTA,
            longitudeDelta: USER_LOCATION_DELTA,
          };
          if (__DEV__) console.log('[MapSearch] Using GPS location:', userRegion);
          setInitialRegion(userRegion);
          setRegion(userRegion);
          setLocationLoaded(true);

          // Animate map to user location
          if (mapRef.current) {
            mapRef.current.animateToRegion(userRegion, 500);
          }
        },
        (error) => {
          if (__DEV__) console.log('[MapSearch] GPS location error:', error.message);

          // Priority 2: Check for saved address in preferences
          if (preferences.savedAddress &&
              preferences.savedAddress.latitude &&
              preferences.savedAddress.longitude) {
            const prefRegion: Region = {
              latitude: preferences.savedAddress.latitude,
              longitude: preferences.savedAddress.longitude,
              latitudeDelta: USER_LOCATION_DELTA,
              longitudeDelta: USER_LOCATION_DELTA,
            };
            if (__DEV__) console.log('[MapSearch] Using saved address:', prefRegion);
            setInitialRegion(prefRegion);
            setRegion(prefRegion);
            setLocationLoaded(true);

            if (mapRef.current) {
              mapRef.current.animateToRegion(prefRegion, 500);
            }
          } else {
            // Priority 3: Default to Canada-wide view
            if (__DEV__) console.log('[MapSearch] Using Canada default region');
            setInitialRegion(CANADA_REGION);
            setRegion(CANADA_REGION);
            setLocationLoaded(true);
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    determineInitialRegion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter activities based on user preferences (only apply non-default filters)
  const filteredActivities = useMemo(() => {
    if (__DEV__) {
      console.log('[MapSearch] Filtering activities:', {
        total: allActivities.length,
        withCoords: allActivities.filter(a => a.latitude && a.longitude).length,
      });
    }

    return allActivities.filter((activity) => {
      // Filter out full activities if preference is set
      if (preferences.hideFullActivities && activity.spotsAvailable === 0) {
        return false;
      }

      // Filter by environment preference (only if explicitly set)
      if (preferences.environmentFilter && preferences.environmentFilter !== 'all') {
        const name = activity.name?.toLowerCase() || '';
        const isIndoor = name.includes('indoor') || name.includes('gym') || 
                         name.includes('studio') || name.includes('arena');
        const isOutdoor = name.includes('outdoor') || name.includes('park') || 
                          name.includes('field') || name.includes('beach');
        
        if (preferences.environmentFilter === 'indoor' && isOutdoor && !isIndoor) return false;
        if (preferences.environmentFilter === 'outdoor' && isIndoor && !isOutdoor) return false;
      }

      // Note: We intentionally don't filter by age/price/activity type here
      // The map should show all available activities - users can use the filter button
      // to apply more restrictive filters if needed

      return true;
    });
  }, [allActivities, preferences.hideFullActivities, preferences.environmentFilter]);

  // Cluster the filtered activities
  const clusters = useMemo(() => {
    return clusterActivities(filteredActivities);
  }, [filteredActivities]);

  // Filter activities visible within current map viewport
  const getVisibleActivities = useCallback((activities: Activity[], mapRegion: Region): Activity[] => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;
    const minLat = latitude - latitudeDelta / 2;
    const maxLat = latitude + latitudeDelta / 2;
    const minLng = longitude - longitudeDelta / 2;
    const maxLng = longitude + longitudeDelta / 2;

    return activities.filter(a =>
      a.latitude != null && a.longitude != null &&
      a.latitude >= minLat && a.latitude <= maxLat &&
      a.longitude >= minLng && a.longitude <= maxLng
    );
  }, []);

  // Update visible activities when region changes (debounced)
  const updateVisibleActivities = useCallback((newRegion: Region) => {
    if (regionChangeTimeout.current) {
      clearTimeout(regionChangeTimeout.current);
    }
    regionChangeTimeout.current = setTimeout(() => {
      const visible = getVisibleActivities(filteredActivities, newRegion);
      setTotalInViewport(visible.length);
      // Limit to 50 for performance, sorted by distance from center
      const sorted = visible.sort((a, b) => {
        const distA = Math.abs(a.latitude! - newRegion.latitude) + Math.abs(a.longitude! - newRegion.longitude);
        const distB = Math.abs(b.latitude! - newRegion.latitude) + Math.abs(b.longitude! - newRegion.longitude);
        return distA - distB;
      });
      setVisibleActivities(sorted.slice(0, 50));
    }, 300);
  }, [filteredActivities, getVisibleActivities]);

  // Initial visible activities update when activities load
  useEffect(() => {
    if (filteredActivities.length > 0 && locationLoaded) {
      updateVisibleActivities(region);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredActivities, locationLoaded]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadActivities(); }, []);

  // Process activities and set state
  const processAndSetActivities = (activities: Activity[]) => {
    if (__DEV__) {
      console.log('[MapSearch] API returned:', {
        total: activities?.length || 0,
        sample: activities?.[0] ? {
          id: activities[0].id,
          name: activities[0].name,
          lat: activities[0].latitude,
          lng: activities[0].longitude,
        } : null,
      });
    }

    // Filter to only activities with valid coordinates
    // Check both activity-level coords and nested location object
    const activitiesWithLocation = (activities || []).map((a: Activity) => {
      // Try to get coordinates from activity or from nested location
      let lat = a.latitude;
      let lng = a.longitude;

      // If no coords on activity, check if location is an object with coords
      if ((lat == null || lng == null) && typeof a.location === 'object' && a.location) {
        const loc = a.location as any;
        lat = loc.latitude ?? lat;
        lng = loc.longitude ?? lng;
      }

      return { ...a, latitude: lat, longitude: lng };
    }).filter((a: Activity) => {
      const hasCoords = a.latitude != null && a.longitude != null &&
                        !isNaN(a.latitude) && !isNaN(a.longitude);
      return hasCoords;
    });

    if (__DEV__) {
      console.log('[MapSearch] Activities with valid coordinates:', activitiesWithLocation.length);
      if (activitiesWithLocation.length === 0 && activities?.length > 0) {
        // Log sample activity to debug
        const sample = activities[0];
        console.log('[MapSearch] Sample activity location data:', {
          actLat: sample.latitude,
          actLng: sample.longitude,
          location: sample.location,
        });
      }
    }

    setAllActivities(activitiesWithLocation);

    // Fit map to show all activities (only if no search filters - don't auto-zoom when filtered)
    if (activitiesWithLocation.length > 0 && mapRef.current && !searchFilters) {
      const coords = activitiesWithLocation.map((a: Activity) => ({
        latitude: a.latitude!,
        longitude: a.longitude!,
      }));

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 } as any,
          animated: true,
        } as any);
      }, 500);
    }
  };

  // Load activities with search filters applied
  const loadActivitiesWithFilters = async (filters: ActivitySearchParams) => {
    try {
      setLoading(true);

      // Combine search filters with map-specific requirements
      const apiFilters: Record<string, unknown> = {
        ...filters,
        limit: 500, // Load more for map view
        hasCoordinates: true, // Only get activities with lat/lng
      };

      if (__DEV__) console.log('[MapSearch] Loading with search filters:', apiFilters);

      const activities = await activityService.searchActivities(apiFilters);
      processAndSetActivities(activities);
    } catch (error) {
      if (__DEV__) console.error('[MapSearch] Error loading filtered activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      setLoading(true);

      // Load activities with coordinates only for map view
      const filters: Record<string, unknown> = {
        limit: 500, // Load more for map view
        hasCoordinates: true, // Only get activities with lat/lng
      };

      if (__DEV__) console.log('[MapSearch] Loading activities with filters:', filters);

      const activities = await activityService.searchActivities(filters);
      processAndSetActivities(activities);
    } catch (error) {
      if (__DEV__) console.error('[MapSearch] Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle tapping a marker on the map - scroll list to show the card
  const handleMarkerPress = useCallback((cluster: LocationCluster) => {
    // If cluster has only one activity, select it and scroll to it
    if (cluster.activities.length === 1) {
      const activity = cluster.activities[0];
      setSelectedActivityId(activity.id);

      // Find index in visible activities
      const index = visibleActivities.findIndex(a => a.id === activity.id);
      if (index >= 0 && listRef.current) {
        listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }
    } else {
      // Zoom in on cluster to see individual markers
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: cluster.latitude,
          longitude: cluster.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 300);
      }
    }
  }, [visibleActivities]);

  const handleActivityPress = useCallback((activity: Activity) => {
    (navigation as any).navigate('ActivityDetail', { activity });
  }, [navigation]);

  const handleMyLocation = useCallback(() => {
    // Try to get current location, fall back to initial region
    Geolocation.getCurrentPosition(
      (position) => {
        const userRegion: Region = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: USER_LOCATION_DELTA,
          longitudeDelta: USER_LOCATION_DELTA,
        };
        mapRef.current?.animateToRegion(userRegion, 500);
      },
      () => {
        // Fall back to initial region if GPS fails
        mapRef.current?.animateToRegion(initialRegion, 500);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
    );
  }, [initialRegion]);

  const handleFitAll = useCallback(() => {
    if (clusters.length > 0 && mapRef.current) {
      const coords = clusters.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 50, right: 50, bottom: 250, left: 50 } as any,
        animated: true,
      } as any);
    }
    setSelectedActivityId(null);
  }, [clusters]);

  // Handle region change - update visible activities
  const handleRegionChange = useCallback((newRegion: Region) => {
    setRegion(newRegion);
    updateVisibleActivities(newRegion);
  }, [updateVisibleActivities]);

  // Render horizontal activity card
  const renderActivityCard = useCallback(({ item }: { item: Activity }) => {
    const isSelected = selectedActivityId === item.id;
    const locationName = typeof item.location === 'string'
      ? item.location
      : item.location?.name || item.locationName || '';

    // Get activity image using the same logic as Dashboard
    const activityTypeName = typeof item.activityType === 'string'
      ? item.activityType
      : (item.activityType as any)?.name || item.category || 'general';
    const subcategory = (item as any).activitySubtype?.name || item.subcategory;
    const imageKey = getActivityImageKey(activityTypeName, subcategory, item.name);
    const imageSource = getActivityImageByKey(imageKey, activityTypeName);

    // Format date range like Dashboard
    let dateRangeText = '';
    if (item.dateStart && item.dateEnd) {
      const start = new Date(item.dateStart);
      const end = new Date(item.dateEnd);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateRangeText = `${startStr} - ${endStr}`;
    } else if ((item as any).dateRange?.start && (item as any).dateRange?.end) {
      const start = new Date((item as any).dateRange.start);
      const end = new Date((item as any).dateRange.end);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateRangeText = `${startStr} - ${endStr}`;
    } else if (item.dates) {
      dateRangeText = item.dates;
    }

    // Format time like Dashboard
    let timeText = '';
    if (item.startTime && item.endTime) {
      timeText = `${item.startTime} - ${item.endTime}`;
    } else if (item.startTime) {
      timeText = item.startTime;
    }

    // Format age range
    const ageText = item.ageMin != null && item.ageMax != null
      ? `Ages ${item.ageMin}-${item.ageMax}`
      : item.ageMin != null
      ? `Ages ${item.ageMin}+`
      : '';

    return (
      <TouchableOpacity
        style={[styles.activityCard, isSelected && styles.activityCardSelected]}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.9}
      >
        <Image source={imageSource} style={styles.cardImage} resizeMode="cover" />
        {item.price != null && (
          <View style={styles.priceTag}>
            <Text style={styles.priceTagText}>${item.price}</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>

          {locationName ? (
            <View style={styles.cardInfoRow}>
              <Icon name="map-marker" size={12} color="#717171" />
              <Text style={styles.cardInfoText} numberOfLines={1}>{locationName}</Text>
            </View>
          ) : null}

          {dateRangeText ? (
            <View style={styles.cardInfoRow}>
              <Icon name="calendar" size={12} color="#717171" />
              <Text style={styles.cardInfoText}>{dateRangeText}</Text>
            </View>
          ) : null}

          {timeText ? (
            <View style={styles.cardInfoRow}>
              <Icon name="clock-outline" size={12} color="#717171" />
              <Text style={styles.cardInfoText}>{timeText}</Text>
            </View>
          ) : null}

          {ageText ? (
            <View style={styles.cardInfoRow}>
              <Icon name="account-child" size={12} color="#717171" />
              <Text style={styles.cardInfoText}>{ageText}</Text>
            </View>
          ) : null}

          {item.spotsAvailable != null && item.spotsAvailable > 0 && item.spotsAvailable <= 10 && (
            <View style={[
              styles.spotsBadge,
              item.spotsAvailable <= 3 && styles.spotsBadgeUrgent,
            ]}>
              <Icon
                name={item.spotsAvailable <= 3 ? "alert-circle" : "information"}
                size={12}
                color={item.spotsAvailable <= 3 ? "#D93025" : Colors.primary}
              />
              <Text style={[
                styles.spotsText,
                item.spotsAvailable <= 3 && styles.spotsTextUrgent,
              ]}>
                {item.spotsAvailable} {item.spotsAvailable === 1 ? 'spot left' : 'spots left'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selectedActivityId, handleActivityPress]);

  const keyExtractor = useCallback((item: Activity) => item.id, []);

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Tab Navigation */}
        <TopTabNavigation />

        {/* Map Section - 55% of screen */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          rotateEnabled={false}
          onRegionChangeComplete={handleRegionChange}
        >
          {clusters.map((cluster) => (
            <ClusterMarker
              key={cluster.id}
              latitude={cluster.latitude}
              longitude={cluster.longitude}
              count={cluster.activities.length}
              onPress={() => handleMarkerPress(cluster)}
              isSelected={cluster.activities.some(a => a.id === selectedActivityId)}
            />
          ))}
        </MapView>

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading activities...</Text>
          </View>
        )}

        {/* Search Button - Top Right */}
        <View style={styles.searchButtonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, searchFilters && styles.searchButtonActive]}
            onPress={handleOpenSearch}
          >
            <Icon
              name="magnify"
              size={22}
              color={searchFilters ? '#fff' : Colors.primary}
            />
          </TouchableOpacity>
          {searchFilters && (
            <TouchableOpacity
              style={styles.clearSearchBadge}
              onPress={clearSearchFilters}
            >
              <Icon name="close" size={12} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Active Indicator */}
        {searchFilters && (
          <View style={styles.searchIndicator}>
            <Icon name="filter" size={14} color="#fff" />
            <Text style={styles.searchIndicatorText} numberOfLines={1}>
              {searchQuery || 'Filtered'}
            </Text>
          </View>
        )}

        {/* Action Buttons - Bottom Right */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleMyLocation}>
            <Icon name="crosshairs-gps" size={22} color={Colors.primary} />
          </TouchableOpacity>

          {clusters.length > 0 && (
            <TouchableOpacity style={styles.actionButton} onPress={handleFitAll}>
              <Icon name="fit-to-screen-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List Section - 45% of screen */}
      <View style={styles.listSection}>
        {/* List Header */}
        <View style={styles.listHeader}>
          <View style={styles.listHeaderRow}>
            <Icon name="map-marker-multiple" size={18} color={Colors.primary} />
            <Text style={styles.listHeaderText}>
              {totalInViewport > visibleActivities.length
                ? `Showing ${visibleActivities.length} of ${totalInViewport} nearby`
                : `${visibleActivities.length} ${visibleActivities.length === 1 ? 'activity' : 'activities'} nearby`
              }
            </Text>
          </View>
          {allActivities.length !== filteredActivities.length && (
            <View style={styles.filterBadge}>
              <Icon name="filter" size={12} color={Colors.primary} />
              <Text style={styles.filterBadgeText}>
                {allActivities.length - filteredActivities.length} hidden
              </Text>
            </View>
          )}
        </View>

        {/* Horizontal Activity List */}
        {!loading && visibleActivities.length > 0 ? (
          <FlatList
            ref={listRef}
            data={visibleActivities}
            renderItem={renderActivityCard}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalListContent}
            snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
            decelerationRate="fast"
            initialNumToRender={3}
            maxToRenderPerBatch={5}
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + CARD_MARGIN * 2,
              offset: (CARD_WIDTH + CARD_MARGIN * 2) * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              // Fallback for scroll failures
              const wait = new Promise(resolve => setTimeout(resolve, 100));
              wait.then(() => {
                listRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
              });
            }}
          />
        ) : !loading && clusters.length === 0 ? (
          <View style={styles.emptyListState}>
            <Icon name="map-marker-question" size={40} color="#CCC" />
            <Text style={styles.emptyListTitle}>No activities found</Text>
            <Text style={styles.emptyListSubtitle}>
              Try zooming out or changing your filters
            </Text>
          </View>
        ) : !loading && visibleActivities.length === 0 ? (
          <View style={styles.emptyListState}>
            <Icon name="gesture-swipe" size={40} color="#CCC" />
            <Text style={styles.emptyListTitle}>Pan or zoom the map</Text>
            <Text style={styles.emptyListSubtitle}>
              Activities will appear as they come into view
            </Text>
          </View>
        ) : null}
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '15',
  },
  // Map section - 55% of screen
  mapSection: {
    flex: 0.55,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    gap: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  searchButtonContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  searchButtonActive: {
    backgroundColor: Colors.primary,
  },
  clearSearchBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D93025',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  searchIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  searchIndicatorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  // List section - 45% of screen
  listSection: {
    flex: 0.45,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 99, 139, 0.15)',
    backgroundColor: 'rgba(255, 245, 248, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primary,
  },
  horizontalListContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  // Activity card styles
  activityCard: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  activityCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cardImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F5F5F5',
  },
  priceTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceTagText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    lineHeight: 20,
    marginBottom: 4,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  cardInfoText: {
    fontSize: 12,
    color: '#717171',
    flex: 1,
  },
  spotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  spotsBadgeUrgent: {
    backgroundColor: '#D93025' + '15',
  },
  spotsText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  spotsTextUrgent: {
    color: '#D93025',
  },
  // Empty state styles
  emptyListState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'transparent',
  },
  emptyListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  emptyListSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default MapSearchScreen;
