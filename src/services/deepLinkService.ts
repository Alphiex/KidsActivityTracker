import { Linking, EmitterSubscription } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_INVITATION_KEY = '@pending_invitation_token';
// Only allow alphanumeric tokens with hyphens/underscores for security
const TOKEN_REGEX = /^[a-zA-Z0-9_-]+$/;

export interface DeepLinkData {
  type: 'invitation' | 'activity' | 'unknown';
  token?: string;
  activityId?: string;
  path: string;
  params: Record<string, string>;
}

class DeepLinkService {
  private static instance: DeepLinkService;
  private listeners: ((data: DeepLinkData) => void)[] = [];
  private initialized = false;
  private linkingSubscription: EmitterSubscription | null = null;

  private constructor() {}

  static getInstance(): DeepLinkService {
    if (!DeepLinkService.instance) {
      DeepLinkService.instance = new DeepLinkService();
    }
    return DeepLinkService.instance;
  }

  /**
   * Initialize the deep link service
   * Should be called once when the app starts
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Handle app opened from a link when app was closed
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      if (__DEV__) console.log('[DeepLink] Initial URL received');
      this.handleUrl(initialUrl);
    }

    // Handle links when app is already running
    this.linkingSubscription = Linking.addEventListener('url', (event) => {
      if (__DEV__) console.log('[DeepLink] URL event received');
      this.handleUrl(event.url);
    });

    this.initialized = true;
  }

  /**
   * Cleanup the deep link service
   */
  cleanup(): void {
    if (this.linkingSubscription) {
      this.linkingSubscription.remove();
      this.linkingSubscription = null;
    }
    this.listeners = [];
    this.initialized = false;
  }

  /**
   * Validate a token format for security
   */
  private isValidToken(token: string): boolean {
    return TOKEN_REGEX.test(token) && token.length > 0 && token.length <= 128;
  }

  /**
   * Parse a URL and extract deep link data
   */
  parseUrl(url: string): DeepLinkData {
    try {
      // Handle custom scheme: kidsactivitytracker://invite/TOKEN
      if (url.startsWith('kidsactivitytracker://')) {
        const path = url.replace('kidsactivitytracker://', '');
        return this.parsePathAndParams(path);
      }

      // Handle universal links: https://kidsactivitytracker.ca/invite/TOKEN
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const params: Record<string, string> = {};
      
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return this.parsePathAndParams(path, params);
    } catch (error) {
      console.error('[DeepLink] Error parsing URL:', error);
      return {
        type: 'unknown',
        path: url,
        params: {},
      };
    }
  }

  private parsePathAndParams(
    path: string,
    queryParams: Record<string, string> = {}
  ): DeepLinkData {
    // Remove leading slash
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const segments = cleanPath.split('/').filter(Boolean);

    // Handle invitation links: /invite/TOKEN
    if (segments[0] === 'invite' && segments[1]) {
      const token = decodeURIComponent(segments[1]);
      if (this.isValidToken(token)) {
        return {
          type: 'invitation',
          token,
          path: cleanPath,
          params: queryParams,
        };
      }
      // Invalid token format - treat as unknown
      if (__DEV__) console.warn('[DeepLink] Invalid invitation token format');
      return { type: 'unknown', path: cleanPath, params: queryParams };
    }

    // Handle legacy format: /accept-invitation?token=TOKEN
    if (segments[0] === 'accept-invitation' && queryParams.token) {
      const token = queryParams.token;
      if (this.isValidToken(token)) {
        return {
          type: 'invitation',
          token,
          path: cleanPath,
          params: queryParams,
        };
      }
      if (__DEV__) console.warn('[DeepLink] Invalid invitation token format');
      return { type: 'unknown', path: cleanPath, params: queryParams };
    }

    // Handle activity links: /activity/ID
    if (segments[0] === 'activity' && segments[1]) {
      const activityId = decodeURIComponent(segments[1]);
      if (this.isValidToken(activityId)) {
        return {
          type: 'activity',
          activityId,
          path: cleanPath,
          params: queryParams,
        };
      }
      if (__DEV__) console.warn('[DeepLink] Invalid activity ID format');
      return { type: 'unknown', path: cleanPath, params: queryParams };
    }

    return {
      type: 'unknown',
      path: cleanPath,
      params: queryParams,
    };
  }

  /**
   * Handle an incoming URL
   */
  private handleUrl(url: string): void {
    const data = this.parseUrl(url);
    if (__DEV__) console.log('[DeepLink] Parsed type:', data.type);

    // Notify all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        if (__DEV__) console.error('[DeepLink] Error in listener:', error);
      }
    });
  }

  /**
   * Add a listener for deep link events
   */
  addListener(callback: (data: DeepLinkData) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Store a pending invitation token for processing after login
   */
  async storePendingInvitation(token: string): Promise<boolean> {
    if (!this.isValidToken(token)) {
      if (__DEV__) console.warn('[DeepLink] Attempted to store invalid token');
      return false;
    }
    try {
      await AsyncStorage.setItem(PENDING_INVITATION_KEY, token);
      if (__DEV__) console.log('[DeepLink] Stored pending invitation');
      return true;
    } catch (error) {
      if (__DEV__) console.error('[DeepLink] Error storing pending invitation:', error);
      return false;
    }
  }

  /**
   * Get and clear pending invitation token atomically
   */
  async getPendingInvitation(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(PENDING_INVITATION_KEY);
      if (token) {
        // Clear immediately to prevent duplicate processing
        await AsyncStorage.removeItem(PENDING_INVITATION_KEY);
        // Validate token before returning
        if (this.isValidToken(token)) {
          if (__DEV__) console.log('[DeepLink] Retrieved pending invitation');
          return token;
        }
        if (__DEV__) console.warn('[DeepLink] Stored token was invalid');
      }
      return null;
    } catch (error) {
      if (__DEV__) console.error('[DeepLink] Error getting pending invitation:', error);
      return null;
    }
  }

  /**
   * Check if there's a pending invitation
   */
  async hasPendingInvitation(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(PENDING_INVITATION_KEY);
      return token !== null && this.isValidToken(token);
    } catch {
      return false;
    }
  }

  /**
   * Clear any pending invitation
   */
  async clearPendingInvitation(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PENDING_INVITATION_KEY);
    } catch {
      // Silently fail - not critical
    }
  }
}

export const deepLinkService = DeepLinkService.getInstance();
export default deepLinkService;
