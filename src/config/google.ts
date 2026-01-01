/**
 * Google API Configuration
 *
 * Note: The API key is also configured in native code:
 * - iOS: ios/Config.local.xcconfig (gitignored)
 * - Android: android/local.properties (gitignored)
 *
 * For Places API autocomplete, we need the key available in JavaScript.
 * In production, this should use environment variables or secure config.
 */

// Google Places API Configuration
export const GOOGLE_PLACES_CONFIG = {
  // API Key for Places API (same key as Maps)
  // This key should have Places API enabled in Google Cloud Console
  API_KEY: 'AIzaSyCLBy686_0R0ftrFysQPIfUJHdGc6kOvDg',

  // Default query parameters
  DEFAULT_QUERY: {
    language: 'en',
    components: 'country:ca|country:us', // Restrict to Canada and US
  },

  // Debounce delay for autocomplete (ms)
  DEBOUNCE_DELAY: 300,
};
