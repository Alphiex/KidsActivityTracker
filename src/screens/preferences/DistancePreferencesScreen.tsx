import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../../services/preferencesService';
import { useTheme } from '../../contexts/ThemeContext';
import {
  locationService,
  RADIUS_OPTIONS,
  RadiusOption,
  LocationPermissionStatus
} from '../../services/locationService';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { EnhancedAddress } from '../../types/preferences';

const DistancePreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();

  const [distanceEnabled, setDistanceEnabled] = useState(currentPreferences.distanceFilterEnabled);
  const [selectedRadius, setSelectedRadius] = useState<RadiusOption>(
    (currentPreferences.distanceRadiusKm as RadiusOption) || 25
  );
  const [locationSource, setLocationSource] = useState<'gps' | 'saved_address'>(
    currentPreferences.locationSource || 'gps'
  );
  const [selectedAddress, setSelectedAddress] = useState<EnhancedAddress | null>(
    locationService.getEnhancedAddress()
  );
  const [locationStatus, setLocationStatus] = useState<LocationPermissionStatus>('unavailable');
  const [checkingLocation, setCheckingLocation] = useState(false);

  useEffect(() => {
    checkLocationStatus();
  }, []);

  const checkLocationStatus = async () => {
    setCheckingLocation(true);
    try {
      const status = await locationService.checkPermission();
      setLocationStatus(status);
    } catch (error) {
      console.error('[DistancePreferences] Error checking location:', error);
    } finally {
      setCheckingLocation(false);
    }
  };

  const handleRequestPermission = async () => {
    setCheckingLocation(true);
    try {
      const status = await locationService.requestPermission();
      setLocationStatus(status);
      if (status === 'blocked') {
        locationService.showPermissionBlockedAlert();
      } else if (status === 'granted') {
        setLocationSource('gps');
      }
    } catch (error) {
      console.error('[DistancePreferences] Error requesting permission:', error);
    } finally {
      setCheckingLocation(false);
    }
  };

  const handleAddressSelect = async (address: EnhancedAddress | null) => {
    setSelectedAddress(address);
    if (address) {
      // Save the address immediately when selected
      await locationService.saveEnhancedAddress(address);
      setLocationSource('saved_address');
    }
  };

  const handleSave = () => {
    preferencesService.updatePreferences({
      distanceFilterEnabled: distanceEnabled,
      distanceRadiusKm: selectedRadius,
      locationSource: locationSource,
    });
    navigation.goBack();
  };

  const savedAddress = locationService.getSavedAddress();
  const canUseGPS = locationStatus === 'granted';
  const hasSavedAddress = !!savedAddress;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Distance Settings
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Filter activities by distance from your location. Only activities within your
          selected radius will appear in search results.
        </Text>

        {/* Enable/Disable Toggle */}
        <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleContent}>
            <Icon name="map-marker-radius" size={28} color={colors.primary} />
            <View style={styles.toggleTextContainer}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Distance Filtering
              </Text>
              <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                Show only nearby activities
              </Text>
            </View>
          </View>
          <Switch
            value={distanceEnabled}
            onValueChange={setDistanceEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={distanceEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>

        {distanceEnabled && (
          <>
            {/* Radius Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Search Radius
              </Text>
              <View style={styles.radiusContainer}>
                {RADIUS_OPTIONS.map((radius) => {
                  const isSelected = selectedRadius === radius;
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
                      onPress={() => setSelectedRadius(radius)}
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

            {/* Location Source */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Location Source
              </Text>

              {/* GPS Option */}
              <TouchableOpacity
                style={[
                  styles.sourceOption,
                  {
                    backgroundColor: locationSource === 'gps' ? colors.primary + '10' : colors.surface,
                    borderColor: locationSource === 'gps' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  if (canUseGPS) {
                    setLocationSource('gps');
                  } else {
                    handleRequestPermission();
                  }
                }}
              >
                <View style={styles.sourceContent}>
                  <Icon
                    name="crosshairs-gps"
                    size={24}
                    color={locationSource === 'gps' ? colors.primary : colors.text}
                  />
                  <View style={styles.sourceTextContainer}>
                    <Text
                      style={[
                        styles.sourceLabel,
                        { color: locationSource === 'gps' ? colors.primary : colors.text },
                      ]}
                    >
                      Use GPS Location
                    </Text>
                    <Text style={[styles.sourceSubtitle, { color: colors.textSecondary }]}>
                      {checkingLocation
                        ? 'Checking...'
                        : canUseGPS
                          ? 'Location access granted'
                          : locationStatus === 'blocked'
                            ? 'Permission blocked - tap to open settings'
                            : 'Tap to enable location access'}
                    </Text>
                  </View>
                </View>
                <Icon
                  name={locationSource === 'gps' ? 'radiobox-marked' : 'radiobox-blank'}
                  size={24}
                  color={locationSource === 'gps' ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Saved Address Option */}
              <TouchableOpacity
                style={[
                  styles.sourceOption,
                  {
                    backgroundColor: locationSource === 'saved_address' ? colors.primary + '10' : colors.surface,
                    borderColor: locationSource === 'saved_address' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setLocationSource('saved_address')}
              >
                <View style={styles.sourceContent}>
                  <Icon
                    name="home-map-marker"
                    size={24}
                    color={locationSource === 'saved_address' ? colors.primary : colors.text}
                  />
                  <View style={styles.sourceTextContainer}>
                    <Text
                      style={[
                        styles.sourceLabel,
                        { color: locationSource === 'saved_address' ? colors.primary : colors.text },
                      ]}
                    >
                      Use Saved Address
                    </Text>
                    <Text style={[styles.sourceSubtitle, { color: colors.textSecondary }]}>
                      {hasSavedAddress
                        ? savedAddress.address.substring(0, 40) + (savedAddress.address.length > 40 ? '...' : '')
                        : 'Enter your address below'}
                    </Text>
                  </View>
                </View>
                <Icon
                  name={locationSource === 'saved_address' ? 'radiobox-marked' : 'radiobox-blank'}
                  size={24}
                  color={locationSource === 'saved_address' ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Address Autocomplete */}
              {locationSource === 'saved_address' && (
                <View style={[styles.addressContainer, { borderColor: colors.border }]}>
                  <AddressAutocomplete
                    value={selectedAddress}
                    onAddressSelect={handleAddressSelect}
                    label="Your Address"
                    placeholder="Search for your address..."
                    country={['ca', 'us']}
                    showFallbackOption={true}
                  />
                  {selectedAddress?.city && (
                    <View style={styles.addressDetailsRow}>
                      <Icon name="map-marker" size={16} color={colors.textSecondary} />
                      <Text style={[styles.addressDetailsText, { color: colors.textSecondary }]}>
                        {[selectedAddress.city, selectedAddress.state, selectedAddress.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  radiusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  radiusButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
  },
  radiusButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  sourceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sourceTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  sourceLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  sourceSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  addressContainer: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
  },
  addressDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  addressDetailsText: {
    fontSize: 13,
  },
});

export default DistancePreferencesScreen;
