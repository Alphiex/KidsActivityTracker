import { MMKV } from 'react-native-mmkv';
import NotificationService, { WaitlistEntry } from './notificationService';
import { Activity } from '../types';

// Lazy initialization to avoid JSI issues on Android
let _storage: MMKV | null = null;
let _storageInitAttempted = false;

const getStorage = (): MMKV | null => {
  if (_storage) return _storage;

  if (_storageInitAttempted) return null;

  try {
    _storage = new MMKV();
    return _storage;
  } catch (error) {
    _storageInitAttempted = true;
    console.warn('[WaitlistService] MMKV initialization failed:', error);
    return null;
  }
};

const WAITLIST_CACHE_KEY = 'waitlist_cache';
const WAITLIST_IDS_KEY = 'waitlist_ids';

export interface CachedWaitlistEntry extends WaitlistEntry {
  hasAvailability?: boolean;
}

class WaitlistService {
  private static instance: WaitlistService;
  private notificationService: NotificationService;
  private cachedEntries: CachedWaitlistEntry[] = [];
  private waitlistIds: Set<string> = new Set();
  private lastFetched: number = 0;
  private isFetching: boolean = false;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
    this.loadCache();
  }

  static getInstance(): WaitlistService {
    if (!WaitlistService.instance) {
      WaitlistService.instance = new WaitlistService();
    }
    return WaitlistService.instance;
  }

  /**
   * Load cached data from MMKV
   */
  private loadCache(): void {
    try {
      const storage = getStorage();

      // Load cached entries
      const entriesJson = storage?.getString(WAITLIST_CACHE_KEY);
      if (entriesJson) {
        this.cachedEntries = JSON.parse(entriesJson);
      }

      // Load waitlist IDs for fast lookup
      const idsJson = storage?.getString(WAITLIST_IDS_KEY);
      if (idsJson) {
        this.waitlistIds = new Set(JSON.parse(idsJson));
      }
    } catch (error) {
      console.error('[WaitlistService] Error loading cache:', error);
      this.cachedEntries = [];
      this.waitlistIds = new Set();
    }
  }

  /**
   * Save cache to MMKV
   */
  private saveCache(): void {
    try {
      const storage = getStorage();
      if (storage) {
        storage.set(WAITLIST_CACHE_KEY, JSON.stringify(this.cachedEntries));
        storage.set(WAITLIST_IDS_KEY, JSON.stringify([...this.waitlistIds]));
      }
    } catch (error) {
      console.error('[WaitlistService] Error saving cache:', error);
    }
  }

  /**
   * Check if activity is on waitlist (fast, from cache)
   */
  isOnWaitlist(activityId: string): boolean {
    return this.waitlistIds.has(activityId);
  }

  /**
   * Get all waitlist entries (from cache, fetches if stale)
   */
  async getWaitlist(forceRefresh: boolean = false): Promise<CachedWaitlistEntry[]> {
    const cacheAge = Date.now() - this.lastFetched;
    const isCacheStale = cacheAge > 5 * 60 * 1000; // 5 minutes

    if (forceRefresh || isCacheStale) {
      await this.refreshFromServer();
    }

    return this.cachedEntries;
  }

  /**
   * Refresh waitlist from server
   */
  async refreshFromServer(): Promise<void> {
    if (this.isFetching) return;

    this.isFetching = true;
    try {
      const entries = await this.notificationService.getWaitlist();

      // Update cache with availability flag
      this.cachedEntries = entries.map(entry => ({
        ...entry,
        hasAvailability: (entry.activity?.spotsAvailable ?? 0) > 0,
      }));

      // Update ID set for fast lookups
      this.waitlistIds = new Set(entries.map(e => e.activityId));

      this.lastFetched = Date.now();
      this.saveCache();
    } catch (error) {
      console.error('[WaitlistService] Error refreshing from server:', error);
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Join waitlist for an activity (optimistic update)
   */
  async joinWaitlist(activity: Activity): Promise<{ success: boolean; message?: string }> {
    const activityId = activity.id;

    // Optimistic update
    this.waitlistIds.add(activityId);
    const optimisticEntry: CachedWaitlistEntry = {
      id: `temp_${Date.now()}`,
      activityId,
      activity: {
        id: activity.id,
        name: activity.name,
        provider: typeof activity.provider === 'string' ? activity.provider : (activity.provider as any)?.name,
        location: typeof activity.location === 'string'
          ? activity.location
          : activity.location?.name || activity.locationName,
        spotsAvailable: activity.spotsAvailable ?? activity.spotsLeft,
        cost: activity.cost,
      },
      joinedAt: new Date().toISOString(),
      hasAvailability: (activity.spotsAvailable ?? activity.spotsLeft ?? 0) > 0,
    };
    this.cachedEntries.push(optimisticEntry);
    this.saveCache();

    // Make API call
    const result = await this.notificationService.joinWaitlist(activityId);

    if (!result.success) {
      // Rollback on failure
      this.waitlistIds.delete(activityId);
      this.cachedEntries = this.cachedEntries.filter(e => e.activityId !== activityId);
      this.saveCache();
    } else {
      // Refresh to get real ID
      await this.refreshFromServer();
    }

    return result;
  }

  /**
   * Leave waitlist for an activity (optimistic update)
   */
  async leaveWaitlist(activityId: string): Promise<{ success: boolean; message?: string }> {
    // Store for potential rollback
    const removedEntry = this.cachedEntries.find(e => e.activityId === activityId);

    // Optimistic update
    this.waitlistIds.delete(activityId);
    this.cachedEntries = this.cachedEntries.filter(e => e.activityId !== activityId);
    this.saveCache();

    // Make API call
    const result = await this.notificationService.leaveWaitlist(activityId);

    if (!result.success && removedEntry) {
      // Rollback on failure
      this.waitlistIds.add(activityId);
      this.cachedEntries.push(removedEntry);
      this.saveCache();
    }

    return result;
  }

  /**
   * Toggle waitlist status for an activity
   */
  async toggleWaitlist(activity: Activity): Promise<{ success: boolean; isOnWaitlist: boolean; message?: string }> {
    const isCurrentlyOnWaitlist = this.isOnWaitlist(activity.id);

    if (isCurrentlyOnWaitlist) {
      const result = await this.leaveWaitlist(activity.id);
      return { ...result, isOnWaitlist: !result.success };
    } else {
      const result = await this.joinWaitlist(activity);
      return { ...result, isOnWaitlist: result.success };
    }
  }

  /**
   * Get count of waitlist entries
   */
  getWaitlistCount(): number {
    return this.waitlistIds.size;
  }

  /**
   * Get count of activities with spots now available
   */
  getAvailableCount(): number {
    return this.cachedEntries.filter(e => e.hasAvailability).length;
  }

  /**
   * Get waitlist entries with spots available
   */
  getAvailableEntries(): CachedWaitlistEntry[] {
    return this.cachedEntries.filter(e => e.hasAvailability);
  }

  /**
   * Clear all cached data (for logout)
   */
  clearCache(): void {
    this.cachedEntries = [];
    this.waitlistIds = new Set();
    this.lastFetched = 0;

    try {
      const storage = getStorage();
      if (storage) {
        storage.delete(WAITLIST_CACHE_KEY);
        storage.delete(WAITLIST_IDS_KEY);
      }
    } catch (error) {
      console.error('[WaitlistService] Error clearing cache:', error);
    }
  }

  /**
   * Get a specific waitlist entry
   */
  getEntry(activityId: string): CachedWaitlistEntry | undefined {
    return this.cachedEntries.find(e => e.activityId === activityId);
  }
}

export default WaitlistService;
