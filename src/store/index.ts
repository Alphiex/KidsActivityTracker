import { configureStore } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createMigrate,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

// Import slices
import authReducer from './slices/authSlice';
import childrenReducer from './slices/childrenSlice';
import childActivitiesReducer from './slices/childActivitiesSlice';
import childFavoritesReducer from './slices/childFavoritesSlice';
import subscriptionReducer from './slices/subscriptionSlice';
import chatReducer from './slices/chatSlice';

// Migrations for redux-persist
const migrations = {
  // Version 2: Ensure selectedChildIds is properly initialized
  2: (state: any) => {
    console.log('[Redux Persist Migration] Running migration to v2');
    if (state?.children) {
      const children = state.children.children || [];
      const selectedChildIds = state.children.selectedChildIds || [];

      // If we have children but selectedChildIds is empty or stale, reset it
      if (children.length > 0 && selectedChildIds.length === 0) {
        console.log('[Redux Persist Migration] Initializing selectedChildIds to all children');
        return {
          ...state,
          children: {
            ...state.children,
            selectedChildIds: children.map((c: any) => c.id),
          },
        };
      }

      // Remove any stale IDs that don't exist in children
      const validChildIds = children.map((c: any) => c.id);
      const validSelected = selectedChildIds.filter((id: string) => validChildIds.includes(id));
      if (validSelected.length !== selectedChildIds.length) {
        console.log('[Redux Persist Migration] Cleaning up stale selectedChildIds');
        return {
          ...state,
          children: {
            ...state.children,
            selectedChildIds: validSelected.length > 0 ? validSelected : validChildIds,
          },
        };
      }
    }
    return state;
  },
};

// Persist configuration
const persistConfig = {
  key: 'root',
  version: 2,  // Bumped from 1 to trigger migration
  storage: AsyncStorage,
  whitelist: ['auth', 'children', 'subscription', 'chat'], // Persist auth, children, subscription, and chat state
  migrate: createMigrate(migrations, { debug: __DEV__ }),
};

const rootReducer = combineReducers({
  auth: authReducer,
  children: childrenReducer,
  childActivities: childActivitiesReducer,
  childFavorites: childFavoritesReducer,
  subscription: subscriptionReducer,
  chat: chatReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export hooks for TypeScript
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;