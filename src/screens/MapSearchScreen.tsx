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
  Animated,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { Activity } from '../types';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import { ClusterMarker, MapActivityCard } from '../components/map';
import { Colors } from '../theme';

const { width, height } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = height * 0.45;

// Default region (Vancouver area)
const DEFAULT_REGION: Region = {
  latitude: 49.2827,
  longitude: -123.1207,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

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
  const mapRef = useRef<MapView>(null);
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();

  // State
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<LocationCluster | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;

  // Get user preferences for filtering
  const preferences = preferencesService.getPreferences();

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

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    // Animate bottom sheet
    Animated.spring(bottomSheetAnim, {
      toValue: selectedCluster ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
  }, [selectedCluster, bottomSheetAnim]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      // Load activities with coordinates only for map view
      const filters: Record<string, unknown> = {
        limit: 500, // Load more for map view
        hasCoordinates: true, // Only get activities with lat/lng
      };

      if (__DEV__) console.log('[MapSearch] Loading activities with filters:', filters);

      const result = await activityService.searchActivities(filters);
      
      if (__DEV__) {
        console.log('[MapSearch] API returned:', {
          total: result.activities?.length || 0,
          sample: result.activities?.[0] ? {
            id: result.activities[0].id,
            name: result.activities[0].name,
            lat: result.activities[0].latitude,
            lng: result.activities[0].longitude,
          } : null,
        });
      }

      // Filter to only activities with valid coordinates
      // Check both activity-level coords and nested location object
      const activitiesWithLocation = (result.activities || []).map((a: Activity) => {
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
        if (activitiesWithLocation.length === 0 && result.activities?.length > 0) {
          // Log sample activity to debug
          const sample = result.activities[0];
          console.log('[MapSearch] Sample activity location data:', {
            actLat: sample.latitude,
            actLng: sample.longitude,
            location: sample.location,
          });
        }
      }

      setAllActivities(activitiesWithLocation);

      // Fit map to show all activities
      if (activitiesWithLocation.length > 0 && mapRef.current) {
        const coords = activitiesWithLocation.map((a: Activity) => ({
          latitude: a.latitude!,
          longitude: a.longitude!,
        }));
        
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }, 500);
      }
    } catch (error) {
      if (__DEV__) console.error('[MapSearch] Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClusterPress = useCallback((cluster: LocationCluster) => {
    setSelectedCluster(cluster);
    
    // Zoom to cluster location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 300);
    }
  }, []);

  const handleActivityPress = useCallback((activity: Activity) => {
    (navigation as any).navigate('ActivityDetail', { activity });
  }, [navigation]);

  const handleMapPress = useCallback(() => {
    setSelectedCluster(null);
  }, []);

  const handleMyLocation = useCallback(() => {
    mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
  }, []);

  const handleFitAll = useCallback(() => {
    if (clusters.length > 0 && mapRef.current) {
      const coords = clusters.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }
    setSelectedCluster(null);
  }, [clusters]);

  const bottomSheetTranslateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BOTTOM_SHEET_HEIGHT + 50, 0],
  });

  const renderActivityItem = useCallback(({ item }: { item: Activity }) => (
    <MapActivityCard
      activity={item}
      onPress={() => handleActivityPress(item)}
      onClose={() => {}}
    />
  ), [handleActivityPress]);

  const keyExtractor = useCallback((item: Activity) => item.id, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Map View</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.filterButton} 
            onPress={() => (navigation as any).navigate('Filters')}
          >
            <Icon name="tune-variant" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          rotateEnabled={false}
          onRegionChangeComplete={setRegion}
        >
          {clusters.map((cluster) => (
            <ClusterMarker
              key={cluster.id}
              latitude={cluster.latitude}
              longitude={cluster.longitude}
              count={cluster.activities.length}
              onPress={() => handleClusterPress(cluster)}
              isSelected={selectedCluster?.id === cluster.id}
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

        {/* Empty State - Shows as a card, not full overlay */}
        {!loading && clusters.length === 0 && (
          <View style={styles.emptyStateCard}>
            <Icon name="map-marker-question" size={24} color="#666" />
            <View style={styles.emptyStateCardContent}>
              <Text style={styles.emptyStateCardTitle}>No activities to display</Text>
              <Text style={styles.emptyStateCardText}>
                Location data is being added to activities.
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.emptyStateCardButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.emptyStateCardButtonText}>List View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Badge */}
        {!loading && clusters.length > 0 && (
          <View style={styles.statsBadge}>
            <Icon name="map-marker-multiple" size={16} color="#FFF" />
            <Text style={styles.statsText}>
              {filteredActivities.length} activities at {clusters.length} locations
            </Text>
          </View>
        )}

        {/* Filter indicator */}
        {!loading && allActivities.length !== filteredActivities.length && (
          <View style={styles.filterIndicator}>
            <Icon name="filter" size={14} color={Colors.primary} />
            <Text style={styles.filterIndicatorText}>
              Filtered ({allActivities.length - filteredActivities.length} hidden)
            </Text>
          </View>
        )}

        {/* Action Buttons */}
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

      {/* Bottom Sheet - Activity List */}
      <Animated.View 
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: bottomSheetTranslateY }] }
        ]}
        pointerEvents={selectedCluster ? 'auto' : 'none'}
      >
        {/* Handle */}
        <View style={styles.bottomSheetHandle}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        {selectedCluster && (
          <View style={styles.bottomSheetHeader}>
            <View style={styles.bottomSheetTitleRow}>
              <Icon name="map-marker" size={20} color={Colors.primary} />
              <Text style={styles.bottomSheetTitle} numberOfLines={1}>
                {selectedCluster.locationName}
              </Text>
            </View>
            <Text style={styles.bottomSheetSubtitle}>
              {selectedCluster.activities.length} {selectedCluster.activities.length === 1 ? 'activity' : 'activities'}
            </Text>
            <TouchableOpacity 
              style={styles.closeBottomSheet} 
              onPress={() => setSelectedCluster(null)}
            >
              <Icon name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* Activity List */}
        {selectedCluster && (
          <FlatList
            data={selectedCluster.activities}
            renderItem={renderActivityItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
          />
        )}
      </Animated.View>

      {/* Tap hint when no cluster selected */}
      {!loading && !selectedCluster && clusters.length > 0 && (
        <View style={styles.hintContainer}>
          <Icon name="gesture-tap" size={18} color="#666" />
          <Text style={styles.hintText}>Tap a marker to see activities</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  mapContainer: {
    flex: 1,
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
  emptyStateCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  emptyStateCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  emptyStateCardText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  emptyStateCardButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyStateCardButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  filterIndicator: {
    position: 'absolute',
    top: 60,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  filterIndicatorText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionButtons: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    gap: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
  },
  bottomSheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  bottomSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
    flex: 1,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    marginLeft: 28,
  },
  closeBottomSheet: {
    position: 'absolute',
    top: 0,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

export default MapSearchScreen;
