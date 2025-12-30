import { MMKV } from 'react-native-mmkv';
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
    console.warn('[FavoritesService] MMKV initialization failed:', error);
    return null;
  }
};

const FAVORITES_KEY = 'user_favorites';
const CAPACITY_ALERTS_KEY = 'capacity_alerts';

export interface FavoriteActivity {
  id: string;
  activityId: string;
  addedAt: string;
  lastCapacityCheck?: number;
  lastNotifiedCapacity?: number;
}

export interface CapacityAlert {
  activityId: string;
  capacity: number;
  timestamp: string;
  notified: boolean;
}

class FavoritesService {
  private static instance: FavoritesService;
  private favorites: FavoriteActivity[] = [];
  private capacityAlerts: CapacityAlert[] = [];

  private constructor() {
    this.loadFavorites();
    this.loadCapacityAlerts();
  }

  static getInstance(): FavoritesService {
    if (!FavoritesService.instance) {
      FavoritesService.instance = new FavoritesService();
    }
    return FavoritesService.instance;
  }

  private loadFavorites() {
    try {
      const storage = getStorage();
      const stored = storage?.getString(FAVORITES_KEY);
      if (stored) {
        this.favorites = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      this.favorites = [];
    }
  }

  private saveFavorites() {
    try {
      const storage = getStorage();
      if (storage) {
        storage.set(FAVORITES_KEY, JSON.stringify(this.favorites));
      }
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }

  private loadCapacityAlerts() {
    try {
      const storage = getStorage();
      const stored = storage?.getString(CAPACITY_ALERTS_KEY);
      if (stored) {
        this.capacityAlerts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading capacity alerts:', error);
      this.capacityAlerts = [];
    }
  }

  private saveCapacityAlerts() {
    try {
      const storage = getStorage();
      if (storage) {
        storage.set(CAPACITY_ALERTS_KEY, JSON.stringify(this.capacityAlerts));
      }
    } catch (error) {
      console.error('Error saving capacity alerts:', error);
    }
  }

  getFavorites(): FavoriteActivity[] {
    return this.favorites;
  }

  isFavorite(activityId: string): boolean {
    return this.favorites.some(fav => fav.activityId === activityId);
  }

  addFavorite(activity: Activity) {
    if (!this.isFavorite(activity.id)) {
      const favorite: FavoriteActivity = {
        id: `fav_${Date.now()}`,
        activityId: activity.id,
        addedAt: new Date().toISOString(),
        lastCapacityCheck: activity.spotsLeft,
      };
      this.favorites.push(favorite);
      this.saveFavorites();
      
      // Start monitoring capacity if spots are limited
      if (activity.spotsLeft !== undefined && activity.spotsLeft <= 10) {
        this.checkCapacityChange(activity);
      }
    }
  }

  removeFavorite(activityId: string) {
    this.favorites = this.favorites.filter(fav => fav.activityId !== activityId);
    this.saveFavorites();
    
    // Clean up capacity alerts for this activity
    this.capacityAlerts = this.capacityAlerts.filter(
      alert => alert.activityId !== activityId
    );
    this.saveCapacityAlerts();
  }

  toggleFavorite(activity: Activity) {
    if (this.isFavorite(activity.id)) {
      this.removeFavorite(activity.id);
    } else {
      this.addFavorite(activity);
    }
  }

  checkCapacityChange(activity: Activity): boolean {
    // Only check if activity has limited spots
    if (activity.spotsLeft === undefined || activity.spotsLeft > 3) {
      return false;
    }

    const favorite = this.favorites.find(fav => fav.activityId === activity.id);
    if (!favorite) return false;

    const previousCapacity = favorite.lastCapacityCheck;
    const currentCapacity = activity.spotsLeft;

    // Update last checked capacity
    favorite.lastCapacityCheck = currentCapacity;
    this.saveFavorites();

    // Check if we need to create an alert
    if (currentCapacity <= 3 && currentCapacity !== previousCapacity) {
      // Check if capacity has decreased and hit a threshold (3, 2, or 1)
      if (previousCapacity === undefined || currentCapacity < previousCapacity) {
        if (currentCapacity === 3 || currentCapacity === 2 || currentCapacity === 1) {
          // Only notify if we haven't already notified for this capacity level
          if (favorite.lastNotifiedCapacity !== currentCapacity) {
            this.createCapacityAlert(activity, currentCapacity);
            favorite.lastNotifiedCapacity = currentCapacity;
            this.saveFavorites();
            return true;
          }
        }
      }
    }

    return false;
  }

  private createCapacityAlert(activity: Activity, capacity: number) {
    const alert: CapacityAlert = {
      activityId: activity.id,
      capacity,
      timestamp: new Date().toISOString(),
      notified: false,
    };
    
    this.capacityAlerts.push(alert);
    this.saveCapacityAlerts();
    
    // This is where we would trigger a push notification
    // For now, we'll just log it
    console.log(`Capacity Alert: ${activity.name} has only ${capacity} spot${capacity === 1 ? '' : 's'} left!`);
  }

  getUnnotifiedAlerts(): CapacityAlert[] {
    return this.capacityAlerts.filter(alert => !alert.notified);
  }

  markAlertAsNotified(activityId: string) {
    const alert = this.capacityAlerts.find(a => a.activityId === activityId && !a.notified);
    if (alert) {
      alert.notified = true;
      this.saveCapacityAlerts();
    }
  }

  getCapacityAlertsForActivity(activityId: string): CapacityAlert[] {
    return this.capacityAlerts.filter(alert => alert.activityId === activityId);
  }

  clearOldAlerts(daysToKeep: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    this.capacityAlerts = this.capacityAlerts.filter(alert => {
      const alertDate = new Date(alert.timestamp);
      return alertDate > cutoffDate;
    });
    
    this.saveCapacityAlerts();
  }

  getFavoriteCount(): number {
    return this.favorites.length;
  }

  // Get activities that need capacity checking
  getActivitiesNeedingCapacityCheck(): string[] {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    return this.favorites
      .filter(fav => {
        // Check if we have capacity info and it's been checked recently
        if (fav.lastCapacityCheck !== undefined && fav.lastCapacityCheck <= 3) {
          return true;
        }
        return false;
      })
      .map(fav => fav.activityId);
  }
}

export default FavoritesService;