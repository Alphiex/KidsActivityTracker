/**
 * Redux Mocks
 * Mock store and state for testing Redux-connected components
 */
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { Provider } from 'react-redux';

// Mock initial states
export const mockAuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const mockChildrenState = {
  children: [],
  selectedChild: null,
  isLoading: false,
  error: null,
};

export const mockActivitiesState = {
  activities: [],
  selectedActivity: null,
  searchResults: [],
  filters: {},
  isLoading: false,
  error: null,
};

export const mockFavoritesState = {
  favorites: [],
  isLoading: false,
  error: null,
};

export const mockSubscriptionState = {
  isSubscribed: false,
  tier: 'free',
  products: [],
  isLoading: false,
  error: null,
};

export const mockPreferencesState = {
  activityTypes: [],
  ageRange: { min: 0, max: 18 },
  cities: [],
  maxDistance: 50,
  maxCost: null,
  isLoading: false,
  error: null,
};

// Combined mock state
export const mockRootState = {
  auth: mockAuthState,
  children: mockChildrenState,
  activities: mockActivitiesState,
  favorites: mockFavoritesState,
  subscription: mockSubscriptionState,
  preferences: mockPreferencesState,
};

// Mock reducers
const mockAuthReducer = (state = mockAuthState, action: any) => {
  switch (action.type) {
    case 'auth/login/fulfilled':
      return { ...state, user: action.payload.user, isAuthenticated: true };
    case 'auth/logout/fulfilled':
      return { ...state, user: null, isAuthenticated: false };
    default:
      return state;
  }
};

const mockChildrenReducer = (state = mockChildrenState, action: any) => {
  switch (action.type) {
    case 'children/fetchChildren/fulfilled':
      return { ...state, children: action.payload };
    default:
      return state;
  }
};

const mockActivitiesReducer = (state = mockActivitiesState, action: any) => {
  switch (action.type) {
    case 'activities/search/fulfilled':
      return { ...state, searchResults: action.payload };
    default:
      return state;
  }
};

const mockFavoritesReducer = (state = mockFavoritesState) => state;
const mockSubscriptionReducer = (state = mockSubscriptionState) => state;
const mockPreferencesReducer = (state = mockPreferencesState) => state;

// Create mock store
export const createMockStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      auth: mockAuthReducer,
      children: mockChildrenReducer,
      activities: mockActivitiesReducer,
      favorites: mockFavoritesReducer,
      subscription: mockSubscriptionReducer,
      preferences: mockPreferencesReducer,
    },
    preloadedState: {
      ...mockRootState,
      ...preloadedState,
    },
  });
};

// Test wrapper with Redux Provider
interface WrapperProps {
  children: React.ReactNode;
}

export const createTestWrapper = (preloadedState = {}) => {
  const store = createMockStore(preloadedState);

  const Wrapper: React.FC<WrapperProps> = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  return { Wrapper, store };
};

// Mock useDispatch and useSelector
export const mockDispatch = jest.fn();
export const mockUseDispatch = () => mockDispatch;

export const createMockUseSelector = (mockState: Partial<typeof mockRootState>) => {
  return <T,>(selector: (state: typeof mockRootState) => T): T => {
    return selector({ ...mockRootState, ...mockState });
  };
};

// Reset mocks
export const resetReduxMocks = () => {
  mockDispatch.mockClear();
};
