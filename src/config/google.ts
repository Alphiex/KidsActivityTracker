import Config from 'react-native-config';

/**
 * Google API Configuration
 *
 * Note: The API key is configured via environment variables:
 * - Set GOOGLE_PLACES_API_KEY in your .env file
 * - iOS: Also configured in ios/Config.local.xcconfig (gitignored)
 * - Android: Also configured in android/local.properties (gitignored)
 *
 * For Places API autocomplete, we need the key available in JavaScript.
 */

// Google Places API Configuration
export const GOOGLE_PLACES_CONFIG = {
  // API Key for Places API (loaded from environment)
  // This key should have Places API enabled in Google Cloud Console
  API_KEY: Config.GOOGLE_PLACES_API_KEY || '',

  // Default query parameters
  DEFAULT_QUERY: {
    language: 'en',
    components: 'country:ca|country:us', // Restrict to Canada and US
  },

  // Debounce delay for autocomplete (ms)
  DEBOUNCE_DELAY: 300,
};
