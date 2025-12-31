import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Activity } from '../../types';
import { Colors } from '../../theme';

interface ActivityMapMarkerProps {
  activity: Activity;
  onPress: () => void;
  isSelected?: boolean;
}

const ActivityMapMarker: React.FC<ActivityMapMarkerProps> = ({
  activity,
  onPress,
  isSelected = false,
}) => {
  const getMarkerColor = () => {
    if (activity.spotsAvailable === 0) return Colors.error;
    if (activity.spotsAvailable && activity.spotsAvailable <= 3) return Colors.warning;
    return Colors.primary;
  };

  const formatPrice = (cost: number | undefined) => {
    if (cost === undefined || cost === null) return '';
    if (cost === 0) return 'Free';
    return `$${cost}`;
  };

  if (!activity.latitude || !activity.longitude) {
    return null;
  }

  return (
    <Marker
      coordinate={{
        latitude: activity.latitude,
        longitude: activity.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={[
        styles.markerContainer,
        isSelected && styles.markerContainerSelected,
        { backgroundColor: getMarkerColor() }
      ]}>
        <Text style={styles.markerText} numberOfLines={1}>
          {formatPrice(activity.cost)}
        </Text>
      </View>
      <View style={[
        styles.markerArrow,
        { borderTopColor: getMarkerColor() }
      ]} />
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  markerContainerSelected: {
    transform: [{ scale: 1.2 }],
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },
});

export default ActivityMapMarker;
