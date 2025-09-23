import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius } from '../../theme/modernTheme';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' | 'ghost';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  style,
  textStyle,
  icon,
}) => {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: { backgroundColor: ModernColors.primary },
          text: { color: ModernColors.textOnPrimary },
        };
      case 'secondary':
        return {
          container: { 
            backgroundColor: ModernColors.secondaryLight + '20',
            borderWidth: 1,
            borderColor: ModernColors.secondaryLight + '40',
          },
          text: { color: ModernColors.secondary },
        };
      case 'success':
        return {
          container: { backgroundColor: ModernColors.success },
          text: { color: ModernColors.textOnPrimary },
        };
      case 'warning':
        return {
          container: { backgroundColor: ModernColors.warning },
          text: { color: ModernColors.textOnPrimary },
        };
      case 'error':
        return {
          container: { backgroundColor: ModernColors.error },
          text: { color: ModernColors.textOnPrimary },
        };
      case 'outline':
        return {
          container: { 
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: ModernColors.border,
          },
          text: { color: ModernColors.text },
        };
      case 'ghost':
        return {
          container: { 
            backgroundColor: ModernColors.background,
            borderWidth: 1,
            borderColor: ModernColors.border,
          },
          text: { color: ModernColors.textSecondary },
        };
      default:
        return {
          container: { backgroundColor: ModernColors.primary },
          text: { color: ModernColors.textOnPrimary },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: { 
            paddingHorizontal: ModernSpacing.sm,
            paddingVertical: ModernSpacing.xs,
            borderRadius: ModernBorderRadius.md,
          },
          text: { fontSize: ModernTypography.sizes.xs },
        };
      case 'lg':
        return {
          container: { 
            paddingHorizontal: ModernSpacing.lg,
            paddingVertical: ModernSpacing.sm + 2,
            borderRadius: ModernBorderRadius.xl,
          },
          text: { fontSize: ModernTypography.sizes.base },
        };
      case 'md':
      default:
        return {
          container: { 
            paddingHorizontal: ModernSpacing.md,
            paddingVertical: ModernSpacing.sm,
            borderRadius: ModernBorderRadius.lg,
          },
          text: { fontSize: ModernTypography.sizes.sm },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle = [
    styles.container,
    variantStyles.container,
    sizeStyles.container,
    style,
  ];

  const textStyles = [
    styles.text,
    variantStyles.text,
    sizeStyles.text,
    textStyle,
  ];

  const content = (
    <>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      {typeof children === 'string' ? (
        <Text style={textStyles}>{children}</Text>
      ) : (
        children
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={containerStyle}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: ModernTypography.weights.medium as any,
  },
  iconContainer: {
    marginRight: ModernSpacing.xs,
  },
});

export default Badge;