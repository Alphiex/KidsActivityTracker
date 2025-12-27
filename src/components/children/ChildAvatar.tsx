import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { safeInitials } from '../../utils/safeAccessors';

interface ChildAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: number;
  style?: ViewStyle;
}

const ChildAvatar: React.FC<ChildAvatarProps> = ({
  name,
  avatarUrl,
  size = 50,
  style,
}) => {
  const initials = safeInitials(name, '?');

  const backgroundColor = getColorFromName(name);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarUrl ? '#f0f0f0' : backgroundColor,
        },
        style,
      ]}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, { borderRadius: size / 2 }]}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
          {initials}
        </Text>
      )}
    </View>
  );
};

// Helper function to generate consistent colors based on name
const getColorFromName = (name: string | undefined | null): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#48DBFB', '#FD79A8', '#A29BFE',
  ];

  // Handle undefined/null/empty names
  const safeName = name?.trim() || 'Unknown';

  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ChildAvatar;