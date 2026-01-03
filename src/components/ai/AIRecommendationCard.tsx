import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { AIRecommendation, AISourceType } from '../../types/ai';
import { Activity } from '../../types';
import { OptimizedActivityImage } from '../OptimizedActivityImage';
import { getActivityImageByKey } from '../../assets/images';
import { getActivityImageKey } from '../../utils/activityHelpers';
import { formatActivityPrice } from '../../utils/formatters';
import { Colors, Theme } from '../../theme';
import { ChildWithPreferences } from '../../store/slices/childrenSlice';
import { getChildColor } from '../../theme/childColors';
import { ChildAvatar } from '../children';

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  activity: Activity;
  source: AISourceType;
  onPress?: () => void;
  showExplanation?: boolean;
  containerStyle?: any;
  children?: ChildWithPreferences[];
}

/**
 * Activity card enhanced with AI recommendation explanation
 * Matches the style of the regular ActivityCard with "why" reasons
 */
const AIRecommendationCard: React.FC<AIRecommendationCardProps> = ({
  recommendation,
  activity,
  source,
  onPress,
  showExplanation = true,
  containerStyle,
  children: childrenProp,
}) => {
  const { colors, isDark } = useTheme();

  // Calculate which children this activity is great for
  const matchingChildren = useMemo(() => {
    if (!childrenProp || childrenProp.length === 0) return [];

    const activityAgeMin = activity.ageRange?.min ?? activity.ageMin ?? 0;
    const activityAgeMax = activity.ageRange?.max ?? activity.ageMax ?? 18;

    return childrenProp.filter(child => {
      if (!child.dateOfBirth) return false;
      const birthDate = new Date(child.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= activityAgeMin && age <= activityAgeMax;
    });
  }, [childrenProp, activity]);

  // Format fit score as label
  const fitScoreLabel = recommendation.fit_score >= 90
    ? 'Excellent Match'
    : recommendation.fit_score >= 70
      ? 'Great Match'
      : 'Good Match';

  const fitScoreColor = recommendation.fit_score >= 90
    ? '#10B981'
    : recommendation.fit_score >= 70
      ? '#E8638B'
      : '#6B7280';

  // Get image source for activity
  const getImageSource = () => {
    const activityType = Array.isArray(activity.activityType)
      ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
      : (activity.activityType as any)?.name;

    return getActivityImageByKey(
      getActivityImageKey(
        activity.category || activityType || '',
        activity.subcategory,
        activity.name
      ),
      activityType // Pass activity type for fallback
    );
  };

  // Format date range
  const formatDateRange = () => {
    if (!activity.dateRange?.start && !activity.dateRange?.end) return null;

    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const start = activity.dateRange?.start ? formatDate(activity.dateRange.start) : '';
    const end = activity.dateRange?.end ? formatDate(activity.dateRange.end) : '';

    if (start && end) {
      const today = new Date();
      const startDate = new Date(activity.dateRange.start);
      const endDate = new Date(activity.dateRange.end);

      if (startDate <= today && endDate >= today) {
        return `In Progress`;
      }

      // Check if start and end dates are the same day
      const isSameDay = startDate.getFullYear() === endDate.getFullYear() &&
                        startDate.getMonth() === endDate.getMonth() &&
                        startDate.getDate() === endDate.getDate();

      return isSameDay ? start : `${start} - ${end}`;
    }
    return start || end;
  };

  // Format time display
  const formatTime = () => {
    if (activity.startTime || activity.endTime) {
      return `${activity.startTime || ''}${activity.startTime && activity.endTime ? ' - ' : ''}${activity.endTime || ''}`;
    }
    return null;
  };

  // Extract days of week from activity
  const extractDaysOfWeek = (): string | null => {
    const daysSet = new Set<string>();
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activityAny = activity as any;

    // Extract from dayOfWeek array (e.g., ["Monday", "Wednesday"])
    if (activityAny.dayOfWeek && Array.isArray(activityAny.dayOfWeek)) {
      activityAny.dayOfWeek.forEach((day: string) => {
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

  // Get location name
  const getLocation = () => {
    if (typeof activity.location === 'string') return activity.location;
    return activity.location?.name || activity.locationName || null;
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardBackground }, containerStyle]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        <OptimizedActivityImage
          source={getImageSource()}
          style={styles.image}
          resizeMode="cover"
          containerStyle={styles.imageContainer}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageGradient}
        />

        {/* Rank Badge */}
        <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.rankText}>#{recommendation.rank}</Text>
        </View>

        {/* Sponsored Badge */}
        {recommendation.is_sponsored && (
          <View style={styles.sponsoredBadge}>
            <Icon name="star" size={10} color="#F59E0B" />
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>
        )}

        {/* Price Overlay */}
        <View style={styles.imageOverlay}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>{formatActivityPrice(activity.cost)}</Text>
            {activity.cost !== null && activity.cost !== undefined && activity.cost > 0 && (
              <Text style={styles.priceLabel}>per child</Text>
            )}
          </View>
        </View>

        {/* Fit Score Badge */}
        <View style={[styles.fitBadge, { backgroundColor: fitScoreColor }]}>
          <Icon name="star" size={12} color="#fff" />
          <Text style={styles.fitText}>{fitScoreLabel}</Text>
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {activity.name}
        </Text>

        {/* Provider */}
        {activity.provider && (
          <Text style={[styles.provider, { color: colors.textSecondary }]} numberOfLines={1}>
            {typeof activity.provider === 'string' ? activity.provider : (activity.provider as any)?.name}
          </Text>
        )}

        {/* Location */}
        {getLocation() && (
          <View style={styles.infoRow}>
            <Icon name="map-marker" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
              {getLocation()}
            </Text>
          </View>
        )}

        {/* Date Range */}
        {formatDateRange() && (
          <View style={[styles.infoRow, styles.dateRow]}>
            <Icon name="calendar-range" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, styles.dateText, { color: colors.text }]}>
              {formatDateRange()}
            </Text>
          </View>
        )}

        {/* Time with Days */}
        {formatTime() && (
          <View style={[styles.infoRow, styles.timeRow]}>
            <Icon name="clock-outline" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, styles.timeText, { color: colors.text }]}>
              {extractDaysOfWeek() ? `${extractDaysOfWeek()} • ` : ''}{formatTime()}
            </Text>
          </View>
        )}

        {/* Days of Week (only shown if no time info) */}
        {extractDaysOfWeek() && !formatTime() && (
          <View style={[styles.infoRow, styles.daysRow]}>
            <Icon name="calendar-week" size={16} color={Colors.primary} />
            <Text style={[styles.infoText, styles.daysText, { color: Colors.primary }]}>
              {extractDaysOfWeek()}
            </Text>
          </View>
        )}

        {/* Age Range */}
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

        {/* Spots Available */}
        {activity.spotsAvailable !== null && activity.spotsAvailable !== undefined && (
          <View style={styles.spotsContainer}>
            {activity.spotsAvailable === 0 ? (
              <View style={styles.fullBadge}>
                <Text style={styles.fullText}>FULL</Text>
              </View>
            ) : activity.spotsAvailable <= 5 ? (
              <View style={styles.limitedBadge}>
                <Icon name="alert-circle" size={14} color={Colors.warning} />
                <Text style={styles.limitedText}>
                  Only {activity.spotsAvailable} {activity.spotsAvailable === 1 ? 'spot' : 'spots'} left!
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
        )}
      </View>

      {/* Great For Section - shows which children this activity suits */}
      {matchingChildren.length > 0 && (
        <View style={[styles.greatForSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.greatForLabel, { color: colors.textSecondary }]}>Great for:</Text>
          <View style={styles.greatForChildren}>
            {matchingChildren.map(child => {
              const color = getChildColor(child.colorId);
              return (
                <View
                  key={child.id}
                  style={[styles.greatForBadge, { backgroundColor: color.hex + '25', borderColor: color.hex }]}
                >
                  <ChildAvatar child={child} size={20} showBorder={false} />
                  <Text style={[styles.greatForName, { color: color.hex }]}>{child.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Why This Is Great Section */}
      {showExplanation && recommendation.why && recommendation.why.length > 0 && (
        <View style={[styles.whySection, { borderTopColor: colors.border, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#F0FDF4' }]}>
          <View style={styles.whyHeader}>
            <Icon name="heart-outline" size={16} color="#10B981" />
            <Text style={[styles.whyTitle, { color: '#10B981' }]}>
              Great for your child:
            </Text>
          </View>
          {recommendation.why.slice(0, 3).map((reason, index) => (
            <View key={index} style={styles.whyItem}>
              <Icon name="check-circle" size={14} color="#10B981" />
              <Text style={[styles.whyText, { color: colors.text }]}>
                {reason}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Warnings */}
      {recommendation.warnings && recommendation.warnings.length > 0 && (
        <View style={[styles.warningsSection, { borderTopColor: colors.border, backgroundColor: '#FEF3C7' }]}>
          {recommendation.warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Icon name="alert-circle" size={14} color="#F59E0B" />
              <Text style={styles.warningText}>
                {warning}
              </Text>
            </View>
          ))}
        </View>
      )}
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
    height: 180,
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
  rankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 1,
  },
  rankText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 12,
    left: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  sponsoredText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '600',
  },
  fitBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  fitText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.white,
    opacity: 0.9,
  },
  content: {
    padding: Theme.spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 24,
  },
  provider: {
    fontSize: 13,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  dateRow: {
    backgroundColor: Colors.secondary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginHorizontal: -4,
    marginBottom: 8,
  },
  dateText: {
    fontWeight: '600',
    fontSize: 13,
  },
  timeRow: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginHorizontal: -4,
    marginBottom: 8,
  },
  timeText: {
    fontWeight: '600',
    fontSize: 13,
    color: Colors.primary,
  },
  daysRow: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginHorizontal: -4,
    marginBottom: 8,
  },
  daysText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  spotsContainer: {
    marginTop: 8,
  },
  fullBadge: {
    backgroundColor: Colors.error + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  limitedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  availableText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.success,
  },
  greatForSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  greatForLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  greatForChildren: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  greatForBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  greatForName: {
    fontSize: 12,
    fontWeight: '600',
  },
  whySection: {
    padding: 12,
    borderTopWidth: 1,
  },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  whyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  whyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  whyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  warningsSection: {
    padding: 12,
    borderTopWidth: 1,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#92400E',
  },
});

export default AIRecommendationCard;
