import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Activity } from '../types';
import { Colors, Theme } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { formatActivityPrice } from '../utils/formatters';

interface ActivityCardCompactProps {
  activity: Activity;
  onPress?: () => void;
}

/**
 * Format days of week array to readable string
 */
const formatDaysOfWeek = (days: string[] | undefined): string => {
  if (!days || days.length === 0) return '';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes('Saturday') && !days.includes('Sunday')) {
    return 'Weekdays';
  }
  if (days.length === 2 && days.includes('Saturday') && days.includes('Sunday')) {
    return 'Weekends';
  }
  // Abbreviate day names
  const abbrev: Record<string, string> = {
    'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed',
    'Thursday': 'Thu', 'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
  };
  return days.map(d => abbrev[d] || d.substring(0, 3)).join(', ');
};

/**
 * Format time string (e.g., "09:00" or "9:00 AM")
 */
const formatTime = (time: string | undefined): string => {
  if (!time) return '';
  // If already formatted with AM/PM, return as is
  if (time.includes('AM') || time.includes('PM') || time.includes('am') || time.includes('pm')) {
    return time;
  }
  // Convert 24h to 12h format
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours)) return time;
  const period = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes?.toString().padStart(2, '0') || '00'} ${period}`;
};

/**
 * Format date to short format (e.g., "Jan 15")
 */
const formatShortDate = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

/**
 * Compact activity card for AI chat responses
 * Shows: Name, Location, Day/Time, Price, Start/End Dates
 *
 * Handles both standard Activity format AND AI search result format:
 * - Standard: cost, daysOfWeek, startTime, endTime, dateStart, dateEnd
 * - AI result: price, schedule (string), startDate, endDate, dates (string)
 */
export const ActivityCardCompact: React.FC<ActivityCardCompactProps> = ({
  activity,
  onPress,
}) => {
  const { colors } = useTheme();

  // Cast to any to handle AI result format which has different field names
  const act = activity as any;

  // Get location name - handle string or object
  const locationName = typeof act.location === 'string'
    ? act.location
    : act.location?.name || act.locationName || act.locationCity || '';

  // Format price - AI returns 'price', standard Activity has 'cost'
  const costValue = act.cost ?? act.price;
  const priceText = formatActivityPrice(costValue);

  // Format days and time
  // AI returns 'schedule' as formatted string like "Mon, Tue @ 9:00-10:00"
  // Standard Activity has daysOfWeek[], startTime, endTime
  let dayTimeText = '';
  if (act.schedule && typeof act.schedule === 'string') {
    // AI format - already formatted
    dayTimeText = act.schedule;
  } else {
    // Standard format - format from individual fields
    const daysText = formatDaysOfWeek(act.daysOfWeek);
    const startTimeText = formatTime(act.startTime);
    const endTimeText = formatTime(act.endTime);
    const timeText = startTimeText && endTimeText
      ? `${startTimeText} - ${endTimeText}`
      : startTimeText || '';
    dayTimeText = daysText && timeText
      ? `${daysText} • ${timeText}`
      : daysText || timeText;
  }

  // Format date range
  // AI returns 'startDate'/'endDate' (string) or 'dates' (formatted string)
  // Standard Activity has 'dateStart'/'dateEnd'
  let dateRangeText = '';
  if (act.dates && typeof act.dates === 'string' && act.dates !== 'Ongoing') {
    // AI format - already formatted like "Jan 15 - Feb 28, 2026"
    dateRangeText = act.dates;
  } else {
    // Standard format - format from individual fields
    const startDate = formatShortDate(act.dateStart || act.startDate);
    const endDate = formatShortDate(act.dateEnd || act.endDate);
    dateRangeText = startDate && endDate
      ? `${startDate} - ${endDate}`
      : startDate || endDate || '';
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.cardBackground }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Activity Name */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {act.name || 'Untitled Activity'}
        </Text>

        {/* Location */}
        {locationName ? (
          <View style={styles.detailRow}>
            <Icon name="map-marker" size={13} color={Colors.primary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
              {locationName}
            </Text>
          </View>
        ) : null}

        {/* Day of Week & Time */}
        {dayTimeText ? (
          <View style={styles.detailRow}>
            <Icon name="clock-outline" size={13} color={Colors.primary} />
            <Text style={[styles.dayTimeText, { color: Colors.primary }]} numberOfLines={1}>
              {dayTimeText}
            </Text>
          </View>
        ) : null}

        {/* Bottom row: Price and Date Range */}
        <View style={styles.bottomRow}>
          {/* Price Badge */}
          <View style={[
            styles.priceBadge,
            priceText === 'Free' ? styles.priceBadgeFree : styles.priceBadgePaid
          ]}>
            <Icon
              name="tag"
              size={11}
              color={priceText === 'Free' ? '#166534' : '#DC2626'}
            />
            <Text style={[
              styles.priceText,
              priceText === 'Free' ? styles.priceTextFree : styles.priceTextPaid
            ]}>
              {priceText || 'Price TBD'}
            </Text>
          </View>

          {/* Date Range */}
          {dateRangeText ? (
            <View style={styles.dateBadge}>
              <Icon name="calendar-range" size={11} color="#6B7280" />
              <Text style={styles.dateText}>{dateRangeText}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Icon name="chevron-right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    marginVertical: Theme.spacing.xs,
    ...Theme.shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  detailText: {
    fontSize: 12,
    flex: 1,
  },
  dayTimeText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priceBadgeFree: {
    backgroundColor: '#DCFCE7',
  },
  priceBadgePaid: {
    backgroundColor: '#FEE2E2',
  },
  priceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  priceTextFree: {
    color: '#166534',
  },
  priceTextPaid: {
    color: '#DC2626',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  dateText: {
    fontSize: 11,
    color: '#6B7280',
  },
});

export default ActivityCardCompact;
