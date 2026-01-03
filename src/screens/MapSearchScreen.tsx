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
  Share,
  TextInput,
  Keyboard,
} from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import GooglePlacesSDK, { PLACE_FIELDS } from 'react-native-google-places-sdk';
import { Activity } from '../types';
import { ActivitySearchParams } from '../types/api';
import ActivityService, { ChildBasedFilterParams } from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import FavoritesService from '../services/favoritesService';
import WaitlistService from '../services/waitlistService';
import childPreferencesService from '../services/childPreferencesService';
import { ClusterMarker } from '../components/map';
import ChildAvatar from '../components/children/ChildAvatar';
import { Colors } from '../theme';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';
import UpgradePromptModal from '../components/UpgradePromptModal';
import AddToCalendarModal from '../components/AddToCalendarModal';
import { formatActivityPrice } from '../utils/formatters';
import { useAppSelector } from '../store';
import { selectAllChildren, selectSelectedChildIds, selectFilterMode, ChildWithPreferences } from '../store/slices/childrenSlice';
import { geocodeAddress } from '../utils/geocoding';

type MapSearchRouteProp = RouteProp<{
  MapSearch: {
    filters?: ActivitySearchParams;
    searchQuery?: string;
  };
}, 'MapSearch'>;

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_MARGIN = 8;
const SKELETON_COUNT = 3;

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

// Minimum movement threshold before refetching (in degrees, ~5km)
const REFETCH_THRESHOLD = 0.05;


/**
 * Check if a region has moved significantly from another region
 */
function hasRegionMovedSignificantly(newRegion: Region, oldRegion: Region | null): boolean {
  if (!oldRegion) return true;

  const latDiff = Math.abs(newRegion.latitude - oldRegion.latitude);
  const lngDiff = Math.abs(newRegion.longitude - oldRegion.longitude);
  const zoomChanged = Math.abs(newRegion.latitudeDelta - oldRegion.latitudeDelta) > 0.02;

  return latDiff > REFETCH_THRESHOLD || lngDiff > REFETCH_THRESHOLD || zoomChanged;
}

/**
 * Calculate a region that encompasses all provided coordinates
 * Returns null if no valid coordinates are provided
 */
