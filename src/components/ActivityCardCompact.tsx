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
 * Compact activity card for AI chat responses
 * No image, no action buttons - just key info in a tappable card
 */
export const ActivityCardCompact: React.FC<ActivityCardCompactProps> = ({
  activity,
  onPress,
}) => {
  const { colors } = useTheme();

  // Format age range
  const getAgeText = () => {
    const minAge = activity.ageRange?.min ?? activity.ageMin;
    const maxAge = activity.ageRange?.max ?? activity.ageMax;

    if (minAge === undefined && maxAge === undefined) return null;
    if (minAge === null && maxAge === null) return null;

    const min = minAge ?? 0;
    const max = maxAge ?? 99;

    if (min <= 1 && max >= 90) return 'All ages';
    if (min === max) return `Age ${min}`;
    if (max >= 90) return `Ages ${min}+`;
    return `Ages ${min}-${max}`;
  };

  // Get location name
  const locationName = typeof activity.location === 'string'
    ? activity.location
    : activity.location?.name || activity.locationName || '';

  const ageText = getAgeText();
  const priceText = formatActivityPrice(activity.cost);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.cardBackground }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {activity.name}
        </Text>

        <View style={styles.detailsRow}>
          {locationName ? (
            <View style={styles.detailItem}>
              <Icon name="map-marker" size={12} color={Colors.primary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                {locationName}
              </Text>
            </View>
          ) : null}

          {priceText ? (
            <View style={styles.detailItem}>
              <Icon name="tag" size={12} color={Colors.primary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {priceText}
              </Text>
            </View>
          ) : null}

          {ageText ? (
            <View style={styles.detailItem}>
              <Icon name="account-child" size={12} color={Colors.primary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {ageText}
              </Text>
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
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
});

export default ActivityCardCompact;
