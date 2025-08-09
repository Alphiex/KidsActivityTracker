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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
// import MapView, { Marker } from 'react-native-maps'; // TODO: Install react-native-maps
import LinearGradient from 'react-native-linear-gradient';
import { Activity } from '../../types';
import { useStore } from '../../store';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchActivityChildren } from '../../store/slices/childActivitiesSlice';
import ActivityService from '../../services/activityService';
import RegisterChildModal from '../../components/activities/RegisterChildModal';
import ChildActivityStatus from '../../components/activities/ChildActivityStatus';
import { formatPrice } from '../../utils/formatters';
import { useTheme } from '../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const ActivityDetailScreenEnhanced = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const { favoriteActivities, toggleFavorite } = useStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    description: true,
    requirements: false,
    location: false,
  });
  
  // Parse the serialized dates back to Date objects
  const serializedActivity = route.params?.activity;
  const activity: Activity = {
    ...serializedActivity,
    dateRange: serializedActivity.dateRange ? {
      start: new Date(serializedActivity.dateRange.start),
      end: new Date(serializedActivity.dateRange.end),
    } : null,
    scrapedAt: new Date(serializedActivity.scrapedAt),
  };

  useEffect(() => {
    setIsFavorite(favoriteActivities.includes(activity.id) || activity.isFavorite);
    dispatch(fetchActivityChildren(activity.id));
  }, [activity.id, favoriteActivities, activity.isFavorite, dispatch]);

  const handleToggleFavorite = async () => {
    setLoading(true);
    try {
      const activityService = ActivityService.getInstance();
      await activityService.toggleFavorite(activity.id);
      toggleFavorite(activity.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    if (activity.directRegistrationUrl || activity.registrationUrl) {
      Linking.openURL(activity.directRegistrationUrl || activity.registrationUrl);
    } else {
      Alert.alert('Registration', 'Registration URL not available for this activity');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, colors.primary + 'CC']}
        style={styles.headerGradient}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.category}>{activity.category}</Text>
          <Text style={styles.title}>{activity.name}</Text>
          {activity.subcategory && (
            <Text style={styles.subcategory}>{activity.subcategory}</Text>
          )}
        </View>
        
        <TouchableOpacity
          onPress={handleToggleFavorite}
          style={styles.favoriteButton}
          disabled={loading}
        >
          <Icon
            name={isFavorite ? 'favorite' : 'favorite-border'}
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Registration Status Banner */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: getStatusColor(activity.registrationStatus) }
          ]}
        >
          <Icon
            name={getStatusIcon(activity.registrationStatus)}
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.statusText}>
            {activity.registrationButtonText || activity.registrationStatus || 'Status Unknown'}
          </Text>
        </View>

        {/* Quick Info Cards */}
        <View style={styles.quickInfoContainer}>
          <View style={[styles.quickInfoCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="calendar-range" size={20} color={colors.primary} />
            <Text style={[styles.quickInfoLabel, { color: colors.textSecondary }]}>Dates</Text>
            <Text style={[styles.quickInfoValue, { color: colors.text }]}>
              {activity.dates || (activity.dateRange ? 
                `${formatDate(activity.dateRange.start)} - ${formatDate(activity.dateRange.end)}` : 
                'TBD')}
            </Text>
          </View>

          <View style={[styles.quickInfoCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="human-child" size={20} color={colors.primary} />
            <Text style={[styles.quickInfoLabel, { color: colors.textSecondary }]}>Ages</Text>
            <Text style={[styles.quickInfoValue, { color: colors.text }]}>
              {activity.ageRange ? `${activity.ageRange.min}-${activity.ageRange.max} yrs` : 'All ages'}
            </Text>
          </View>

          <View style={[styles.quickInfoCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="cash" size={20} color={colors.primary} />
            <Text style={[styles.quickInfoLabel, { color: colors.textSecondary }]}>Cost</Text>
            <Text style={[styles.quickInfoValue, { color: colors.text }]}>
              ${formatPrice(activity.cost)}
            </Text>
          </View>

          <View style={[styles.quickInfoCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="account-group" size={20} color={colors.primary} />
            <Text style={[styles.quickInfoLabel, { color: colors.textSecondary }]}>Spots</Text>
            <Text style={[styles.quickInfoValue, { color: colors.text }]}>
              {activity.totalSpots ? 
                `${activity.spotsAvailable || 0}/${activity.totalSpots}` : 
                activity.spotsAvailable || 'TBD'}
            </Text>
          </View>
        </View>

        {/* Main Registration Button */}
        <TouchableOpacity
          style={[
            styles.mainRegisterButton,
            { 
              backgroundColor: activity.registrationStatus === 'Closed' ? '#9E9E9E' : colors.primary,
              opacity: activity.registrationStatus === 'Closed' ? 0.7 : 1,
            }
          ]}
          onPress={handleRegister}
          disabled={activity.registrationStatus === 'Closed'}
        >
          <Icon name="open-in-new" size={20} color="#FFFFFF" />
          <Text style={styles.mainRegisterButtonText}>
            {activity.registrationStatus === 'Closed' ? 
              'Registration Closed' : 
              activity.registrationStatus === 'WaitList' ?
              'Join Waitlist' :
              'Register Now'}
          </Text>
        </TouchableOpacity>

        {/* Expandable Sections */}
        {/* Details Section */}
        <TouchableOpacity
          style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
          onPress={() => toggleSection('details')}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
          <Icon
            name={expandedSections.details ? 'expand-less' : 'expand-more'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        
        {expandedSections.details && (
          <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
            {activity.schedule && (
              <View style={styles.detailRow}>
                <Icon name="schedule" size={20} color={colors.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Schedule</Text>
                  <Text style={[styles.detailText, { color: colors.text }]}>
                    {typeof activity.schedule === 'string' ? activity.schedule : 'See description'}
                  </Text>
                </View>
              </View>
            )}

            {activity.instructor && (
              <View style={styles.detailRow}>
                <Icon name="person" size={20} color={colors.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Instructor</Text>
                  <Text style={[styles.detailText, { color: colors.text }]}>
                    {activity.instructor}
                  </Text>
                </View>
              </View>
            )}

            {activity.courseId && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="barcode" size={20} color={colors.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Course ID</Text>
                  <Text style={[styles.detailText, { color: colors.text }]}>
                    {activity.courseId}
                  </Text>
                </View>
              </View>
            )}

            {activity.registrationDate && (
              <View style={styles.detailRow}>
                <Icon name="event" size={20} color={colors.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Registration Opens</Text>
                  <Text style={[styles.detailText, { color: colors.text }]}>
                    {activity.registrationDate}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Description Section */}
        {(activity.fullDescription || activity.description) && (
          <>
            <TouchableOpacity
              style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
              onPress={() => toggleSection('description')}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
              <Icon
                name={expandedSections.description ? 'expand-less' : 'expand-more'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            
            {expandedSections.description && (
              <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.descriptionText, { color: colors.text }]}>
                  {activity.fullDescription || activity.description}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Requirements Section */}
        {(activity.prerequisites || activity.whatToBring) && (
          <>
            <TouchableOpacity
              style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
              onPress={() => toggleSection('requirements')}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Requirements</Text>
              <Icon
                name={expandedSections.requirements ? 'expand-less' : 'expand-more'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            
            {expandedSections.requirements && (
              <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
                {activity.prerequisites && (
                  <View style={styles.requirementItem}>
                    <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>
                      Prerequisites
                    </Text>
                    <Text style={[styles.requirementText, { color: colors.text }]}>
                      {activity.prerequisites}
                    </Text>
                  </View>
                )}
                
                {activity.whatToBring && (
                  <View style={styles.requirementItem}>
                    <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>
                      What to Bring
                    </Text>
                    <Text style={[styles.requirementText, { color: colors.text }]}>
                      {activity.whatToBring}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Location Section */}
        <TouchableOpacity
          style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
          onPress={() => toggleSection('location')}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
          <Icon
            name={expandedSections.location ? 'expand-less' : 'expand-more'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        
        {expandedSections.location && (
          <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
            <View style={styles.locationInfo}>
              <Icon name="location-on" size={20} color={colors.textSecondary} />
              <View style={styles.locationTextContainer}>
                <Text style={[styles.locationName, { color: colors.text }]}>
                  {activity.location || activity.locationName || 'Location TBD'}
                </Text>
                {activity.fullAddress && (
                  <Text style={[styles.locationAddress, { color: colors.textSecondary }]}>
                    {activity.fullAddress}
                  </Text>
                )}
              </View>
            </View>

            {activity.latitude && activity.longitude && (
              <View style={styles.mapContainer}>
                {/* TODO: Add MapView once react-native-maps is installed */}
                <View style={[styles.map, styles.mapPlaceholder]}>
                  <Icon name="location-on" size={48} color={colors.primary} />
                  <Text style={[styles.mapPlaceholderText, { color: colors.text }]}>
                    Map View Available
                  </Text>
                  <Text style={[styles.mapCoordinates, { color: colors.textSecondary }]}>
                    {activity.latitude.toFixed(4)}, {activity.longitude.toFixed(4)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.directionsButton}
                  onPress={() => {
                    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
                    const latLng = `${activity.latitude},${activity.longitude}`;
                    const label = activity.location || activity.name;
                    const url = Platform.select({
                      ios: `${scheme}${label}@${latLng}`,
                      android: `${scheme}${latLng}(${label})`
                    });
                    Linking.openURL(url);
                  }}
                >
                  <Icon name="directions" size={16} color="#FFFFFF" />
                  <Text style={styles.directionsText}>Get Directions</Text>
                </TouchableOpacity>
              </View>
            )}

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

        {/* Child Registration Section */}
        <View style={[styles.childSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Child Registration</Text>
          <ChildActivityStatus 
            activityId={activity.id} 
            onPress={() => setShowRegisterModal(true)}
          />
          <TouchableOpacity
            style={[styles.registerChildButton, { backgroundColor: colors.secondary }]}
            onPress={() => setShowRegisterModal(true)}
          >
            <Icon name="child-care" size={20} color="#FFFFFF" />
            <Text style={styles.registerChildButtonText}>Register Child</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <RegisterChildModal
        visible={showRegisterModal}
        activity={activity}
        onClose={() => setShowRegisterModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    padding: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  category: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginVertical: 8,
  },
  subcategory: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  favoriteButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  quickInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  quickInfoCard: {
    width: (width - 48) / 2,
    padding: 16,
    margin: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickInfoLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  quickInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  mainRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 16,
    borderRadius: 12,
  },
  mainRegisterButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionContent: {
    marginHorizontal: 16,
    marginTop: 2,
    padding: 16,
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 16,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  requirementItem: {
    marginBottom: 16,
  },
  requirementLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 16,
    lineHeight: 22,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
  },
  locationAddress: {
    fontSize: 14,
    marginTop: 4,
  },
  mapContainer: {
    height: 200,
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  mapCoordinates: {
    fontSize: 12,
    marginTop: 4,
  },
  directionsButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  directionsText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 6,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  contactText: {
    fontSize: 16,
    marginLeft: 12,
  },
  childSection: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  registerChildButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  registerChildButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default ActivityDetailScreenEnhanced;