/**
 * GradientIcon - Icon with gradient fill using MaskedView
 *
 * Used for activity card icons when an activity is assigned to multiple children.
 * Shows a diagonal gradient blending the first two children's colors.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface GradientIconProps {
  /** Icon name from MaterialCommunityIcons */
  name: string;
  /** Icon size in pixels */
  size: number;
  /** Array of gradient colors (min 2) */
  colors: string[];
  /** Optional style for the container */
  style?: any;
}

/**
 * Renders an icon with a gradient fill
 * Uses MaskedView to apply gradient colors to the icon shape
 */
export const GradientIcon: React.FC<GradientIconProps> = ({
  name,
  size,
  colors,
  style,
}) => {
  // Ensure we have at least 2 colors for gradient
  const gradientColors = colors.length >= 2
    ? colors
    : [colors[0] || '#FFFFFF', colors[0] || '#FFFFFF'];

  return (
    <View style={[{ width: size, height: size }, style]}>
      <MaskedView
        style={styles.maskedView}
        maskElement={
          <View style={styles.maskContainer}>
            <Icon name={name} size={size} color="#000" />
          </View>
        }
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size }}
        />
      </MaskedView>
    </View>
  );
};

const styles = StyleSheet.create({
  maskedView: {
    flex: 1,
  },
  maskContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

export default GradientIcon;
