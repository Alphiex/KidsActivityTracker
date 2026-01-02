import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CHILD_COLORS, getChildColor } from '../../theme/childColors';

interface ColorPickerProps {
  selectedId: number;
  onSelect: (colorId: number) => void;
}

/**
 * Color picker grid component
 * Displays 10 pastel colors in a 2x5 grid for selection
 */
const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedId,
  onSelect,
}) => {
  const selectedColor = getChildColor(selectedId);

  const renderColor = useCallback((color: typeof CHILD_COLORS[0]) => {
    const isSelected = color.id === selectedId;

    return (
      <TouchableOpacity
        key={color.id}
        style={[
          styles.colorItem,
          isSelected && styles.colorItemSelected,
        ]}
        onPress={() => onSelect(color.id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.colorCircle,
          { backgroundColor: color.hex },
          isSelected && styles.colorCircleSelected,
        ]}>
          {isSelected && (
            <Icon name="check" size={20} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selectedId, onSelect]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Pick a Color</Text>
      <View style={styles.grid}>
        {CHILD_COLORS.map(renderColor)}
      </View>
      <Text style={[styles.selectedLabel, { color: selectedColor.hex }]}>
        {selectedColor.name}
      </Text>
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
    gap: 12,
  },
  colorItem: {
    width: '18%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorItemSelected: {
    transform: [{ scale: 1.1 }],
  },
  colorCircle: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default ColorPicker;
