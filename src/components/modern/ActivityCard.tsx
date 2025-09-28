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

const { width } = Dimensions.get('window');

interface ActivityCardProps {
  activity: {
    id: string;
    name: string;
    location?: string;
    locationName?: string;
    price?: number;
    cost?: number;
    rating?: number;
    image?: string;
    category?: string;
    isNew?: boolean;
    spotsAvailable?: number;
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
    schedule?: string | {
      startTime?: string;
      endTime?: string;
      days?: string[];
    };
    registrationStatus?: string;
  };
  onPress?: () => void;
  variant?: 'default' | 'compact' | 'full';
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onPress,
  variant = 'default',
}) => {
  const price = activity.price ?? activity.cost ?? 0;
  const location = activity.locationName || activity.location || 'Location TBA';
  const isAvailable = activity.registrationStatus !== 'Closed' && 
                     activity.registrationStatus !== 'Waitlist' &&
                     (activity.spotsAvailable === undefined || activity.spotsAvailable > 0);

  const getAgeRange = () => {
    if (activity.ageMin !== undefined && activity.ageMax !== undefined) {
      return `Ages ${activity.ageMin}-${activity.ageMax}`;
    }
    return null;
  };

  const getTimeInfo = () => {
    // Check for direct startTime/endTime fields first (from API)
    if (activity.startTime || activity.endTime) {
      const dayPrefix = activity.schedule && typeof activity.schedule === 'string' ? `${activity.schedule} • ` : '';
      return `${dayPrefix}${activity.startTime || ''}${activity.startTime && activity.endTime ? ' - ' : ''}${activity.endTime || ''}`;
    }

    // Check for sessions
    if (activity.sessions && activity.sessions.length > 0) {
      const session = activity.sessions[0];
      if (session.startTime) {
        return `${session.startTime}${session.endTime ? ' - ' + session.endTime : ''}`;
      }
    }

    // Check for schedule object
    if (activity.schedule && typeof activity.schedule === 'object') {
      if (activity.schedule.startTime) {
        return `${activity.schedule.startTime}${activity.schedule.endTime ? ' - ' + activity.schedule.endTime : ''}`;
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
      return <Badge variant="warning" size="sm">{activity.spotsAvailable} spots left</Badge>;
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
        {activity.image ? (
          <Image source={{ uri: activity.image }} style={styles.image} />
        ) : (
          <LinearGradient
            colors={ModernColors.categoryGradients.new}
            style={styles.imagePlaceholder}
          >
            <Icon name="image-outline" size={40} color={ModernColors.textOnPrimary} />
          </LinearGradient>
        )}
        <View style={styles.badgeContainer}>
          {getStatusBadge()}
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{activity.name}</Text>
        
        <View style={styles.detailRow}>
          <Icon name="map-marker" size={16} color={ModernColors.textMuted} />
          <Text style={styles.location} numberOfLines={1}>{location}</Text>
        </View>

        {getTimeInfo() && (
          <View style={styles.detailRow}>
            <Icon name="clock-outline" size={16} color={ModernColors.textMuted} />
            <Text style={styles.timeText}>{getTimeInfo()}</Text>
          </View>
        )}

        {getAgeRange() && (
          <View style={styles.detailRow}>
            <Icon name="account-child" size={16} color={ModernColors.textMuted} />
            <Text style={styles.location}>{getAgeRange()}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[styles.price, !isAvailable && styles.priceUnavailable]}>
            ${price.toFixed(2)}
          </Text>
          {activity.rating && (
            <View style={styles.rating}>
              <Icon name="star" size={16} color={ModernColors.warning} />
              <Text style={styles.ratingText}>{activity.rating}</Text>
            </View>
          )}
        </View>
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
  timeText: {
    fontSize: ModernTypography.sizes.sm,
    fontWeight: ModernTypography.weights.semibold as any,
    color: ModernColors.accent,
    marginLeft: ModernSpacing.xs,
    flex: 1,
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