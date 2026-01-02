import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Share } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Activity } from '../../types';
import { Colors, Theme } from '../../theme';
import { formatActivityPrice } from '../../utils/formatters';
import { getActivityImageByKey } from '../../assets/images';
import { getActivityImageKey } from '../../utils/activityHelpers';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppSelector } from '../../store';
import { selectActivityChildren } from '../../store/slices/childActivitiesSlice';
import FavoritesService from '../../services/favoritesService';
import WaitlistService from '../../services/waitlistService';
import AddToCalendarModal from '../AddToCalendarModal';

interface MapActivityCardProps {
  activity: Activity;
  onPress: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  // Optional external favorite control
  isFavorite?: boolean;
  onFavoritePress?: () => void;
  canAddFavorite?: boolean;
  onFavoriteLimitReached?: () => void;
  // Waitlist support
  isOnWaitlist?: boolean;
  onWaitlistPress?: () => void;
  canAddToWaitlist?: boolean;
  onWaitlistLimitReached?: () => void;
}

const MapActivityCard: React.FC<MapActivityCardProps> = ({
  activity,
  onPress,
  onClose,
  showCloseButton = false,
  isFavorite: externalIsFavorite,
  onFavoritePress,
  canAddFavorite = true,
  onFavoriteLimitReached,
  isOnWaitlist: externalIsOnWaitlist,
  onWaitlistPress,
  canAddToWaitlist = true,
  onWaitlistLimitReached,
}) => {
  const { colors } = useTheme();
  const favoritesService = FavoritesService.getInstance();
  const waitlistService = WaitlistService.getInstance();

  // Use external state if provided, otherwise manage internally
  const isExternallyControlled = externalIsFavorite !== undefined;
  const [internalIsFavorite, setInternalIsFavorite] = useState(false);
  const isFavorite = isExternallyControlled ? externalIsFavorite : internalIsFavorite;

  // Waitlist state
  const isWaitlistExternallyControlled = externalIsOnWaitlist !== undefined;
  const [internalIsOnWaitlist, setInternalIsOnWaitlist] = useState(false);
  const isOnWaitlist = isWaitlistExternallyControlled ? externalIsOnWaitlist : internalIsOnWaitlist;

  // Calendar state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const registeredChildIds = useAppSelector(selectActivityChildren(activity.id));
  const isOnCalendar = registeredChildIds.length > 0;

  useEffect(() => {
    if (!isExternallyControlled) {
      setInternalIsFavorite(favoritesService.isFavorite(activity.id));
    }
    if (!isWaitlistExternallyControlled) {
      setInternalIsOnWaitlist(waitlistService.isOnWaitlist(activity.id));
    }
  }, [activity.id, isExternallyControlled, isWaitlistExternallyControlled]);

  const getImageKeyAndType = () => {
    const activityType = Array.isArray(activity.activityType)
      ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
      : (activity.activityType as any)?.name;
    const category = activity.category || activityType || '';
    return {
      key: getActivityImageKey(category, activity.subcategory, activity.name),
      type: activityType,
    };
  };

  // Extract days of week from activity
  const extractDaysOfWeek = (): string | null => {
    const daysSet = new Set<string>();
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Extract from dayOfWeek array
    if (activity.dayOfWeek && Array.isArray(activity.dayOfWeek)) {
      activity.dayOfWeek.forEach((day: string) => {
        if (day && typeof day === 'string') {
          const abbrev = day.substring(0, 3);
          const normalized = abbrev.charAt(0).toUpperCase() + abbrev.slice(1).toLowerCase();
          if (dayOrder.includes(normalized)) {
            daysSet.add(normalized);
          }
        }
      });
    }

    // Extract from sessions array
    if (activity.sessions && Array.isArray(activity.sessions)) {
      activity.sessions.forEach((session: any) => {
        const dayOfWeek = session?.dayOfWeek;
        if (dayOfWeek && typeof dayOfWeek === 'string') {
          const abbrev = dayOfWeek.substring(0, 3);
          const normalized = abbrev.charAt(0).toUpperCase() + abbrev.slice(1).toLowerCase();
          if (dayOrder.includes(normalized)) {
            daysSet.add(normalized);
          }
        }
      });
    }

    // Extract from schedule object with days array
    if (activity.schedule && typeof activity.schedule === 'object' && !Array.isArray(activity.schedule)) {
      const scheduleObj = activity.schedule as { days?: string[] };
      if (scheduleObj.days && Array.isArray(scheduleObj.days)) {
        scheduleObj.days.forEach((day: string) => {
          const abbrev = day.substring(0, 3);
          const normalized = abbrev.charAt(0).toUpperCase() + abbrev.slice(1).toLowerCase();
          if (dayOrder.includes(normalized)) {
            daysSet.add(normalized);
          }
        });
      }
    }

    if (daysSet.size === 0) return null;

    const sortedDays = Array.from(daysSet).sort((a, b) =>
      dayOrder.indexOf(a) - dayOrder.indexOf(b)
    );

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

  const handleFavoriteToggle = () => {
    if (!isFavorite && !canAddFavorite) {
      if (onFavoriteLimitReached) {
        onFavoriteLimitReached();
      }
      return;
    }

    if (onFavoritePress) {
      onFavoritePress();
    } else {
      favoritesService.toggleFavorite(activity);
      setInternalIsFavorite(!internalIsFavorite);
    }
  };

  const handleWaitlistToggle = async () => {
    if (!isOnWaitlist && !canAddToWaitlist) {
      if (onWaitlistLimitReached) {
        onWaitlistLimitReached();
      }
      return;
    }

    if (onWaitlistPress) {
      onWaitlistPress();
    } else {
      setInternalIsOnWaitlist(!internalIsOnWaitlist);
      const result = await waitlistService.toggleWaitlist(activity);
      if (!result.success) {
        setInternalIsOnWaitlist(internalIsOnWaitlist);
      }
    }
  };

  const handleShare = async () => {
    try {
      const locationName = typeof activity.location === 'string'
        ? activity.location
        : activity.location?.name || activity.locationName || '';

      const details: string[] = [];
      details.push(`🎯 ${activity.name}`);
      details.push('');

      if (locationName) {
        details.push(`📍 ${locationName}`);
      }

      const price = formatActivityPrice(activity.cost);
      if (price) {
        details.push(`💰 ${price}`);
      }

      if (activity.ageRange) {
        const ageMin = activity.ageRange.min ?? 0;
        const ageMax = activity.ageRange.max ?? 18;
        if (ageMin === 0 && ageMax >= 18) {
          details.push('👶 All ages welcome');
        } else {
          details.push(`👶 Ages ${ageMin}-${ageMax}`);
        }
      }

      const days = extractDaysOfWeek();
      if (days) {
        details.push(`📅 ${days}`);
      }

      if (activity.startTime) {
        const timeStr = activity.endTime
          ? `${activity.startTime} - ${activity.endTime}`
          : activity.startTime;
        details.push(`🕐 ${timeStr}`);
      }

      details.push('');
      details.push('Found on KidsActivityTracker 🎈');

      await Share.share({
        message: details.join('\n'),
        title: activity.name,
      });
    } catch (error) {
      console.error('Error sharing activity:', error);
    }
  };

  const daysOfWeek = extractDaysOfWeek();
  const hasTime = activity.startTime || activity.endTime;

  return (
    <>
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.cardBackground }]} onPress={onPress} activeOpacity={0.95}>
        {showCloseButton && onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={18} color="#666" />
          </TouchableOpacity>
        )}

        <View style={styles.imageContainer}>
          <Image
            source={(() => {
              const { key, type } = getImageKeyAndType();
              return getActivityImageByKey(key, type);
            })()}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{formatActivityPrice(activity.cost)}</Text>
          </View>

          {/* Action buttons overlay */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleFavoriteToggle}>
              <Icon
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={14}
                color={isFavorite ? '#E8638B' : '#FFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleWaitlistToggle}>
              <Icon
                name={isOnWaitlist ? 'bell-ring' : 'bell-outline'}
                size={14}
                color={isOnWaitlist ? '#FFB800' : '#FFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Icon name="share-variant" size={14} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowCalendarModal(true)}>
              <Icon
                name={isOnCalendar ? 'calendar-check' : 'calendar-plus'}
                size={14}
                color={isOnCalendar ? '#4ECDC4' : '#FFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{activity.name}</Text>

          <View style={styles.infoRow}>
            <Icon name="map-marker" size={14} color={Colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
              {typeof activity.location === 'string'
                ? activity.location
                : activity.location?.name || activity.locationName || 'Location TBD'}
            </Text>
          </View>

          {/* Time with Days */}
          {hasTime && (
            <View style={[styles.infoRow, styles.timeRow]}>
              <Icon name="clock-outline" size={14} color={Colors.primary} />
              <Text style={[styles.timeText, { color: colors.text }]} numberOfLines={1}>
                {daysOfWeek ? `${daysOfWeek} • ` : ''}
                {`${activity.startTime || ''}${activity.startTime && activity.endTime ? ' - ' : ''}${activity.endTime || ''}`}
              </Text>
            </View>
          )}

          {/* Days of Week (only if no time) */}
          {daysOfWeek && !hasTime && (
            <View style={[styles.infoRow, styles.daysRow]}>
              <Icon name="calendar-week" size={14} color={Colors.primary} />
              <Text style={styles.daysText}>{daysOfWeek}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Icon name="account-child" size={14} color={Colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {(() => {
                const min = activity.ageRange?.min ?? 0;
                const max = activity.ageRange?.max ?? 18;
                if (min <= 1 && max >= 90) return 'All ages';
                if (min === max) return `Age ${min}`;
                if (max >= 90) return `Ages ${min}+`;
                return `Ages ${min}-${max}`;
              })()}
            </Text>
          </View>

          {activity.spotsAvailable !== undefined && activity.spotsAvailable !== null && (
            <View style={[
              styles.spotsBadge,
              activity.spotsAvailable === 0 && styles.spotsBadgeFull,
              activity.spotsAvailable <= 3 && activity.spotsAvailable > 0 && styles.spotsBadgeLimited,
            ]}>
              <Text style={[
                styles.spotsText,
                activity.spotsAvailable === 0 && styles.spotsTextFull,
                activity.spotsAvailable <= 3 && activity.spotsAvailable > 0 && styles.spotsTextLimited,
              ]}>
                {activity.spotsAvailable === 0 ? 'FULL' : `${activity.spotsAvailable} spots left`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chevronContainer}>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </View>
      </TouchableOpacity>

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
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    ...Theme.shadows.md,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: 90,
    height: 'auto',
    minHeight: 100,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    minHeight: 100,
  },
  priceTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actionButtonsRow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 2,
  },
  actionButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  infoText: {
    fontSize: 11,
    color: '#717171',
    marginLeft: 5,
    flex: 1,
  },
  timeRow: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 5,
    flex: 1,
  },
  daysRow: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
    marginRight: 8,
  },
  daysText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 5,
    letterSpacing: 0.3,
  },
  spotsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.success + '20',
    marginTop: 2,
  },
  spotsBadgeFull: {
    backgroundColor: Colors.error + '20',
  },
  spotsBadgeLimited: {
    backgroundColor: Colors.warning + '20',
  },
  spotsText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.success,
  },
  spotsTextFull: {
    color: Colors.error,
  },
  spotsTextLimited: {
    color: Colors.warning,
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingRight: 10,
  },
});

export default MapActivityCard;
