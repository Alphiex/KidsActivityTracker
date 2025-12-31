/**
 * Navigation Mocks
 * Mock implementations for React Navigation
 */

export const mockNavigate = jest.fn();
export const mockGoBack = jest.fn();
export const mockReset = jest.fn();
export const mockSetOptions = jest.fn();
export const mockDispatch = jest.fn();
export const mockAddListener = jest.fn(() => jest.fn());

export const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  reset: mockReset,
  setOptions: mockSetOptions,
  dispatch: mockDispatch,
  addListener: mockAddListener,
  canGoBack: jest.fn(() => true),
  isFocused: jest.fn(() => true),
  setParams: jest.fn(),
  getParent: jest.fn(() => null),
  getState: jest.fn(() => ({
    routes: [],
    index: 0,
  })),
};

export const mockRoute = {
  key: 'test-key',
  name: 'TestScreen',
  params: {},
};

// Create navigation mock with custom params
export const createMockNavigation = (overrides = {}) => ({
  ...mockNavigation,
  ...overrides,
});

export const createMockRoute = <T extends Record<string, unknown>>(
  name: string,
  params: T = {} as T
) => ({
  key: `${name}-key`,
  name,
  params,
});

// Navigation container mock for testing
export const mockNavigationContainer = {
  navigate: mockNavigate,
  reset: mockReset,
  goBack: mockGoBack,
  dispatch: mockDispatch,
  getCurrentRoute: jest.fn(() => ({ name: 'Home' })),
  getRootState: jest.fn(() => ({
    routes: [{ name: 'Home' }],
    index: 0,
  })),
};

// Reset all navigation mocks
export const resetNavigationMocks = () => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockReset.mockClear();
  mockSetOptions.mockClear();
  mockDispatch.mockClear();
  mockAddListener.mockClear();
};
