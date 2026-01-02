import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { EnhancedAddress } from '../../types/preferences';
import { locationService } from '../../services/locationService';

export type LocationSource = 'gps' | 'saved_address';

export interface ChildLocationData {
  locationSource: LocationSource;
  savedAddress: EnhancedAddress | null;
  distanceRadiusKm: number;
}

export interface SiblingWithLocation {
  id: string;
  name: string;
  location?: string;
  savedAddress?: EnhancedAddress | null;
}

interface ChildLocationStepProps {
  childName: string;
  data: ChildLocationData;
  onChange: (data: ChildLocationData) => void;
  onScrollToAddress?: () => void;
  siblings?: SiblingWithLocation[];
}

const DISTANCE_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
];

const ChildLocationStep: React.FC<ChildLocationStepProps> = ({
  childName,
  data,
  onChange,
  onScrollToAddress,
  siblings = [],
}) => {
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(data.locationSource === 'gps');

  // Filter siblings that have a location
  const siblingsWithLocation = siblings.filter(s => s.location || s.savedAddress);

  const handleSelectGps = async () => {
    setIsGpsLoading(true);
    try {
      const status = await locationService.requestPermission();

      if (status === 'granted') {
        onChange({
          ...data,
          locationSource: 'gps',
          savedAddress: null, // Clear saved address when switching to GPS
        });
        setGpsEnabled(true);
      } else if (status === 'blocked') {
        locationService.showPermissionBlockedAlert();
        setGpsEnabled(false);
      } else {
        Alert.alert(
          'Location Not Available',
          'Location permission was not granted. You can enter an address instead.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[ChildLocationStep] Error requesting GPS:', error);
      Alert.alert('Error', 'Could not access location. Please try entering an address instead.');
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleSelectAddress = () => {
    onChange({
      ...data,
      locationSource: 'saved_address',
    });
    setGpsEnabled(false);
  };

  const handleAddressSelect = (address: EnhancedAddress | null) => {
    onChange({
      ...data,
      savedAddress: address,
    });
  };

  const handleDistanceChange = (distance: number) => {
    onChange({
      ...data,
      distanceRadiusKm: distance,
    });
  };

  const handleCopySiblingLocation = (sibling: SiblingWithLocation) => {
    const address: EnhancedAddress = sibling.savedAddress || {
      formattedAddress: sibling.location || '',
      city: sibling.location || '',
      latitude: 0,
      longitude: 0,
      updatedAt: new Date().toISOString(),
    };
    onChange({
      ...data,
      locationSource: 'saved_address',
      savedAddress: address,
    });
    setGpsEnabled(false);
  };

  const isGpsSelected = data.locationSource === 'gps';
  const isAddressSelected = data.locationSource === 'saved_address';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          We'll show activities near this location for {childName}
        </Text>
      </View>

      {/* Copy from sibling option */}
      {siblingsWithLocation.length > 0 && (
        <View style={styles.siblingSection}>
          <Text style={styles.siblingLabel}>Copy from another child:</Text>
          <View style={styles.siblingOptions}>
            {siblingsWithLocation.map((sibling) => (
              <TouchableOpacity
                key={sibling.id}
                style={styles.siblingChip}
                onPress={() => handleCopySiblingLocation(sibling)}
                activeOpacity={0.7}
              >
                <Icon name="account-child" size={18} color="#E8638B" />
                <Text style={styles.siblingChipText}>{sibling.name}'s location</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* GPS Option */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          isGpsSelected && gpsEnabled && styles.optionCardSelected,
        ]}
        onPress={handleSelectGps}
        activeOpacity={0.7}
        disabled={isGpsLoading}
      >
        <View style={[styles.iconContainer, isGpsSelected && gpsEnabled && styles.iconContainerSelected]}>
          {isGpsLoading ? (
            <ActivityIndicator size="small" color={isGpsSelected && gpsEnabled ? '#FFFFFF' : '#E8638B'} />
          ) : (
            <Icon
              name="crosshairs-gps"
              size={28}
              color={isGpsSelected && gpsEnabled ? '#FFFFFF' : '#E8638B'}
            />
          )}
        </View>
        <View style={styles.optionText}>
          <Text style={[styles.optionTitle, isGpsSelected && gpsEnabled && styles.optionTitleSelected]}>
            Use my location
          </Text>
          <Text style={styles.optionDescription}>
            Allow GPS access for automatic location
          </Text>
        </View>
        {isGpsSelected && gpsEnabled && (
          <View style={styles.optionCheckmark}>
            <Icon name="check" size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Distance selector - only show when GPS is enabled */}
      {isGpsSelected && gpsEnabled && (
        <View style={styles.distanceSection}>
          <Text style={styles.distanceLabel}>Show activities within:</Text>
          <View style={styles.distanceOptions}>
            {DISTANCE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.distanceChip,
                  data.distanceRadiusKm === option.value && styles.distanceChipSelected,
                ]}
                onPress={() => handleDistanceChange(option.value)}
              >
                <Text
                  style={[
                    styles.distanceChipText,
                    data.distanceRadiusKm === option.value && styles.distanceChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Address Option */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          isAddressSelected && styles.optionCardSelected,
        ]}
        onPress={handleSelectAddress}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, isAddressSelected && styles.iconContainerSelected]}>
          <Icon
            name="home-map-marker"
            size={28}
            color={isAddressSelected ? '#FFFFFF' : '#E8638B'}
          />
        </View>
        <View style={styles.optionText}>
          <Text style={[styles.optionTitle, isAddressSelected && styles.optionTitleSelected]}>
            Enter an address
          </Text>
          <Text style={styles.optionDescription}>
            Search for your home or school address
          </Text>
        </View>
        {isAddressSelected && data.savedAddress && (
          <View style={styles.optionCheckmark}>
            <Icon name="check" size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Address Autocomplete - only show when address mode is selected */}
      {isAddressSelected && (
        <View style={styles.addressSection}>
          <AddressAutocomplete
            value={data.savedAddress}
            onAddressSelect={handleAddressSelect}
            placeholder="Start typing an address..."
            country={['ca', 'us']}
            showFallbackOption={true}
            onFocus={onScrollToAddress}
          />

          {data.savedAddress && (
            <View style={styles.distanceSection}>
              <Text style={styles.distanceLabel}>Show activities within:</Text>
              <View style={styles.distanceOptions}>
                {DISTANCE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.distanceChip,
                      data.distanceRadiusKm === option.value && styles.distanceChipSelected,
                    ]}
                    onPress={() => handleDistanceChange(option.value)}
                  >
                    <Text
                      style={[
                        styles.distanceChipText,
                        data.distanceRadiusKm === option.value && styles.distanceChipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Icon name="information-outline" size={20} color="#6B7280" />
        <Text style={styles.infoText}>
          Different children can have different locations (e.g., home vs. school).
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#E8638B',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: '#E8638B',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#E8638B',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  optionCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8638B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  addressSection: {
    marginBottom: 12,
    marginTop: 4,
    zIndex: 1000,
  },
  distanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  distanceChipSelected: {
    backgroundColor: '#E8638B',
    borderColor: '#E8638B',
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  distanceChipTextSelected: {
    color: '#FFFFFF',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  siblingSection: {
    marginBottom: 16,
  },
  siblingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 10,
  },
  siblingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  siblingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  siblingChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E8638B',
  },
});

export default ChildLocationStep;
