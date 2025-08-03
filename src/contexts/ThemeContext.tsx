import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

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
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const lightColors: ThemeColors = {
  primary: '#667eea',
  primaryDark: '#764ba2',
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
  tabBarActive: '#667eea',
  tabBarInactive: '#999999',
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  inputBackground: '#ffffff',
  shadowColor: '#000000',
};

const darkColors: ThemeColors = {
  primary: '#818cf8',
  primaryDark: '#9333ea',
  background: '#0f0f0f',
  surface: '#1a1a1a',
  surfaceVariant: '#262626',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  border: '#333333',
  error: '#ff6b6b',
  success: '#66d9a0',
  warning: '#ffc947',
  info: '#66b3ff',
  cardBackground: '#1a1a1a',
  headerBackground: '#1a1a1a',
  tabBarBackground: '#1a1a1a',
  tabBarActive: '#818cf8',
  tabBarInactive: '#666666',
  gradientStart: '#818cf8',
  gradientEnd: '#9333ea',
  inputBackground: '#262626',
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
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  
  const isDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    // Load saved theme preference
    loadThemeMode();
  }, []);

  const loadThemeMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('themeMode');
      if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
        setModeState(savedMode as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme mode:', error);
    }
  };

  const setMode = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem('themeMode', newMode);
      setModeState(newMode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};