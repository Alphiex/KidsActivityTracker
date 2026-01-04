/**
 * LockedFeatureOverlay - Wraps premium features with a blur + lock overlay
 *
 * Shows content with a frosted glass overlay when locked, with:
 * - Semi-transparent white overlay
 * - Centered lock icon
 * - "PREMIUM" badge
 * - Tap to open paywall
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

interface LockedFeatureOverlayProps {
  /** Whether the feature is locked */
  isLocked: boolean;
  /** The content to wrap */
  children: React.ReactNode;
  /** Feature identifier for analytics */
  feature?: string;
  /** Title shown on the overlay */
  title?: string;
  /** Description shown on the overlay */
  description?: string;
  /** Custom onPress handler (defaults to opening Paywall) */
  onPress?: () => void;
  /** Style for the container */
  style?: object;
  /** Whether to show the PREMIUM badge */
  showBadge?: boolean;
  /** Whether to show the lock icon */
  showLockIcon?: boolean;
  /** Size variant */
  size?: 'compact' | 'normal' | 'large';
}

const LockedFeatureOverlay: React.FC<LockedFeatureOverlayProps> = ({
  isLocked,
  children,
  feature,
  title,
  description,
  onPress,
  style,
  showBadge = true,
  showLockIcon = true,
  size = 'normal',
}) => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Pulse animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Paywall', { feature });
    }
  };

  // If not locked, just render children
  if (!isLocked) {
    return <View style={style}>{children}</View>;
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'compact':
        return {
          iconSize: 28,
          titleSize: 14,
          descSize: 12,
          badgePadding: { paddingHorizontal: 8, paddingVertical: 3 },
        };
      case 'large':
        return {
          iconSize: 48,
          titleSize: 18,
          descSize: 14,
          badgePadding: { paddingHorizontal: 12, paddingVertical: 6 },
        };
      default:
        return {
          iconSize: 36,
          titleSize: 16,
          descSize: 13,
          badgePadding: { paddingHorizontal: 10, paddingVertical: 4 },
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const overlayColor = isDark
    ? 'rgba(30, 30, 30, 0.85)'
    : 'rgba(255, 255, 255, 0.88)';

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* Render the actual content */}
      <View style={styles.contentWrapper}>{children}</View>

      {/* Frosted glass overlay */}
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: overlayColor }]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* PREMIUM Badge in corner */}
        {showBadge && (
          <LinearGradient
            colors={['#FFB5C5', '#E8638B', '#D53F8C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.badge, sizeStyles.badgePadding]}
          >
            <Icon name="crown" size={12} color="#fff" style={styles.badgeIcon} />
            <Text style={styles.badgeText}>PREMIUM</Text>
          </LinearGradient>
        )}

        {/* Center content */}
        <View style={styles.centerContent}>
          {showLockIcon && (
            <View style={[styles.lockCircle, { backgroundColor: colors.primary + '15' }]}>
              <Icon
                name="lock"
                size={sizeStyles.iconSize}
                color={colors.primary}
              />
            </View>
          )}
          {title && (
            <Text
              style={[
                styles.title,
                { color: colors.text, fontSize: sizeStyles.titleSize },
              ]}
            >
              {title}
            </Text>
          )}
          {description && (
            <Text
              style={[
                styles.description,
                { color: colors.textSecondary, fontSize: sizeStyles.descSize },
              ]}
            >
              {description}
            </Text>
          )}
          <View style={[styles.unlockButton, { backgroundColor: colors.primary }]}>
            <Icon name="lock-open-outline" size={14} color="#fff" />
            <Text style={styles.unlockText}>Tap to Unlock</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * LockedFeatureSection - A simpler variant for section headers with lock
 */
interface LockedFeatureSectionProps {
  isLocked: boolean;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}

export const LockedFeatureSection: React.FC<LockedFeatureSectionProps> = ({
  isLocked,
  title,
  subtitle,
  onPress,
}) => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  if (!isLocked) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Paywall');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.sectionContainer, { backgroundColor: colors.surfaceVariant }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.sectionLeft}>
        <Icon name="lock" size={20} color={colors.primary} />
        <View style={styles.sectionText}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <LinearGradient
        colors={['#FFB5C5', '#E8638B', '#D53F8C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sectionBadge}
      >
        <Icon name="crown" size={10} color="#fff" style={styles.badgeIcon} />
        <Text style={styles.sectionBadgeText}>PREMIUM</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  contentWrapper: {
    opacity: 0.4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  unlockText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Section styles
  sectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 8,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionText: {
    marginLeft: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default LockedFeatureOverlay;
