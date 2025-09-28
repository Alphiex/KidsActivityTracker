import { MMKV } from 'react-native-mmkv';
import { UserPreferences, FilterPreset } from '../types/preferences';

const storage = new MMKV();

const PREFERENCES_KEY = 'user_preferences';
const FILTER_PRESETS_KEY = 'filter_presets';

class PreferencesService {
  private static instance: PreferencesService;
  private preferences: UserPreferences | null = null;
  private filterPresets: FilterPreset[] = [];

  private constructor() {
    this.loadPreferences();
    this.loadFilterPresets();
  }

  static getInstance(): PreferencesService {
    if (!PreferencesService.instance) {
      PreferencesService.instance = new PreferencesService();
    }
    return PreferencesService.instance;
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      id: `user_${Date.now()}`,
      locations: [],
      ageRanges: [{ min: 0, max: 18 }],
      priceRange: { min: 0, max: 1000 },
      daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      timePreferences: {
        morning: true,
        afternoon: true,
        evening: true,
      },
      preferredCategories: [], // DEPRECATED - use preferredActivityTypes
      preferredActivityTypes: [],
      excludedCategories: [],
      notifications: {
        enabled: true,
        newActivities: true,
        favoriteCapacity: true,
        capacityThreshold: 3,
        priceDrops: true,
        weeklyDigest: true,
      },
      theme: 'dark',
      viewType: 'card',
      hideClosedActivities: false, // Individual filter (not used when hideClosedOrFull is set)
      hideFullActivities: false, // Individual filter (not used when hideClosedOrFull is set)
      hideClosedOrFull: false, // Default to showing all activities (since old activities might be closed)
      maxBudgetFriendlyAmount: 20, // Default to $20 for budget friendly
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private loadPreferences() {
    try {
      const stored = storage.getString(PREFERENCES_KEY);
      console.log('🔄 [PreferencesService] Loading preferences, stored exists:', !!stored);

      if (stored) {
        const parsed = JSON.parse(stored);

        // Perform one-time migration if needed
        let needsSave = false;
        if (parsed.hideClosedOrFull === undefined) {
          console.log('🔄 [PreferencesService] Migrating: Adding hideClosedOrFull=false for existing user');
          parsed.hideClosedOrFull = false; // Default to false to show all activities

          // Also reset individual filters if they were set
          if (parsed.hideClosedActivities === true || parsed.hideFullActivities === true) {
            console.log('🔄 [PreferencesService] Resetting individual filters during migration');
            parsed.hideClosedActivities = false;
            parsed.hideFullActivities = false;
          }
          needsSave = true;
        }

        this.preferences = parsed;
        console.log('🔄 [PreferencesService] Loaded from storage:', {
          hideClosedOrFull: this.preferences?.hideClosedOrFull,
          hideClosedActivities: this.preferences?.hideClosedActivities,
          hideFullActivities: this.preferences?.hideFullActivities
        });

        // Save back if migration occurred
        if (needsSave) {
          this.savePreferences();
        }
      } else {
        console.log('🔄 [PreferencesService] No stored preferences, using defaults');
        this.preferences = this.getDefaultPreferences();
        this.savePreferences();
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      this.preferences = this.getDefaultPreferences();
    }
  }

  private savePreferences() {
    try {
      if (this.preferences) {
        this.preferences.updatedAt = new Date().toISOString();
        storage.set(PREFERENCES_KEY, JSON.stringify(this.preferences));
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  getPreferences(): UserPreferences {
    if (!this.preferences) {
      this.loadPreferences();
    }
    return this.preferences!;
  }

  updatePreferences(updates: Partial<UserPreferences>) {
    console.log('💾 [PreferencesService] Updating preferences with:', updates);
    console.log('💾 [PreferencesService] Current preferences before update:', {
      hideClosedOrFull: this.preferences?.hideClosedOrFull,
      hideClosedActivities: this.preferences?.hideClosedActivities,
      hideFullActivities: this.preferences?.hideFullActivities
    });

    // Deep merge to preserve nested objects
    this.preferences = {
      ...this.preferences!,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    console.log('💾 [PreferencesService] New preferences after update:', {
      hideClosedOrFull: this.preferences.hideClosedOrFull,
      hideClosedActivities: this.preferences.hideClosedActivities,
      hideFullActivities: this.preferences.hideFullActivities
    });

    this.savePreferences();
    return this.preferences;
  }

  // Location preferences
  addLocation(location: string) {
    if (!this.preferences!.locations.includes(location)) {
      this.preferences!.locations.push(location);
      this.savePreferences();
    }
  }

  removeLocation(location: string) {
    this.preferences!.locations = this.preferences!.locations.filter(
      (loc) => loc !== location
    );
    this.savePreferences();
  }

  // Age range preferences
  addAgeRange(min: number, max: number) {
    this.preferences!.ageRanges.push({ min, max });
    this.savePreferences();
  }

  removeAgeRange(index: number) {
    this.preferences!.ageRanges.splice(index, 1);
    this.savePreferences();
  }

  // Category preferences
  toggleCategory(category: string, preferred: boolean) {
    if (preferred) {
      if (!this.preferences!.preferredCategories.includes(category)) {
        this.preferences!.preferredCategories.push(category);
      }
      this.preferences!.excludedCategories = this.preferences!.excludedCategories.filter(
        (cat) => cat !== category
      );
    } else {
      this.preferences!.preferredCategories = this.preferences!.preferredCategories.filter(
        (cat) => cat !== category
      );
      if (!this.preferences!.excludedCategories.includes(category)) {
        this.preferences!.excludedCategories.push(category);
      }
    }
    this.savePreferences();
  }

  // Filter presets
  private loadFilterPresets() {
    try {
      const stored = storage.getString(FILTER_PRESETS_KEY);
      if (stored) {
        this.filterPresets = JSON.parse(stored);
      } else {
        this.filterPresets = this.getDefaultFilterPresets();
        this.saveFilterPresets();
      }
    } catch (error) {
      console.error('Error loading filter presets:', error);
      this.filterPresets = this.getDefaultFilterPresets();
    }
  }

  private saveFilterPresets() {
    try {
      storage.set(FILTER_PRESETS_KEY, JSON.stringify(this.filterPresets));
    } catch (error) {
      console.error('Error saving filter presets:', error);
    }
  }

  private getDefaultFilterPresets(): FilterPreset[] {
    return [
      {
        id: 'weekend',
        name: 'Weekend Activities',
        filters: {
          daysOfWeek: ['Saturday', 'Sunday'],
        },
        isDefault: false,
      },
      {
        id: 'budget',
        name: 'Budget Friendly',
        filters: {
          priceRange: { min: 0, max: 100 },
        },
        isDefault: false,
      },
      {
        id: 'toddlers',
        name: 'Toddlers (2-4)',
        filters: {
          ageRanges: [{ min: 2, max: 4 }],
        },
        isDefault: false,
      },
    ];
  }

  getFilterPresets(): FilterPreset[] {
    return this.filterPresets;
  }

  saveFilterPreset(preset: FilterPreset) {
    const existingIndex = this.filterPresets.findIndex((p) => p.id === preset.id);
    if (existingIndex >= 0) {
      this.filterPresets[existingIndex] = preset;
    } else {
      this.filterPresets.push(preset);
    }
    this.saveFilterPresets();
  }

  deleteFilterPreset(id: string) {
    this.filterPresets = this.filterPresets.filter((p) => p.id !== id);
    this.saveFilterPresets();
  }

  // Check if activity matches preferences
  matchesPreferences(activity: any): boolean {
    const prefs = this.preferences!;
    
    // Check age range
    const ageMatch = prefs.ageRanges.some(
      (range) => 
        activity.ageRange.min <= range.max && 
        activity.ageRange.max >= range.min
    );
    if (!ageMatch) return false;

    // Check price
    if (activity.cost < prefs.priceRange.min || activity.cost > prefs.priceRange.max) {
      return false;
    }

    // Check excluded categories
    if (prefs.excludedCategories.includes(activity.category)) {
      return false;
    }

    // Check location if specified
    if (prefs.locations.length > 0 && !prefs.locations.includes(activity.location)) {
      return false;
    }

    return true;
  }

  // Notification check
  shouldNotifyForActivity(activity: any): boolean {
    if (!this.preferences!.notifications.enabled) return false;
    if (!this.preferences!.notifications.newActivities) return false;
    
    return this.matchesPreferences(activity);
  }

  // Reset preferences
  resetPreferences() {
    this.preferences = this.getDefaultPreferences();
    this.savePreferences();
  }

  // Mark onboarding complete
  completeOnboarding() {
    this.preferences!.hasCompletedOnboarding = true;
    this.savePreferences();
  }
}

export default PreferencesService;