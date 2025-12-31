import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_INVITATION_KEY = '@pending_invitation_token';

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
      console.log('[DeepLink] Initial URL:', initialUrl);
      this.handleUrl(initialUrl);
    }

    // Handle links when app is already running
    Linking.addEventListener('url', (event) => {
      console.log('[DeepLink] URL event:', event.url);
      this.handleUrl(event.url);
    });

    this.initialized = true;
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
      return {
        type: 'invitation',
        token: segments[1],
        path: cleanPath,
        params: queryParams,
      };
    }

    // Handle legacy format: /accept-invitation?token=TOKEN
    if (segments[0] === 'accept-invitation' && queryParams.token) {
      return {
        type: 'invitation',
        token: queryParams.token,
        path: cleanPath,
        params: queryParams,
      };
    }

    // Handle activity links: /activity/ID
    if (segments[0] === 'activity' && segments[1]) {
      return {
        type: 'activity',
        activityId: segments[1],
        path: cleanPath,
        params: queryParams,
      };
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
    console.log('[DeepLink] Parsed data:', data);

    // Notify all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        console.error('[DeepLink] Error in listener:', error);
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
  async storePendingInvitation(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(PENDING_INVITATION_KEY, token);
      console.log('[DeepLink] Stored pending invitation:', token);
    } catch (error) {
      console.error('[DeepLink] Error storing pending invitation:', error);
    }
  }

  /**
   * Get and clear pending invitation token
   */
  async getPendingInvitation(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(PENDING_INVITATION_KEY);
      if (token) {
        await AsyncStorage.removeItem(PENDING_INVITATION_KEY);
        console.log('[DeepLink] Retrieved pending invitation:', token);
      }
      return token;
    } catch (error) {
      console.error('[DeepLink] Error getting pending invitation:', error);
      return null;
    }
  }

  /**
   * Check if there's a pending invitation
   */
  async hasPendingInvitation(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(PENDING_INVITATION_KEY);
      return token !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear any pending invitation
   */
  async clearPendingInvitation(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PENDING_INVITATION_KEY);
    } catch (error) {
      console.error('[DeepLink] Error clearing pending invitation:', error);
    }
  }
}

export const deepLinkService = DeepLinkService.getInstance();
export default deepLinkService;
