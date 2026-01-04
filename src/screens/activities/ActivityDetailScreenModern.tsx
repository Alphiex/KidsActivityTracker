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
  ImageBackground,
  SafeAreaView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import LinearGradient from 'react-native-linear-gradient';
import { Activity } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchActivityChildren } from '../../store/slices/childActivitiesSlice';
import ActivityService from '../../services/activityService';
import FavoritesService from '../../services/favoritesService';
import WaitlistService from '../../services/waitlistService';
import childrenService from '../../services/childrenService';
import useWaitlistSubscription from '../../hooks/useWaitlistSubscription';
import useSmartPaywallTrigger from '../../hooks/useSmartPaywallTrigger';
import UpgradePromptModal from '../../components/UpgradePromptModal';
import RegisterChildModal from '../../components/activities/RegisterChildModal';
import ChildActivityStatus from '../../components/activities/ChildActivityStatus';
import AssignActivityToChildModal from '../../components/activities/AssignActivityToChildModal';
import { formatActivityPrice, cleanActivityName } from '../../utils/formatters';
import { geocodeAddressWithCache, getFullAddress } from '../../utils/geocoding';
import { shareActivity, shareActivityViaEmail } from '../../utils/sharing';
import { getActivityImageByKey, aiRobotImage } from '../../assets/images';
import { getActivityImageKey } from '../../utils/activityHelpers';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../../theme/modernTheme';
import { ActivityExplanation } from '../../components/ai/ActivityExplanation';

const { width, height } = Dimensions.get('window');
const activityService = ActivityService.getInstance();

