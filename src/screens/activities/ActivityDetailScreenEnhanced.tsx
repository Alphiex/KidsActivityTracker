import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import LinearGradient from 'react-native-linear-gradient';
import { Activity } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchActivityChildren } from '../../store/slices/childActivitiesSlice';
import ActivityService from '../../services/activityService';
import FavoritesService from '../../services/favoritesService';
import RegisterChildModal from '../../components/activities/RegisterChildModal';
import ChildActivityStatus from '../../components/activities/ChildActivityStatus';
import AssignActivityToChildModal from '../../components/activities/AssignActivityToChildModal';
import { formatPrice } from '../../utils/formatters';
import { useTheme } from '../../contexts/ThemeContext';
import { geocodeAddressWithCache, getFullAddress } from '../../utils/geocoding';
import childrenService from '../../services/childrenService';
import { shareActivityViaEmail } from '../../utils/sharing';
const activityService = ActivityService.getInstance();

const { width } = Dimensions.get('window');

const ActivityDetailScreenEnhanced = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { colors, isDark } = useTheme();
  const favoritesService = FavoritesService.getInstance();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showChildAssignModal, setShowChildAssignModal] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [freshActivity, setFreshActivity] = useState<Activity | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(true);
  const mapRef = React.useRef<MapView>(null);
  
  // Parse the serialized dates back to Date objects
  const serializedActivity = route.params?.activity;
  
  if (!serializedActivity) {
    console.error('ActivityDetailScreenEnhanced: No activity data received');
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            No activity data available
          </Text>
        </View>
      </View>
    );
  }
  
  console.log('ActivityDetailScreenEnhanced received activity:', serializedActivity?.name);
  console.log('Location data:', {
    latitude: serializedActivity?.latitude,
    longitude: serializedActivity?.longitude,
    location: serializedActivity?.location,
    fullAddress: serializedActivity?.fullAddress,
  });
  
  // Debug logging for missing fields
  console.log('DEBUG - Activity data received:', {
    name: serializedActivity?.name,
    registrationStatus: serializedActivity?.registrationStatus,
    dates: serializedActivity?.dates,
    fullDescription: serializedActivity?.fullDescription,
    courseId: serializedActivity?.courseId,
    externalId: serializedActivity?.externalId,
    spotsAvailable: serializedActivity?.spotsAvailable,
    totalSpots: serializedActivity?.totalSpots,
    instructor: serializedActivity?.instructor,
    startTime: serializedActivity?.startTime,
    endTime: serializedActivity?.endTime,
    sessions: serializedActivity?.sessions?.length || 0,
    prerequisites: serializedActivity?.prerequisites,
  });
  
  let activity: Activity = freshActivity || serializedActivity;
  
  // Fetch fresh activity details
  useEffect(() => {
    const fetchFreshDetails = async () => {
      if (!serializedActivity?.id) return;
      
      try {
        setFetchingDetails(true);
        console.log('Fetching fresh activity details for:', serializedActivity.id);
        const response = await activityService.getActivityDetails(serializedActivity.id);
        
        if (response.activity) {
          console.log('Fresh activity data received:', {
            name: response.activity.name,
            registrationStatus: response.activity.registrationStatus,
            dates: response.activity.dates,
            fullDescription: response.activity.fullDescription?.substring(0, 50),
            instructor: response.activity.instructor,
            spotsAvailable: response.activity.spotsAvailable,
            sessions: response.activity.sessions?.length || 0,
            requiredExtras: response.activity.requiredExtras?.length || 0,
          });
          
          // Parse dates if needed
          const parsedActivity = {
            ...response.activity,
            dateRange: response.activity.dateRange ? {
              start: new Date(response.activity.dateRange.start),
              end: new Date(response.activity.dateRange.end),
            } : null,
            scrapedAt: new Date(response.activity.scrapedAt || response.activity.updatedAt),
          };
          
          setFreshActivity(parsedActivity);
        }
      } catch (error) {
        console.error('Error fetching fresh activity details:', error);
        // Fall back to passed activity
      } finally {
        setFetchingDetails(false);
      }
    };
    
    fetchFreshDetails();
  }, [serializedActivity?.id]);
  
  try {
    // Ensure we have proper date objects
    if (!activity.dateRange && activity.dateStart && activity.dateEnd) {
      activity = {
        ...activity,
        dateRange: {
          start: new Date(activity.dateStart),
          end: new Date(activity.dateEnd),
        }
      };
    }
  } catch (error) {
    console.error('Error parsing activity data:', error);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Error loading activity details
          </Text>
        </View>
      </View>
    );
  }

  useEffect(() => {
    setIsFavorite(favoritesService.isFavorite(activity.id) || activity.isFavorite);
    dispatch(fetchActivityChildren(activity.id));
  }, [activity.id, activity.isFavorite, dispatch]);

  // Geocode address if coordinates are not available
  useEffect(() => {
    const geocodeIfNeeded = async () => {
      // If activity already has coordinates, don't geocode
      if (activity.latitude && activity.longitude) {
        return;
      }

      // Get the full address
      const address = getFullAddress(activity);
      if (!address) {
        return;
      }

      try {
        const coords = await geocodeAddressWithCache(address);
        if (coords) {
          setGeocodedCoords(coords);
          // Animate to the new location
          setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.005, // Detailed view for exact location
              longitudeDelta: 0.005,
            }, 1000);
          }, 100);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    };

    geocodeIfNeeded();
  }, [activity]);

  const handleToggleFavorite = async () => {
    setLoading(true);
    try {
      const activityService = ActivityService.getInstance();
      await activityService.toggleFavorite(activity.id);
      favoritesService.toggleFavorite(activity);
      setIsFavorite(!isFavorite);
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    const url = activity.directRegistrationUrl || activity.registrationUrl;
    if (url) {
      Linking.openURL(url).catch(err => {
        console.error('Failed to open URL:', err);
        Alert.alert('Error', 'Failed to open registration link');
      });
    } else {
      Alert.alert('Registration', 'Registration URL not available for this activity');
    }
  };

  const handleGetDirections = () => {
    if (activity.latitude || geocodedCoords) {
      const lat = activity.latitude || geocodedCoords?.latitude;
      const lng = activity.longitude || geocodedCoords?.longitude;
      const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
      const latLng = `${lat},${lng}`;
      const label = typeof activity.location === 'string' 
        ? activity.location 
        : activity.location?.name || activity.locationName || activity.name;
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
      });
      Linking.openURL(url);
    } else {
      const address = getFullAddress(activity);
      const encodedAddress = encodeURIComponent(address);
      const url = Platform.select({
        ios: `maps:0,0?q=${encodedAddress}`,
        android: `geo:0,0?q=${encodedAddress}`
      });
      Linking.openURL(url);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return '#4CAF50';
      case 'waitlist':
        return '#FF9800';
      case 'closed':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'check-circle';
      case 'waitlist':
        return 'timer';
      case 'closed':
        return 'cancel';
      default:
        return 'help';
    }
  };

  // Determine map coordinates - use exact coordinates when available
  const mapLat = activity.latitude || geocodedCoords?.latitude || 49.3217;
  const mapLng = activity.longitude || geocodedCoords?.longitude || -123.0724;
  const hasExactLocation = !!(activity.latitude || geocodedCoords);
  
  // Debug logging
  console.log('Map coordinates:', {
    activityLat: activity.latitude,
    activityLng: activity.longitude,
    geocodedLat: geocodedCoords?.latitude,
    geocodedLng: geocodedCoords?.longitude,
    finalLat: mapLat,
    finalLng: mapLng,
    hasExactLocation,
  });

  // Show loading state while fetching fresh data
  if (fetchingDetails) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading activity details...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Header */}
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'DD']}
            style={styles.heroGradient}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <View style={styles.backButtonCircle}>
                <Icon name="arrow-back" size={24} color={colors.primary} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleToggleFavorite}
              style={styles.favoriteButton}
              disabled={loading}
            >
              <View style={styles.favoriteButtonCircle}>
                <Icon
                  name={isFavorite ? 'favorite' : 'favorite-border'}
                  size={24}
                  color={isFavorite ? '#FF4444' : colors.primary}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.heroContent}>
              <Text style={styles.category}>{activity.category}</Text>
              <Text style={styles.title}>{activity.name}</Text>
              {activity.subcategory && (
                <Text style={styles.subcategory}>{activity.subcategory}</Text>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {/* Primary Register Button */}
          {(activity.directRegistrationUrl || activity.registrationUrl) && (
            <TouchableOpacity
              style={[styles.primaryRegisterButton, { backgroundColor: colors.primary }]}
              onPress={handleRegister}
            >
              <Text style={styles.primaryRegisterButtonText}>Register for this Activity</Text>
              <Icon name="open-in-new" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
          
          {/* View on Website Button */}
          {activity.detailUrl && (
            <TouchableOpacity
              style={[styles.viewWebsiteButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
              onPress={() => {
                Linking.openURL(activity.detailUrl).catch(err => {
                  console.error('Failed to open URL:', err);
                  Alert.alert('Error', 'Failed to open website link');
                });
              }}
            >
              <Icon name="language" size={20} color={colors.primary} />
              <Text style={[styles.viewWebsiteButtonText, { color: colors.primary }]}>View on Website</Text>
            </TouchableOpacity>
          )}
          
          {/* Share Activity Button */}
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            onPress={() => shareActivityViaEmail({ activity })}
          >
            <Icon name="share" size={20} color={colors.primary} />
            <Text style={[styles.shareButtonText, { color: colors.primary }]}>Share via Email</Text>
          </TouchableOpacity>
        </View>

        {/* Registration Status Card - Always show */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Icon
                name={getStatusIcon(activity.registrationStatus || 'Unknown')}
                size={24}
                color={getStatusColor(activity.registrationStatus || 'Unknown')}
              />
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                  Registration Status
                </Text>
                <Text style={[styles.statusValue, { color: colors.text }]}>
                  {activity.registrationButtonText || activity.registrationStatus || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Key Details Grid */}
        <View style={styles.detailsGrid}>
          <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="calendar-range" size={24} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Dates</Text>
            <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
              {activity.dates || (activity.dateRange ? 
                `${formatDate(activity.dateRange.start)} - ${formatDate(activity.dateRange.end)}` : 
                'TBD')}
            </Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Time</Text>
            <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
              {activity.startTime && activity.endTime ? 
                `${activity.startTime} - ${activity.endTime}` : 
                activity.schedule || 'TBD'}
            </Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="human-child" size={24} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Ages</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {activity.ageRange?.min}-{activity.ageRange?.max} yrs
            </Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="cash" size={24} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Cost</Text>
            <View>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                ${formatPrice(activity.cost || 0)}
              </Text>
              {activity.costIncludesTax === false && (
                <Text style={[styles.detailSubtext, { color: colors.textSecondary, fontSize: 11 }]}>
                  + tax
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="account-group" size={24} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Spots</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {activity.spotsAvailable || 0}
              {activity.totalSpots ? `/${activity.totalSpots}` : ''}
            </Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="calendar-clock" size={24} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Registration</Text>
            <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
              {activity.registrationEndDate ? 
                `Ends ${formatDate(new Date(activity.registrationEndDate))}` : 
                'Open'}
            </Text>
          </View>
        </View>

        {/* Description */}
        {(activity.fullDescription || activity.description) && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.descriptionText, { color: colors.text }]}>
              {activity.fullDescription || activity.description}
            </Text>
          </View>
        )}
        
        {/* Course Details */}
        {activity.courseDetails && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Course Details</Text>
            <Text style={[styles.descriptionText, { color: colors.text }]}>
              {activity.courseDetails}
            </Text>
          </View>
        )}

        {/* Sessions */}
        {activity.sessions && activity.sessions.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {activity.sessions.length === 1 ? 'Session' : `Sessions (${activity.sessions.length})`}
            </Text>
            {activity.sessions.map((session, index) => (
              <View key={index} style={[styles.sessionItem, index > 0 && styles.sessionBorder]}>
                <View style={styles.sessionHeader}>
                  <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.primary} />
                  <Text style={[styles.sessionNumber, { color: colors.text }]}>
                    {activity.sessions.length > 1 ? `Session ${session.sessionNumber || index + 1}` : 'Date & Time'}
                  </Text>
                </View>
                {(session.date || session.dayOfWeek) && (
                  <Text style={[styles.sessionDate, { color: colors.text }]}>
                    {session.dayOfWeek ? `${session.dayOfWeek}${session.date ? ', ' : ''}` : ''}{session.date || ''}
                  </Text>
                )}
                {(session.startTime || session.endTime) && (
                  <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                    {session.startTime}{session.endTime && ` - ${session.endTime}`}
                  </Text>
                )}
                {(session.location || session.subLocation) && (
                  <View style={styles.sessionLocation}>
                    <Icon name="location-on" size={16} color={colors.textSecondary} />
                    <Text style={[styles.sessionLocationText, { color: colors.textSecondary }]}>
                      {session.location || activity.location}
                      {session.subLocation ? ` - ${session.subLocation}` : ''}
                    </Text>
                  </View>
                )}
                {session.instructor && (
                  <View style={styles.sessionInstructor}>
                    <Icon name="person" size={16} color={colors.textSecondary} />
                    <Text style={[styles.sessionInstructorText, { color: colors.textSecondary }]}>
                      {session.instructor}
                    </Text>
                  </View>
                )}
                {session.notes && (
                  <View style={styles.sessionNotes}>
                    <Icon name="info-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.sessionNotesText, { color: colors.textSecondary }]}>
                      {session.notes}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Schedule & Additional Info */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Details</Text>
          
          {/* Show schedule only if no sessions */}
          {!activity.sessions && activity.schedule && (
            <View style={styles.infoRow}>
              <Icon name="schedule" size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Schedule</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {typeof activity.schedule === 'string' ? activity.schedule : 
                   `${activity.schedule.days?.join(', ')} ${activity.schedule.startTime} - ${activity.schedule.endTime}`}
                </Text>
              </View>
            </View>
          )}

          {activity.instructor && (
            <View style={styles.infoRow}>
              <Icon name="person" size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Instructor</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{activity.instructor}</Text>
              </View>
            </View>
          )}

          {activity.courseId && (
            <View style={styles.infoRow}>
              <Icon name="tag" size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Course ID</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{activity.courseId}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Requirements */}
        {(activity.prerequisites || activity.whatToBring) && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Requirements</Text>
            
            {activity.prerequisites && (
              <View style={styles.requirementSection}>
                <Text style={[styles.requirementTitle, { color: colors.text }]}>Prerequisites</Text>
                {typeof activity.prerequisites === 'string' ? (
                  <Text style={[styles.requirementText, { color: colors.textSecondary }]}>
                    {activity.prerequisites}
                  </Text>
                ) : Array.isArray(activity.prerequisites) ? (
                  <View>
                    {activity.prerequisites.map((prereq, index) => (
                      <View key={index} style={styles.prerequisiteItem}>
                        <MaterialCommunityIcons 
                          name="checkbox-marked-circle-outline" 
                          size={16} 
                          color={colors.warning} 
                        />
                        <View style={styles.prerequisiteContent}>
                          <Text style={[styles.prerequisiteName, { color: colors.text }]}>
                            {prereq.name}
                          </Text>
                          {prereq.description && (
                            <Text style={[styles.prerequisiteDescription, { color: colors.textSecondary }]}>
                              {prereq.description}
                            </Text>
                          )}
                          {prereq.url && (
                            <TouchableOpacity
                              onPress={() => Linking.openURL(prereq.url)}
                              style={styles.prerequisiteLink}
                            >
                              <Text style={[styles.prerequisiteLinkText, { color: colors.primary }]}>
                                View Course Details
                              </Text>
                              <Icon name="open-in-new" size={14} color={colors.primary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}

            {activity.whatToBring && (
              <View style={styles.requirementSection}>
                <Text style={[styles.requirementTitle, { color: colors.text }]}>What to Bring</Text>
                <Text style={[styles.requirementText, { color: colors.textSecondary }]}>
                  {activity.whatToBring}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Required Extras */}
        {activity.requiredExtras && activity.requiredExtras.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Required Extras</Text>
            <View style={styles.extrasContainer}>
              {activity.requiredExtras.map((extra, index) => (
                <View key={index} style={[styles.extraItem, index > 0 && styles.extraBorder]}>
                  <View style={styles.extraLeft}>
                    <Icon name="shopping-cart" size={18} color={colors.primary} />
                    <Text style={[styles.extraName, { color: colors.text }]}>
                      {extra.name}
                    </Text>
                  </View>
                  <Text style={[styles.extraCost, { color: colors.primary }]}>
                    {extra.cost}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Location & Map */}
        {getFullAddress(activity) && (
          <View style={[styles.card, { backgroundColor: colors.surface, padding: 0, overflow: 'hidden' }]}>
            <View style={styles.locationHeader}>
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Location</Text>
            </View>
            
            <View style={styles.locationInfo}>
              <Icon name="location-on" size={24} color={colors.primary} />
              <View style={styles.locationTextContainer}>
                <Text style={[styles.locationName, { color: colors.text }]}>
                  {typeof activity.location === 'string' 
                    ? activity.location 
                    : activity.location?.name || activity.locationName || 'Location'}
                </Text>
                {(activity.fullAddress || (typeof activity.location === 'object' && activity.location?.address)) && (
                  <Text style={[styles.locationAddress, { color: colors.textSecondary }]}>
                    {activity.fullAddress || (typeof activity.location === 'object' ? activity.location.address : '')}
                  </Text>
                )}
              </View>
            </View>

            {/* Always show map */}
            <View style={styles.mapWrapper}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: mapLat,
                  longitude: mapLng,
                  latitudeDelta: 0.005, // Always show detailed view
                  longitudeDelta: 0.005,
                }}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsCompass={true}
                showsScale={false}
                zoomEnabled={true}
                zoomTapEnabled={true}
              >
                {/* Always show marker */}
                <Marker
                  coordinate={{
                    latitude: mapLat,
                    longitude: mapLng,
                  }}
                  title={activity.name}
                  description={getFullAddress(activity)}
                  pinColor={colors.primary}
                  anchor={{ x: 0.5, y: 1 }}
                  calloutAnchor={{ x: 0.5, y: 0 }}
                >
                  {/* Custom marker for better visibility */}
                  <View style={styles.customMarker}>
                    <View style={[styles.markerDot, { backgroundColor: colors.primary }]} />
                    <View style={[styles.markerStem, { backgroundColor: colors.primary }]} />
                  </View>
                </Marker>
              </MapView>

              <TouchableOpacity
                style={styles.directionsButton}
                onPress={handleGetDirections}
              >
                <Icon name="directions" size={20} color="#FFFFFF" />
                <Text style={styles.directionsText}>Directions</Text>
              </TouchableOpacity>
            </View>

            {activity.contactInfo && (
              <View style={styles.contactInfo}>
                <Icon name="phone" size={20} color={colors.textSecondary} />
                <Text style={[styles.contactText, { color: colors.text }]}>
                  {activity.contactInfo}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Child Registration */}
        <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: 100 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Assign to Child</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary, marginBottom: 16 }]}>
            Track this activity for your children
          </Text>
          <TouchableOpacity
            style={[styles.childRegisterButton, { backgroundColor: colors.secondary }]}
            onPress={() => setShowChildAssignModal(true)}
          >
            <Icon name="account-child" size={20} color="#FFFFFF" />
            <Text style={styles.childRegisterButtonText}>Assign to Child</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <RegisterChildModal
        visible={showRegisterModal}
        activity={activity}
        onClose={() => setShowRegisterModal(false)}
      />

      <AssignActivityToChildModal
        visible={showChildAssignModal}
        activity={activity}
        onClose={() => setShowChildAssignModal(false)}
      />

      {/* Floating Register Button - Always visible at bottom */}
      {(activity.directRegistrationUrl || activity.registrationUrl) && (
        <TouchableOpacity
          style={[styles.floatingRegisterButton, { backgroundColor: colors.primary }]}
          onPress={handleRegister}
          activeOpacity={0.9}
        >
          <View style={styles.floatingButtonContent}>
            <Text style={styles.floatingRegisterText}>Register Now</Text>
            <Icon name="arrow-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  heroContainer: {
    height: 200,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 10,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
  },
  favoriteButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroContent: {
    marginBottom: 10,
  },
  category: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subcategory: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusTextContainer: {
    marginLeft: 12,
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  primaryRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryRegisterButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  viewWebsiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  viewWebsiteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  detailCard: {
    flex: 1,
    minWidth: (width - 44) / 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 14,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
  },
  requirementSection: {
    marginBottom: 16,
  },
  requirementTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Session styles
  sessionItem: {
    paddingVertical: 12,
  },
  sessionBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  sessionDate: {
    fontSize: 15,
    marginBottom: 4,
    marginLeft: 32,
  },
  sessionTime: {
    fontSize: 14,
    marginLeft: 32,
  },
  sessionLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 32,
    marginTop: 4,
  },
  sessionLocationText: {
    fontSize: 14,
    marginLeft: 4,
  },
  sessionInstructor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 32,
    marginTop: 4,
  },
  sessionInstructorText: {
    fontSize: 14,
    marginLeft: 4,
  },
  // Prerequisite styles
  prerequisiteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  prerequisiteContent: {
    marginLeft: 8,
    flex: 1,
  },
  prerequisiteName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  prerequisiteDescription: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 4,
  },
  prerequisiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  prerequisiteLinkText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  locationHeader: {
    padding: 16,
    paddingBottom: 0,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  locationTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
  },
  mapWrapper: {
    height: 250,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
  },
  mapOverlayContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  mapOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 6,
  },
  directionsButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  directionsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  extrasContainer: {
    marginTop: 8,
  },
  extraItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  extraBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  extraLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  extraName: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  extraCost: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  contactText: {
    marginLeft: 12,
    fontSize: 14,
  },
  childRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  childRegisterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  customMarker: {
    alignItems: 'center',
  },
  markerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerStem: {
    width: 3,
    height: 20,
    marginTop: -2,
  },
  floatingRegisterButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingRegisterText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
});

export default ActivityDetailScreenEnhanced;