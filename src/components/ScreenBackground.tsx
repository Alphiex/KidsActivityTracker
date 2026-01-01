import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Reusable screen background with subtle pink-to-blue gradient
 * Use this as the main container for screen content
 */
const ScreenBackground: React.FC<ScreenBackgroundProps> = ({ children, style }) => {
  return (
    <LinearGradient
      colors={['#FFFFFF', '#FFF5F8', '#FFE5EC', '#E8F4FF']}
      locations={[0, 0.3, 0.6, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ScreenBackground;
