import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { EnhancedAddress } from '../../types/preferences';

export interface ChildLocationData {
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
  // Filter siblings that have a valid location with coordinates
  const siblingsWithLocation = siblings.filter(
    s => s.savedAddress?.latitude && s.savedAddress?.longitude
  );

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
    // Only use sibling's savedAddress if it has valid coordinates
    if (sibling.savedAddress &&
        sibling.savedAddress.latitude &&
        sibling.savedAddress.longitude &&
        sibling.savedAddress.latitude !== 0 &&
        sibling.savedAddress.longitude !== 0) {
      onChange({
        ...data,
        savedAddress: sibling.savedAddress,
      });
    } else {
      Alert.alert(
        'No Address Available',
        `${sibling.name}'s location doesn't have a saved address. Please enter an address manually.`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          Enter the location where {childName} will do activities (home, school, etc.)
        </Text>
      </View>

      {/* Copy from sibling option */}
      {siblingsWithLocation.length > 0 && (
        <View style={styles.siblingSection}>
          <Text style={styles.siblingLabel}>Use same location as:</Text>
          <View style={styles.siblingOptions}>
            {siblingsWithLocation.map((sibling) => (
              <TouchableOpacity
                key={sibling.id}
                style={styles.siblingChip}
                onPress={() => handleCopySiblingLocation(sibling)}
                activeOpacity={0.7}
              >
                <Icon name="account-child" size={18} color="#E8638B" />
                <Text style={styles.siblingChipText}>{sibling.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Address Autocomplete */}
      <View style={styles.addressSection}>
        <AddressAutocomplete
          value={data.savedAddress}
          onAddressSelect={handleAddressSelect}
          placeholder="Search for an address..."
          country={['ca', 'us']}
          showFallbackOption={true}
          onFocus={onScrollToAddress}
        />
      </View>

      {/* Distance selector - only show when address is set */}
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
  addressSection: {
    marginBottom: 12,
    zIndex: 1000,
  },
  distanceSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
