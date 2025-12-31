/**
 * Auth Slice - Firebase Authentication State Management
 *
 * Handles authentication state using Firebase Auth.
 * Firebase manages tokens automatically, so we just track user state.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authService, PostgresUser } from '../../services/authService';
import { firebaseAuthService, FirebaseUser, AuthProvider } from '../../services/firebaseAuthService';
import * as SecureStore from '../../utils/secureStorage';
import { fetchSubscription, clearSubscription } from './subscriptionSlice';
import { revenueCatService } from '../../services/revenueCatService';

interface AuthState {
  // PostgreSQL user (our database)
  user: PostgresUser | null;
  // Firebase user info (for display)
  firebaseUser: FirebaseUser | null;
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Auth provider used
  authProvider: AuthProvider | null;
}

const initialState: AuthState = {
  user: null,
  firebaseUser: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  authProvider: null,
};

/**
 * Helper to sync Firebase user with PostgreSQL and RevenueCat
 */
const syncUserAfterAuth = async (
  firebaseUser: FirebaseUser,
  dispatch: any
): Promise<PostgresUser> => {
  // Sync with PostgreSQL database
  const { user: postgresUser } = await authService.syncUser();

  // Cache user data locally
  await SecureStore.setUserData(postgresUser);

  // Initialize RevenueCat with PostgreSQL user ID
  try {
    await revenueCatService.login(postgresUser.id);
    dispatch(fetchSubscription());
  } catch (error) {
    console.log('[Auth] RevenueCat login/subscription fetch failed:', error);
  }

  return postgresUser;
};

// ============================================================
// ASYNC THUNKS - Firebase Authentication
// ============================================================

/**
 * Sign in with email and password
 */
export const loginWithEmail = createAsyncThunk(
  'auth/loginWithEmail',
  async ({ email, password }: { email: string; password: string }, { dispatch }) => {
    const firebaseUser = await firebaseAuthService.signInWithEmail(email, password);
    const postgresUser = await syncUserAfterAuth(firebaseUser, dispatch);
    return { firebaseUser, postgresUser, authProvider: 'email' as AuthProvider };
  }
);

/**
 * Sign in with Google
 */
export const loginWithGoogle = createAsyncThunk('auth/loginWithGoogle', async (_, { dispatch }) => {
  const firebaseUser = await firebaseAuthService.signInWithGoogle();
  const postgresUser = await syncUserAfterAuth(firebaseUser, dispatch);
  return { firebaseUser, postgresUser, authProvider: 'google' as AuthProvider };
});

/**
 * Sign in with Apple (iOS only)
 */
export const loginWithApple = createAsyncThunk('auth/loginWithApple', async (_, { dispatch }) => {
  const firebaseUser = await firebaseAuthService.signInWithApple();
  const postgresUser = await syncUserAfterAuth(firebaseUser, dispatch);
  return { firebaseUser, postgresUser, authProvider: 'apple' as AuthProvider };
});

/**
 * Create account with email and password
 */
export const registerWithEmail = createAsyncThunk(
  'auth/registerWithEmail',
  async (
    { email, password, name }: { email: string; password: string; name: string },
    { dispatch }
  ) => {
    const firebaseUser = await firebaseAuthService.createAccount(email, password, name);
    const postgresUser = await syncUserAfterAuth(firebaseUser, dispatch);
    return { firebaseUser, postgresUser, authProvider: 'email' as AuthProvider };
  }
);

/**
 * Logout from all providers
 */
export const logout = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  // Notify server
  await authService.logout();

  // Sign out from Firebase (also signs out from Google/Apple)
  await firebaseAuthService.signOut();

  // Clear local data
  await SecureStore.clearAllAuthData();

  // Clear subscription state and logout from RevenueCat
  dispatch(clearSubscription());
  try {
    await revenueCatService.logout();
  } catch (error) {
    console.log('[Auth] RevenueCat logout failed:', error);
  }
});

/**
 * Load auth state from Firebase on app start
 */
