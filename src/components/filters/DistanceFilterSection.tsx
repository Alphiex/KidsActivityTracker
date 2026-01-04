import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { locationService, RADIUS_OPTIONS, RadiusOption, LocationPermissionStatus } from '../../services/locationService';
import { UserPreferences } from '../../types/preferences';

interface DistanceFilterSectionProps {
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onConfigurePress?: () => void;
}

const DistanceFilterSection: React.FC<DistanceFilterSectionProps> = ({
  preferences,
  onUpdatePreferences,
  onConfigurePress,
}) => {
  const { colors } = useTheme();
  const [locationStatus, setLocationStatus] = useState<LocationPermissionStatus>('unavailable');
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    checkLocationStatus();
  }, []);

  const checkLocationStatus = async () => {
    setCheckingLocation(true);
    try {
      const status = await locationService.checkPermission();
      setLocationStatus(status);
    } catch (error) {
      console.error('[DistanceFilter] Error checking location:', error);
    } finally {
      setCheckingLocation(false);
    }
  };

  const handleEnableToggle = async (enabled: boolean) => {
    if (enabled && locationStatus !== 'granted' && !preferences.savedAddress) {
      // Need to get permission or set address first
      const status = await locationService.requestPermission();
      setLocationStatus(status);

      if (status === 'granted') {
        onUpdatePreferences({
          distanceFilterEnabled: true,
          locationSource: 'gps',
        });
      } else if (status === 'blocked') {
        locationService.showPermissionBlockedAlert();
      } else {
        // Permission denied - show address input option
        setShowAddressInput(true);
      }
    } else {
      onUpdatePreferences({ distanceFilterEnabled: enabled });
    }
  };

  const handleRadiusSelect = (radius: RadiusOption) => {
    onUpdatePreferences({ distanceRadiusKm: radius });
  };

  const handleSaveAddress = async () => {
    if (!addressInput.trim()) return;

    setSavingAddress(true);
    try {
      const success = await locationService.geocodeAndSaveAddress(addressInput.trim());
      if (success) {
        onUpdatePreferences({
          distanceFilterEnabled: true,
          locationSource: 'saved_address',
        });
        setShowAddressInput(false);
        setAddressInput('');
      }
    } catch (error) {
      console.error('[DistanceFilter] Error saving address:', error);
    } finally {
      setSavingAddress(false);
    }
  };

  const savedAddress = locationService.getSavedAddress();
  const locationSourceLabel = preferences.locationSource === 'saved_address' && savedAddress
    ? `Using: ${savedAddress.address.substring(0, 30)}...`
    : locationStatus === 'granted'
      ? 'Using: GPS Location'
      : 'Location not available';

  return (
    <View style={styles.container}>
      {/* Enable/Disable Toggle */}
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={styles.rowLeft}>
          <Icon name="map-marker-radius" size={22} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Filter by Distance
          </Text>
        </View>
        <Switch
          value={preferences.distanceFilterEnabled}
          onValueChange={handleEnableToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={preferences.distanceFilterEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      {preferences.distanceFilterEnabled && (
        <>
          {/* Current Location Source */}
          <View style={[styles.statusRow, { backgroundColor: '#f5f5f5' }]}>
            <Icon
              name={preferences.locationSource === 'gps' ? 'crosshairs-gps' : 'home-map-marker'}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {locationSourceLabel}
            </Text>
            {onConfigurePress && (
              <TouchableOpacity onPress={onConfigurePress} style={styles.configureButton}>
                <Text style={[styles.configureText, { color: colors.primary }]}>Configure</Text>
                <Icon name="chevron-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Radius Selection */}
          <View style={styles.radiusContainer}>
            <Text style={[styles.radiusLabel, { color: colors.text }]}>
              Search Radius
            </Text>
            <View style={styles.radiusButtonsContainer}>
              {RADIUS_OPTIONS.map((radius) => {
                const isSelected = preferences.distanceRadiusKm === radius;
                return (
                  <TouchableOpacity
                    key={radius}
                    style={[
                      styles.radiusButton,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => handleRadiusSelect(radius)}
                  >
                    <Text
                      style={[
                        styles.radiusButtonText,
                        { color: isSelected ? '#fff' : colors.text },
                      ]}
                    >
                      {radius} km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* Address Input (when GPS not available) */}
      {showAddressInput && (
        <View style={[styles.addressContainer, { borderColor: colors.border }]}>
          <Text style={[styles.addressLabel, { color: colors.text }]}>
            Enter your address:
          </Text>
          <TextInput
            style={[
              styles.addressInput,
              {
                color: colors.text,
                backgroundColor: '#f5f5f5',
                borderColor: colors.border,
              },
            ]}
            placeholder="e.g., 123 Main St, Vancouver, BC"
            placeholderTextColor={colors.textSecondary}
            value={addressInput}
            onChangeText={setAddressInput}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <View style={styles.addressButtons}>
            <TouchableOpacity
              style={[styles.addressButton, { borderColor: colors.border }]}
              onPress={() => setShowAddressInput(false)}
            >
              <Text style={{ color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addressButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveAddress}
              disabled={savingAddress || !addressInput.trim()}
            >
              {savingAddress ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff' }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading indicator */}
      {checkingLocation && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Checking location...
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    flex: 1,
  },
  configureButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configureText: {
    fontSize: 13,
    fontWeight: '500',
  },
  radiusContainer: {
    marginTop: 16,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
  },
  radiusButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  radiusButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addressContainer: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  addressInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 15,
  },
  addressButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  addressButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
  },
});

export default DistanceFilterSection;
