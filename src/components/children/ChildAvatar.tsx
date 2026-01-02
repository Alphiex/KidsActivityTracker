import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { safeInitials } from '../../utils/safeAccessors';
import { getChildAvatar, getChildColor } from '../../theme/childColors';
import { Child } from '../../store/slices/childrenSlice';

interface ChildAvatarProps {
  // Option 1: Pass full child object
  child?: Child;
  // Option 2: Pass individual props (for backwards compatibility)
  name?: string;
  avatarUrl?: string;
  avatarId?: number;
  colorId?: number;
  // Display options
  size?: number;
  showBorder?: boolean;
  borderWidth?: number;
  style?: ViewStyle;
}

/**
 * Child Avatar component
 *
 * Displays a child's avatar with optional colored border ring.
 * Supports bundled animal avatars, custom URL avatars, or initials fallback.
 */
const ChildAvatar: React.FC<ChildAvatarProps> = ({
  child,
  name: propName,
  avatarUrl: propAvatarUrl,
  avatarId: propAvatarId,
  colorId: propColorId,
  size = 50,
  showBorder = true,
  borderWidth: propBorderWidth,
  style,
}) => {
  // Extract values from child object or use direct props
  const name = child?.name || propName || '';
  const avatarUrl = child?.avatar || propAvatarUrl;
  const avatarId = child?.avatarId || propAvatarId;
  const colorId = child?.colorId || propColorId || 1;

  // Get color and avatar definitions
  const childColor = getChildColor(colorId);
  const childAvatar = avatarId ? getChildAvatar(avatarId) : null;

  // Calculate border width based on size
  const borderWidthValue = propBorderWidth ?? Math.max(2, size * 0.06);
  const innerSize = showBorder ? size - borderWidthValue * 2 - 4 : size;

  // Get initials for fallback
  const initials = safeInitials(name, '?');

  // Determine what to render inside the avatar
  const renderAvatarContent = () => {
    // Priority 1: Custom avatar URL (legacy support)
    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, { borderRadius: innerSize / 2 }]}
          resizeMode="cover"
        />
      );
    }

    // Priority 2: Bundled animal avatar
    if (childAvatar) {
      if (childAvatar.source) {
        return (
          <Image
            source={childAvatar.source}
            style={styles.avatarImage}
            resizeMode="contain"
          />
        );
      }
      // Use emoji fallback if no image source
      return (
        <Text style={[styles.emoji, { fontSize: innerSize * 0.5 }]}>
          {childAvatar.emoji}
        </Text>
      );
    }

    // Priority 3: Initials fallback
    return (
      <Text style={[styles.initials, { fontSize: innerSize * 0.4 }]}>
        {initials}
      </Text>
    );
  };

  // Background color for initials/emoji mode
  const getBackgroundColor = () => {
    if (avatarUrl) return '#f0f0f0';
    if (childAvatar) return '#F8F9FA';
    return childColor.hex + 'CC'; // 80% opacity for initials
  };

  if (showBorder) {
    return (
      <View
        style={[
          styles.borderContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: borderWidthValue,
            borderColor: childColor.hex,
          },
          style,
        ]}
      >
        <View
          style={[
            styles.innerContainer,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              backgroundColor: getBackgroundColor(),
            },
          ]}
        >
          {renderAvatarContent()}
        </View>
      </View>
    );
  }

  // No border version
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getBackgroundColor(),
        },
        style,
      ]}
    >
      {renderAvatarContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  borderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  innerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  avatarImage: {
    width: '75%',
    height: '75%',
  },
  emoji: {
    textAlign: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ChildAvatar;
