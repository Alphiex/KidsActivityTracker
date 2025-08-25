import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Activity } from '../types';
import { useAppSelector } from '../store';
import { selectActivityChildren } from '../store/slices/childActivitiesSlice';
import FavoritesService from '../services/favoritesService';
import { Colors, Theme } from '../theme';
import { getActivityImageByKey } from '../assets/images';
import { useTheme } from '../contexts/ThemeContext';
import ChildActivityStatus from './activities/ChildActivityStatus';
import { formatPrice } from '../utils/formatters';
import { getActivityImageKey } from '../utils/activityHelpers';
import { OptimizedActivityImage } from './OptimizedActivityImage';
import { consolidateActivityTypes } from '../utils/activityTypeConsolidation';

const { width } = Dimensions.get('window');

interface ActivityCardProps {
  activity: Activity;
  onPress?: () => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onPress }) => {
  const favoritesService = FavoritesService.getInstance();
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasCapacityAlert, setHasCapacityAlert] = useState(false);
  const { colors, isDark } = useTheme();
  const registeredChildIds = useAppSelector(selectActivityChildren(activity.id));

  useEffect(() => {
    setIsFavorite(favoritesService.isFavorite(activity.id));
    const alerts = favoritesService.getCapacityAlertsForActivity(activity.id);
    setHasCapacityAlert(alerts.length > 0);
  }, [activity.id]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = (start: Date, end: Date) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
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
      // If schedule is a string, return it as is
      return schedule;
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

  const extractDaysFromSessions = (sessions: typeof activity.sessions) => {
    if (!sessions || sessions.length === 0) return null;
    
    const uniqueDays = [...new Set(sessions.map(s => s.dayOfWeek).filter(Boolean))];
    if (uniqueDays.length === 0) return null;
    
    // Sort days in order (Monday to Sunday)
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    uniqueDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    
    // Check for common patterns
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const isWeekdays = uniqueDays.length === 5 && uniqueDays.every(day => weekdays.includes(day));
    
    if (isWeekdays) {
      return 'Weekdays';
    } else if (uniqueDays.length === 7) {
      return 'Daily';
    } else if (uniqueDays.length === 2 && 
               uniqueDays.includes('Saturday') && 
               uniqueDays.includes('Sunday')) {
      return 'Weekends';
    } else if (uniqueDays.length === 1) {
      return uniqueDays[0] + 's'; // e.g., "Mondays"
    } else {
      // For multiple days, use full names if 3 or fewer, abbreviations if more
      if (uniqueDays.length <= 3) {
        return uniqueDays.join(', ');
      } else {
        const dayAbbrev: { [key: string]: string } = {
          'Monday': 'Mon',
          'Tuesday': 'Tue',
          'Wednesday': 'Wed',
          'Thursday': 'Thu',
          'Friday': 'Fri',
          'Saturday': 'Sat',
          'Sunday': 'Sun'
        };
        return uniqueDays.map(day => dayAbbrev[day] || day).join(', ');
      }
    }
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

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.cardBackground }]}
      onPress={() => {
        console.log('ActivityCard pressed:', activity.name);
        console.log('onPress function exists:', !!onPress);
        if (onPress) {
          onPress();
        }
      }}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        <OptimizedActivityImage 
          source={getActivityImageByKey(getActivityImageKey(
            activity.category || (activity.activityType && activity.activityType[0]) || '', 
            activity.subcategory
          ))} 
          style={styles.image} 
          resizeMode="cover"
          containerStyle={styles.imageContainer}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageGradient}
        />
        <View style={styles.imageOverlay}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>${formatPrice(activity.cost)}</Text>
            <Text style={styles.priceLabel}>per child</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            favoritesService.toggleFavorite(activity);
            setIsFavorite(!isFavorite);
          }}
          style={styles.favoriteButton}
        >
          <Icon
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? '#FF6B6B' : colors.textSecondary}
          />
        </TouchableOpacity>
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

        {activity.dateRange && (
          <View style={[styles.infoRow, styles.dateRangeRow]}>
            <Icon name="calendar-range" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, styles.dateRangeText, { color: colors.text }]}>
              {formatDateRange(activity.dateRange.start, activity.dateRange.end)}
            </Text>
          </View>
        )}

        {/* Display days of the week prominently */}
        {activity.sessions && activity.sessions.length > 0 && extractDaysFromSessions(activity.sessions) && (
          <View style={[styles.infoRow, styles.daysRow]}>
            <Icon name="calendar-week" size={16} color={Colors.secondary} />
            <Text style={[styles.infoText, styles.daysText, { color: colors.text }]}>
              {extractDaysFromSessions(activity.sessions)}
            </Text>
          </View>
        )}

        {activity.sessions && activity.sessions.length > 0 ? (
          <View style={[styles.sessionsContainer]}>
            {activity.sessions.length === 1 ? (
              // Single session - display inline
              <View style={[styles.infoRow, styles.scheduleRow]}>
                <Icon name="clock-outline" size={16} color={Colors.primary} />
                <Text style={[styles.infoText, styles.scheduleText, { color: colors.text }]} numberOfLines={2}>
                  {activity.sessions[0].date && `${activity.sessions[0].date} • `}
                  {activity.sessions[0].startTime && activity.sessions[0].endTime 
                    ? `${activity.sessions[0].startTime} - ${activity.sessions[0].endTime}`
                    : activity.sessions[0].startTime || ''}
                </Text>
              </View>
            ) : (
              // Multiple sessions
              <View style={styles.multipleSessionsContainer}>
                <View style={styles.sessionHeader}>
                  <Icon name="calendar-multiple" size={16} color={Colors.primary} />
                  <Text style={[styles.sessionHeaderText, { color: colors.text }]}>
                    {activity.sessions.length} Sessions Available
                  </Text>
                </View>
                {activity.sessions.slice(0, 2).map((session, index) => (
                  <View key={index} style={styles.sessionItem}>
                    <Text style={[styles.sessionText, { color: colors.textSecondary }]}>
                      {session.date && `${session.date}`}
                      {session.startTime && ` • ${session.startTime}`}
                      {session.endTime && ` - ${session.endTime}`}
                    </Text>
                  </View>
                ))}
                {activity.sessions.length > 2 && (
                  <Text style={[styles.moreSessionsText, { color: Colors.primary }]}>
                    +{activity.sessions.length - 2} more sessions
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
        ) : null}

        <View style={styles.infoRow}>
          <Icon name="account-child" size={16} color={Colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Ages {activity.ageRange.min} - {activity.ageRange.max} years
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
            {activity.spotsAvailable === 0 ? (
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
            )}
          </View>

          <View style={styles.activityIcons}>
            {consolidateActivityTypes(activity.activityType).slice(0, 3).map((type) => (
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
      
      {/* New: Quick Action Buttons */}
      <View style={[styles.quickActions, { 
        backgroundColor: isDark ? 'rgba(50, 50, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)' 
      }]}>
        <TouchableOpacity style={styles.quickActionButton}>
          <Icon name="share-variant" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton}>
          <Icon name="calendar-plus" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: Theme.spacing.md,
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
    height: 100,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Theme.spacing.md,
  },
  priceContainer: {
    alignItems: 'flex-start',
  },
  priceText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
  },
  favoriteButton: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Theme.borderRadius.round,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    padding: Theme.spacing.md,
  },
  header: {
    marginBottom: Theme.spacing.sm,
  },
  title: {
    ...Theme.typography.h5,
    marginBottom: Theme.spacing.xs,
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
  daysRow: {
    backgroundColor: Colors.secondary + '20',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    marginHorizontal: -Theme.spacing.xs,
    marginBottom: Theme.spacing.xs,
  },
  daysText: {
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
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
    marginTop: Theme.spacing.md,
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
  quickActions: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionButton: {
    padding: 8,
    marginHorizontal: 2,
  },
});

export default ActivityCard;