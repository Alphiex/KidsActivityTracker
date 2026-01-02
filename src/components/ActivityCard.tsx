import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Activity } from '../types';
import { useAppSelector } from '../store';
import { selectActivityChildren } from '../store/slices/childActivitiesSlice';
import FavoritesService from '../services/favoritesService';
import WaitlistService from '../services/waitlistService';
import { fixDayAbbreviations } from '../utils/dayAbbreviations';
import { Colors, Theme } from '../theme';
import { getActivityImageByKey } from '../assets/images';
import { useTheme } from '../contexts/ThemeContext';
import ChildActivityStatus from './activities/ChildActivityStatus';
import { formatActivityPrice } from '../utils/formatters';
import { getActivityImageKey } from '../utils/activityHelpers';
import { OptimizedActivityImage } from './OptimizedActivityImage';
import { consolidateActivityTypes } from '../utils/activityTypeConsolidation';
import { safeFirst, safeSubstring, safeParseDate } from '../utils/safeAccessors';
import AddToCalendarModal from './AddToCalendarModal';

const { width } = Dimensions.get('window');

interface ActivityCardProps {
  activity: Activity;
  onPress?: () => void;
  // Optional external favorite control (when provided, overrides internal state)
  isFavorite?: boolean;
  onFavoritePress?: () => void;
  // Variant support for different card styles
  variant?: 'default' | 'compact';
  // Subscription limit checking for favorites
  canAddFavorite?: boolean;
  onFavoriteLimitReached?: () => void;
  // Custom container style for grid layouts
  containerStyle?: any;
  // Custom image height (default: 200)
  imageHeight?: number;
  // Waitlist support
  isOnWaitlist?: boolean;
  onWaitlistPress?: () => void;
  canAddToWaitlist?: boolean;
  onWaitlistLimitReached?: () => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onPress,
  isFavorite: externalIsFavorite,
  onFavoritePress,
  variant = 'default',
  canAddFavorite = true,
  onFavoriteLimitReached,
  containerStyle,
  imageHeight = 200,
  isOnWaitlist: externalIsOnWaitlist,
  onWaitlistPress,
  canAddToWaitlist = true,
  onWaitlistLimitReached,
}) => {
  const favoritesService = FavoritesService.getInstance();
  const waitlistService = WaitlistService.getInstance();

  // Use external state if provided, otherwise manage internally
  const isExternallyControlled = externalIsFavorite !== undefined;
  const [internalIsFavorite, setInternalIsFavorite] = useState(false);
  const isFavorite = isExternallyControlled ? externalIsFavorite : internalIsFavorite;

  // Waitlist state - same pattern as favorites
  const isWaitlistExternallyControlled = externalIsOnWaitlist !== undefined;
  const [internalIsOnWaitlist, setInternalIsOnWaitlist] = useState(false);
  const isOnWaitlist = isWaitlistExternallyControlled ? externalIsOnWaitlist : internalIsOnWaitlist;

  const [hasCapacityAlert, setHasCapacityAlert] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const { colors, isDark } = useTheme();
  const registeredChildIds = useAppSelector(selectActivityChildren(activity.id));

  // Check if activity is on any child's calendar
  const isOnCalendar = registeredChildIds.length > 0;

  useEffect(() => {
    // Only set internal state if not externally controlled
    if (!isExternallyControlled) {
      setInternalIsFavorite(favoritesService.isFavorite(activity.id));
    }
    // Set waitlist state if not externally controlled
    if (!isWaitlistExternallyControlled) {
      setInternalIsOnWaitlist(waitlistService.isOnWaitlist(activity.id));
    }
    const alerts = favoritesService.getCapacityAlertsForActivity(activity.id);
    setHasCapacityAlert(alerts.length > 0);
  }, [activity.id, isExternallyControlled, isWaitlistExternallyControlled]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = (start: Date | string | undefined | null, end: Date | string | undefined | null) => {
    const startDate = safeParseDate(start);
    const endDate = safeParseDate(end);

    // Return fallback if dates are invalid
    if (!startDate || !endDate) {
      if (startDate) return `Starts ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      if (endDate) return `Ends ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return 'Date TBD';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for date comparison

    // Format full date with year if different from current year
    const formatFullDate = (date: Date) => {
      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      };
      return date.toLocaleDateString('en-US', options);
    };

    const baseRange = `${formatFullDate(startDate)} - ${formatFullDate(endDate)}`;

    // Check if activity has already started
    if (startDate <= today && endDate >= today) {
      return `In Progress • ${baseRange}`;
    }

    // Check if it starts soon (within 7 days)
    const daysUntilStart = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilStart >= 0 && daysUntilStart <= 7) {
      const startText = daysUntilStart === 0 ? 'Starts Today' :
                       daysUntilStart === 1 ? 'Starts Tomorrow' :
                       `Starts in ${daysUntilStart} days`;
      return `${startText} • ${baseRange}`;
    }

    return baseRange;
  };

  const formatSchedule = (schedule: typeof activity.schedule) => {
    if (!schedule) return null;
    
    if (typeof schedule === 'string') {
      // Use our global utility to fix ALL day abbreviations
      return fixDayAbbreviations(schedule);
    }
    
    // If schedule is an object with days and times
    if (schedule.days && schedule.days.length > 0) {
      let daysStr = '';
      
      // Check if it's weekdays
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const isWeekdays = schedule.days.length === 5 && 
        schedule.days.every(day => weekdays.includes(day));
      
      if (isWeekdays) {
        daysStr = 'Weekdays';
      } else if (schedule.days.length === 7) {
        daysStr = 'Daily';
      } else if (schedule.days.length === 2 && 
                 schedule.days.includes('Saturday') && 
                 schedule.days.includes('Sunday')) {
        daysStr = 'Weekends';
      } else {
        // Abbreviate day names for space
        const dayAbbrev: { [key: string]: string } = {
          'Monday': 'Mon',
          'Tuesday': 'Tue',
          'Wednesday': 'Wed',
          'Thursday': 'Thu',
          'Friday': 'Fri',
          'Saturday': 'Sat',
          'Sunday': 'Sun'
        };
        daysStr = schedule.days.map(day => dayAbbrev[day] || day).join(', ');
      }
      
      const timeStr = schedule.startTime && schedule.endTime 
        ? `${schedule.startTime} - ${schedule.endTime}`
        : schedule.startTime || '';
      return `${daysStr}${timeStr ? ' • ' + timeStr : ''}`;
    }
    
    return null;
  };

  // Extract days of week from sessions, schedule object, or schedule string
  const extractDaysOfWeek = (): string | null => {
    const daysSet = new Set<string>();
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Extract from sessions array
    if (activity.sessions && activity.sessions.length > 0) {
      activity.sessions.forEach(session => {
        const dayOfWeek = session?.dayOfWeek;
        if (dayOfWeek && typeof dayOfWeek === 'string') {
          const day = safeSubstring(dayOfWeek, 0, 3);
          if (day) {
            const normalized = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
            if (dayOrder.includes(normalized)) {
              daysSet.add(normalized);
            }
          }
        }
      });
    }

    // Extract from schedule object with days array
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

    if (daysSet.size === 0) return null;

    // Sort days in order
    const sortedDays = Array.from(daysSet).sort((a, b) =>
      dayOrder.indexOf(a) - dayOrder.indexOf(b)
    );

    // Check for common patterns
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const weekend = ['Sat', 'Sun'];

    if (sortedDays.length === 5 && weekdays.every(d => sortedDays.includes(d))) {
      return 'Weekdays';
    }
    if (sortedDays.length === 2 && weekend.every(d => sortedDays.includes(d))) {
      return 'Weekends';
    }
    if (sortedDays.length === 7) {
      return 'Daily';
    }

    return sortedDays.join(', ');
  };

  const getActivityIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      // Original lowercase keys
      camps: 'tent',
      sports: 'basketball',
      arts: 'palette',
      swimming: 'swim',
      education: 'school',
      general: 'star',
      
      // Consolidated activity types
      'Swimming': 'swim',
      'Music': 'music-note',
      'Sports': 'basketball',
      'Skating': 'skate',
      'Visual Arts': 'palette',
      'Dance': 'dance-ballroom',
      'Martial Arts': 'karate',
      'Camps': 'tent',
    };
    return iconMap[type] || 'star';
  };

  const getCapacityColor = (spotsLeft?: number) => {
    if (!spotsLeft) return Colors.success;
    if (spotsLeft <= 1) return '#FF5252';
    if (spotsLeft <= 3) return '#FF9800';
    return Colors.success;
  };

  const handleShare = async () => {
    try {
      const locationName = typeof activity.location === 'string'
        ? activity.location
        : activity.location?.name || activity.locationName || '';

      const message = `Check out this activity: ${activity.name}${locationName ? ` at ${locationName}` : ''}`;

      await Share.share({
        message,
        title: activity.name,
      });
    } catch (error) {
      console.error('Error sharing activity:', error);
    }
  };

  const handleWaitlistToggle = async () => {
    // If trying to add (not remove), check subscription limit
    if (!isOnWaitlist && !canAddToWaitlist) {
      if (onWaitlistLimitReached) {
        onWaitlistLimitReached();
      }
      return;
    }

    if (onWaitlistPress) {
      // Use external handler if provided
      onWaitlistPress();
    } else {
      // Optimistic update
      setInternalIsOnWaitlist(!internalIsOnWaitlist);
      // Use internal handler
      const result = await waitlistService.toggleWaitlist(activity);
      // Revert if failed
      if (!result.success) {
        setInternalIsOnWaitlist(internalIsOnWaitlist);
      }
    }
  };

  return (
    <>
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardBackground }, containerStyle]}
      onPress={() => {
        console.log('ActivityCard pressed:', activity.name);
        console.log('onPress function exists:', !!onPress);
        if (onPress) {
          onPress();
        }
      }}
      activeOpacity={0.9}
    >
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <OptimizedActivityImage
          source={getActivityImageByKey(
            getActivityImageKey(
              activity.category || (
                Array.isArray(activity.activityType)
                  ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
                  : (activity.activityType as any)?.name
              ) || '',
              activity.subcategory,
              activity.name
            ),
            // Pass activity type for fallback when specific image not found
            Array.isArray(activity.activityType)
              ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
              : (activity.activityType as any)?.name
          )}
          style={styles.image}
          resizeMode="cover"
          containerStyle={{ flex: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageGradient}
        />
        {activity.isFeatured && (
          <View style={[styles.featuredBadge, activity.featuredTier === 'gold' ? styles.featuredGold : activity.featuredTier === 'silver' ? styles.featuredSilver : styles.featuredBronze]}>
            <Icon name="star" size={12} color="#FFF" />
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}
        {isOnCalendar && !activity.isFeatured && (
          <View style={styles.calendarBadge}>
            <Icon name="calendar-check" size={12} color="#FFF" />
            <Text style={styles.calendarBadgeText}>On Calendar</Text>
          </View>
        )}
        {isOnCalendar && activity.isFeatured && (
          <View style={styles.calendarBadgeSmall}>
            <Icon name="calendar-check" size={14} color="#FFF" />
          </View>
        )}
        <View style={styles.imageOverlay}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>{formatActivityPrice(activity.cost)}</Text>
            {activity.cost !== null && activity.cost !== undefined && activity.cost > 0 && <Text style={styles.priceLabel}>per child</Text>}
          </View>
        </View>
        {/* Action buttons row - favorites, waitlist, share, calendar */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            onPress={() => {
              console.log('Toggling favorite for activity:', activity.id, activity.name);
              console.log('Current favorite status:', isFavorite);

              // If trying to add (not remove), check subscription limit
              if (!isFavorite && !canAddFavorite) {
                console.log('Favorite limit reached, showing upgrade prompt');
                if (onFavoriteLimitReached) {
                  onFavoriteLimitReached();
                }
                return;
              }

              if (onFavoritePress) {
                // Use external handler if provided
                onFavoritePress();
              } else {
                // Use internal handler
                favoritesService.toggleFavorite(activity);
                setInternalIsFavorite(!internalIsFavorite);
              }
              console.log('New favorite status:', !isFavorite);
            }}
            style={styles.actionButton}
          >
            <Icon
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? '#E8638B' : '#FFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleWaitlistToggle}>
            <Icon
              name={isOnWaitlist ? 'bell-ring' : 'bell-outline'}
              size={18}
              color={isOnWaitlist ? '#FFB800' : '#FFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Icon name="share-variant" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowCalendarModal(true)}
          >
            <Icon
              name={isOnCalendar ? 'calendar-check' : 'calendar-plus'}
              size={18}
              color={isOnCalendar ? '#4ECDC4' : '#FFF'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {activity.name}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="map-marker" size={16} color={Colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
            {typeof activity.location === 'string' 
              ? activity.location 
              : activity.location?.name || activity.locationName || 'Location TBD'}
          </Text>
        </View>

        {/* Provider Badge */}
        {activity.provider && (
          <View style={styles.providerRow}>
            <Icon name="domain" size={14} color="#6B7280" />
            <Text style={styles.providerText} numberOfLines={1}>
              {activity.provider}
            </Text>
          </View>
        )}

        {activity.dateRange && (
          <View style={[styles.infoRow, styles.dateRangeRow]}>
            <Icon name="calendar-range" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, styles.dateRangeText, { color: colors.text }]}>
              {activity.dateRange ? formatDateRange(activity.dateRange.start, activity.dateRange.end) : 'Date TBD'}
            </Text>
          </View>
        )}

        {/* Display time prominently - ALWAYS show if we have any time data */}
        {(activity.startTime || activity.endTime) && (
          <View style={[styles.infoRow, styles.timeRow]}>
            <Icon name="clock-outline" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, styles.timeText, { color: colors.text, fontWeight: '500' }]}>
              {extractDaysOfWeek() ? `${extractDaysOfWeek()} • ` : ''}
              {`${activity.startTime || ''}${activity.startTime && activity.endTime ? ' - ' : ''}${activity.endTime || ''}`}
            </Text>
          </View>
        )}

        {/* Only show days of the week separately if we don't have start/end time */}
        {extractDaysOfWeek() && !activity.startTime && !activity.endTime && (
          <View style={[styles.infoRow, styles.daysRow]}>
            <Icon name="calendar-week" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, styles.daysText, { color: Colors.primary }]}>
              {extractDaysOfWeek()}
            </Text>
          </View>
        )}

        {/* Only show sessions/schedule section if we don't already have start/end time displayed */}
        {!activity.startTime && !activity.endTime && (
          activity.sessions && activity.sessions?.length > 0 ? (
            <View style={[styles.sessionsContainer]}>
              {activity.sessions?.length === 1 ? (
                // Single session - display inline
                (() => {
                  const firstSession = safeFirst(activity.sessions);
                  return firstSession ? (
                    <View style={[styles.infoRow, styles.scheduleRow]}>
                      <Icon name="clock-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.infoText, styles.scheduleText, { color: colors.text }]} numberOfLines={2}>
                        {firstSession.date && `${firstSession.date} • `}
                        {firstSession.startTime && firstSession.endTime
                          ? `${firstSession.startTime} - ${firstSession.endTime}`
                          : firstSession.startTime || ''}
                      </Text>
                    </View>
                  ) : null;
                })()
              ) : (
                // Multiple sessions
                <View style={styles.multipleSessionsContainer}>
                  <View style={styles.sessionHeader}>
                    <Icon name="calendar-multiple" size={16} color={Colors.primary} />
                    <Text style={[styles.sessionHeaderText, { color: colors.text }]}>
                      {activity.sessions?.length || 0} Sessions Available
                    </Text>
                  </View>
                  {activity.sessions?.slice(0, 2).map((session, index) => (
                    <View key={index} style={styles.sessionItem}>
                      <Text style={[styles.sessionText, { color: colors.textSecondary }]}>
                        {session?.date && `${session.date}`}
                        {session?.startTime && ` • ${session.startTime}`}
                        {session?.endTime && ` - ${session.endTime}`}
                      </Text>
                    </View>
                  ))}
                  {(activity.sessions?.length || 0) > 2 && (
                    <Text style={[styles.moreSessionsText, { color: Colors.primary }]}>
                      +{(activity.sessions?.length || 0) - 2} more sessions
                    </Text>
                  )}
                </View>
              )}
            </View>
          ) : activity.schedule && formatSchedule(activity.schedule) ? (
            // Fallback to old schedule format if no sessions
            <View style={[styles.infoRow, styles.scheduleRow]}>
              <Icon name="clock-outline" size={16} color={Colors.primary} />
              <Text style={[styles.infoText, styles.scheduleText, { color: colors.text }]} numberOfLines={2}>
                {formatSchedule(activity.schedule)}
              </Text>
            </View>
          ) : null
        )}

        <View style={styles.infoRow}>
          <Icon name="account-child" size={16} color={Colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {(() => {
              const minAge = activity.ageRange?.min ?? activity.ageMin;
              const maxAge = activity.ageRange?.max ?? activity.ageMax;

              // No age data - show unknown
              if (minAge === undefined && maxAge === undefined) {
                return 'Ages not specified';
              }
              if (minAge === null && maxAge === null) {
                return 'Ages not specified';
              }

              const min = minAge ?? 0;
              const max = maxAge ?? 99;

              // All ages (very wide range like 0-99 or 0-100)
              if (min <= 1 && max >= 90) {
                return 'All ages';
              }

              // Same age
              if (min === max) {
                return `Age ${min} years`;
              }

              // High max age (99, 100, etc.) - show "X+" format
              if (max >= 90) {
                return `Ages ${min}+`;
              }

              // Normal range
              return `Ages ${min}-${max}`;
            })()}
          </Text>
        </View>

        {activity.hasPrerequisites && activity.prerequisites && (
          <View style={[styles.infoRow, styles.prerequisiteRow]}>
            <Icon name="alert-circle-outline" size={16} color={Colors.warning} />
            <Text style={[styles.prerequisiteText, { color: Colors.warning }]}>
              Prerequisites required
            </Text>
          </View>
        )}

        <View style={styles.bottomSection}>
          <View style={styles.spotsContainer}>
            {activity.spotsAvailable !== null && activity.spotsAvailable !== undefined ? (
              activity.spotsAvailable === 0 ? (
                <View style={styles.fullBadge}>
                  <Text style={styles.fullText}>FULL</Text>
                </View>
              ) : activity.spotsAvailable <= 3 ? (
                <View style={[styles.limitedBadge, { backgroundColor: getCapacityColor(activity.spotsAvailable) + '20' }]}>
                  <Icon name="alert-circle" size={14} color={getCapacityColor(activity.spotsAvailable)} />
                  <Text style={[styles.limitedText, { color: getCapacityColor(activity.spotsAvailable) }]}>
                    Only {activity.spotsAvailable} {activity.spotsAvailable === 1 ? 'spot' : 'spots'} left!
                  </Text>
                  {hasCapacityAlert && (
                    <Icon name="bell-ring" size={14} color={getCapacityColor(activity.spotsAvailable)} style={{ marginLeft: 4 }} />
                  )}
                </View>
              ) : activity.spotsAvailable <= 5 ? (
                <View style={styles.limitedBadge}>
                  <Icon name="alert-circle" size={14} color={Colors.warning} />
                  <Text style={styles.limitedText}>
                    Only {activity.spotsAvailable} spots left!
                  </Text>
                </View>
              ) : (
                <View style={styles.availableBadge}>
                  <Icon name="check-circle" size={14} color={Colors.success} />
                  <Text style={styles.availableText}>
                    {activity.spotsAvailable} spots available
                  </Text>
                </View>
              )
            ) : null}
          </View>

          <View style={styles.activityIcons}>
            {consolidateActivityTypes(
              Array.isArray(activity.activityType)
                ? activity.activityType.map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean)
                : (activity.activityType as any)?.name
                  ? [(activity.activityType as any).name]
                  : []
            ).slice(0, 3).map((type) => (
              <View 
                key={type} 
                style={[
                  styles.activityIcon,
                  { backgroundColor: (Colors.activities[type] || Colors.primary) + '20' }
                ]}
              >
                <Icon 
                  name={getActivityIcon(type)} 
                  size={20} 
                  color={Colors.activities[type] || Colors.primary} 
                />
              </View>
            ))}
          </View>
        </View>

        {/* Show registered children status */}
        {registeredChildIds.length > 0 && (
          <ChildActivityStatus
            activityId={activity.id}
            compact={true}
          />
        )}
      </View>
    </TouchableOpacity>

    {/* Add to Calendar Modal - outside TouchableOpacity for proper event handling */}
    <AddToCalendarModal
      visible={showCalendarModal}
      activity={activity}
      onClose={() => setShowCalendarModal(false)}
    />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: Theme.spacing.sm,
    ...Theme.shadows.md,
    overflow: 'hidden',
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Theme.spacing.sm,
  },
  priceContainer: {
    alignItems: 'flex-start',
  },
  priceText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.white,
    opacity: 0.9,
  },
  actionButtonsRow: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionButton: {
    padding: 6,
    marginHorizontal: 2,
  },
  featuredBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    left: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  featuredGold: {
    backgroundColor: '#FFB800',
  },
  featuredSilver: {
    backgroundColor: '#8E8E93',
  },
  featuredBronze: {
    backgroundColor: '#CD7F32',
  },
  featuredText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    left: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#4ECDC4',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  calendarBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  calendarBadgeSmall: {
    position: 'absolute',
    top: Theme.spacing.sm + 28,
    left: Theme.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    padding: Theme.spacing.sm,
  },
  header: {
    marginBottom: Theme.spacing.xs,
  },
  title: {
    ...Theme.typography.h5,
    fontSize: 15,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  infoText: {
    ...Theme.typography.bodySmall,
    marginLeft: Theme.spacing.sm,
    flex: 1,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
    paddingVertical: 2,
  },
  providerText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
    fontWeight: '500',
  },
  dateRangeRow: {
    backgroundColor: Colors.secondary + '15',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    marginHorizontal: -Theme.spacing.xs,
    marginBottom: Theme.spacing.xs,
  },
  dateRangeText: {
    fontWeight: '600',
    fontSize: 13,
  },
  timeRow: {
    backgroundColor: Colors.secondary + '10',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    marginHorizontal: -Theme.spacing.xs,
    marginBottom: Theme.spacing.xs,
  },
  timeText: {
    fontWeight: '700',
    fontSize: 14,
    color: Colors.secondary,
  },
  daysRow: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    marginHorizontal: -Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  daysText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  scheduleRow: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    marginHorizontal: -Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  scheduleText: {
    fontWeight: '600',
    fontSize: 13,
  },
  sessionsContainer: {
    marginBottom: Theme.spacing.sm,
  },
  multipleSessionsContainer: {
    backgroundColor: Colors.primary + '10',
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  sessionHeaderText: {
    fontWeight: '600',
    fontSize: 14,
    marginLeft: Theme.spacing.sm,
  },
  sessionItem: {
    paddingLeft: Theme.spacing.lg + Theme.spacing.xs,
    marginBottom: Theme.spacing.xs / 2,
  },
  sessionText: {
    fontSize: 12,
    lineHeight: 16,
  },
  moreSessionsText: {
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: Theme.spacing.lg + Theme.spacing.xs,
    marginTop: Theme.spacing.xs / 2,
  },
  prerequisiteRow: {
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    marginHorizontal: -Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  prerequisiteText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: Theme.spacing.sm,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
  },
  spotsContainer: {
    flex: 1,
  },
  fullBadge: {
    backgroundColor: Colors.error + '20',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  fullText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.error,
  },
  limitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  limitedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
    marginLeft: 4,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  availableText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.success,
    marginLeft: 4,
  },
  activityIcons: {
    flexDirection: 'row',
    marginLeft: Theme.spacing.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: Theme.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Theme.spacing.xs,
  },
});

export default ActivityCard;