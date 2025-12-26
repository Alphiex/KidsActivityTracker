import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LocationRowProps } from './types';
import HierarchicalCheckbox from './HierarchicalCheckbox';
import { styles } from './styles';

const LocationRow: React.FC<LocationRowProps> = ({
  location,
  isSelected,
  onToggle,
}) => {
  return (
    <TouchableOpacity style={styles.locationRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.locationCheckbox}>
        <HierarchicalCheckbox
          state={isSelected ? 'checked' : 'unchecked'}
          onPress={onToggle}
        />
      </View>
      <View style={styles.locationContent}>
        <Text style={styles.locationName} numberOfLines={2}>
          {location.name}
        </Text>
        <Text style={styles.locationMeta}>
          {location.activityCount} {location.activityCount === 1 ? 'activity' : 'activities'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(LocationRow);
