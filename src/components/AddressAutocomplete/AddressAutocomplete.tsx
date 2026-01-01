import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { GOOGLE_PLACES_CONFIG } from '../../config/google';
import { EnhancedAddress } from '../../types/preferences';
import { AddressAutocompleteProps, GooglePlaceData, GooglePlaceDetails } from './types';
import { parseGooglePlaceDetails, formatAddressForDisplay, formatLocationDetails } from './utils';
import { geocodeAddress } from '../../utils/geocoding';

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onAddressSelect,
  placeholder = 'Search for your address...',
  label,
  showClearButton = true,
  country = ['ca', 'us'],
  types = ['address', 'geocode'],
  disabled = false,
  error,
  onFallbackToManual,
  showFallbackOption = true,
  containerStyle,
  inputStyle,
}) => {
  const { colors } = useTheme();
  const autocompleteRef = useRef<GooglePlacesAutocompleteRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualStreet, setManualStreet] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualProvince, setManualProvince] = useState('');
  const [manualPostalCode, setManualPostalCode] = useState('');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);

  const handlePlaceSelect = useCallback(async (
    data: GooglePlaceData,
    details: GooglePlaceDetails | null
  ) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const enhancedAddress = parseGooglePlaceDetails(data, details);

      // If we don't have coordinates from details, something went wrong
      if (!enhancedAddress.latitude || !enhancedAddress.longitude) {
        throw new Error('Could not get location coordinates');
      }

      onAddressSelect(enhancedAddress);
      Keyboard.dismiss();
    } catch (err) {
      console.error('[AddressAutocomplete] Error processing place:', err);
      setApiError('Failed to get address details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onAddressSelect]);

  const handleClear = useCallback(() => {
    onAddressSelect(null);
    autocompleteRef.current?.clear();
    setApiError(null);
    setShowManualEntry(false);
    setManualAddress('');
    setManualStreet('');
    setManualCity('');
    setManualProvince('');
    setManualPostalCode('');
  }, [onAddressSelect]);

  const handleManualGeocode = useCallback(async () => {
    // Require at least city
    if (!manualCity.trim()) {
      setApiError('Please enter at least a city name.');
      return;
    }

    setIsGeocodingManual(true);
    setApiError(null);

    // Build full address string for geocoding
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
        setApiError('Could not find this address. Please check and try again.');
      }
    } catch (err) {
      console.error('[AddressAutocomplete] Manual geocoding error:', err);
      setApiError('Failed to verify address. Please try again.');
    } finally {
      setIsGeocodingManual(false);
    }
  }, [manualStreet, manualCity, manualProvince, manualPostalCode, onAddressSelect]);

  const handleFallback = useCallback(() => {
    setShowManualEntry(true);
    onFallbackToManual?.();
  }, [onFallbackToManual]);

  // If we have a selected value, show it
  if (value && !showManualEntry) {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        )}
        <View style={[styles.selectedContainer, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
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
          {showClearButton && !disabled && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Icon name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
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

          {/* Street Address (optional) */}
          <TextInput
            style={[
              styles.manualInput,
              styles.manualInputSmall,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={manualStreet}
            onChangeText={setManualStreet}
            placeholder="Street address (optional)"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!disabled && !isGeocodingManual}
          />

          {/* City (required) */}
          <TextInput
            style={[
              styles.manualInput,
              styles.manualInputSmall,
              {
                backgroundColor: colors.surface,
                borderColor: apiError && !manualCity.trim() ? '#EF4444' : colors.border,
                color: colors.text,
              },
            ]}
            value={manualCity}
            onChangeText={setManualCity}
            placeholder="City *"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!disabled && !isGeocodingManual}
          />

          {/* Province/State and Postal Code row */}
          <View style={styles.manualInputRow}>
            <TextInput
              style={[
                styles.manualInput,
                styles.manualInputSmall,
                styles.manualInputHalf,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={manualProvince}
              onChangeText={setManualProvince}
              placeholder="Province/State"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!disabled && !isGeocodingManual}
            />
            <TextInput
              style={[
                styles.manualInput,
                styles.manualInputSmall,
                styles.manualInputHalf,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={manualPostalCode}
              onChangeText={setManualPostalCode}
              placeholder="Postal code"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!disabled && !isGeocodingManual}
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

  // Autocomplete input
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      )}
      <View style={styles.autocompleteWrapper}>
        <GooglePlacesAutocomplete
          ref={autocompleteRef}
          placeholder={placeholder}
          onPress={(data, details) => handlePlaceSelect(data as GooglePlaceData, details as GooglePlaceDetails)}
          fetchDetails={true}
          query={{
            key: GOOGLE_PLACES_CONFIG.API_KEY,
            language: 'en',
            components: Array.isArray(country)
              ? country.map(c => `country:${c}`).join('|')
              : `country:${country}`,
            types: types.join('|'),
          }}
          onFail={(error) => {
            console.error('[AddressAutocomplete] API error:', error);
            console.error('[AddressAutocomplete] API Key configured:', !!GOOGLE_PLACES_CONFIG.API_KEY);
            if (!GOOGLE_PLACES_CONFIG.API_KEY) {
              setApiError('Address search not configured. Please enter manually.');
            } else {
              setApiError('Address search unavailable. Try entering manually below.');
            }
          }}
          onNotFound={() => {
            setApiError('No addresses found. Try a different search.');
          }}
          debounce={GOOGLE_PLACES_CONFIG.DEBOUNCE_DELAY}
          minLength={3}
          enablePoweredByContainer={false}
          textInputProps={{
            placeholderTextColor: colors.textSecondary,
            editable: !disabled && !isLoading,
            style: [
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: apiError ? '#EF4444' : colors.border,
                color: colors.text,
              },
              inputStyle,
            ],
          }}
          styles={{
            container: styles.autocompleteContainer,
            listView: [styles.listView, { backgroundColor: colors.surface }],
            row: [styles.row, { backgroundColor: colors.surface }],
            separator: [styles.separator, { backgroundColor: colors.border }],
            description: [styles.description, { color: colors.text }],
            predefinedPlacesDescription: { color: colors.primary },
          }}
          renderLeftButton={() => (
            <View style={styles.searchIconContainer}>
              <Icon name="magnify" size={20} color={colors.textSecondary} />
            </View>
          )}
          renderRightButton={() => (
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          )}
        />
      </View>

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
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  autocompleteWrapper: {
    zIndex: 10,
    width: '100%',
  },
  autocompleteContainer: {
    flex: 0,
    width: '100%',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingLeft: 40,
    paddingRight: 40,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
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
  listView: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 1000,
    maxHeight: 200,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  separator: {
    height: 1,
  },
  description: {
    fontSize: 14,
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
    minHeight: 60,
    textAlignVertical: 'top',
  },
  manualInputSmall: {
    minHeight: 48,
    marginBottom: 10,
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
