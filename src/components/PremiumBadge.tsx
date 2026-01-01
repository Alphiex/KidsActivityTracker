/**
 * PremiumBadge - Small badge to indicate premium-only features
 * Use next to feature labels or buttons that require premium
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

interface PremiumBadgeProps {
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show crown icon */
  showIcon?: boolean;
  /** Whether tapping navigates to paywall */
  interactive?: boolean;
  /** Custom text (default: "PREMIUM") */
  text?: string;
  /** Custom style */
  style?: object;
}

const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  size = 'small',
  showIcon = true,
  interactive = true,
  text = 'PREMIUM',
  style,
}) => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const handlePress = () => {
    if (interactive) {
      navigation.navigate('Paywall');
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'large':
        return {
          container: styles.containerLarge,
          text: styles.textLarge,
          iconSize: 14,
        };
      case 'medium':
        return {
          container: styles.containerMedium,
          text: styles.textMedium,
          iconSize: 12,
        };
      default:
        return {
          container: styles.containerSmall,
          text: styles.textSmall,
          iconSize: 10,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const content = (
    <View
      style={[
        styles.container,
        sizeStyles.container,
        { backgroundColor: colors.warning },
        style,
      ]}
    >
      {showIcon && (
        <Icon
          name="crown"
          size={sizeStyles.iconSize}
          color="#fff"
          style={styles.icon}
        />
      )}
      <Text style={[styles.text, sizeStyles.text]}>{text}</Text>
    </View>
  );

  if (interactive) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

/**
 * LockedFeature - A wrapper component for features that are locked behind premium
 * Shows the feature name with a lock icon and premium badge
 */
export interface LockedFeatureProps {
  label: string;
  description?: string;
  onPress?: () => void;
}

export const LockedFeature: React.FC<LockedFeatureProps> = ({ label, description, onPress }) => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Paywall');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.lockedContainer, { backgroundColor: colors.surfaceVariant }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.lockedContent}>
        <Icon name="lock" size={18} color={colors.textSecondary} />
        <View style={styles.lockedTextContainer}>
          <Text style={[styles.lockedLabel, { color: colors.textSecondary }]}>{label}</Text>
          {description && (
            <Text style={[styles.lockedDescription, { color: colors.textSecondary }]}>{description}</Text>
          )}
        </View>
      </View>
      <PremiumBadge size="small" interactive={false} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
  },
  containerSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  containerMedium: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  containerLarge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  icon: {
    marginRight: 3,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textSmall: {
    fontSize: 9,
  },
  textMedium: {
    fontSize: 11,
  },
  textLarge: {
    fontSize: 13,
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    opacity: 0.8,
  },
  lockedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lockedTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  lockedLabel: {
    fontSize: 15,
  },
  lockedDescription: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
});

export default PremiumBadge;
