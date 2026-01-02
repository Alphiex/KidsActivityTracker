/**
 * Firebase Authentication Service
 * Handles all Firebase Auth operations including social logins
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { secureLog, secureError } from '../utils/secureLogger';

// Google Sign-In configuration - done lazily to ensure native module is ready
let googleSignInConfigured = false;
const configureGoogleSignIn = () => {
  if (googleSignInConfigured) return;
  try {
    // webClientId is the OAuth 2.0 Web Client ID from Firebase Console
    // This is required for Firebase Auth integration on both platforms
    GoogleSignin.configure({
      webClientId: '97509826340-g56nnh9fp4e1clvrp8tap870ildddle2.apps.googleusercontent.com',
      offlineAccess: true,
    });
    googleSignInConfigured = true;
    secureLog('[FirebaseAuth] Google Sign-In configured');
  } catch (error) {
    secureError('[FirebaseAuth] Failed to configure Google Sign-In:', error);
  }
};

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
}

export type AuthProvider = 'email' | 'google' | 'apple';

class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private authStateListeners: Array<(user: FirebaseUser | null) => void> = [];

  private constructor() {
    // Listen to auth state changes
    auth().onAuthStateChanged((user) => {
      const firebaseUser = user ? this.mapFirebaseUser(user) : null;
      this.authStateListeners.forEach((listener) => listener(firebaseUser));
    });
  }

  static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }

  /**
   * Map Firebase user to our FirebaseUser interface
   */
  private mapFirebaseUser(user: FirebaseAuthTypes.User): FirebaseUser {
    const providerData = user.providerData[0];
    let providerId = 'email';
    if (providerData?.providerId === 'google.com') {
      providerId = 'google';
    } else if (providerData?.providerId === 'apple.com') {
      providerId = 'apple';
    }

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      providerId,
    };
  }

  /**
   * Get current Firebase user
   */
  getCurrentUser(): FirebaseUser | null {
    const user = auth().currentUser;
    return user ? this.mapFirebaseUser(user) : null;
  }

  /**
   * Get Firebase ID token for API calls
   * Firebase automatically refreshes the token if needed
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    const user = auth().currentUser;
    if (!user) {
      return null;
    }

    try {
      const token = await user.getIdToken(forceRefresh);
      return token;
    } catch (error) {
      secureError('[FirebaseAuth] Failed to get ID token:', error);
      return null;
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    this.authStateListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
    try {
      secureLog('[FirebaseAuth] Signing in with email...');
      const credential = await auth().signInWithEmailAndPassword(email, password);
      secureLog('[FirebaseAuth] Email sign-in successful');
      return this.mapFirebaseUser(credential.user);
    } catch (error: any) {
      secureError('[FirebaseAuth] Email sign-in failed:', error.code);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Create account with email and password
   */
  async createAccount(email: string, password: string, displayName?: string): Promise<FirebaseUser> {
    try {
      secureLog('[FirebaseAuth] Creating account with email...');
      const credential = await auth().createUserWithEmailAndPassword(email, password);

      // Update display name if provided
      if (displayName) {
        await credential.user.updateProfile({ displayName });
      }

      // Send email verification
      await credential.user.sendEmailVerification();

      secureLog('[FirebaseAuth] Account created successfully');
      return this.mapFirebaseUser(credential.user);
    } catch (error: any) {
      secureError('[FirebaseAuth] Account creation failed:', error.code);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<FirebaseUser> {
    try {
      secureLog('[FirebaseAuth] Starting Google Sign-In...');

      // Ensure Google Sign-In is configured
      configureGoogleSignIn();

      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign in with Google
      const signInResult = await GoogleSignin.signIn();

      // Get the ID token
      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token returned from Google Sign-In');
      }

      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign in to Firebase with the Google credential
      const credential = await auth().signInWithCredential(googleCredential);

      secureLog('[FirebaseAuth] Google sign-in successful');
      return this.mapFirebaseUser(credential.user);
    } catch (error: any) {
      secureError('[FirebaseAuth] Google sign-in failed:', error.code || error.message);

      // Handle Google Sign-In specific errors
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Sign-in was cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error('Sign-in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services not available');
      }

      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with Apple (iOS only)
   */
  async signInWithApple(): Promise<FirebaseUser> {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      secureLog('[FirebaseAuth] Starting Apple Sign-In...');

      // Import Apple Authentication dynamically
      const { appleAuth } = await import('@invertase/react-native-apple-authentication');

      // Check if Apple Auth is supported
      if (!appleAuth.isSupported) {
        throw new Error('Apple Sign-In is not supported on this device');
      }

      // Start the Apple sign-in request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // Ensure the request was successful
      if (!appleAuthRequestResponse.identityToken) {
        throw new Error('Apple Sign-In failed - no identity token returned');
      }

      // Create an Apple credential with the token and nonce from the response
      const { identityToken, nonce } = appleAuthRequestResponse;
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);

      // Sign in to Firebase with the Apple credential
      const credential = await auth().signInWithCredential(appleCredential);

      // Update display name if this is a new user and we have the full name
      if (appleAuthRequestResponse.fullName?.givenName) {
        const displayName = [
          appleAuthRequestResponse.fullName.givenName,
          appleAuthRequestResponse.fullName.familyName,
        ].filter(Boolean).join(' ');

        if (displayName) {
          await credential.user.updateProfile({ displayName });
        }
      }

      secureLog('[FirebaseAuth] Apple sign-in successful');
      return this.mapFirebaseUser(credential.user);
    } catch (error: any) {
      secureError('[FirebaseAuth] Apple sign-in failed:', error.code, error.message);

      // Handle Apple Sign-In specific errors
      if (error.code === '1001' || error.message?.includes('canceled')) {
        throw new Error('Sign-in was cancelled');
      }
      if (error.code === '1000') {
        // Error 1000 usually means configuration issue or Apple ID not set up
        throw new Error('Apple Sign-In failed. Please ensure you are signed into your Apple ID in Settings, or try again later.');
      }

      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out from all providers
   */
  async signOut(): Promise<void> {
    try {
      secureLog('[FirebaseAuth] Signing out...');

      // Sign out from Google if signed in with Google
      const isGoogleSignedIn = GoogleSignin.hasPreviousSignIn();
      if (isGoogleSignedIn) {
        await GoogleSignin.signOut();
      }

      // Sign out from Firebase
      await auth().signOut();

      secureLog('[FirebaseAuth] Sign out successful');
    } catch (error) {
      secureError('[FirebaseAuth] Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      secureLog('[FirebaseAuth] Sending password reset email...');
      await auth().sendPasswordResetEmail(email);
      secureLog('[FirebaseAuth] Password reset email sent');
    } catch (error: any) {
      secureError('[FirebaseAuth] Password reset failed:', error.code);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Change password for email/password users
   * Requires re-authentication with current password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    if (!user.email) {
      throw new Error('User does not have an email address');
    }

    try {
      secureLog('[FirebaseAuth] Re-authenticating user...');
      // Re-authenticate user with current password
      const credential = auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);

      secureLog('[FirebaseAuth] Updating password...');
      // Update to new password
      await user.updatePassword(newPassword);
      secureLog('[FirebaseAuth] Password changed successfully');
    } catch (error: any) {
      secureError('[FirebaseAuth] Password change failed:', error.code);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(): Promise<void> {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    try {
      await user.sendEmailVerification();
      secureLog('[FirebaseAuth] Verification email sent');
    } catch (error: any) {
      secureError('[FirebaseAuth] Send verification failed:', error.code);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Reload user to check email verification status
   */
  async reloadUser(): Promise<FirebaseUser | null> {
    const user = auth().currentUser;
    if (!user) {
      return null;
    }

    await user.reload();
    return this.mapFirebaseUser(auth().currentUser!);
  }

  /**
   * Delete user account
   * Note: This only deletes from Firebase. Backend handles PostgreSQL deletion.
   */
  async deleteAccount(): Promise<void> {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    try {
      secureLog('[FirebaseAuth] Deleting account...');

      // Sign out from Google if needed
      const isGoogleSignedIn = GoogleSignin.hasPreviousSignIn();
      if (isGoogleSignedIn) {
        await GoogleSignin.revokeAccess();
      }

      // Note: The actual deletion is handled by the backend
      // This is called after the backend confirms deletion
      await user.delete();

      secureLog('[FirebaseAuth] Account deleted');
    } catch (error: any) {
      secureError('[FirebaseAuth] Account deletion failed:', error.code);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handle Firebase auth errors and return user-friendly messages
   */
  private handleAuthError(error: any): Error {
    const errorCode = error.code || '';

    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/requires-recent-login': 'Please sign in again to complete this action.',
      'auth/account-exists-with-different-credential':
        'An account already exists with the same email but different sign-in method.',
    };

    const message = errorMessages[errorCode] || error.message || 'Authentication failed';
    return new Error(message);
  }
}

export const firebaseAuthService = FirebaseAuthService.getInstance();
