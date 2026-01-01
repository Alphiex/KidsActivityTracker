import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { aiRobotImage } from '../../assets/images';

interface AIRecommendButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'compact' | 'outline' | 'featured';
  label?: string;
  subtitle?: string;
}

/**
 * Button to trigger AI recommendations
 * "Find Best for Me" - triggers AI-powered personalized recommendations
 */
const AIRecommendButton: React.FC<AIRecommendButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  label = 'Find Best for Me',
  subtitle,
}) => {
  const { colors } = useTheme();

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.compactButton,
          {
            backgroundColor: colors.primary + '15',
            opacity: disabled ? 0.5 : 1
          }
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="auto-fix" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.outlineButton,
          {
            borderColor: colors.primary,
            opacity: disabled ? 0.5 : 1
          }
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Icon name="auto-fix" size={18} color={colors.primary} />
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
              {label}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  // Featured variant with robot image overlay
  if (variant === 'featured') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.featuredContainer, { opacity: disabled ? 0.5 : 1 }]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#FFB5C5', '#E8638B', '#D53F8C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featuredButton}
        >
          <View style={styles.featuredContent}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.featuredLabel}>{label}</Text>
                {subtitle && (
                  <Text style={styles.featuredSubtitle}>{subtitle}</Text>
                )}
              </>
            )}
          </View>
        </LinearGradient>
        {/* Robot image overlapping outside the button */}
        <Image
          source={aiRobotImage}
          style={styles.robotImage}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  }

  // Primary variant with gradient
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={['#FFB5C5', '#E8638B', '#D53F8C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryButton}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Icon name="auto-fix" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  compactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Featured variant styles
  featuredContainer: {
    position: 'relative',
    marginRight: 40, // Space for robot overflow
    marginTop: 20, // Space for robot overflow at top
  },
  featuredButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingRight: 60, // Extra padding for robot area
    borderRadius: 16,
    minHeight: 72,
    justifyContent: 'center',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  featuredContent: {
    flex: 1,
  },
  featuredLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  featuredSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  robotImage: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 80,
    height: 80,
  },
});

export default AIRecommendButton;
