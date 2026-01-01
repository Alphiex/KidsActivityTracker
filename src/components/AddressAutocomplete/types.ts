import { ViewStyle, TextStyle } from 'react-native';
import { EnhancedAddress } from '../../types/preferences';

export interface AddressAutocompleteProps {
  // Value and change handler
  value?: EnhancedAddress | null;
  onAddressSelect: (address: EnhancedAddress | null) => void;

  // Customization
  placeholder?: string;
  label?: string;
  showClearButton?: boolean;

  // Filtering
  country?: string | string[];     // Restrict to countries (e.g., 'ca' or ['ca', 'us'])
  types?: string[];                // Restrict place types (e.g., ['address', 'geocode'])

  // State
  disabled?: boolean;
  error?: string;

  // Fallback
  onFallbackToManual?: () => void; // Called when Places API fails
  showFallbackOption?: boolean;

  // Styling
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

// Google Places API types
export interface GooglePlaceData {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

export interface GooglePlaceDetails {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: GoogleAddressComponent[];
  place_id: string;
  types: string[];
  name?: string;
}

export interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}
