import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import Geolocation, { GeolocationResponse, GeolocationError } from '@react-native-community/geolocation';
import { geocodeAddress } from '../utils/geocoding';
import { preferencesService } from './preferencesService';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

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
   */
  getSavedAddress(): SavedAddress | null {
    const prefs = preferencesService.getPreferences();
    if (prefs.savedAddress?.address && prefs.savedAddress?.latitude && prefs.savedAddress?.longitude) {
      return prefs.savedAddress;
    }
    return null;
  }

  /**
   * Geocode an address and save it to preferences
   */
  async geocodeAndSaveAddress(address: string): Promise<boolean> {
    try {
      console.log('[LocationService] Geocoding address:', address);
      const coords = await geocodeAddress(address);

      if (coords) {
        const savedAddress: SavedAddress = {
          address,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        await preferencesService.updatePreferences({
          savedAddress,
          locationSource: 'saved_address',
        });

        console.log('[LocationService] Address saved:', savedAddress);
        return true;
      }

      console.warn('[LocationService] Failed to geocode address');
      return false;
    } catch (error) {
      console.error('[LocationService] Error geocoding address:', error);
      return false;
    }
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
   * Returns userLat, userLon, radiusKm if distance filtering is enabled
   */
  async getDistanceFilterParams(): Promise<{
    userLat?: number;
    userLon?: number;
    radiusKm?: number;
  }> {
    const prefs = preferencesService.getPreferences();

    if (!prefs.distanceFilterEnabled) {
      return {};
    }

    const location = await this.getEffectiveLocation();
    if (!location) {
      return {};
    }

    return {
      userLat: location.latitude,
      userLon: location.longitude,
      radiusKm: prefs.distanceRadiusKm || 25,
    };
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
