import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import GooglePlacesSDK, { PLACE_FIELDS, PlacePrediction } from 'react-native-google-places-sdk';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { EnhancedAddress } from '../../types/preferences';
import { AddressAutocompleteProps } from './types';
import { formatAddressForDisplay, formatLocationDetails } from './utils';
import { geocodeAddress } from '../../utils/geocoding';

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onAddressSelect,
  placeholder = 'Search for your address...',
  label,
  showClearButton = true,
  country = ['ca', 'us'],
  disabled = false,
  error,
  onFallbackToManual,
  showFallbackOption = true,
  onFocus,
  containerStyle,
  inputStyle,
}) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Manual entry state
  const [manualStreet, setManualStreet] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualProvince, setManualProvince] = useState('');
  const [manualPostalCode, setManualPostalCode] = useState('');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);

  // Debug log on mount
  useEffect(() => {
    console.log('[AddressAutocomplete] Native SDK component mounted');
    console.log('[AddressAutocomplete] GooglePlacesSDK:', typeof GooglePlacesSDK);
    console.log('[AddressAutocomplete] fetchPredictions method:', typeof GooglePlacesSDK.fetchPredictions);
  }, []);

  const fetchPredictions = useCallback(async (text: string) => {
    if (text.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    setApiError(null);
    console.log('[AddressAutocomplete] Fetching predictions for:', text);

    try {
      const countries = Array.isArray(country) ? country : [country];
      console.log('[AddressAutocomplete] Countries filter:', countries);
      console.log('[AddressAutocomplete] Calling GooglePlacesSDK.fetchPredictions...');

      const results = await GooglePlacesSDK.fetchPredictions(text, {
        countries,
      });

      console.log('[AddressAutocomplete] Predictions received:', results?.length || 0);
      console.log('[AddressAutocomplete] First prediction:', results?.[0] ? JSON.stringify(results[0]) : 'none');
      setPredictions(results || []);
      setShowDropdown(true);
    } catch (err: any) {
      console.error('[AddressAutocomplete] Fetch predictions error:', err);
      console.error('[AddressAutocomplete] Error details:', err?.message, err?.code);
      setApiError('Address search failed. Try entering manually.');
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, [country]);

  const handleTextChange = useCallback((text: string) => {
    setSearchText(text);

    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchPredictions(text);
    }, 300);
  }, [fetchPredictions]);

  const handleSelectPrediction = useCallback(async (prediction: PlacePrediction) => {
    setIsFetchingDetails(true);
    setApiError(null);
    setShowDropdown(false);
    setSearchText(prediction.primaryText || prediction.description);

    try {
      // Fetch place details using the place ID
      const place = await GooglePlacesSDK.fetchPlaceByID(prediction.placeID, [
        PLACE_FIELDS.NAME,
        PLACE_FIELDS.FORMATTED_ADDRESS,
        PLACE_FIELDS.ADDRESS_COMPONENTS,
        PLACE_FIELDS.COORDINATE,
        PLACE_FIELDS.TYPES,
      ]);

      console.log('[AddressAutocomplete] Place details:', place);

      if (!place || !place.coordinate) {
        throw new Error('Could not get location coordinates');
      }

      // Parse address components
      let streetNumber = '';
      let streetName = '';
      let city = '';
      let state = '';
      let postalCode = '';
      let countryName = '';

      if (place.addressComponents) {
        for (const component of place.addressComponents) {
          const types = component.types || [];
          if (types.includes('street_number')) {
            streetNumber = component.name;
          } else if (types.includes('route')) {
            streetName = component.name;
          } else if (types.includes('locality')) {
            city = component.name;
          } else if (types.includes('administrative_area_level_1')) {
            state = component.shortName || component.name;
          } else if (types.includes('postal_code')) {
            postalCode = component.name;
          } else if (types.includes('country')) {
            countryName = component.name;
          }
        }
      }

      const streetAddress = [streetNumber, streetName].filter(Boolean).join(' ');

      const enhancedAddress: EnhancedAddress = {
        formattedAddress: place.formattedAddress || prediction.description,
        streetAddress: streetAddress || undefined,
        city: city || undefined,
        state: state || undefined,
        postalCode: postalCode || undefined,
        country: countryName || undefined,
        latitude: place.coordinate!.latitude,
        longitude: place.coordinate!.longitude,
        placeId: prediction.placeID,
        updatedAt: new Date().toISOString(),
      };

      onAddressSelect(enhancedAddress);
      Keyboard.dismiss();
    } catch (err: any) {
      console.error('[AddressAutocomplete] Fetch place details error:', err);
      setApiError('Failed to get address details. Please try again.');
    } finally {
      setIsFetchingDetails(false);
    }
  }, [onAddressSelect]);

  const handleClear = useCallback(() => {
    onAddressSelect(null);
    setSearchText('');
    setPredictions([]);
    setApiError(null);
    setShowManualEntry(false);
    setShowDropdown(false);
    setManualStreet('');
    setManualCity('');
    setManualProvince('');
    setManualPostalCode('');
  }, [onAddressSelect]);

  const handleManualGeocode = useCallback(async () => {
    if (!manualCity.trim()) {
      setApiError('Please enter at least a city name.');
      return;
    }

    setIsGeocodingManual(true);
    setApiError(null);

    const addressParts = [
      manualStreet.trim(),
      manualCity.trim(),
      manualProvince.trim(),
      manualPostalCode.trim(),
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    try {
      const coords = await geocodeAddress(fullAddress);

      if (coords) {
        const enhancedAddress: EnhancedAddress = {
          formattedAddress: fullAddress,
          streetAddress: manualStreet.trim() || undefined,
          city: manualCity.trim(),
          state: manualProvince.trim() || undefined,
          postalCode: manualPostalCode.trim() || undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
          updatedAt: new Date().toISOString(),
        };
        onAddressSelect(enhancedAddress);
        setShowManualEntry(false);
        Keyboard.dismiss();
      } else {
        // Show prominent alert for failed geocoding
        Alert.alert(
          'Invalid Address',
          'We couldn\'t verify this address. Please check the spelling and try again, or use the search feature to find your address.',
          [{ text: 'OK' }]
        );
        setApiError('Could not find this address. Please check and try again.');
      }
    } catch (err) {
      console.error('[AddressAutocomplete] Manual geocoding error:', err);
      Alert.alert(
        'Address Verification Failed',
        'There was a problem verifying your address. Please try again or use the search feature.',
        [{ text: 'OK' }]
      );
      setApiError('Failed to verify address. Please try again.');
    } finally {
      setIsGeocodingManual(false);
    }
  }, [manualStreet, manualCity, manualProvince, manualPostalCode, onAddressSelect]);

  const handleFallback = useCallback(() => {
    setShowManualEntry(true);
    setShowDropdown(false);
    onFallbackToManual?.();
  }, [onFallbackToManual]);

  // If we have a selected value, show it
  if (value && !showManualEntry) {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        )}
        <TouchableOpacity
          style={[styles.selectedContainer, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          onPress={() => !disabled && handleClear()}
          activeOpacity={0.7}
        >
          <View style={styles.selectedContent}>
            <Icon name="map-marker-check" size={24} color={colors.primary} />
            <View style={styles.selectedTextContainer}>
              <Text style={[styles.selectedAddress, { color: colors.text }]} numberOfLines={2}>
                {formatAddressForDisplay(value)}
              </Text>
              {(value.city || value.state || value.postalCode) && (
                <Text style={[styles.selectedDetails, { color: colors.textSecondary }]}>
                  {formatLocationDetails(value)}
                </Text>
              )}
            </View>
          </View>
          {!disabled && (
            <View style={styles.editButton}>
              <Icon name="pencil" size={16} color={colors.primary} />
              <Text style={[styles.editButtonText, { color: colors.primary }]}>Change</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Manual entry fallback
  if (showManualEntry) {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        )}
        <View style={styles.manualEntryContainer}>
          <Text style={[styles.manualEntryHint, { color: colors.textSecondary }]}>
            Enter your address:
          </Text>

          <TextInput
            key="street-light"
            style={[
              styles.manualInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
              Platform.OS === 'ios' && { color: colors.text },
            ]}
            value={manualStreet}
            onChangeText={setManualStreet}
            placeholder="Street address (optional)"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!disabled && !isGeocodingManual}
            onFocus={onFocus}
            keyboardAppearance="light"
            selectionColor={colors.primary}
          />

          <TextInput
            key="city-light"
            style={[
              styles.manualInput,
              {
                backgroundColor: colors.surface,
                borderColor: apiError && !manualCity.trim() ? '#EF4444' : colors.border,
                color: colors.text,
              },
              Platform.OS === 'ios' && { color: colors.text },
            ]}
            value={manualCity}
            onChangeText={setManualCity}
            placeholder="City *"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!disabled && !isGeocodingManual}
            onFocus={onFocus}
            keyboardAppearance="light"
            selectionColor={colors.primary}
          />

          <View style={styles.manualInputRow}>
            <TextInput
              key="province-light"
              style={[
                styles.manualInput,
                styles.manualInputHalf,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
                Platform.OS === 'ios' && { color: colors.text },
              ]}
              value={manualProvince}
              onChangeText={setManualProvince}
              placeholder="Province/State"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!disabled && !isGeocodingManual}
              onFocus={onFocus}
              keyboardAppearance="light"
              selectionColor={colors.primary}
            />
            <TextInput
              key="postal-light"
              style={[
                styles.manualInput,
                styles.manualInputHalf,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
                Platform.OS === 'ios' && { color: colors.text },
              ]}
              value={manualPostalCode}
              onChangeText={setManualPostalCode}
              placeholder="Postal code"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!disabled && !isGeocodingManual}
              onFocus={onFocus}
              keyboardAppearance="light"
              selectionColor={colors.primary}
            />
          </View>

          {apiError && (
            <Text style={styles.errorText}>{apiError}</Text>
          )}

          <View style={styles.manualButtonsRow}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={() => {
                setShowManualEntry(false);
                setManualStreet('');
                setManualCity('');
                setManualProvince('');
                setManualPostalCode('');
                setApiError(null);
              }}
              disabled={isGeocodingManual}
            >
              <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.verifyButton,
                { backgroundColor: colors.primary },
                (!manualCity.trim() || isGeocodingManual) && styles.verifyButtonDisabled,
              ]}
              onPress={handleManualGeocode}
              disabled={!manualCity.trim() || isGeocodingManual}
            >
              {isGeocodingManual ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Save Location</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Autocomplete input with predictions dropdown
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      )}

      <View style={styles.inputWrapper}>
        <View style={styles.searchIconContainer}>
          <Icon name="magnify" size={20} color={colors.textSecondary} />
        </View>

        <TextInput
          ref={inputRef}
          key="search-input-light"
          style={[
            styles.textInput,
            inputStyle,
            {
              backgroundColor: colors.surface,
              borderColor: apiError ? '#EF4444' : colors.border,
              color: colors.text,
            },
            // iOS-specific: Force text color to be applied on physical devices
            Platform.OS === 'ios' && { color: colors.text },
          ]}
          value={searchText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          editable={!disabled && !isFetchingDetails}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          keyboardAppearance="light"
          selectionColor={colors.primary}
          onFocus={() => {
            if (predictions.length > 0) {
              setShowDropdown(true);
            }
            onFocus?.();
          }}
        />

        {(isLoading || isFetchingDetails) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>

      {/* Predictions dropdown */}
      {showDropdown && predictions.length > 0 && (
        <View style={[styles.predictionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.placeID}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.predictionRow, { borderBottomColor: colors.border }]}
                onPress={() => handleSelectPrediction(item)}
              >
                <Icon name="map-marker-outline" size={18} color={colors.textSecondary} style={styles.predictionIcon} />
                <View style={styles.predictionTextContainer}>
                  <Text style={[styles.predictionPrimary, { color: colors.text }]} numberOfLines={1}>
                    {item.primaryText}
                  </Text>
                  <Text style={[styles.predictionSecondary, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {apiError && (
        <Text style={styles.errorText}>{apiError}</Text>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {showFallbackOption && (
        <TouchableOpacity style={styles.fallbackButton} onPress={handleFallback}>
          <Icon name="keyboard" size={16} color={colors.primary} />
          <Text style={[styles.fallbackText, { color: colors.primary }]}>
            Enter address manually
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    zIndex: 1000,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  searchIconContainer: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    right: 12,
    top: 14,
    zIndex: 1,
  },
  textInput: {
    fontSize: 16,
    paddingLeft: 40,
    paddingRight: 40,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    color: '#333333', // Default color for iOS, overridden by theme
  },
  predictionsContainer: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    maxHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
    overflow: 'hidden',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  predictionIcon: {
    marginRight: 10,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionPrimary: {
    fontSize: 15,
    fontWeight: '500',
  },
  predictionSecondary: {
    fontSize: 13,
    marginTop: 2,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  selectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  selectedAddress: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedDetails: {
    fontSize: 13,
    marginTop: 2,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(232, 99, 139, 0.1)',
    marginLeft: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
  },
  fallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 8,
  },
  fallbackText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  manualEntryContainer: {
    marginTop: 4,
  },
  manualEntryHint: {
    fontSize: 13,
    marginBottom: 8,
  },
  manualInput: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    marginBottom: 10,
    color: '#333333', // Default color for iOS, overridden by theme
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  manualInputHalf: {
    flex: 1,
  },
  manualButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  verifyButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AddressAutocomplete;
