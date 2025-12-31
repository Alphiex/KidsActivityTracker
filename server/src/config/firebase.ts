/**
 * Firebase Admin SDK Configuration
 * Shared initialization for FCM and Firebase Authentication
 */

import admin from 'firebase-admin';

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Safe to call multiple times - will only initialize once
 */
export function initializeFirebase(): boolean {
  if (firebaseInitialized) {
    return true;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT env var not set');
    console.warn('[Firebase] Firebase Auth and FCM will be disabled');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('[Firebase] Admin SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('[Firebase] Failed to initialize Admin SDK:', error);
    return false;
  }
}

/**
 * Check if Firebase is initialized
 */
export function isFirebaseInitialized(): boolean {
  return firebaseInitialized;
}

/**
 * Get Firebase Auth instance
 * Returns null if Firebase is not initialized
 */
export function getFirebaseAuth(): admin.auth.Auth | null {
  if (!initializeFirebase()) {
    return null;
  }
  return admin.auth();
}

/**
 * Get Firebase Messaging instance
 * Returns null if Firebase is not initialized
 */
export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  if (!initializeFirebase()) {
    return null;
  }
  return admin.messaging();
}

/**
 * Verify a Firebase ID token
 * Returns the decoded token if valid, null otherwise
 */
export async function verifyFirebaseToken(
  idToken: string
): Promise<admin.auth.DecodedIdToken | null> {
  const auth = getFirebaseAuth();
  if (!auth) {
    console.error('[Firebase] Cannot verify token - Firebase not initialized');
    return null;
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    // Don't log full error for common cases like expired tokens
    if (error.code === 'auth/id-token-expired') {
      console.log('[Firebase] Token expired');
    } else if (error.code === 'auth/argument-error') {
      console.log('[Firebase] Invalid token format');
    } else {
      console.error('[Firebase] Token verification failed:', error.message);
    }
    return null;
  }
}

/**
 * Get a Firebase user by UID
 */
export async function getFirebaseUser(
  uid: string
): Promise<admin.auth.UserRecord | null> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return null;
  }

  try {
    return await auth.getUser(uid);
  } catch (error) {
    console.error('[Firebase] Failed to get user:', error);
    return null;
  }
}

/**
 * Delete a Firebase user by UID
 */
export async function deleteFirebaseUser(uid: string): Promise<boolean> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return false;
  }

  try {
    await auth.deleteUser(uid);
    console.log(`[Firebase] User ${uid} deleted`);
    return true;
  } catch (error) {
    console.error('[Firebase] Failed to delete user:', error);
    return false;
  }
}

// Export the admin instance for direct access if needed
export { admin };