const ActivityDetailScreenModern = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const favoritesService = FavoritesService.getInstance();
  const waitlistService = WaitlistService.getInstance();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isAssignedToCalendar, setIsAssignedToCalendar] = useState(false);

  // Subscription-aware waitlist
  const {
    canAddToWaitlist,
    onWaitlistLimitReached,
    showUpgradeModal: showWaitlistUpgradeModal,
    hideUpgradeModal: hideWaitlistUpgradeModal,
    waitlistCount,
    waitlistLimit,
    syncWaitlistCount,
  } = useWaitlistSubscription();
  const { onFavoriteAdded } = useSmartPaywallTrigger();
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showChildAssignModal, setShowChildAssignModal] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [freshActivity, setFreshActivity] = useState<Activity | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(true);
  const [loadingFromDeepLink, setLoadingFromDeepLink] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const mapRef = React.useRef<MapView>(null);
  const { user } = useAppSelector((state) => state.auth);

  const serializedActivity = (route.params as any)?.activity;
  const activityIdFromDeepLink = (route.params as any)?.activityId;

  // Handle deep link - fetch activity by ID if no activity object provided
  useEffect(() => {
    const fetchActivityFromDeepLink = async () => {
      if (serializedActivity || !activityIdFromDeepLink) return;

      try {
        setLoadingFromDeepLink(true);
        setDeepLinkError(null);
        console.log('[ActivityDetail] Fetching activity from deep link:', activityIdFromDeepLink);
        const details = await activityService.getActivityDetails(activityIdFromDeepLink);

        if (details) {
          const parsedActivity = {
            ...details,
            dateRange: details.dateRange ? {
              start: new Date(details.dateRange.start),
              end: new Date(details.dateRange.end),
            } : null,
            scrapedAt: new Date(details.scrapedAt || details.updatedAt),
          };
          setFreshActivity(parsedActivity);
        } else {
          setDeepLinkError('Activity not found');
        }
      } catch (error) {
        console.error('[ActivityDetail] Error fetching activity from deep link:', error);
        setDeepLinkError('Unable to load activity');
      } finally {
        setLoadingFromDeepLink(false);
        setFetchingDetails(false);
      }
    };

    fetchActivityFromDeepLink();
  }, [activityIdFromDeepLink, serializedActivity]);

  // Show loading state for deep links
  if (loadingFromDeepLink) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Loading activity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error for deep link failures
  if (deepLinkError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={ModernColors.text} />
          </TouchableOpacity>
          <Icon name="alert-circle-outline" size={64} color={ModernColors.textMuted} style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>{deepLinkError}</Text>
          <Text style={styles.errorSubtext}>This activity may have been removed or is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!serializedActivity && !freshActivity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={ModernColors.text} />
          </TouchableOpacity>
          <Text style={styles.errorText}>No activity data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  let activity: Activity = freshActivity || serializedActivity;

  useEffect(() => {
    const fetchFreshDetails = async () => {
      if (!serializedActivity?.id) return;

      try {
        setFetchingDetails(true);
        const details = await activityService.getActivityDetails(serializedActivity.id);

        if (details) {
          console.log('[ActivityDetail] Location data:', {
            locationName: details.locationName,
            fullAddress: details.fullAddress,
            latitude: details.latitude,
            longitude: details.longitude,
            location: details.location
          });
          const parsedActivity = {
            ...details,
            dateRange: details.dateRange ? {
              start: new Date(details.dateRange.start),
              end: new Date(details.dateRange.end),
            } : null,
            scrapedAt: new Date(details.scrapedAt || details.updatedAt),
          };
          setFreshActivity(parsedActivity);
        }
      } catch (error) {
        console.error('Error fetching fresh activity details:', error);
      } finally {
        setFetchingDetails(false);
      }
    };

    fetchFreshDetails();
  }, [serializedActivity?.id]);

  useEffect(() => {
    setIsFavorite(favoritesService.isFavorite(activity.id));
    setIsOnWaitlist(waitlistService.isOnWaitlist(activity.id));
    dispatch(fetchActivityChildren(activity.id));

    // Check if activity is assigned to any child
    const checkAssignment = async () => {
      if (!user) return;
      try {
        const isAssigned = await childrenService.isActivityAssignedToAnyChild(activity.id);
        setIsAssignedToCalendar(isAssigned);
      } catch (error) {
        console.error('Error checking activity assignment:', error);
      }
    };
    checkAssignment();
  }, [activity.id, dispatch, user]);

  useEffect(() => {
    const geocodeIfNeeded = async () => {
      if (activity.latitude && activity.longitude) {
        return;
      }

      // Try location name first (most accurate), then full address
      const locationToGeocode = activity.locationName ||
                                (typeof activity.location === 'string' ? activity.location : activity.location?.name) ||
                                activity.fullAddress ||
                                getFullAddress(activity);

      if (!locationToGeocode) return;

      // Add "North Vancouver BC" to location name for better geocoding accuracy
      const searchAddress = locationToGeocode.includes('Vancouver') || locationToGeocode.includes('BC')
        ? locationToGeocode
        : `${locationToGeocode}, North Vancouver, BC`;

      console.log('[ActivityDetail] Geocoding:', searchAddress);

      try {
        const coords = await geocodeAddressWithCache(searchAddress);
        if (coords) {
          console.log('[ActivityDetail] Geocoded coordinates:', coords);
          setGeocodedCoords(coords);
          setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          }, 100);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    };

    geocodeIfNeeded();
  }, [activity]);

  const handleToggleFavorite = () => {
    if (!user) return;
    const newFavoriteState = !isFavorite;
    setIsFavorite(newFavoriteState);

    if (newFavoriteState) {
      favoritesService.addFavorite(activity);
      // Trigger smart paywall at 5 favorites milestone
      const newFavoriteCount = favoritesService.getFavoriteCount();
      onFavoriteAdded(newFavoriteCount);
    } else {
      favoritesService.removeFavorite(activity.id);
    }
  };

  const handleToggleWaitlist = async () => {
    if (!user) return;

    // Check subscription limit when trying to add
    if (!isOnWaitlist && !canAddToWaitlist) {
      onWaitlistLimitReached();
      return;
    }

    const newWaitlistState = !isOnWaitlist;
    setIsOnWaitlist(newWaitlistState); // Optimistic update

    const result = await waitlistService.toggleWaitlist(activity);
    if (!result.success) {
      // Revert on failure
      setIsOnWaitlist(!newWaitlistState);
      Alert.alert('Error', result.message || 'Failed to update waitlist');
    } else {
      // Sync count after successful change
      syncWaitlistCount();
    }
  };

  const handleRegister = () => {
    const url = activity.directRegistrationUrl || activity.registrationUrl;
    if (url) {
      Linking.openURL(url).catch(err => {
        Alert.alert('Error', 'Failed to open registration link');
      });
    } else {
      Alert.alert('Registration', 'Registration URL not available');
    }
  };

  const handleGetDirections = () => {
    if (activity.latitude || geocodedCoords) {
      const lat = activity.latitude || geocodedCoords?.latitude;
      const lng = activity.longitude || geocodedCoords?.longitude;
      const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
      const latLng = `${lat},${lng}`;
      const label = activity.locationName || activity.name;
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
      });
      if (url) Linking.openURL(url);
    } else {
      const address = getFullAddress(activity);
      const encodedAddress = encodeURIComponent(address);
      const url = Platform.select({
        ios: `maps:0,0?q=${encodedAddress}`,
        android: `geo:0,0?q=${encodedAddress}`
      });
      if (url) Linking.openURL(url);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateRange = (startDate: Date, endDate: Date): string => {
    // Check if dates are the same (single-day activity)
    const isSameDay = startDate.getFullYear() === endDate.getFullYear() &&
                      startDate.getMonth() === endDate.getMonth() &&
                      startDate.getDate() === endDate.getDate();

    if (isSameDay) {
      return formatDate(startDate);
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getDayOfWeek = () => {
    // First check if schedule field contains day information
    if (activity.schedule) {
      const scheduleStr = typeof activity.schedule === 'string' ? activity.schedule : '';
      const schedule = scheduleStr.toLowerCase();
      const dayPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/gi;
      const matches = schedule.match(dayPattern);

      if (matches && matches.length > 0) {
        // Remove duplicates and convert to full day names
        const uniqueDays = [...new Set(matches.map((day: string) => {
          const dayLower = day.toLowerCase();
          // Map abbreviations to full names
          const dayMap: {[key: string]: string} = {
            'mon': 'Monday',
            'tue': 'Tuesday',
            'wed': 'Wednesday',
            'thu': 'Thursday',
            'fri': 'Friday',
            'sat': 'Saturday',
            'sun': 'Sunday'
          };

          // Check if it's an abbreviation
          if (dayMap[dayLower]) {
            return dayMap[dayLower];
          }

          // Capitalize full day name
          return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
        }))];

        return uniqueDays.join(', ');
      }
    }

    // Fallback to date range if available
    if (activity.dateRange?.start) {
      return activity.dateRange.start.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Fallback to dates field
    if (activity.dates) {
      const dateMatch = activity.dates.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[0]);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
        }
      }
    }

    return null;
  };

  const getAgeRange = (): string | null => {
    // First check if we have proper ageRange data from API
    if (activity.ageRange &&
        activity.ageRange.min !== undefined && activity.ageRange.min !== null &&
        activity.ageRange.max !== undefined && activity.ageRange.max !== null) {
      // Check for "All Ages" pattern (0-99 or similar wide range)
      if (activity.ageRange.min === 0 && activity.ageRange.max >= 99) {
        return 'All Ages';
      }
      // Validate it's not the default 0-18 fallback when there's specific age info in the name
      if (activity.ageRange.min === 0 && activity.ageRange.max === 18) {
        // Try to parse from name/description first
        const parsedAge = parseAgeFromText();
        if (parsedAge) {
          return parsedAge;
        }
      }
      // If min equals max, show single age
      if (activity.ageRange.min === activity.ageRange.max) {
        return `${activity.ageRange.min} yrs`;
      }
      // High max age (99, 100, etc.) - show "X+" format
      if (activity.ageRange.max >= 90) {
        return `${activity.ageRange.min}+ yrs`;
      }
      return `${activity.ageRange.min}-${activity.ageRange.max} yrs`;
    }

    // Fallback: try to parse from name or description
    const parsedAge = parseAgeFromText();
    if (parsedAge) {
      return parsedAge;
    }

    // Return null if no valid age data found
    return null;
  };

  const parseAgeFromText = (): string | null => {
    const text = `${activity.name} ${activity.description || ''} ${activity.category || ''}`.toLowerCase();

    // Helper to convert years and months to decimal years, then round
    const parseAgeWithMonths = (years: number, months: number) => {
      return Math.round(years + (months / 12));
    };

    // Pattern: "1m to 5 y 12m" - complex format with years and months
    const complexRangeMatch = text.match(/(\d+)\s*m?\s*(?:to|through|-)\s*(\d+)\s*y\s*(\d+)?\s*m?/i);
    if (complexRangeMatch) {
      const firstNum = parseInt(complexRangeMatch[1]);
      const minAge = text.match(/(\d+)\s*m\s*(?:to|through|-)/i)
        ? parseAgeWithMonths(0, firstNum)  // First is months only
        : firstNum;  // First is years

      const maxYears = parseInt(complexRangeMatch[2]);
      const maxMonths = complexRangeMatch[3] ? parseInt(complexRangeMatch[3]) : 0;
      const maxAge = parseAgeWithMonths(maxYears, maxMonths);

      return `${minAge}-${maxAge} yrs`;
    }

    // Pattern: "1-5yrs", "1-5 yrs", "1-5 years"
    const rangePattern = /(\d+)\s*-\s*(\d+)\s*(yrs?|years?)/i;
    const rangeMatch = text.match(rangePattern);
    if (rangeMatch) {
      return `${rangeMatch[1]}-${rangeMatch[2]} yrs`;
    }

    // Pattern: "ages 1-5", "for 1-5"
    const agesPattern = /(ages?|for)\s+(\d+)\s*-\s*(\d+)/i;
    const agesMatch = text.match(agesPattern);
    if (agesMatch) {
      return `${agesMatch[2]}-${agesMatch[3]} yrs`;
    }

    // Pattern: "toddler" (1-3), "preschool" (3-5), "youth" (6-12), "teen" (13-18)
    if (text.includes('toddler')) return '1-3 yrs';
    if (text.includes('preschool')) return '3-5 yrs';
    if (text.includes('youth') || text.includes('elementary')) return '6-12 yrs';
    if (text.includes('teen')) return '13-18 yrs';

    return null;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return '#22C55E';
      case 'waitlist':
        return '#F59E0B';
      case 'closed':
        return '#EF4444';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'check-circle';
      case 'waitlist':
        return 'clock-outline';
      case 'closed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const mapLat = activity.latitude || geocodedCoords?.latitude || 49.3217;
  const mapLng = activity.longitude || geocodedCoords?.longitude || -123.0724;

  if (fetchingDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Loading activity details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero Section with Image */}
        <ImageBackground
          source={getActivityImageByKey(
            getActivityImageKey(
              activity.category || '',
              activity.subcategory,
              activity.name
            ),
            // Pass activity type for fallback
            Array.isArray(activity.activityType)
              ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
              : (activity.activityType as any)?.name
          ) || require('../../assets/images/activities/multi_sport/sports_general.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
            style={styles.heroGradient}
          >
            {/* Header Buttons */}
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
                <Icon name="arrow-left" size={22} color="#000" />
              </TouchableOpacity>
              <View style={styles.headerButtonsRight}>
                {isAssignedToCalendar && (
                  <View style={styles.headerCalendarBadge}>
                    <Icon name="calendar-check" size={22} color="#FFF" />
                  </View>
                )}
                <TouchableOpacity style={styles.headerButton} onPress={handleToggleWaitlist}>
                  <Icon name={isOnWaitlist ? 'bell-ring' : 'bell-outline'} size={22} color={isOnWaitlist ? '#FFB800' : '#000'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton} onPress={handleToggleFavorite}>
                  <Icon name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? '#E8638B' : '#000'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Title Overlay */}
            <View style={styles.heroContent}>
              <Text style={styles.categoryBadge}>{activity.category?.toUpperCase() || 'ACTIVITY'} • {activity.subcategory || 'GENERAL'}</Text>
              <Text style={styles.activityTitle}>{cleanActivityName(activity.name)}</Text>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Primary Action Buttons */}
          <View style={styles.actionSection}>
            {/* Register Button with overlapping icon on right */}
            <View style={styles.featuredButtonWrapper}>
              <TouchableOpacity
                style={styles.featuredButton}
                onPress={handleRegister}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFB5C5', '#E8638B', '#D53F8C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.featuredButtonGradient}
                >
                  <View style={styles.featuredButtonContent}>
                    <Text style={styles.featuredButtonTitle}>Register Now</Text>
                    <Text style={styles.featuredButtonSubtitle}>Sign up for this activity</Text>
                  </View>
                  <Icon name="chevron-right" size={22} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
              {/* Overlapping icon on right */}
              <View style={styles.registerIconOverlay}>
                <Icon name="party-popper" size={36} color="#FFFFFF" />
              </View>
            </View>

            {/* Watch for Spots Button - only shown for Waitlist status activities */}
            {activity.registrationStatus === 'Waitlist' && (
              <View style={styles.watchSpotsButtonWrapper}>
                <TouchableOpacity
                  style={[
                    styles.watchSpotsButton,
                    isOnWaitlist && styles.watchSpotsButtonActive,
                  ]}
                  onPress={handleToggleWaitlist}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isOnWaitlist ? ['#22C55E', '#16A34A'] : ['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.watchSpotsButtonGradient}
                  >
                    <View style={styles.watchSpotsIconContainer}>
                      <Icon
                        name={isOnWaitlist ? 'bell-ring' : 'bell-plus'}
                        size={28}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={styles.watchSpotsButtonContent}>
                      <Text style={styles.watchSpotsButtonTitle}>
                        {isOnWaitlist ? 'Watching for Spots' : 'Watch for Spots'}
                      </Text>
                      <Text style={styles.watchSpotsButtonSubtitle}>
                        {isOnWaitlist
                          ? "We'll notify you when spots open"
                          : 'Get notified when spots open up'}
                      </Text>
                    </View>
                    {isOnWaitlist ? (
                      <Icon name="check-circle" size={22} color="#FFFFFF" />
                    ) : (
                      <Icon name="chevron-right" size={22} color="#FFFFFF" />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* Calendar Button with overlapping icon on left */}
            <View style={styles.calendarButtonWrapper}>
              {/* Overlapping calendar icon on left */}
              <View style={styles.calendarIconOverlay}>
                <Icon name="calendar-check" size={32} color="#FFFFFF" />
              </View>
              <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => setShowChildAssignModal(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFB5C5', '#E8638B', '#D53F8C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.calendarButtonGradient}
                >
                  <View style={styles.calendarButtonContent}>
                    <Text style={styles.featuredButtonTitle}>Add to Calendar</Text>
                    <Text style={styles.featuredButtonSubtitle}>Schedule for your child</Text>
                  </View>
                  <Icon name="chevron-right" size={22} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Secondary Action Buttons Row */}
            <View style={styles.secondaryButtonsRow}>
              {/* Share Button - General sharing via social, messaging, etc. */}
              <View style={styles.miniButtonWrapper}>
                <View style={styles.miniIconOverlayLeft}>
                  <Icon name="share-variant" size={18} color="#E8638B" />
                </View>
                <TouchableOpacity
                  style={styles.miniButton}
                  onPress={() => shareActivity({ activity })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.miniButtonTitle}>Share</Text>
                  <Text style={styles.miniButtonSubtitle}>Social & More</Text>
                </TouchableOpacity>
              </View>

              {/* Notify Button with icon overlay */}
              <View style={styles.miniButtonWrapper}>
                <View style={[styles.miniIconOverlayLeft, isOnWaitlist && styles.miniIconActive]}>
                  <Icon
                    name={isOnWaitlist ? 'bell-ring' : 'bell-outline'}
                    size={18}
                    color={isOnWaitlist ? '#FFB800' : '#E8638B'}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.miniButton, isOnWaitlist && styles.miniButtonActive]}
                  onPress={handleToggleWaitlist}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.miniButtonTitle, isOnWaitlist && styles.miniButtonTitleActive]}>
                    {isOnWaitlist ? 'Watching' : 'Notify'}
                  </Text>
                  <Text style={[styles.miniButtonSubtitle, isOnWaitlist && styles.miniButtonSubtitleActive]}>
                    {isOnWaitlist ? 'On List' : 'When Available'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Registration Status */}
          <View style={styles.statusCard}>
            <View style={styles.statusIndicator}>
              <Icon
                name={getStatusIcon(activity.registrationStatus || 'Open')}
                size={20}
                color={getStatusColor(activity.registrationStatus || 'Open')}
              />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Registration Status</Text>
                <Text style={styles.statusValue}>{activity.registrationStatus || 'Open'}</Text>
              </View>
            </View>
          </View>

          {/* Key Details Grid */}
          <View style={styles.detailsGrid}>
            {/* Full Width Dates Row */}
            <View style={styles.detailRowFull}>
              <View style={styles.detailItemFull}>
                <Icon name="calendar" size={20} color={ModernColors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Dates</Text>
                  <Text style={styles.detailValue}>
                    {activity.dates || (activity.dateRange ?
                      formatDateRange(activity.dateRange.start, activity.dateRange.end) :
                      'Date TBD')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Day of Week and Duration Row */}
            <View style={styles.detailRow}>
              {getDayOfWeek() && (
                <View style={styles.detailItem}>
                  <Icon name="calendar-today" size={20} color={ModernColors.primary} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Day of Week</Text>
                    <Text style={styles.detailValue}>{getDayOfWeek()}</Text>
                  </View>
                </View>
              )}

              <View style={styles.detailItem}>
                <Icon name="clock-outline" size={20} color={ModernColors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>
                    {activity.startTime && activity.endTime ?
                      `${activity.startTime} - ${activity.endTime}` :
                      '09:30 am - 12:00 pm'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Ages and Cost Row */}
            <View style={styles.detailRow}>
              {getAgeRange() && (
                <View style={styles.detailItem}>
                  <Icon name="account-child" size={20} color={ModernColors.primary} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Ages</Text>
                    <Text style={styles.detailValue}>
                      {getAgeRange()}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.detailItem}>
                <Icon name="cash" size={20} color={ModernColors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Cost</Text>
                  <Text style={styles.detailValue}>
                    {formatActivityPrice(activity.cost)}
                    {activity.cost !== null && activity.cost !== undefined && activity.cost > 0 && activity.costIncludesTax === false && ' + tax'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailRow}>
              {(activity.spotsAvailable !== null && activity.spotsAvailable !== undefined) && (
                <View style={styles.detailItem}>
                  <Icon name="account-group" size={20} color={ModernColors.primary} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Available Spots</Text>
                    <Text style={styles.detailValue}>
                      {activity.spotsAvailable}
                      {activity.totalSpots ? `/${activity.totalSpots}` : ''}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.detailItem}>
                <Icon name="account" size={20} color={ModernColors.primary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Instructor</Text>
                  <Text style={styles.detailValue}>{activity.instructor || 'TBD'}</Text>
                </View>
              </View>
            </View>

            {/* Course ID Row */}
            {activity.courseId && (
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Icon name="identifier" size={20} color={ModernColors.primary} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Course ID</Text>
                    <Text style={styles.detailValue}>{activity.courseId}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Provider Row */}
            {activity.provider && (
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Icon name="domain" size={20} color={ModernColors.primary} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Provided By</Text>
                    <Text style={styles.detailValue}>{typeof activity.provider === 'string' ? activity.provider : (activity.provider as any)?.name || ''}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {(activity.fullDescription || activity.description) && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>About this Activity</Text>
              <Text style={styles.descriptionText}>
                {activity.fullDescription || activity.description}
              </Text>
            </View>
          )}

          {/* AI Explanation - Why this is great for your children */}
          <View style={styles.sectionCard}>
            <ActivityExplanation
              activityId={activity.id}
              compact={false}
              autoExpand={false}
            />
          </View>

          {/* Sessions */}
          {activity.sessions && activity.sessions.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {activity.sessions.length === 1 ? 'Session Details' : `Sessions (${activity.sessions.length})`}
              </Text>
              {activity.sessions.map((session, index) => (
                <View key={index} style={[styles.sessionItem, index > 0 && styles.sessionBorder]}>
                  <View style={styles.sessionHeader}>
                    <Icon name="calendar-clock" size={18} color={ModernColors.primary} />
                    <Text style={styles.sessionNumber}>
                      {activity.sessions!.length > 1 ? `Session ${session.sessionNumber || index + 1}` : 'Date & Time'}
                    </Text>
                  </View>
                  {(session.date || session.dayOfWeek) && (
                    <Text style={styles.sessionDate}>
                      {session.dayOfWeek ? `${session.dayOfWeek}${session.date ? ', ' : ''}` : ''}{session.date || ''}
                    </Text>
                  )}
                  {(session.startTime || session.endTime) && (
                    <Text style={styles.sessionTime}>
                      {session.startTime}{session.endTime && ` - ${session.endTime}`}
                    </Text>
                  )}
                  {session.location && (
                    <View style={styles.sessionLocation}>
                      <Icon name="map-marker" size={14} color={ModernColors.textSecondary} />
                      <Text style={styles.sessionLocationText}>
                        {session.location}
                        {session.subLocation && ` - ${session.subLocation}`}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Requirements */}
          {(activity.prerequisites || activity.whatToBring || activity.requiredExtras) && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Requirements & Information</Text>

              {activity.prerequisites && (
                <View style={styles.requirementSection}>
                  <Text style={styles.requirementTitle}>Prerequisites</Text>
                  <Text style={styles.requirementText}>
                    {typeof activity.prerequisites === 'string' ?
                      activity.prerequisites :
                      activity.prerequisites.map((p: any) => typeof p === 'string' ? p : p.name).join(', ')}
                  </Text>
                </View>
              )}

              {activity.whatToBring && (
                <View style={styles.requirementSection}>
                  <Text style={styles.requirementTitle}>What to Bring</Text>
                  <Text style={styles.requirementText}>{activity.whatToBring}</Text>
                </View>
              )}

              {activity.requiredExtras && activity.requiredExtras.length > 0 && (
                <View style={styles.requirementSection}>
                  <Text style={styles.requirementTitle}>Required Extras</Text>
                  {activity.requiredExtras.map((extra: any, index: number) => (
                    <View key={index} style={styles.extraItem}>
                      <Text style={styles.extraName}>{typeof extra === 'string' ? extra : extra.name}</Text>
                      <Text style={styles.extraCost}>{typeof extra === 'string' ? '' : extra.cost}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Location & Map */}
          {getFullAddress(activity) && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Location</Text>

              <View style={styles.locationInfo}>
                <Icon name="map-marker" size={20} color={ModernColors.primary} />
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationName}>
                    {activity.locationName || activity.facility || 'Activity Location'}
                  </Text>
                  <Text style={styles.locationAddress}>
                    {getFullAddress(activity)}
                  </Text>
                </View>
              </View>

              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={{
                    latitude: mapLat,
                    longitude: mapLng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                >
                  <Marker
                    coordinate={{
                      latitude: mapLat,
                      longitude: mapLng,
                    }}
                    title={cleanActivityName(activity.name)}
                    description={getFullAddress(activity)}
                  />
                </MapView>

                <TouchableOpacity style={styles.directionsButton} onPress={handleGetDirections}>
                  <Icon name="directions" size={18} color="#FFFFFF" />
                  <Text style={styles.directionsText}>Get Directions</Text>
                </TouchableOpacity>
              </View>

              {activity.contactInfo && (
                <View style={styles.contactInfo}>
                  <Icon name="phone" size={16} color={ModernColors.textSecondary} />
                  <Text style={styles.contactText}>{activity.contactInfo}</Text>
                </View>
              )}
            </View>
          )}

          {/* Additional Actions */}
          <View style={styles.additionalActions}>
            {activity.detailUrl && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => activity.detailUrl && Linking.openURL(activity.detailUrl)}
              >
                <Icon name="web" size={18} color={ModernColors.primary} />
                <Text style={styles.linkButtonText}>View on Website</Text>
              </TouchableOpacity>
            )}

          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      {showRegisterModal && (
        <RegisterChildModal
          activityId={activity.id}
          activityName={cleanActivityName(activity.name)}
          visible={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
        />
      )}
      {showChildAssignModal && (
        <AssignActivityToChildModal
          activity={activity}
          visible={showChildAssignModal}
          onClose={async () => {
            setShowChildAssignModal(false);
            // Refresh assignment status
            try {
              const isAssigned = await childrenService.isActivityAssignedToAnyChild(activity.id);
              setIsAssignedToCalendar(isAssigned);
            } catch (error) {
              console.error('Error checking activity assignment:', error);
            }
          }}
        />
      )}

      {/* Upgrade Modal for notifications (premium feature) */}
      <UpgradePromptModal
        visible={showWaitlistUpgradeModal}
        feature="notifications"
        onClose={hideWaitlistUpgradeModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: ModernSpacing.md,
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ModernSpacing.xl,
  },
  errorText: {
    fontSize: ModernTypography.sizes.lg,
    color: ModernColors.text,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textMuted,
    textAlign: 'center',
    marginTop: ModernSpacing.sm,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: ModernSpacing.lg,
    zIndex: 10,
  },
  heroImage: {
    width: '100%',
    height: height * 0.216,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: ModernSpacing.lg,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'ios' ? 10 : 20,
  },
  headerButtonsRight: {
    flexDirection: 'row',
    gap: ModernSpacing.xs,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...ModernShadows.sm,
  },
  headerCalendarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ModernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...ModernShadows.sm,
  },
  heroContent: {
    marginBottom: ModernSpacing.lg,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    marginBottom: ModernSpacing.xs,
  },
  activityTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: ModernSpacing.xs,
  },
  activitySubtitle: {
    fontSize: ModernTypography.sizes.lg,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 4,
  },
  activityLocation: {
    fontSize: ModernTypography.sizes.base,
    color: 'rgba(255,255,255,0.9)',
  },
  mainContent: {
    padding: ModernSpacing.lg,
    marginTop: ModernSpacing.sm,
  },
  actionSection: {
    marginBottom: ModernSpacing.lg,
  },
  // Featured button styles (Register)
  featuredButtonWrapper: {
    position: 'relative',
    marginBottom: ModernSpacing.lg,
    marginRight: 25, // Space for icon overflow
  },
  featuredButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  featuredButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 50,
    minHeight: 72,
  },
  featuredButtonContent: {
    flex: 1,
  },
  featuredButtonTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  featuredButtonSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
  registerIconOverlay: {
    position: 'absolute',
    right: -10,
    top: '50%',
    transform: [{ translateY: -28 }],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D53F8C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D53F8C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  registerRobotOverlay: {
    position: 'absolute',
    right: -15,
    top: -20,
    width: 70,
    height: 70,
    resizeMode: 'contain',
  },
  // Calendar button styles
  calendarButtonWrapper: {
    position: 'relative',
    marginBottom: ModernSpacing.lg,
    marginLeft: 25, // Space for icon overflow on left
  },
  calendarButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  calendarButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingLeft: 50,
    paddingRight: 16,
    minHeight: 72,
  },
  calendarButtonContent: {
    flex: 1,
  },
  calendarIconOverlay: {
    position: 'absolute',
    left: -10,
    top: '50%',
    transform: [{ translateY: -26 }],
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D53F8C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#D53F8C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  // Watch for Spots button styles (for Waitlist activities)
  watchSpotsButtonWrapper: {
    marginBottom: ModernSpacing.lg,
  },
  watchSpotsButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  watchSpotsButtonActive: {
    shadowColor: '#22C55E',
  },
  watchSpotsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 72,
  },
  watchSpotsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  watchSpotsButtonContent: {
    flex: 1,
  },
  watchSpotsButtonTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  watchSpotsButtonSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
  // Mini buttons row (Share & Notify)
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: ModernSpacing.md,
  },
  miniButtonWrapper: {
    flex: 1,
    position: 'relative',
    paddingLeft: 18,
  },
  miniButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 28,
    paddingRight: 12,
    borderWidth: 1.5,
    borderColor: '#E8638B',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  miniButtonActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FFB800',
  },
  miniButtonTitle: {
    color: '#E8638B',
    fontSize: 14,
    fontWeight: '700',
  },
  miniButtonTitleActive: {
    color: '#B45309',
  },
  miniButtonSubtitle: {
    color: '#D53F8C',
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.8,
  },
  miniButtonSubtitleActive: {
    color: '#D97706',
  },
  miniIconOverlayLeft: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: [{ translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8638B',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  miniIconActive: {
    borderColor: '#FFB800',
    backgroundColor: '#FFFBEB',
  },
  primaryButton: {
    backgroundColor: ModernColors.primary,
    borderRadius: ModernBorderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: ModernSpacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ModernSpacing.md,
    ...ModernShadows.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    marginRight: ModernSpacing.sm,
  },
  secondaryButton: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1.5,
    borderColor: ModernColors.border,
    paddingVertical: 16,
    paddingHorizontal: ModernSpacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: ModernColors.primary,
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    marginLeft: ModernSpacing.sm,
  },
  statusCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    padding: ModernSpacing.lg,
    marginBottom: ModernSpacing.lg,
    ...ModernShadows.sm,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    marginLeft: ModernSpacing.md,
  },
  statusLabel: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginBottom: 2,
  },
  statusValue: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.text,
  },
  detailsGrid: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    padding: ModernSpacing.lg,
    marginBottom: ModernSpacing.lg,
    ...ModernShadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: ModernSpacing.lg,
  },
  detailRowFull: {
    flexDirection: 'row',
    marginBottom: ModernSpacing.lg,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailItemFull: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  detailContent: {
    marginLeft: ModernSpacing.sm,
    flex: 1,
  },
  detailLabel: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '500',
    color: ModernColors.text,
  },
  actionButtonsContainer: {
    marginBottom: ModernSpacing.xl,
  },
  addToCalendarButton: {
    backgroundColor: ModernColors.primary,
    borderRadius: ModernBorderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: ModernSpacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: ModernSpacing.sm,
    ...ModernShadows.md,
  },
  addToCalendarButtonText: {
    color: '#FFFFFF',
    fontSize: ModernTypography.sizes.lg,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    padding: ModernSpacing.lg,
    marginBottom: ModernSpacing.lg,
    ...ModernShadows.sm,
  },
  sectionTitle: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: ModernSpacing.md,
  },
  descriptionText: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    lineHeight: 22,
  },
  sessionItem: {
    paddingVertical: ModernSpacing.md,
  },
  sessionBorder: {
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ModernSpacing.sm,
  },
  sessionNumber: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.text,
    marginLeft: ModernSpacing.sm,
  },
  sessionDate: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginBottom: 4,
  },
  sessionLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sessionLocationText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginLeft: 4,
  },
  requirementSection: {
    marginBottom: ModernSpacing.md,
  },
  requirementTitle: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: ModernSpacing.xs,
  },
  requirementText: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.textSecondary,
    lineHeight: 20,
  },
  extraItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ModernSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  extraName: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
  },
  extraCost: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.primary,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: ModernSpacing.md,
  },
  locationTextContainer: {
    marginLeft: ModernSpacing.sm,
    flex: 1,
  },
  locationName: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
  mapContainer: {
    borderRadius: ModernBorderRadius.md,
    overflow: 'hidden',
    marginTop: ModernSpacing.md,
  },
  map: {
    width: '100%',
    height: 200,
  },
  directionsButton: {
    position: 'absolute',
    bottom: ModernSpacing.md,
    right: ModernSpacing.md,
    backgroundColor: ModernColors.primary,
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...ModernShadows.md,
  },
  directionsText: {
    color: '#FFFFFF',
    fontSize: ModernTypography.sizes.sm,
    fontWeight: '600',
    marginLeft: 4,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: ModernSpacing.md,
    paddingTop: ModernSpacing.md,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  contactText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.text,
    marginLeft: ModernSpacing.sm,
  },
  additionalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: ModernSpacing.lg,
    paddingBottom: ModernSpacing.xl,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ModernSpacing.sm,
  },
  linkButtonText: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.primary,
    fontWeight: '500',
    marginLeft: ModernSpacing.sm,
  },
  waitlistActiveButton: {
    backgroundColor: '#FFB800' + '20',
    borderColor: '#FFB800',
    marginTop: ModernSpacing.sm,
  },
  waitlistActiveButtonText: {
    color: '#B38600',
  },
  waitlistPromptButton: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
    marginTop: ModernSpacing.sm,
  },
  waitlistPromptButtonText: {
    color: '#FFFFFF',
  },
});

export default ActivityDetailScreenModern;