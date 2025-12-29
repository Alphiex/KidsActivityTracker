import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PreferencesService from '../../services/preferencesService';
import { locationService } from '../../services/locationService';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'OnboardingDistance'>;

type SelectionType = 'gps' | 'address' | null;

const OnboardingDistanceScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const preferencesService = PreferencesService.getInstance();

  const [selection, setSelection] = useState<SelectionType>(null);
  const [addressInput, setAddressInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState(false);

  const handleSelectGPS = async () => {
    setIsLoading(true);
    try {
      const status = await locationService.requestPermission();

      if (status === 'granted') {
        setSelection('gps');
        await preferencesService.updatePreferences({
          distanceFilterEnabled: true,
          locationSource: 'gps',
          locationPermissionAsked: true,
        });
      } else if (status === 'blocked') {
        locationService.showPermissionBlockedAlert();
        setSelection(null);
      } else {
        Alert.alert(
          'Location Not Available',
          'Would you like to enter your address instead?',
          [
            { text: 'Skip', style: 'cancel', onPress: () => setSelection(null) },
            { text: 'Enter Address', onPress: () => {
              setShowAddressInput(true);
              setSelection('address');
            }},
          ]
        );
      }
    } catch (error) {
      console.error('[OnboardingDistance] Error requesting GPS:', error);
      Alert.alert('Error', 'Could not access location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAddress = () => {
    setSelection('address');
    setShowAddressInput(true);
  };

  const handleSaveAddress = async () => {
    if (!addressInput.trim()) return;

    setIsLoading(true);
    try {
      const success = await locationService.geocodeAndSaveAddress(addressInput.trim());
      if (success) {
        await preferencesService.updatePreferences({
          distanceFilterEnabled: true,
          locationSource: 'saved_address',
          locationPermissionAsked: true,
        });
        setShowAddressInput(false);
      } else {
        Alert.alert(
          'Address Not Found',
          'We couldn\'t find that address. Please check and try again.'
        );
      }
    } catch (error) {
      console.error('[OnboardingDistance] Error saving address:', error);
      Alert.alert('Error', 'Could not save address. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    navigation.navigate('OnboardingComplete');
  };

  const handleSkip = async () => {
    await preferencesService.updatePreferences({
      locationPermissionAsked: true,
    });
    navigation.navigate('OnboardingComplete');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isReady = selection === 'gps' || (selection === 'address' && !showAddressInput);

  return (
    <SafeAreaView style={styles.container}>
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
          <View style={styles.stepDot} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
        <Text style={styles.title}>Find activities near you</Text>
        <Text style={styles.subtitle}>
          Filter results by distance to see what's close by
        </Text>
      </View>

      <View style={styles.content}>
        {/* GPS Option */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            selection === 'gps' && styles.optionCardSelected,
          ]}
          onPress={handleSelectGPS}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          <View style={[styles.iconContainer, selection === 'gps' && styles.iconContainerSelected]}>
            <Icon
              name="crosshairs-gps"
              size={28}
              color={selection === 'gps' ? '#FFFFFF' : '#FF385C'}
            />
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, selection === 'gps' && styles.optionTitleSelected]}>
              Use my location
            </Text>
            <Text style={styles.optionDescription}>
              Allow GPS access for automatic location
            </Text>
          </View>
          {selection === 'gps' && (
            <View style={styles.checkmark}>
              <Icon name="check" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Address Option */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            selection === 'address' && styles.optionCardSelected,
          ]}
          onPress={handleSelectAddress}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          <View style={[styles.iconContainer, selection === 'address' && styles.iconContainerSelected]}>
            <Icon
              name="home-map-marker"
              size={28}
              color={selection === 'address' ? '#FFFFFF' : '#FF385C'}
            />
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, selection === 'address' && styles.optionTitleSelected]}>
              Enter my address
            </Text>
            <Text style={styles.optionDescription}>
              Set a home address to calculate distances
            </Text>
          </View>
          {selection === 'address' && !showAddressInput && (
            <View style={styles.checkmark}>
              <Icon name="check" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Address Input */}
        {showAddressInput && (
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Your address</Text>
            <TextInput
              style={styles.addressInput}
              placeholder="e.g., 123 Main St, Vancouver, BC"
              placeholderTextColor="#9CA3AF"
              value={addressInput}
              onChangeText={setAddressInput}
              autoCapitalize="words"
              autoCorrect={false}
              multiline
              numberOfLines={2}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[
                styles.saveAddressButton,
                (!addressInput.trim() || isLoading) && styles.saveAddressButtonDisabled,
              ]}
              onPress={handleSaveAddress}
              disabled={!addressInput.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="map-marker-check" size={18} color="#FFFFFF" />
                  <Text style={styles.saveAddressButtonText}>Verify & Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Icon name="information-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            You can change this anytime in Settings. Distance filtering helps you discover
            activities within your preferred radius.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FF385C" />
            <Text style={styles.loadingText}>Setting up location...</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.nextButton, !isReady && styles.nextButtonDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.nextButtonText}>
            {isReady ? 'Continue' : 'Skip for now'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    paddingBottom: 24,
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
    backgroundColor: '#FF385C',
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
    borderColor: '#FF385C',
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
    backgroundColor: '#FF385C',
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
    color: '#FF385C',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF385C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  addressInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    textAlignVertical: 'top',
    minHeight: 60,
  },
  saveAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF385C',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 12,
    gap: 8,
  },
  saveAddressButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveAddressButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  nextButton: {
    backgroundColor: '#FF385C',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF385C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingDistanceScreen;