export const loadAuthState = createAsyncThunk('auth/loadAuthState', async (_, { dispatch }) => {
  const firebaseUser = firebaseAuthService.getCurrentUser();

  if (!firebaseUser) {
    // Clear any stale local data
    await SecureStore.clearAllAuthData();
    return null;
  }

  try {
    // Sync with PostgreSQL to get full user data
    const { user: postgresUser } = await authService.syncUser();
    await SecureStore.setUserData(postgresUser);

    // Initialize RevenueCat
    try {
      await revenueCatService.login(postgresUser.id);
      dispatch(fetchSubscription());
    } catch (error) {
      console.log('[Auth] RevenueCat login/subscription fetch failed:', error);
    }

    return {
      firebaseUser,
      postgresUser,
      authProvider: firebaseUser.providerId as AuthProvider,
    };
  } catch (error: any) {
    console.error('[Auth] Failed to sync user on app load:', error.message);
    // Firebase user exists but PostgreSQL sync failed - clear and start fresh
    await firebaseAuthService.signOut();
    await SecureStore.clearAllAuthData();
    return null;
  }
});

/**
 * Send password reset email (uses Firebase directly)
 */
export const sendPasswordReset = createAsyncThunk(
  'auth/sendPasswordReset',
  async ({ email }: { email: string }) => {
    await firebaseAuthService.sendPasswordResetEmail(email);
    return { success: true };
  }
);

/**
 * Update user profile
 */
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: { name?: string; phoneNumber?: string; preferences?: any }) => {
    const response = await authService.updateProfile(data);
    return response;
  }
);

/**
 * Delete account
 */
export const deleteAccount = createAsyncThunk('auth/deleteAccount', async (_, { dispatch }) => {
  // Delete from PostgreSQL (backend also deletes from Firebase)
  await authService.deleteAccount();

  // Clear local state
  await SecureStore.clearAllAuthData();
  dispatch(clearSubscription());

  try {
    await revenueCatService.logout();
  } catch (error) {
    console.log('[Auth] RevenueCat logout failed:', error);
  }

  return { success: true };
});

// ============================================================
// SLICE DEFINITION
// ============================================================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.firebaseUser = null;
      state.isAuthenticated = false;
      state.authProvider = null;
      state.error = null;
    },
    updateUserProfile: (state, action: PayloadAction<Partial<PostgresUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    setFirebaseUser: (state, action: PayloadAction<FirebaseUser | null>) => {
      state.firebaseUser = action.payload;
      if (!action.payload) {
        state.isAuthenticated = false;
        state.user = null;
      }
    },
  },
  extraReducers: (builder) => {
    // Login with Email
    builder
      .addCase(loginWithEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.postgresUser;
        state.firebaseUser = action.payload.firebaseUser;
        state.authProvider = action.payload.authProvider;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginWithEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
        state.isAuthenticated = false;
      });

    // Login with Google
    builder
      .addCase(loginWithGoogle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.postgresUser;
        state.firebaseUser = action.payload.firebaseUser;
        state.authProvider = action.payload.authProvider;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Google sign-in failed';
        state.isAuthenticated = false;
      });

    // Login with Apple
    builder
      .addCase(loginWithApple.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithApple.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.postgresUser;
        state.firebaseUser = action.payload.firebaseUser;
        state.authProvider = action.payload.authProvider;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginWithApple.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Apple sign-in failed';
        state.isAuthenticated = false;
      });

    // Register with Email
    builder
      .addCase(registerWithEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerWithEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.postgresUser;
        state.firebaseUser = action.payload.firebaseUser;
        state.authProvider = action.payload.authProvider;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerWithEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Registration failed';
        state.isAuthenticated = false;
      });

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.firebaseUser = null;
      state.isAuthenticated = false;
      state.authProvider = null;
      state.error = null;
    });

    // Load Auth State
    builder
      .addCase(loadAuthState.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadAuthState.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.user = action.payload.postgresUser;
          state.firebaseUser = action.payload.firebaseUser;
          state.authProvider = action.payload.authProvider;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
        }
      })
      .addCase(loadAuthState.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
      });

    // Send Password Reset
    builder
      .addCase(sendPasswordReset.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendPasswordReset.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(sendPasswordReset.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to send reset email';
      });

    // Update Profile
    builder.addCase(updateProfile.fulfilled, (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload.profile };
      }
    });

    // Delete Account
    builder
      .addCase(deleteAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.firebaseUser = null;
        state.isAuthenticated = false;
        state.authProvider = null;
        state.error = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete account';
      });
  },
});

export const { clearError, clearAuth, updateUserProfile, setFirebaseUser } = authSlice.actions;
export default authSlice.reducer;
