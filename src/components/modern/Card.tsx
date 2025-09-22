import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ModernColors, ModernShadows, ModernBorderRadius, ModernSpacing } from '../../theme/modernTheme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  gradient?: string[];
  gradientColors?: string[];
  style?: StyleProp<ViewStyle>;
  shadow?: 'sm' | 'md' | 'lg' | 'xl';
  borderRadius?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  animated?: boolean;
  borderColor?: string;
  backgroundColor?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  onPress,
  gradient,
  gradientColors,
  style,
  shadow = 'md',
  borderRadius = 'lg',
  padding = 'md',
  animated = false,
  borderColor,
  backgroundColor = ModernColors.surface,
}) => {
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (animated && onPress) {
      Animated.spring(scaleValue, {
        toValue: 0.98,
        useNativeDriver: true,
        speed: 50,
        bounciness: 10,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (animated && onPress) {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 10,
      }).start();
    }
  };

  const paddingValue = padding === 'none' ? 0 : 
                       padding === 'sm' ? ModernSpacing.sm :
                       padding === 'lg' ? ModernSpacing.lg : ModernSpacing.md;

  const borderRadiusValue = ModernBorderRadius[borderRadius];

  const cardStyle = [
    styles.card,
    ModernShadows[shadow],
    {
      borderRadius: borderRadiusValue,
      backgroundColor: gradient || gradientColors ? 'transparent' : backgroundColor,
      borderColor: borderColor || ModernColors.border,
      borderWidth: borderColor ? 1 : 0,
    },
    style,
  ];

  const innerStyle = {
    padding: paddingValue,
    borderRadius: borderRadiusValue,
  };

  const content = gradient || gradientColors ? (
    <LinearGradient
      colors={gradientColors || gradient || ModernColors.primaryGradient}
      style={[innerStyle, { flex: 1 }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {children}
    </LinearGradient>
  ) : (
    <View style={innerStyle}>{children}</View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View 
          style={[
            cardStyle, 
            animated ? { transform: [{ scale: scaleValue }] } : {}
          ]}
        >
          {content}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: ModernColors.surface,
    overflow: 'hidden',
  },
});

export default Card;