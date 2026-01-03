import { Platform } from 'react-native';

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Geocode an address to get latitude and longitude coordinates
 * Uses native platform geocoding services (no API key required)
 */
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address || address.trim() === '') {
    console.warn('geocodeAddress: Empty address provided');
    return null;
  }

  try {
    // Clean and encode the address
    const cleanAddress = address.trim();
    const encodedAddress = encodeURIComponent(cleanAddress);
    
    // Use Nominatim (OpenStreetMap) for geocoding - free and no API key required
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
    
    console.log('Geocoding address:', cleanAddress);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'KidsActivityTracker/1.0', // Required by Nominatim
      },
    });
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const coordinates: Coordinates = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      };
      
      console.log('Geocoding successful:', coordinates);
      return coordinates;
    }
    
    console.warn('No geocoding results found for address:', cleanAddress);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

/**
 * Get full address string from activity location data
 */
export const getFullAddress = (activity: any): string => {
  // Check for fullAddress field first
  if (activity.fullAddress) {
    return activity.fullAddress;
  }
  
  // Check if location is an object with address
  if (typeof activity.location === 'object' && activity.location?.address) {
    const locationName = activity.location.name || '';
    const address = activity.location.address;
    
    // Combine location name and address if both exist
    if (locationName && !address.includes(locationName)) {
      return `${locationName}, ${address}`;
    }
    return address;
  }
  
  // Check if location is a string
  if (typeof activity.location === 'string') {
    return activity.location;
  }
  
  // Check for locationName field
  if (activity.locationName) {
    return activity.locationName;
  }
  
  return '';
};

/**
 * Reverse geocode coordinates to get an address
 * Uses Nominatim (OpenStreetMap) - free and no API key required
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<{
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
} | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    console.log('Reverse geocoding:', { latitude, longitude });

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'KidsActivityTracker/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.display_name) {
      const address = data.address || {};
      const result = {
        formattedAddress: data.display_name,
        city: address.city || address.town || address.village || address.municipality,
        state: address.state || address.province,
        country: address.country,
        postalCode: address.postcode,
      };

      console.log('Reverse geocoding successful:', result);
      return result;
    }

    console.warn('No reverse geocoding results found');
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

/**
 * Simple in-memory cache for geocoding results to avoid repeated API calls
 */
const geocodeCache = new Map<string, Coordinates>();

/**
 * Geocode with caching to reduce API calls
 */
export const geocodeAddressWithCache = async (address: string): Promise<Coordinates | null> => {
  const cacheKey = address.toLowerCase().trim();
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    console.log('Geocoding cache hit for:', address);
    return geocodeCache.get(cacheKey)!;
  }
  
  // Geocode and cache the result
  const coordinates = await geocodeAddress(address);
  if (coordinates) {
    geocodeCache.set(cacheKey, coordinates);
  }
  
  return coordinates;
};