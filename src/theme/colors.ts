export const Colors = {
  // Primary colors - Pink Pastel theme
  primary: '#E8638B',
  primaryDark: '#D53F8C',
  primaryLight: '#FFB5C5',

  // Secondary colors - Soft blue (complementary)
  secondary: '#7C9EF5',
  secondaryDark: '#5B7FE5',
  secondaryLight: '#A5BFFA',

  // Accent colors - Warm coral
  accent: '#FFD166',
  accentDark: '#F5B800',
  accentLight: '#FFE5A0',
  
  // Status colors
  success: '#7ED321',
  warning: '#F5A623',
  error: '#D0021B',
  info: '#4A90E2',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray: '#6C757D',
  lightGray: '#E9ECEF',
  darkGray: '#343A40',
  grayScale: {
    100: '#F8F9FA',
    200: '#E9ECEF',
    300: '#DEE2E6',
    400: '#CED4DA',
    500: '#ADB5BD',
    600: '#6C757D',
    700: '#495057',
    800: '#343A40',
    900: '#212529',
  },
  
  // Semantic colors
  background: '#F8F9FA',
  surface: '#FFFFFF',
  border: '#DEE2E6',
  text: {
    primary: '#212529',
    secondary: '#6C757D',
    disabled: '#ADB5BD',
    inverse: '#FFFFFF',
  },
  // Convenience text color aliases
  textSecondary: '#6C757D',
  textDisabled: '#ADB5BD',
  
  // Activity type colors
  activities: {
    // Original lowercase keys for backward compatibility
    camps: '#4A90E2',
    sports: '#FF9800',
    arts: '#9C27B0',
    swimming: '#00BCD4',
    education: '#8BC34A',
    general: '#607D8B',

    // Consolidated activity types (capitalized)
    'Swimming': '#00BCD4',
    'Music': '#9C27B0',
    'Sports': '#FF9800',
    'Skating': '#03A9F4',
    'Visual Arts': '#E8638B',
    'Dance': '#FFB5C5',
    'Martial Arts': '#F44336',
    'Camps': '#4A90E2',
  } as { [key: string]: string },
  
  // Gradient colors - Pink Pastel theme
  gradients: {
    primary: ['#FFB5C5', '#E8638B', '#D53F8C'],
    secondary: ['#A5BFFA', '#7C9EF5', '#5B7FE5'],
    sunset: ['#FFE5A0', '#FFD166', '#F5B800'],
    ocean: ['#A5BFFA', '#7C9EF5'],
    forest: ['#8BC34A', '#689F38'],
  }
};