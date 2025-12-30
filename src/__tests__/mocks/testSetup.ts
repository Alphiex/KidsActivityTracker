/**
 * Common test setup and utilities
 */

// Mock react-native modules that cause issues in tests
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: jest.fn((obj) => obj.ios) },
  Dimensions: { get: jest.fn(() => ({ width: 375, height: 812 })) },
  StyleSheet: { create: jest.fn((styles) => styles), flatten: jest.fn((style) => style) },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  SafeAreaView: 'SafeAreaView',
  StatusBar: 'StatusBar',
  ActivityIndicator: 'ActivityIndicator',
  Switch: 'Switch',
  TextInput: 'TextInput',
  FlatList: 'FlatList',
  Animated: {
    View: 'Animated.View',
    Value: jest.fn(() => ({ interpolate: jest.fn() })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    event: jest.fn(),
    ScrollView: 'Animated.ScrollView',
  },
  Modal: 'Modal',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(() => false),
  })),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {},
  })),
  useFocusEffect: jest.fn((callback) => callback()),
}));

// Mock vector icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// Mock slider
jest.mock('@react-native-community/slider', () => 'Slider');

// Mock date time picker
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// Mock theme context
export const mockTheme = {
  colors: {
    primary: '#FF385C',
    background: '#FFFFFF',
    surface: '#F9F9F9',
    text: '#222222',
    textSecondary: '#717171',
    border: '#EEEEEE',
    cardBackground: '#FFFFFF',
  },
  isDark: false,
};

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => mockTheme),
}));

// Helper to wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Helper to create a wrapper with providers
export const createTestWrapper = (children: React.ReactNode) => {
  return children; // Add providers here if needed
};

