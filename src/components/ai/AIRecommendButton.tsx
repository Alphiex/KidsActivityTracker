import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  View 
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

interface AIRecommendButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'compact' | 'outline';
  label?: string;
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
  label = 'Find Best for Me'
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
  
  // Primary variant with gradient
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={['#8B5CF6', '#6366F1']}
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
    shadowColor: '#8B5CF6',
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
});

export default AIRecommendButton;
