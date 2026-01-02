import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { CHILD_AVATARS, getChildAvatar, getChildColor } from '../../theme/childColors';

interface AvatarPickerProps {
  selectedId: number;
  colorId?: number;           // Color to use for selected border
  onSelect: (avatarId: number) => void;
}

/**
 * Avatar picker grid component
 * Displays 10 cute animal avatars in a 2x5 grid for selection
 */
const AvatarPicker: React.FC<AvatarPickerProps> = ({
  selectedId,
  colorId = 1,
  onSelect,
}) => {
  const selectedColor = getChildColor(colorId);

  const renderAvatar = useCallback((avatar: typeof CHILD_AVATARS[0]) => {
    const isSelected = avatar.id === selectedId;

    return (
      <TouchableOpacity
        key={avatar.id}
        style={[
          styles.avatarItem,
          isSelected && [styles.avatarItemSelected, { borderColor: selectedColor.hex }],
        ]}
        onPress={() => onSelect(avatar.id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.avatarInner,
          isSelected && { backgroundColor: selectedColor.hex + '20' },
        ]}>
          {avatar.source ? (
            <Image source={avatar.source} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
          )}
        </View>
        <Text style={[
          styles.avatarName,
          isSelected && { color: selectedColor.hex, fontWeight: '600' },
        ]}>
          {avatar.name}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedId, selectedColor, onSelect]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Choose an Avatar</Text>
      <View style={styles.grid}>
        {CHILD_AVATARS.map(renderAvatar)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  avatarItem: {
    width: '18%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'transparent',
    padding: 4,
  },
  avatarItemSelected: {
    borderWidth: 3,
    backgroundColor: '#fff',
  },
  avatarInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  avatarName: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default AvatarPicker;
