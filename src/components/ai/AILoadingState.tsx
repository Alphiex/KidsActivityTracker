import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

interface AILoadingStateProps {
  message?: string;
}

/**
 * Loading state for AI operations
 * Shows an animated indicator while AI is processing
 */
const AILoadingState: React.FC<AILoadingStateProps> = ({ 
  message = 'Finding the best matches...' 
}) => {
  const { colors } = useTheme();
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Spinning animation for the icon
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    
    // Pulse animation for the container
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.iconContainer, 
          { 
            backgroundColor: colors.primary + '20',
            transform: [{ scale: pulseValue }]
          }
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Icon name="auto-fix" size={32} color={colors.primary} />
        </Animated.View>
      </Animated.View>
      
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        This may take a few seconds
      </Text>
      
      {/* Skeleton cards */}
      <View style={styles.skeletonContainer}>
        {[1, 2, 3].map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.skeletonCard, 
              { 
                backgroundColor: colors.surface,
                opacity: 1 - (index * 0.2)
              }
            ]}
          >
            <View style={[styles.skeletonImage, { backgroundColor: colors.border }]} />
            <View style={styles.skeletonContent}>
              <View style={[styles.skeletonTitle, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonText, { backgroundColor: colors.border }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    marginBottom: 32,
  },
  skeletonContainer: {
    width: '100%',
    gap: 12,
  },
  skeletonCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  skeletonImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  skeletonContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  skeletonTitle: {
    height: 16,
    borderRadius: 4,
    width: '70%',
  },
  skeletonText: {
    height: 12,
    borderRadius: 4,
    width: '50%',
  },
});

export default AILoadingState;
