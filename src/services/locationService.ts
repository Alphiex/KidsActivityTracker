import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import Geolocation, { GeolocationResponse, GeolocationError } from '@react-native-community/geolocation';
import { geocodeAddress } from '../utils/geocoding';
import { preferencesService } from './preferencesService';
import { EnhancedAddress, LegacyAddress, isEnhancedAddress, isLegacyAddress } from '../types/preferences';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

// Keep for backward compatibility
export interface SavedAddress {
  address: string;
  latitude: number;
  longitude: number;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';
export type LocationSource = 'gps' | 'saved_address';

export interface EffectiveLocation extends LocationCoordinates {
  source: LocationSource;
}

// Valid radius options in km
export const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

class LocationService {
  private watchId: number | null = null;

  /**
   * Request location permission from the user
   * Returns the permission status
   */
  async requestPermission(): Promise<LocationPermissionStatus> {
    try {
      if (Platform.OS === 'ios') {
        return new Promise((resolve) => {
          Geolocation.requestAuthorization();
          // iOS doesn't have a direct way to check status after request
          // We'll try to get location to determine if it was granted
          Geolocation.getCurrentPosition(
            () => resolve('granted'),
            (error: GeolocationError) => {
              if (error.code === 1) {
                // PERMISSION_DENIED
                resolve('denied');
              } else {
                resolve('unavailable');
              }
            },
            { timeout: 5000, maximumAge: 0 }
          );
        });
      } else if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'We need access to your location to find activities near you.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return 'granted';
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          return 'blocked';
        } else {
          return 'denied';
        }
      }
      return 'unavailable';
    } catch (error) {
      console.error('[LocationService] Error requesting permission:', error);
      return 'unavailable';
    }
  }

  /**
   * Check current permission status without requesting
   */
  async checkPermission(): Promise<LocationPermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return hasPermission ? 'granted' : 'denied';
      } else {
        // iOS: Try to get position to check permission
        return new Promise((resolve) => {
          Geolocation.getCurrentPosition(
            () => resolve('granted'),
            (error: GeolocationError) => {
              if (error.code === 1) {
                resolve('denied');
              } else {
                resolve('unavailable');
              }
            },
            { timeout: 3000, maximumAge: 60000 }
          );
        });
      }
    } catch (error) {
      console.error('[LocationService] Error checking permission:', error);
      return 'unavailable';
    }
  }

  /**
   * Get the user's current GPS location
   */
  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position: GeolocationResponse) => {
          const coords: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('[LocationService] Got GPS location:', coords);
          resolve(coords);
        },
        (error: GeolocationError) => {
          console.error('[LocationService] GPS error:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000, // Cache location for 1 minute
        }
      );
    });
  }

  /**
   * Get the user's saved address from preferences
   * Returns legacy format for backward compatibility
   */
  getSavedAddress(): SavedAddress | null {
    const prefs = preferencesService.getPreferences();
    const saved = prefs.savedAddress;

    if (!saved) return null;

    // Handle enhanced address format
    if (isEnhancedAddress(saved)) {
      if (saved.latitude && saved.longitude) {
        return {
          address: saved.formattedAddress,
          latitude: saved.latitude,
          longitude: saved.longitude,
        };
      }
      return null;
    }

    // Handle legacy format
    if (isLegacyAddress(saved)) {
      if (saved.address && saved.latitude && saved.longitude) {
        return saved;
      }
    }

    return null;
  }

  /**
   * Get the enhanced address from preferences (new format)
   */
  getEnhancedAddress(): EnhancedAddress | null {
    const prefs = preferencesService.getPreferences();
    const saved = prefs.savedAddress;

    if (!saved) return null;

    // Already enhanced format
    if (isEnhancedAddress(saved)) {
      return saved;
    }

    // Migrate legacy format
    if (isLegacyAddress(saved)) {
      return {
        formattedAddress: saved.address,
        latitude: saved.latitude,
        longitude: saved.longitude,
        updatedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Save an enhanced address to user preferences
   *
   * @deprecated User-level address storage is deprecated.
   * Use childPreferencesService.updateLocationPreferences() for child-level addresses.
   * This method is kept for backward compatibility only.
   */
  async saveEnhancedAddress(address: EnhancedAddress): Promise<boolean> {
    console.log('[LocationService] saveEnhancedAddress is deprecated - use child preferences');
    // No longer save to user preferences - address is per-child now
    return true;
  }

  /**
   * Geocode an address and save it to preferences
   *
   * @deprecated User-level address storage is deprecated.
   * Use childPreferencesService.updateLocationPreferences() for child-level addresses.
   */
  async geocodeAndSaveAddress(address: string): Promise<boolean> {
    console.log('[LocationService] geocodeAndSaveAddress is deprecated - use child preferences');
    // No longer save to user preferences - address is per-child now
    return true;
  }

  /**
   * Clear the saved address
   */
  async clearSavedAddress(): Promise<void> {
    await preferencesService.updatePreferences({
      savedAddress: undefined,
    });
  }

  /**
   * Get the effective location based on user's preference (GPS or saved address)
   */
  async getEffectiveLocation(): Promise<EffectiveLocation | null> {
    const prefs = preferencesService.getPreferences();

    // If distance filtering is disabled, return null
    if (!prefs.distanceFilterEnabled) {
      return null;
    }

    const source = prefs.locationSource || 'gps';

    if (source === 'saved_address') {
      const savedAddress = this.getSavedAddress();
      if (savedAddress) {
        return {
          latitude: savedAddress.latitude,
          longitude: savedAddress.longitude,
          source: 'saved_address',
        };
      }
      // Fall back to GPS if no saved address
    }

    // Try GPS
    const gpsLocation = await this.getCurrentLocation();
    if (gpsLocation) {
      return {
        ...gpsLocation,
        source: 'gps',
      };
    }

    // If GPS failed, try saved address as fallback
    const savedAddress = this.getSavedAddress();
    if (savedAddress) {
      return {
        latitude: savedAddress.latitude,
        longitude: savedAddress.longitude,
        source: 'saved_address',
      };
    }

    return null;
  }

  /**
   * Get distance filter parameters for API calls
   *
   * @deprecated User-level distance filtering is deprecated.
   * Distance filtering is now managed per-child via ChildPreferences.
   * This method now returns empty object - use childFilters.mergedFilters
   * in activityService calls instead.
   */
  async getDistanceFilterParams(): Promise<{
    userLat?: number;
    userLon?: number;
    radiusKm?: number;
  }> {
    // DEPRECATED: Distance filtering now uses child-level preferences
    // Return empty to disable user-level distance filtering
    console.log('[LocationService] getDistanceFilterParams is deprecated - use child preferences');
    return {};
  }

  /**
   * Open app settings so user can enable location permission
   */
  openSettings(): void {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }

  /**
   * Show alert when location permission is blocked
   */
  showPermissionBlockedAlert(): void {
    Alert.alert(
      'Location Permission Required',
      'Location access has been blocked. Please enable it in your device settings to use distance-based filtering.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => this.openSettings() },
      ]
    );
  }

  /**
   * Cleanup - stop watching location if active
   */
  cleanup(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;
