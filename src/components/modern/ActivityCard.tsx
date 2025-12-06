import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Badge from './Badge';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../../theme/modernTheme';
import { getActivityImageKey } from '../../utils/activityHelpers';
import { getActivityImageByKey } from '../../assets/images';
import { formatPrice } from '../../utils/formatters';

const { width } = Dimensions.get('window');

interface ActivityCardProps {
  isFavorite?: boolean;
  onFavoritePress?: () => void;
  isAssignedToCalendar?: boolean;
  activity: {
    id: string;
    name: string;
    location?: string | { name: string; address: string; };
    locationName?: string;
    price?: number;
    cost?: number;
    rating?: number;
    image?: string;
    imageUrl?: string;
    category?: string;
    isNew?: boolean;
    spotsAvailable?: number;
    ageRange?: {
      min: number;
      max: number;
    };
    ageMin?: number;
    ageMax?: number;
    dateRange?: {
      start: string;
      end: string;
    };
    sessions?: Array<{
      startTime?: string;
      endTime?: string;
      dayOfWeek?: string;
      date?: string;
    }>;
    schedule?: string | Array<any> | {
      startTime?: string;
      endTime?: string;
      days?: string[];
    };
    registrationStatus?: string;
    startTime?: string;
    endTime?: string;
    dates?: string;
    activityType?: any;
    activitySubtype?: any;
    subcategory?: string;
  };
  onPress?: () => void;
  variant?: 'default' | 'compact' | 'full';
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onPress,
  variant = 'default',
  isFavorite = false,
  onFavoritePress,
  isAssignedToCalendar = false,
}) => {
  const price = activity.price ?? activity.cost ?? 0;

  const activityTypeName = activity.activityType?.name || activity.category || 'general';
  const subcategory = activity.activitySubtype?.name || activity.subcategory;
  const imageKey = getActivityImageKey(activityTypeName, subcategory);
  const imageSource = getActivityImageByKey(imageKey);

  const getLocationName = (): string => {
    if (activity.locationName) return activity.locationName;
    if (typeof activity.location === 'string') return activity.location;
    if (activity.location && typeof activity.location === 'object' && 'name' in activity.location) {
      return activity.location.name;
    }
    return 'Location TBA';
  };

  const location = getLocationName();
  const isAvailable = activity.registrationStatus !== 'Closed' && 
                     activity.registrationStatus !== 'Waitlist' &&
                     (activity.spotsAvailable === undefined || activity.spotsAvailable > 0);

  const getAgeRange = () => {
    if (activity.ageRange) {
      return `Ages ${activity.ageRange.min}-${activity.ageRange.max}`;
    }
    if (activity.ageMin !== undefined && activity.ageMax !== undefined) {
      return `Ages ${activity.ageMin}-${activity.ageMax}`;
    }
    return null;
  };

  // Extract days of week from sessions or schedule string
  const getDaysOfWeek = (): string | null => {
    const daysSet = new Set<string>();
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Extract from sessions array
    if (activity.sessions && Array.isArray(activity.sessions) && activity.sessions.length > 0) {
      activity.sessions.forEach(session => {
        if (session.dayOfWeek) {
          // Normalize to 3-letter abbreviation
          const day = session.dayOfWeek.substring(0, 3);
          const normalized = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
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
        /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi
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

    // Sort days in order and format
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

  const getTimeOnly = (): string | null => {
    let timeRange = '';

    if (activity.sessions && Array.isArray(activity.sessions) && activity.sessions.length > 0) {
      const firstSession = activity.sessions[0];
      if (firstSession.startTime || firstSession.endTime) {
        timeRange = `${firstSession.startTime || ''}${firstSession.startTime && firstSession.endTime ? ' - ' : ''}${firstSession.endTime || ''}`;
      }
    } else if (activity.startTime || activity.endTime) {
      timeRange = `${activity.startTime || ''}${activity.startTime && activity.endTime ? ' - ' : ''}${activity.endTime || ''}`;
    }

    return timeRange || null;
  };

  const getDateRange = () => {
    if (activity.dateRange && activity.dateRange.start && activity.dateRange.end) {
      const start = new Date(activity.dateRange.start);
      const end = new Date(activity.dateRange.end);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    if (activity.startDate && activity.endDate) {
      const start = new Date(activity.startDate);
      const end = new Date(activity.endDate);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    return null;
  };

  const isInProgress = () => {
    const now = new Date();
    if (activity.dateRange && activity.dateRange.start && activity.dateRange.end) {
      const start = new Date(activity.dateRange.start);
      const end = new Date(activity.dateRange.end);
      return now >= start && now <= end;
    }
    if (activity.startDate && activity.endDate) {
      const start = new Date(activity.startDate);
      const end = new Date(activity.endDate);
      return now >= start && now <= end;
    }
    return false;
  };

  const getSpotsText = () => {
    if (activity.spotsAvailable !== undefined && activity.spotsAvailable !== null) {
      if (activity.spotsAvailable === 0) {
        return 'Full';
      } else if (activity.spotsAvailable === 1) {
        return 'Only 1 spot left!';
      } else if (activity.spotsAvailable <= 5) {
        return `Only ${activity.spotsAvailable} spots left!`;
      } else {
        return `${activity.spotsAvailable} spots available`;
      }
    }
    return null;
  };

  const getStatusBadge = () => {
    if (activity.registrationStatus === 'Closed') {
      return <Badge variant="error" size="sm">Closed</Badge>;
    }
    if (activity.registrationStatus === 'Waitlist') {
      return <Badge variant="warning" size="sm">Waitlist</Badge>;
    }
    if (activity.spotsAvailable !== undefined && activity.spotsAvailable <= 3 && activity.spotsAvailable > 0) {
      return <Badge variant="warning" size="sm">{`${activity.spotsAvailable} spots left`}</Badge>;
    }
    if (activity.isNew) {
      return <Badge variant="success" size="sm">New</Badge>;
    }
    return null;
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.compactContent}>
          <View style={styles.compactLeft}>
            <Text style={styles.compactTitle} numberOfLines={1}>{activity.name}</Text>
            <View style={styles.compactDetails}>
              <Icon name="map-marker" size={14} color={ModernColors.textMuted} />
              <Text style={styles.compactLocation} numberOfLines={1}>{location}</Text>
              {getTimeInfo() && (
                <>
                  <Icon name="clock-outline" size={14} color={ModernColors.textMuted} style={{ marginLeft: 8 }} />
                  <Text style={styles.compactLocation}>{getTimeInfo()}</Text>
                </>
              )}
              {getAgeRange() && (
                <>
                  <Icon name="account-child" size={14} color={ModernColors.textMuted} style={{ marginLeft: 8 }} />
                  <Text style={styles.compactLocation}>{getAgeRange()}</Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.compactRight}>
            <Text style={[styles.compactPrice, !isAvailable && styles.priceUnavailable]}>
              ${price}
            </Text>
            {getStatusBadge()}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, variant === 'full' && styles.fullContainer]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        <Image source={imageSource} style={styles.image} />

        {/* Favorite and Calendar Buttons */}
        <View style={styles.iconButtonsContainer}>
          {isAssignedToCalendar && (
            <View style={styles.calendarBadge}>
              <Icon
                name="calendar-check"
                size={20}
                color="#FFF"
              />
            </View>
          )}
          {onFavoritePress && (
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={(e) => {
                e.stopPropagation();
                onFavoritePress();
              }}
            >
              <Icon
                name={isFavorite ? "heart" : "heart-outline"}
                size={20}
                color={isFavorite ? "#FF385C" : "#FFF"}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Price Overlay */}
        {price > 0 && (
          <View style={styles.priceOverlay}>
            <Text style={styles.priceOverlayText}>${formatPrice(price)}</Text>
            <Text style={styles.perChildText}>per child</Text>
          </View>
        )}

        {/* NEW Badge */}
        {activity.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{activity.name}</Text>
        
        <View style={styles.detailRow}>
          <Icon name="map-marker" size={16} color={ModernColors.textMuted} />
          <Text style={styles.location} numberOfLines={1}>{location}</Text>
        </View>

        {isInProgress() && getDateRange() && (
          <View style={styles.detailRow}>
            <Icon name="calendar" size={16} color={ModernColors.success} />
            <Text style={[styles.scheduleText, { color: ModernColors.success, fontWeight: '600' }]}>In Progress</Text>
            <Text style={styles.scheduleText}> • {getDateRange()}</Text>
          </View>
        )}

        {!isInProgress() && getDateRange() && (
          <View style={styles.detailRow}>
            <Icon name="calendar" size={16} color={ModernColors.textMuted} />
            <Text style={styles.scheduleText}>{getDateRange()}</Text>
          </View>
        )}

        {getDaysOfWeek() && (
          <View style={styles.daysRow}>
            <Icon name="calendar-week" size={16} color={ModernColors.primary} />
            <Text style={styles.daysText}>{getDaysOfWeek()}</Text>
          </View>
        )}

        {getTimeOnly() && (
          <View style={styles.detailRow}>
            <Icon name="clock-outline" size={16} color={ModernColors.accent} />
            <Text style={styles.timeText}>{getTimeOnly()}</Text>
          </View>
        )}

        {getAgeRange() && (
          <View style={styles.detailRow}>
            <Icon name="account-child" size={16} color={ModernColors.textMuted} />
            <Text style={styles.location}>{getAgeRange()}</Text>
          </View>
        )}

        {getSpotsText() && (
          <View style={[
            styles.spotsContainer,
            activity.spotsAvailable <= 5 ? styles.spotsUrgent : styles.spotsNormal
          ]}>
            <Icon
              name={activity.spotsAvailable === 0 ? "close-circle" : "information"}
              size={14}
              color={activity.spotsAvailable <= 5 ? ModernColors.error : ModernColors.textMuted}
            />
            <Text style={[
              styles.spotsText,
              activity.spotsAvailable <= 5 ? styles.spotsTextUrgent : styles.spotsTextNormal
            ]}>
              {getSpotsText()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.xl,
    overflow: 'hidden',
    ...ModernShadows.lg,
    marginBottom: ModernSpacing.md,
    marginHorizontal: ModernSpacing.md,
    borderWidth: 1,
    borderColor: ModernColors.borderLight,
  },
  fullContainer: {
    width: width - (ModernSpacing.lg * 2),
  },
  imageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: ModernSpacing.sm,
    right: ModernSpacing.sm,
  },
  iconButtonsContainer: {
    position: 'absolute',
    top: ModernSpacing.sm,
    right: ModernSpacing.sm,
    flexDirection: 'row',
    gap: ModernSpacing.xs,
  },
  favoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    ...ModernShadows.md,
  },
  calendarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ModernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...ModernShadows.md,
  },
  priceOverlay: {
    position: 'absolute',
    bottom: ModernSpacing.sm,
    right: ModernSpacing.sm,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: ModernSpacing.sm,
    paddingVertical: ModernSpacing.xs / 2,
    borderRadius: ModernBorderRadius.md,
  },
  priceOverlayText: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: ModernTypography.weights.bold as any,
    color: '#FFF',
  },
  perChildText: {
    fontSize: ModernTypography.sizes.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  newBadge: {
    position: 'absolute',
    top: ModernSpacing.sm,
    left: ModernSpacing.sm,
    backgroundColor: ModernColors.success,
    paddingHorizontal: ModernSpacing.sm,
    paddingVertical: ModernSpacing.xs / 2,
    borderRadius: ModernBorderRadius.sm,
  },
  newBadgeText: {
    fontSize: ModernTypography.sizes.xs,
    fontWeight: ModernTypography.weights.bold as any,
    color: ModernColors.textOnPrimary,
  },
  content: {
    padding: ModernSpacing.md,
  },
  title: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: ModernTypography.weights.semibold as any,
    color: ModernColors.text,
    marginBottom: ModernSpacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ModernSpacing.xs,
  },
  location: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginLeft: ModernSpacing.xs,
    flex: 1,
  },
  scheduleText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginLeft: ModernSpacing.xs,
    flex: 1,
  },
  timeText: {
    fontSize: ModernTypography.sizes.sm,
    fontWeight: ModernTypography.weights.semibold as any,
    color: ModernColors.accent,
    marginLeft: ModernSpacing.xs,
    flex: 1,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ModernSpacing.xs,
    backgroundColor: ModernColors.primary + '15',
    paddingVertical: ModernSpacing.xs,
    paddingHorizontal: ModernSpacing.sm,
    borderRadius: ModernBorderRadius.sm,
    marginHorizontal: -ModernSpacing.xs,
  },
  daysText: {
    fontSize: ModernTypography.sizes.sm,
    fontWeight: ModernTypography.weights.bold as any,
    color: ModernColors.primary,
    marginLeft: ModernSpacing.xs,
    flex: 1,
    letterSpacing: 0.5,
  },
  statusText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginLeft: ModernSpacing.xs,
    flex: 1,
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ModernSpacing.xs,
    paddingHorizontal: ModernSpacing.sm,
    borderRadius: ModernBorderRadius.sm,
    marginTop: ModernSpacing.xs,
  },
  spotsNormal: {
    backgroundColor: ModernColors.backgroundAlt,
  },
  spotsUrgent: {
    backgroundColor: ModernColors.error + '15',
  },
  spotsText: {
    fontSize: ModernTypography.sizes.sm,
    marginLeft: ModernSpacing.xs / 2,
  },
  spotsTextNormal: {
    color: ModernColors.textSecondary,
  },
  spotsTextUrgent: {
    color: ModernColors.error,
    fontWeight: ModernTypography.weights.semibold as any,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: ModernSpacing.sm,
  },
  price: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: ModernTypography.weights.bold as any,
    color: ModernColors.primary,
  },
  priceUnavailable: {
    color: ModernColors.textMuted,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: ModernTypography.sizes.sm,
    fontWeight: ModernTypography.weights.medium as any,
    color: ModernColors.text,
    marginLeft: ModernSpacing.xs / 2,
  },
  
  // Compact variant styles
  compactContainer: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    padding: ModernSpacing.md,
    marginBottom: ModernSpacing.sm,
    borderWidth: 1,
    borderColor: ModernColors.border,
    ...ModernShadows.sm,
  },
  compactContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactLeft: {
    flex: 1,
    marginRight: ModernSpacing.md,
  },
  compactTitle: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: ModernTypography.weights.semibold as any,
    color: ModernColors.text,
    marginBottom: ModernSpacing.xs,
  },
  compactDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactLocation: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginLeft: ModernSpacing.xs / 2,
  },
  compactRight: {
    alignItems: 'flex-end',
  },
  compactPrice: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: ModernTypography.weights.bold as any,
    color: ModernColors.success,
    marginBottom: ModernSpacing.xs,
  },
});

export default ActivityCard;