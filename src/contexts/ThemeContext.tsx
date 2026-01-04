import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

interface ThemeColors {
  primary: string;
  primaryDark: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  cardBackground: string;
  headerBackground: string;
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  gradientStart: string;
  gradientEnd: string;
  inputBackground: string;
  shadowColor: string;
}

interface ThemeContextType {
  colors: ThemeColors;
}

const lightColors: ThemeColors = {
  primary: '#E8638B',
  primaryDark: '#D53F8C',
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceVariant: '#f0f0f0',
  text: '#333333',
  textSecondary: '#666666',
  border: '#e0e0e0',
  error: '#ff4444',
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',
  cardBackground: '#ffffff',
  headerBackground: '#ffffff',
  tabBarBackground: '#ffffff',
  tabBarActive: '#E8638B',
  tabBarInactive: '#999999',
  gradientStart: '#FFB5C5',
  gradientEnd: '#D53F8C',
  inputBackground: '#ffffff',
  shadowColor: '#000000',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Keep useColorScheme hook for React Native internal consistency
  useColorScheme();

  // Force light mode - state ensures proper React lifecycle
  const [colors] = useState<ThemeColors>(lightColors);

  return (
    <ThemeContext.Provider value={{ colors }}>
      {children}
    </ThemeContext.Provider>
  );
};
