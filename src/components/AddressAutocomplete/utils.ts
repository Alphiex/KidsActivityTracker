import { EnhancedAddress, LegacyAddress, isLegacyAddress } from '../../types/preferences';
import { GooglePlaceData, GooglePlaceDetails, GoogleAddressComponent } from './types';

/**
 * Extract a specific component from Google address_components array
 */
export function getAddressComponent(
  components: GoogleAddressComponent[],
  type: string,
  useShortName: boolean = false
): string | undefined {
  const component = components.find(c => c.types.includes(type));
  return component ? (useShortName ? component.short_name : component.long_name) : undefined;
}

/**
 * Parse Google Place details into EnhancedAddress format
 */
export function parseGooglePlaceDetails(
  data: GooglePlaceData,
  details: GooglePlaceDetails | null
): EnhancedAddress {
  if (!details) {
    // Fallback when details aren't available
    return {
      formattedAddress: data.description,
      displayName: data.structured_formatting?.main_text,
      latitude: 0,
      longitude: 0,
      placeId: data.place_id,
      types: data.types,
      updatedAt: new Date().toISOString(),
    };
  }

  const components = details.address_components || [];

  return {
    formattedAddress: details.formatted_address,
    displayName: details.name || data.structured_formatting?.main_text,
    latitude: details.geometry.location.lat,
    longitude: details.geometry.location.lng,
    streetNumber: getAddressComponent(components, 'street_number'),
    streetName: getAddressComponent(components, 'route'),
    neighborhood: getAddressComponent(components, 'neighborhood') ||
                  getAddressComponent(components, 'sublocality') ||
                  getAddressComponent(components, 'sublocality_level_1'),
    city: getAddressComponent(components, 'locality') ||
          getAddressComponent(components, 'administrative_area_level_3') ||
          getAddressComponent(components, 'sublocality_level_1'),
    state: getAddressComponent(components, 'administrative_area_level_1'),
    postalCode: getAddressComponent(components, 'postal_code'),
    country: getAddressComponent(components, 'country'),
    countryCode: getAddressComponent(components, 'country', true),
    placeId: details.place_id,
    types: details.types,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Migrate legacy address format to enhanced format
 */
export function migrateLegacyAddress(legacy: LegacyAddress): EnhancedAddress {
  return {
    formattedAddress: legacy.address,
    latitude: legacy.latitude,
    longitude: legacy.longitude,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get effective address from either legacy or enhanced format
 */
export function getEffectiveAddress(
  address: EnhancedAddress | LegacyAddress | undefined
): EnhancedAddress | null {
  if (!address) return null;

  if (isLegacyAddress(address)) {
    return migrateLegacyAddress(address);
  }

  return address;
}

/**
 * Format address for display (short version)
 */
export function formatAddressForDisplay(address: EnhancedAddress): string {
  if (address.displayName) {
    return address.displayName;
  }

  // Build a short display string
  const parts: string[] = [];

  if (address.streetNumber && address.streetName) {
    parts.push(`${address.streetNumber} ${address.streetName}`);
  } else if (address.streetName) {
    parts.push(address.streetName);
  }

  if (address.city) {
    parts.push(address.city);
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return address.formattedAddress;
}

/**
 * Format location details (city, province, postal code)
 */
export function formatLocationDetails(address: EnhancedAddress): string {
  const parts: string[] = [];

  if (address.city) {
    parts.push(address.city);
  }

  if (address.state) {
    parts.push(address.state);
  }

  if (address.postalCode) {
    parts.push(address.postalCode);
  }

  return parts.join(', ');
}
