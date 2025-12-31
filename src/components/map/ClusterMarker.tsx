import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Colors } from '../../theme';

interface ClusterMarkerProps {
  latitude: number;
  longitude: number;
  count: number;
  onPress: () => void;
  isSelected?: boolean;
}

/**
 * Cluster marker that shows the count of activities at a location
 * Similar to Airbnb's map markers showing property counts
 */
const ClusterMarker: React.FC<ClusterMarkerProps> = ({
  latitude,
  longitude,
  count,
  onPress,
  isSelected = false,
}) => {
  // Size scales with count
  const getSize = () => {
    if (count >= 20) return 56;
    if (count >= 10) return 48;
    if (count >= 5) return 42;
    return 36;
  };

  const size = getSize();

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        isSelected && styles.containerSelected,
      ]}>
        <Text style={[
          styles.countText,
          count >= 100 && styles.countTextSmall,
        ]}>
          {count >= 100 ? '99+' : count}
        </Text>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  containerSelected: {
    backgroundColor: '#222222',
    transform: [{ scale: 1.15 }],
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  countTextSmall: {
    fontSize: 12,
  },
});

export default ClusterMarker;
