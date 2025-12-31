import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Activity } from '../types';
import ActivityService from '../services/activityService';
import { ActivityMapMarker, MapActivityCard } from '../components/map';
import { Colors } from '../theme';

const { width, height } = Dimensions.get('window');

// Default region (Vancouver area)
const DEFAULT_REGION: Region = {
  latitude: 49.2827,
  longitude: -123.1207,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const MapSearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef<MapView>(null);
  const activityService = ActivityService.getInstance();

  // State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [showListView, setShowListView] = useState(false);
  const cardAnimation = useRef(new Animated.Value(0)).current;

  // Get filters from route params if provided
  const filters = (route.params as any)?.filters || {};

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    // Animate card in/out
    Animated.spring(cardAnimation, {
      toValue: selectedActivity ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [selectedActivity]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const result = await activityService.searchActivities({
        ...filters,
        limit: 100, // Load more for map view
      });
      
      // Filter to only activities with coordinates
      const activitiesWithLocation = (result.activities || []).filter(
        (a: Activity) => a.latitude && a.longitude
      );
      
      setActivities(activitiesWithLocation);

      // Fit map to show all activities
      if (activitiesWithLocation.length > 0 && mapRef.current) {
        const coords = activitiesWithLocation.map((a: Activity) => ({
          latitude: a.latitude!,
          longitude: a.longitude!,
        }));
        
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
            animated: true,
          });
        }, 500);
      }
    } catch (error) {
      console.error('Error loading map activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerPress = useCallback((activity: Activity) => {
    setSelectedActivity(activity);
    
    // Center map on selected activity
    if (mapRef.current && activity.latitude && activity.longitude) {
      mapRef.current.animateToRegion({
        latitude: activity.latitude,
        longitude: activity.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 300);
    }
  }, []);

  const handleActivityPress = useCallback(() => {
    if (selectedActivity) {
      (navigation as any).navigate('ActivityDetail', { activity: selectedActivity });
    }
  }, [selectedActivity, navigation]);

  const handleMapPress = useCallback(() => {
    setSelectedActivity(null);
  }, []);

  const handleMyLocation = useCallback(() => {
    // This would use device location - for now, go to default region
    mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
  }, []);

  const toggleListView = useCallback(() => {
    if (showListView) {
      setShowListView(false);
    } else {
      setShowListView(true);
      (navigation as any).navigate('SearchResults', { filters });
    }
  }, [showListView, filters, navigation]);

  const cardTranslateY = cardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Map View</Text>
        <TouchableOpacity style={styles.listButton} onPress={toggleListView}>
          <Icon name="format-list-bulleted" size={24} color="#222" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          rotateEnabled={false}
        >
          {activities.map((activity) => (
            <ActivityMapMarker
              key={activity.id}
              activity={activity}
              onPress={() => handleMarkerPress(activity)}
              isSelected={selectedActivity?.id === activity.id}
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

        {/* Activity Count Badge */}
        {!loading && (
          <View style={styles.countBadge}>
            <Icon name="map-marker-multiple" size={16} color="#FFF" />
            <Text style={styles.countText}>
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
            </Text>
          </View>
        )}

        {/* My Location Button */}
        <TouchableOpacity style={styles.myLocationButton} onPress={handleMyLocation}>
          <Icon name="crosshairs-gps" size={22} color={Colors.primary} />
        </TouchableOpacity>

        {/* Recenter Button */}
        {activities.length > 0 && (
          <TouchableOpacity 
            style={styles.recenterButton} 
            onPress={() => {
              const coords = activities.map((a) => ({
                latitude: a.latitude!,
                longitude: a.longitude!,
              }));
              mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
                animated: true,
              });
            }}
          >
            <Icon name="fit-to-screen-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Selected Activity Card */}
      <Animated.View 
        style={[
          styles.cardContainer,
          { transform: [{ translateY: cardTranslateY }] }
        ]}
        pointerEvents={selectedActivity ? 'auto' : 'none'}
      >
        {selectedActivity && (
          <MapActivityCard
            activity={selectedActivity}
            onPress={handleActivityPress}
            onClose={() => setSelectedActivity(null)}
          />
        )}
      </Animated.View>
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
  listButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  countBadge: {
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
  countText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  myLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 180,
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
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 240,
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
  cardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default MapSearchScreen;
