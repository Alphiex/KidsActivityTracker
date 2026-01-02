import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import axios from 'axios';
import PreferencesService from '../../services/preferencesService';
import { locationService } from '../../services/locationService';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { EnhancedAddress } from '../../types/preferences';
import { API_CONFIG } from '../../config/api';
import * as SecureStore from '../../utils/secureStorage';
import { useAppDispatch } from '../../store';
import { updateUserProfile } from '../../store/slices/authSlice';

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'OnboardingLocation'>;

type LocationMode = 'none' | 'gps' | 'address';

const distanceOptions = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
];

const OnboardingLocationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const preferencesService = PreferencesService.getInstance();

  const [locationMode, setLocationMode] = useState<LocationMode>('none');
  const [selectedDistance, setSelectedDistance] = useState<number>(25);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);

  // Address selection state
  const [selectedAddress, setSelectedAddress] = useState<EnhancedAddress | null>(null);


  const handleSelectGps = async () => {
    setIsGpsLoading(true);
    try {
      const status = await locationService.requestPermission();

      if (status === 'granted') {
        setLocationMode('gps');
        setGpsEnabled(true);
      } else if (status === 'blocked') {
        locationService.showPermissionBlockedAlert();
        setLocationMode('none');
        setGpsEnabled(false);
      } else {
        Alert.alert(
          'Location Not Available',
          'Location permission was not granted. You can select cities instead.',
          [
            { text: 'OK', onPress: () => setLocationMode('none') },
          ]
        );
      }
    } catch (error) {
      console.error('[OnboardingLocation] Error requesting GPS:', error);
      Alert.alert('Error', 'Could not access location. Please try again or select cities instead.');
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleSelectAddress = () => {
    setLocationMode('address');
    setGpsEnabled(false);
  };

  const handleAddressSelect = (address: EnhancedAddress | null) => {
    setSelectedAddress(address);
  };

  const handleNext = async () => {
    if (locationMode === 'gps') {
      await preferencesService.updatePreferences({
        distanceFilterEnabled: true,
        locationSource: 'gps',
        locationPermissionAsked: true,
        distanceRadiusKm: selectedDistance,
      });
    } else if (locationMode === 'address' && selectedAddress) {
      // Save the enhanced address and enable distance filtering
      await locationService.saveEnhancedAddress(selectedAddress);
      await preferencesService.updatePreferences({
        distanceFilterEnabled: true,
        locationSource: 'saved_address',
        locationPermissionAsked: true,
        distanceRadiusKm: selectedDistance,
        // Also set preferred location to city if available
        ...(selectedAddress.city && { preferredLocation: selectedAddress.city }),
      });

      // Also save to user's backend profile
      try {
        const token = await SecureStore.getAccessToken();
        if (token) {
          const displayLocation = selectedAddress.city || selectedAddress.formattedAddress;
          await axios.put(
            `${API_CONFIG.BASE_URL}/api/v1/users/profile`,
            { location: displayLocation },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          // Update Redux state
          dispatch(updateUserProfile({ location: displayLocation }));
          console.log('[OnboardingLocation] Saved location to user profile:', displayLocation);
        }
      } catch (error) {
        console.error('[OnboardingLocation] Error saving location to profile:', error);
        // Don't block navigation, just log the error
      }
    } else {
      await preferencesService.updatePreferences({
        locationPermissionAsked: true,
      });
    }
    navigation.navigate('OnboardingSubscription');
  };

  const handleSkip = async () => {
    await preferencesService.updatePreferences({
      locationPermissionAsked: true,
    });
    navigation.navigate('OnboardingSubscription');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepDot} />
            <View style={styles.stepDot} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>
          <Text style={styles.title}>Where would you like to find activities?</Text>
          <Text style={styles.subtitle}>
            Set your location to find activities nearby
          </Text>
        </View>

        <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        {/* GPS Option */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            locationMode === 'gps' && styles.optionCardSelected,
          ]}
          onPress={handleSelectGps}
          activeOpacity={0.7}
          disabled={isGpsLoading}
        >
          <View style={[styles.iconContainer, locationMode === 'gps' && styles.iconContainerSelected]}>
            {isGpsLoading ? (
              <ActivityIndicator size="small" color={locationMode === 'gps' ? '#FFFFFF' : '#E8638B'} />
            ) : (
              <Icon
                name="crosshairs-gps"
                size={28}
                color={locationMode === 'gps' ? '#FFFFFF' : '#E8638B'}
              />
            )}
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, locationMode === 'gps' && styles.optionTitleSelected]}>
              Use my location
            </Text>
            <Text style={styles.optionDescription}>
              Allow GPS access for automatic location
            </Text>
          </View>
          {locationMode === 'gps' && gpsEnabled && (
            <View style={styles.optionCheckmark}>
              <Icon name="check" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Distance selector - only show when GPS is enabled */}
        {locationMode === 'gps' && gpsEnabled && (
          <View style={styles.distanceSection}>
            <Text style={styles.distanceLabel}>Show activities within:</Text>
            <View style={styles.distanceOptions}>
              {distanceOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.distanceChip,
                    selectedDistance === option.value && styles.distanceChipSelected,
                  ]}
                  onPress={() => setSelectedDistance(option.value)}
                >
                  <Text
                    style={[
                      styles.distanceChipText,
                      selectedDistance === option.value && styles.distanceChipTextSelected,
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
            locationMode === 'address' && styles.optionCardSelected,
          ]}
          onPress={handleSelectAddress}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, locationMode === 'address' && styles.iconContainerSelected]}>
            <Icon
              name="home-map-marker"
              size={28}
              color={locationMode === 'address' ? '#FFFFFF' : '#E8638B'}
            />
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, locationMode === 'address' && styles.optionTitleSelected]}>
              Enter your address
            </Text>
            <Text style={styles.optionDescription}>
              Search for your home address
            </Text>
          </View>
          {locationMode === 'address' && selectedAddress && (
            <View style={styles.optionCheckmark}>
              <Icon name="check" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Address Autocomplete - only show when address mode is selected */}
        {locationMode === 'address' && (
          <View style={styles.addressSection}>
            <AddressAutocomplete
              value={selectedAddress}
              onAddressSelect={handleAddressSelect}
              placeholder="Start typing your address..."
              country={['ca', 'us']}
              showFallbackOption={true}
            />
            {selectedAddress && (
              <View style={styles.distanceSection}>
                <Text style={styles.distanceLabel}>Show activities within:</Text>
                <View style={styles.distanceOptions}>
                  {distanceOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.distanceChip,
                        selectedDistance === option.value && styles.distanceChipSelected,
                      ]}
                      onPress={() => setSelectedDistance(option.value)}
                    >
                      <Text
                        style={[
                          styles.distanceChipText,
                          selectedDistance === option.value && styles.distanceChipTextSelected,
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
            You can change this anytime in Settings.
          </Text>
        </View>
      </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#E8638B',
    width: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
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
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  nextButton: {
    backgroundColor: '#E8638B',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingLocationScreen;