function calculateRegionFromCoordinates(
  coordinates: Array<{ latitude: number; longitude: number }>
): Region | null {
  if (coordinates.length === 0) return null;

  if (coordinates.length === 1) {
    // Single location - use city-level zoom
    return {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
      latitudeDelta: USER_LOCATION_DELTA,
      longitudeDelta: USER_LOCATION_DELTA,
    };
  }

  // Multiple locations - calculate bounding box
  const lats = coordinates.map(c => c.latitude);
  const lngs = coordinates.map(c => c.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Add 20% padding to the delta to ensure all points are visible
  const latDelta = Math.max((maxLat - minLat) * 1.3, USER_LOCATION_DELTA);
  const lngDelta = Math.max((maxLng - minLng) * 1.3, USER_LOCATION_DELTA);

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

interface LocationCluster {
  id: string;
  latitude: number;
  longitude: number;
  activities: Activity[];
  locationName: string;
}

/**
 * Skeleton card component for loading state
 */
const SkeletonCard = ({ index }: { index: number }) => (
  <View style={skeletonStyles.card}>
    <View style={skeletonStyles.imageContainer}>
      <View style={skeletonStyles.imagePlaceholder} />
      <View style={skeletonStyles.pricePlaceholder} />
    </View>
    <View style={skeletonStyles.content}>
      <View style={[skeletonStyles.titlePlaceholder, { width: index % 2 === 0 ? '90%' : '75%' }]} />
      <View style={skeletonStyles.linePlaceholder} />
      <View style={[skeletonStyles.linePlaceholder, { width: '60%' }]} />
      <View style={[skeletonStyles.linePlaceholder, { width: '40%' }]} />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    height: 100,
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#E8E8E8',
  },
  pricePlaceholder: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 50,
    height: 24,
    backgroundColor: '#D8D8D8',
    borderRadius: 8,
  },
  content: {
    padding: 12,
    gap: 8,
  },
  titlePlaceholder: {
    height: 16,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
  },
  linePlaceholder: {
    height: 12,
    width: '80%',
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
  },
});

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

  // Get children from Redux to center map on their locations
  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const filterMode = useAppSelector(selectFilterMode);

  // Get selected children for filtering
  const selectedChildren = useMemo(() => {
    if (selectedChildIds.length === 0) {
      return children; // If none selected, use all children
    }
    return children.filter(c => selectedChildIds.includes(c.id));
  }, [children, selectedChildIds]);

  // Calculate child-based filters (age ranges, activity types, etc.)
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
      console.log('[MapSearch] Child-based filters:', {
        selectedChildrenCount: selectedChildren.length,
        selectedChildren: selectedChildren.map(c => ({ name: c.name, dob: c.dateOfBirth, hasPrefs: !!c.preferences })),
        childPreferencesCount: childPreferences.length,
        childAges,
        calculatedAgeRange: `${mergedFilters.ageMin}-${mergedFilters.ageMax}`,
        activityTypes: mergedFilters.activityTypes || [],
        filterMode,
      });
    }

    return {
      filterMode,
      mergedFilters,
    };
  }, [selectedChildren, filterMode]);

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
  const lastFetchedRegion = useRef<Region | null>(null);
  const refetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedRegion = useRef(false);
  const hasCenteredOnChildren = useRef(false);

  // Search filters state (received from SearchScreen)
  const [searchFilters, setSearchFilters] = useState<ActivitySearchParams | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calendar modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedActivityForCalendar, setSelectedActivityForCalendar] = useState<Activity | null>(null);

  // Get user preferences for filtering
  const preferences = preferencesService.getPreferences();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Place search state
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');

  // Place search UI state
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const [placePredictions, setPlacePredictions] = useState<any[]>([]);

  // Cache for geocoded child locations (city names → coordinates)
  const [geocodedChildLocations, setGeocodedChildLocations] = useState<Map<string, { latitude: number; longitude: number }>>(new Map());

  // Handle search filters from navigation params
  useEffect(() => {
    if (route.params?.filters) {
      setSearchFilters(route.params.filters);
      setSearchQuery(route.params.searchQuery || '');
      // Reload activities with new filters, using current region if available
      loadActivitiesWithFilters(route.params.filters, locationLoaded ? region : undefined);
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
    if (searchFilters === null && !loading && locationLoaded) {
      // Reload activities for the current region
      loadActivities(region);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters]);

  // Navigate to filters screen for map-based filtering
  // Hide distance and location sections since the map handles location visually
  const handleOpenSearch = useCallback(() => {
    (navigation as any).navigate('Filters', {
      hiddenSections: ['aiMatch', 'distance', 'locations'],
      screenTitle: 'Map Filters',
    });
  }, [navigation]);

  // Helper to validate coordinates are reasonable (not 0,0 which is in the ocean)
  const isValidCoordinate = useCallback((lat: any, lng: any): boolean => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    // Reject 0,0 (Gulf of Guinea) and coordinates outside reasonable bounds
    if (lat === 0 && lng === 0) return false;
    // Valid latitude is -90 to 90, longitude is -180 to 180
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    // For North America focus, we expect lat ~25-70, lng ~-170 to -50
    // But allow any valid coordinate for flexibility
    return true;
  }, []);

  // Helper to get location from child - checks multiple sources
  const getChildLocation = useCallback((child: ChildWithPreferences): { latitude: number; longitude: number } | null => {
    // 1. Check preferences.savedAddress (new location storage with coordinates)
    let savedAddress = (child.preferences as any)?.savedAddress;
    if (typeof savedAddress === 'string') {
      try {
        savedAddress = JSON.parse(savedAddress);
      } catch (e) { /* ignore */ }
    }
    if (savedAddress && isValidCoordinate(savedAddress.latitude, savedAddress.longitude)) {
      return { latitude: savedAddress.latitude, longitude: savedAddress.longitude };
    }

    // 2. Check locationDetails (deprecated but may have data)
    if (child.locationDetails && isValidCoordinate(child.locationDetails.latitude, child.locationDetails.longitude)) {
      return { latitude: child.locationDetails.latitude!, longitude: child.locationDetails.longitude! };
    }

    // 3. Check geocoded cache (for city names that were geocoded)
    if (child.location && geocodedChildLocations.has(child.id)) {
      return geocodedChildLocations.get(child.id)!;
    }

    return null;
  }, [isValidCoordinate, geocodedChildLocations]);

  // Geocode children's city names if they don't have coordinates
  useEffect(() => {
    const geocodeChildrenLocations = async () => {
      const childrenToGeocode = children.filter(child => {
        // Skip if already has coordinates
        if (getChildLocation(child)) return false;
        // Skip if no city name to geocode
        if (!child.location) return false;
        // Skip if already geocoded
        if (geocodedChildLocations.has(child.id)) return false;
        return true;
      });

      if (childrenToGeocode.length === 0) return;

      if (__DEV__) {
        console.log('[MapSearch] Geocoding city names for children:', childrenToGeocode.map(c => ({ name: c.name, location: c.location })));
      }

      const newGeocodedLocations = new Map(geocodedChildLocations);

      for (const child of childrenToGeocode) {
        try {
          // Geocode the city name (e.g., "North Vancouver" → coordinates)
          const coords = await geocodeAddress(child.location + ', Canada');
          if (coords) {
            newGeocodedLocations.set(child.id, coords);
            if (__DEV__) {
              console.log(`[MapSearch] Geocoded ${child.name}'s location "${child.location}":`, coords);
            }
          }
        } catch (e) {
          console.warn(`[MapSearch] Failed to geocode ${child.location}:`, e);
        }
      }

      if (newGeocodedLocations.size > geocodedChildLocations.size) {
        setGeocodedChildLocations(newGeocodedLocations);
      }
    };

    geocodeChildrenLocations();
  }, [children, getChildLocation, geocodedChildLocations]);

  // Determine initial region based on priority: Children > GPS > Canada
  useEffect(() => {
    // Check for children with location data (includes geocoded city names)
    const childrenWithLocations = children
      .map(child => getChildLocation(child))
      .filter((loc): loc is { latitude: number; longitude: number } => loc !== null);

    if (__DEV__) {
      console.log('[MapSearch] Children location check:', {
        total: children.length,
        withCoords: childrenWithLocations.length,
        geocodedCount: geocodedChildLocations.size,
        locations: childrenWithLocations,
      });
    }

    // If children with locations exist, center on them
    // Allow re-centering if geocoded locations just became available
    if (childrenWithLocations.length > 0) {
      const childrenRegion = calculateRegionFromCoordinates(childrenWithLocations);
      if (childrenRegion) {
        // Only animate if this is a new centering (not already centered here)
        const shouldAnimate = !hasCenteredOnChildren.current;
        hasCenteredOnChildren.current = true;
        hasInitializedRegion.current = true;

        if (__DEV__) {
          console.log('[MapSearch] Centering on children locations:', childrenRegion, { shouldAnimate });
        }

        setInitialRegion(childrenRegion);
        setRegion(childrenRegion);
        setLocationLoaded(true);

        if (shouldAnimate) {
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.animateToRegion(childrenRegion, 800);
              }
            }, 300);
          });
        }

        loadActivities(childrenRegion);
        lastFetchedRegion.current = childrenRegion;
        return;
      }
    }

    // If no children yet, wait briefly for data to load
    if (children.length === 0) {
      setTimeout(() => {
        if (!hasInitializedRegion.current && !hasCenteredOnChildren.current) {
          hasInitializedRegion.current = true;
          setLocationLoaded(true);
          loadActivities();
        }
      }, 2000);
      return;
    }

    // Only do fallback initialization once
    if (hasInitializedRegion.current) return;
    hasInitializedRegion.current = true;

    if (__DEV__) console.log('[MapSearch] No child coordinates, falling back to GPS');

    const determineInitialRegion = async () => {
      // Priority 2: Try to get user's current GPS location
      Geolocation.getCurrentPosition(
        (position) => {
          // Don't override if we've already centered on children
          if (hasCenteredOnChildren.current) return;

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

          // Animate map to region
          if (mapRef.current) {
            mapRef.current.animateToRegion(userRegion, 500);
          }

          // Load activities asynchronously
          loadActivities(userRegion);
          lastFetchedRegion.current = userRegion;
        },
        (error) => {
          // Don't override if we've already centered on children
          if (hasCenteredOnChildren.current) return;

          if (__DEV__) console.log('[MapSearch] GPS location error:', error.message);

          // Priority 3: Check for saved address in preferences
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

            // Animate map to region
            if (mapRef.current) {
              mapRef.current.animateToRegion(prefRegion, 500);
            }

            // Load activities asynchronously
            loadActivities(prefRegion);
            lastFetchedRegion.current = prefRegion;
          } else {
            // Priority 4: Default to Canada-wide view
            if (__DEV__) console.log('[MapSearch] Using Canada default region');
            setInitialRegion(CANADA_REGION);
            setRegion(CANADA_REGION);
            setLocationLoaded(true);

            // For Canada-wide view, don't filter by location (load all)
            loadActivities();
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    determineInitialRegion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, geocodedChildLocations]);

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
  // Also triggers a refetch if region moved significantly
  const updateVisibleActivities = useCallback((newRegion: Region) => {
    // Clear any pending timeouts
    if (regionChangeTimeout.current) {
      clearTimeout(regionChangeTimeout.current);
    }
    if (refetchTimeout.current) {
      clearTimeout(refetchTimeout.current);
    }

    // Immediately update visible activities from currently loaded data
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

      // If very few activities are visible and we might have more in this area, trigger refetch
      // This helps when user zooms into an area with sparse or no loaded activities
      if (visible.length < 10 && hasRegionMovedSignificantly(newRegion, lastFetchedRegion.current)) {
        if (__DEV__) console.log('[MapSearch] Few activities visible, will refetch for new region');
      }
    }, 300);

    // Debounced refetch - wait for user to stop panning/zooming
    // Only refetch if we've moved significantly and no search filters are active
    refetchTimeout.current = setTimeout(() => {
      if (hasRegionMovedSignificantly(newRegion, lastFetchedRegion.current) && !searchFilters) {
        if (__DEV__) console.log('[MapSearch] Region changed significantly, refetching activities');
        loadActivities(newRegion);
      }
    }, 800);
  }, [filteredActivities, getVisibleActivities, searchFilters]);

  // Initial visible activities update when activities load
  useEffect(() => {
    if (filteredActivities.length > 0 && locationLoaded) {
      updateVisibleActivities(region);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredActivities, locationLoaded]);

  // Note: Initial load is now handled in the location determination effect above

  // Reload activities when screen comes into focus (to pick up any new global filters)
  useFocusEffect(
    useCallback(() => {
      if (locationLoaded && !searchFilters) {
        // Reload activities for the current region
        loadActivities(region);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationLoaded, searchFilters, region])
  );

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

    // Note: We intentionally do NOT auto-zoom to fit all activities.
    // The map should stay centered on the user's chosen region (children's locations, GPS, or last position).
    // Activities are loaded for the current visible region via userLat/userLon/radiusKm params.
  };

  // Load activities with search filters applied
  const loadActivitiesWithFilters = async (filters: ActivitySearchParams, forRegion?: Region) => {
    try {
      setLoading(true);

      // Use the region passed or the current region state
      const targetRegion = forRegion || region;

      // Calculate bounds from the region
      const minLat = targetRegion.latitude - targetRegion.latitudeDelta / 2;
      const maxLat = targetRegion.latitude + targetRegion.latitudeDelta / 2;
      const minLng = targetRegion.longitude - targetRegion.longitudeDelta / 2;
      const maxLng = targetRegion.longitude + targetRegion.longitudeDelta / 2;

      if (__DEV__) {
        console.log('[MapSearch] Loading filtered activities for bounds:', {
          minLat, maxLat, minLng, maxLng,
          filters,
        });
      }

      // Build bounds query params with search filters
      const boundsParams: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
        limit: number;
        ageMin?: number;
        ageMax?: number;
        costMin?: number;
        costMax?: number;
        activityType?: string;
        dayOfWeek?: string[];
        hideClosedOrFull?: boolean;
        hideClosedActivities?: boolean;
        hideFullActivities?: boolean;
      } = {
        minLat,
        maxLat,
        minLng,
        maxLng,
        limit: 500,
      };

      // Apply search filters
      if (filters.ageMin !== undefined) boundsParams.ageMin = filters.ageMin;
      if (filters.ageMax !== undefined) boundsParams.ageMax = filters.ageMax;
      if (filters.costMin !== undefined) boundsParams.costMin = filters.costMin;
      if (filters.costMax !== undefined) boundsParams.costMax = filters.costMax;
      if (filters.activityTypes && filters.activityTypes.length > 0) {
        boundsParams.activityType = filters.activityTypes[0]; // Use first activity type
      }
      if (filters.daysOfWeek && filters.daysOfWeek.length > 0 && filters.daysOfWeek.length < 7) {
        boundsParams.dayOfWeek = filters.daysOfWeek;
      }
      if (filters.hideClosedActivities) boundsParams.hideClosedActivities = true;
      if (filters.hideFullActivities) boundsParams.hideFullActivities = true;

      if (__DEV__) console.log('[MapSearch] Bounds query with filters:', boundsParams);

      const result = await activityService.searchActivitiesByBounds(boundsParams);
      processAndSetActivities(result.activities);

      if (forRegion) {
        lastFetchedRegion.current = forRegion;
      }
    } catch (error) {
      if (__DEV__) console.error('[MapSearch] Error loading filtered activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async (forRegion?: Region) => {
    try {
      setLoading(true);

      // Use the region passed or the current region state
      const targetRegion = forRegion || region;

      // Calculate bounds from the region
      const minLat = targetRegion.latitude - targetRegion.latitudeDelta / 2;
      const maxLat = targetRegion.latitude + targetRegion.latitudeDelta / 2;
      const minLng = targetRegion.longitude - targetRegion.longitudeDelta / 2;
      const maxLng = targetRegion.longitude + targetRegion.longitudeDelta / 2;

      if (__DEV__) {
        console.log('[MapSearch] Loading activities for bounds:', {
          minLat, maxLat, minLng, maxLng,
          center: { lat: targetRegion.latitude, lon: targetRegion.longitude },
        });
      }

      // Get child-based filters (age range, activity types, etc.)
      const childFilters = getChildBasedFilters();
      const mergedFilters = childFilters?.mergedFilters;

      // Build bounds query params
      const boundsParams: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
        limit: number;
        ageMin?: number;
        ageMax?: number;
        costMin?: number;
        costMax?: number;
        dayOfWeek?: string[];
        hideClosedOrFull?: boolean;
        hideClosedActivities?: boolean;
        hideFullActivities?: boolean;
      } = {
        minLat,
        maxLat,
        minLng,
        maxLng,
        limit: 500,
      };

      // Apply child-based filters
      if (mergedFilters) {
        if (mergedFilters.ageMin !== undefined) boundsParams.ageMin = mergedFilters.ageMin;
        if (mergedFilters.ageMax !== undefined) boundsParams.ageMax = mergedFilters.ageMax;
        if (mergedFilters.priceRangeMin !== undefined) boundsParams.costMin = mergedFilters.priceRangeMin;
        if (mergedFilters.priceRangeMax !== undefined && mergedFilters.priceRangeMax < 999999) {
          boundsParams.costMax = mergedFilters.priceRangeMax;
        }
        if (mergedFilters.daysOfWeek && mergedFilters.daysOfWeek.length > 0 && mergedFilters.daysOfWeek.length < 7) {
          boundsParams.dayOfWeek = mergedFilters.daysOfWeek;
        }
      }

      // Apply hide closed/full settings from global preferences
      if (preferences.hideClosedOrFull) {
        boundsParams.hideClosedOrFull = true;
      }

      if (__DEV__) console.log('[MapSearch] Bounds query params:', boundsParams);

      // Use the bounds API for geographic filtering
      const result = await activityService.searchActivitiesByBounds(boundsParams);
      processAndSetActivities(result.activities);

      if (__DEV__) console.log('[MapSearch] Loaded', result.total, 'activities in bounds');

      // Track the region we just fetched for
      if (forRegion) {
        lastFetchedRegion.current = forRegion;
      }
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

  // Place search handlers
  const handlePlaceSearchChange = useCallback(async (text: string) => {
    setPlaceSearchQuery(text);
    if (__DEV__) console.log('[MapSearch] Place search text:', text);

    if (text.length < 2) {
      setPlacePredictions([]);
      return;
    }

    try {
      if (__DEV__) console.log('[MapSearch] Fetching place predictions for:', text);
      const results = await GooglePlacesSDK.fetchPredictions(text, {
        countries: ['ca', 'us'],
      });
      if (__DEV__) console.log('[MapSearch] Place predictions received:', results?.length || 0, results);
      setPlacePredictions(results || []);
    } catch (error) {
      if (__DEV__) console.error('[MapSearch] Error fetching place predictions:', error);
      setPlacePredictions([]);
    }
  }, []);

  const handleSelectPlace = useCallback(async (prediction: any) => {
    try {
      Keyboard.dismiss();
      setShowPlaceSearch(false);
      setPlacePredictions([]);
      setPlaceSearchQuery(prediction.primaryText || prediction.description || '');

      // Get place details with coordinates using correct API
      const place = await GooglePlacesSDK.fetchPlaceByID(prediction.placeID, [
        PLACE_FIELDS.NAME,
        PLACE_FIELDS.COORDINATE,
      ]);

      if (place?.coordinate) {
        const newRegion: Region = {
          latitude: place.coordinate.latitude,
          longitude: place.coordinate.longitude,
          latitudeDelta: 0.05, // City-level zoom
          longitudeDelta: 0.05,
        };

        if (__DEV__) {
          console.log('[MapSearch] Place selected, navigating to:', {
            place: prediction.primaryText || prediction.description,
            coordinate: place.coordinate,
            newRegion,
          });
        }

        // Update region state
        setRegion(newRegion);

        // Animate map to the new location
        mapRef.current?.animateToRegion(newRegion, 500);

        // Load activities for the new region (bypass checks for explicit navigation)
        loadActivities(newRegion);
        lastFetchedRegion.current = newRegion;
      } else {
        if (__DEV__) console.warn('[MapSearch] No coordinates returned for place:', prediction, place);
      }
    } catch (error) {
      if (__DEV__) console.error('[MapSearch] Error selecting place:', error);
    }
  }, []);

  const clearPlaceSearch = useCallback(() => {
    setPlaceSearchQuery('');
    setPlacePredictions([]);
    setShowPlaceSearch(false);
  }, []);

  // Favorites and waitlist services for action buttons
  const favoritesService = FavoritesService.getInstance();
  const waitlistService = WaitlistService.getInstance();

  // Extract days of week from activity
  const extractDaysOfWeek = (activity: Activity): string | null => {
    const daysSet = new Set<string>();
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Extract from sessions array
    if (activity.sessions && activity.sessions.length > 0) {
      activity.sessions.forEach(session => {
        const dayOfWeek = session?.dayOfWeek;
        if (dayOfWeek && typeof dayOfWeek === 'string') {
          const day = dayOfWeek.substring(0, 3);
          const normalized = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
          if (dayOrder.includes(normalized)) {
            daysSet.add(normalized);
          }
        }
      });
    }

    // Extract from schedule object
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

    // Extract from daysOfWeek array
    const activityAny = activity as any;
    if (activityAny.daysOfWeek && Array.isArray(activityAny.daysOfWeek)) {
      activityAny.daysOfWeek.forEach((day: string) => {
        const abbrev = day.substring(0, 3);
        const normalized = abbrev.charAt(0).toUpperCase() + abbrev.slice(1).toLowerCase();
        if (dayOrder.includes(normalized)) {
          daysSet.add(normalized);
        }
      });
    }

    if (daysSet.size === 0) return null;

    const sortedDays = Array.from(daysSet).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const weekend = ['Sat', 'Sun'];

    if (sortedDays.length === 5 && weekdays.every(d => sortedDays.includes(d))) return 'Weekdays';
    if (sortedDays.length === 2 && weekend.every(d => sortedDays.includes(d))) return 'Weekends';
    if (sortedDays.length === 7) return 'Daily';

    return sortedDays.join(', ');
  };

  // Handle share
  const handleShareActivity = async (activity: Activity) => {
    try {
      const locationName = typeof activity.location === 'string'
        ? activity.location
        : activity.location?.name || activity.locationName || '';

      const details: string[] = [];
      details.push(`🎯 ${activity.name}`);
      details.push('');
      if (locationName) details.push(`📍 ${locationName}`);
      const price = formatActivityPrice(activity.cost);
      if (price) details.push(`💰 ${price}`);
      if (activity.ageMin != null && activity.ageMax != null) {
        details.push(`👶 Ages ${activity.ageMin}-${activity.ageMax}`);
      }
      details.push('');
      details.push('Found on Kids Activity Tracker 📱');
      details.push('https://apps.apple.com/app/kids-activity-tracker');

      await Share.share({
        message: details.join('\n'),
        title: `Check out: ${activity.name}`,
      });
    } catch (error) {
      console.error('Error sharing activity:', error);
    }
  };

  // Render horizontal activity card with action buttons
  const renderActivityCard = useCallback(({ item }: { item: Activity }) => {
    const isSelected = selectedActivityId === item.id;
    const isFavorite = favoritesService.isFavorite(item.id);
    const isOnWaitlist = waitlistService.isOnWaitlist(item.id);

    const locationName = typeof item.location === 'string'
      ? item.location
      : item.location?.name || item.locationName || '';

    // Get activity image
    const activityTypeName = typeof item.activityType === 'string'
      ? item.activityType
      : (item.activityType as any)?.name || item.category || 'general';
    const subcategory = (item as any).activitySubtype?.name || item.subcategory;
    const imageKey = getActivityImageKey(activityTypeName, subcategory, item.name);
    const imageSource = getActivityImageByKey(imageKey, activityTypeName);

    // Format date range
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
    }

    // Format time with days of week
    const daysOfWeek = extractDaysOfWeek(item);
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

    // Format price
    const priceText = formatActivityPrice(item.cost);

    const handleToggleFavorite = () => {
      favoritesService.toggleFavorite(item);
    };

    const handleToggleWaitlist = async () => {
      await waitlistService.toggleWaitlist(item);
    };

    const handleOpenCalendar = () => {
      setSelectedActivityForCalendar(item);
      setShowCalendarModal(true);
    };

    return (
      <TouchableOpacity
        style={[styles.activityCard, isSelected && styles.activityCardSelected]}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.9}
      >
        {/* Image with action buttons */}
        <View style={styles.cardImageContainer}>
          <Image source={imageSource} style={styles.cardImage} resizeMode="cover" />

          {/* Price overlay */}
          <View style={styles.priceOverlay}>
            <Text style={styles.priceText}>{priceText}</Text>
            {item.cost != null && item.cost > 0 && (
              <Text style={styles.priceLabel}>per child</Text>
            )}
          </View>

          {/* Action buttons - all 4 matching home screen */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.cardActionButton} onPress={handleToggleFavorite}>
              <Icon
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={16}
                color={isFavorite ? '#E8638B' : '#FFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardActionButton} onPress={handleToggleWaitlist}>
              <Icon
                name={isOnWaitlist ? 'bell-ring' : 'bell-outline'}
                size={16}
                color={isOnWaitlist ? '#FFB800' : '#FFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardActionButton} onPress={() => handleShareActivity(item)}>
              <Icon name="share-variant" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardActionButton} onPress={handleOpenCalendar}>
              <Icon name="calendar-plus" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>

          {locationName ? (
            <View style={styles.cardInfoRow}>
              <Icon name="map-marker" size={12} color={Colors.primary} />
              <Text style={styles.cardInfoText} numberOfLines={1}>{locationName}</Text>
            </View>
          ) : null}

          {/* Combined days and time row - matches DashboardScreenModern */}
          {(daysOfWeek || timeText) ? (
            <View style={styles.daysRow}>
              <Icon name="calendar-week" size={12} color="#E8638B" />
              <Text style={styles.daysText}>
                {daysOfWeek}{daysOfWeek && timeText ? ' • ' : ''}{timeText ? timeText : ''}
              </Text>
            </View>
          ) : null}

          {dateRangeText ? (
            <View style={styles.cardInfoRow}>
              <Icon name="calendar" size={12} color="#717171" />
              <Text style={styles.cardInfoText}>{dateRangeText}</Text>
            </View>
          ) : null}

          {ageText ? (
            <View style={styles.cardInfoRow}>
              <Icon name="account-child" size={12} color="#717171" />
              <Text style={styles.cardInfoText}>{ageText}</Text>
            </View>
          ) : null}

          {item.spotsAvailable != null && item.spotsAvailable >= 0 && item.spotsAvailable <= 10 && (
            <View style={[
              styles.spotsBadge,
              item.spotsAvailable <= 3 && styles.spotsBadgeUrgent,
              item.spotsAvailable === 0 && styles.spotsBadgeFull,
            ]}>
              <Icon
                name={item.spotsAvailable === 0 ? "close-circle" : item.spotsAvailable <= 3 ? "alert-circle" : "information"}
                size={12}
                color={item.spotsAvailable === 0 ? "#D93025" : item.spotsAvailable <= 3 ? "#D93025" : Colors.primary}
              />
              <Text style={[
                styles.spotsText,
                item.spotsAvailable <= 3 && styles.spotsTextUrgent,
              ]}>
                {item.spotsAvailable === 0 ? 'FULL' : `${item.spotsAvailable} ${item.spotsAvailable === 1 ? 'spot' : 'spots'} left`}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selectedActivityId, handleActivityPress, favoritesService, waitlistService]);

  const keyExtractor = useCallback((item: Activity) => item.id, []);

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Tab Navigation */}
        <TopTabNavigation />

        {/* Map Section - 55% of screen */}
      <View style={styles.mapSection}>
        {/* Place Search Bar */}
        <View style={styles.placeSearchContainer}>
          <View style={styles.placeSearchInputContainer}>
            <Icon name="magnify" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.placeSearchInput}
              placeholder="Search for a place..."
              placeholderTextColor="#999"
              value={placeSearchQuery}
              onChangeText={handlePlaceSearchChange}
              onFocus={() => setShowPlaceSearch(true)}
              returnKeyType="search"
            />
            {placeSearchQuery.length > 0 && (
              <TouchableOpacity onPress={clearPlaceSearch} style={styles.clearSearchButton}>
                <Icon name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Predictions Dropdown */}
          {showPlaceSearch && placePredictions.length > 0 && (
            <View style={styles.predictionsContainer}>
              {placePredictions.slice(0, 5).map((prediction: any, index: number) => (
                <TouchableOpacity
                  key={prediction.placeId || index}
                  style={styles.predictionItem}
                  onPress={() => handleSelectPlace(prediction)}
                >
                  <Icon name="map-marker" size={18} color={Colors.primary} />
                  <View style={styles.predictionTextContainer}>
                    <Text style={styles.predictionMainText} numberOfLines={1}>
                      {prediction.primaryText || prediction.description}
                    </Text>
                    {prediction.secondaryText && (
                      <Text style={styles.predictionSecondaryText} numberOfLines={1}>
                        {prediction.secondaryText}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Only render map once we've determined the initial region to prevent Canada flash */}
        {!locationLoaded ? (
          <View style={[styles.map, styles.mapLoading]}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        ) : (
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
          {/* Activity cluster markers */}
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

          {/* Child home location markers */}
          {children
            .filter(child => getChildLocation(child) !== null)
            .map(child => {
              const location = getChildLocation(child)!;
              return (
                <Marker
                  key={`child-home-${child.id}`}
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.childMarkerContainer}>
                    <ChildAvatar child={child} size={36} showBorder={true} />
                  </View>
                </Marker>
              );
            })}
        </MapView>
        )}

        {/* Loading indicator - subtle, doesn't block the map */}
        {loading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}


        {/* Filter Button - Top Right */}
        <View style={styles.searchButtonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, searchFilters && styles.searchButtonActive]}
            onPress={handleOpenSearch}
          >
            <Icon
              name="filter-variant"
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

        {/* Filter Active Indicator */}
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
              {loading && visibleActivities.length === 0
                ? 'Loading activities...'
                : totalInViewport > visibleActivities.length
                ? `Showing ${visibleActivities.length} of ${totalInViewport} nearby`
                : `${visibleActivities.length} ${visibleActivities.length === 1 ? 'activity' : 'activities'} nearby`
              }
            </Text>
          </View>
          {!loading && allActivities.length !== filteredActivities.length && (
            <View style={styles.filterBadge}>
              <Icon name="filter" size={12} color={Colors.primary} />
              <Text style={styles.filterBadgeText}>
                {allActivities.length - filteredActivities.length} hidden
              </Text>
            </View>
          )}
        </View>

        {/* Horizontal Activity List */}
        {loading && visibleActivities.length === 0 ? (
          // Show skeleton cards while loading
          <FlatList
            data={Array.from({ length: SKELETON_COUNT }, (_, i) => i)}
            renderItem={({ item }) => <SkeletonCard index={item} />}
            keyExtractor={(item) => `skeleton-${item}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalListContent}
            scrollEnabled={false}
          />
        ) : visibleActivities.length > 0 ? (
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
            <View style={styles.emptyIconCircle}>
              <Icon name="map-marker-question" size={32} color="#E8638B" />
            </View>
            <Text style={styles.emptyListTitle}>No activities found</Text>
            <Text style={styles.emptyListSubtitle}>
              Try zooming out or changing your filters
            </Text>
          </View>
        ) : !loading && visibleActivities.length === 0 ? (
          <View style={styles.emptyListState}>
            <View style={styles.emptyIconCircle}>
              <Icon name="gesture-swipe" size={32} color="#E8638B" />
            </View>
            <Text style={styles.emptyListTitle}>Pan or zoom the map</Text>
            <Text style={styles.emptyListSubtitle}>
              Activities will appear as they come into view
            </Text>
          </View>
        ) : null}
      </View>
      </SafeAreaView>

      {/* Upgrade Modal for Premium Features */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        feature="filters"
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Calendar Modal */}
      {selectedActivityForCalendar && (
        <AddToCalendarModal
          visible={showCalendarModal}
          activity={selectedActivityForCalendar}
          onClose={() => {
            setShowCalendarModal(false);
            setSelectedActivityForCalendar(null);
          }}
        />
      )}
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
  mapLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtons: {
    position: 'absolute',
    right: 12,
    bottom: 24,
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
    zIndex: 101, // Above place search bar
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
  cardImageContainer: {
    position: 'relative',
    height: 80,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  priceLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionButtonsRow: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    padding: 2,
  },
  cardActionButton: {
    padding: 4,
    marginHorizontal: 1,
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    lineHeight: 18,
    marginBottom: 4,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  cardInfoText: {
    fontSize: 11,
    color: '#717171',
    flex: 1,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  daysText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E8638B',
    flex: 1,
  },
  spotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
    gap: 3,
    alignSelf: 'flex-start',
  },
  spotsBadgeUrgent: {
    backgroundColor: '#D93025' + '15',
  },
  spotsBadgeFull: {
    backgroundColor: '#D93025' + '20',
  },
  spotsText: {
    fontSize: 10,
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
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginTop: 12,
  },
  emptyListSubtitle: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    marginTop: 4,
  },
  // Place search styles
  placeSearchContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 60, // Leave room for filter button on right
    zIndex: 100,
  },
  placeSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 8,
  },
  placeSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 4,
  },
  clearSearchButton: {
    padding: 4,
  },
  predictionsContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
  },
  predictionSecondaryText: {
    fontSize: 12,
    color: '#717171',
    marginTop: 2,
  },
  // Child marker styles
  childMarkerContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default MapSearchScreen;
