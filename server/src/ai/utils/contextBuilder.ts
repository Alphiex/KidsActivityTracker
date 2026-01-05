import { FamilyContext, ChildProfile, FamilyPreferences } from '../types/ai.types';
import { EnhancedChildProfile, EnhancedFamilyContext } from '../agents/activityAssistantAgent';
import { PrismaClient } from '../../../generated/prisma';
import { ScoringContext, ChildProfile as ScorerChildProfile, UserPreferences } from './activityScorer';

// Singleton prisma for enhanced context builder
let _prismaEnhanced: PrismaClient | null = null;

function getPrismaEnhanced(): PrismaClient {
  if (!_prismaEnhanced) {
    _prismaEnhanced = new PrismaClient();
  }
  return _prismaEnhanced;
}

/**
 * Build family context from user data
 * This fetches and normalizes child profiles and preferences
 * Includes child-specific preferences for personalized recommendations
 */
export async function buildFamilyContext(
  userId: string | undefined,
  prisma: any
): Promise<FamilyContext> {
  if (!userId) {
    return getDefaultFamilyContext();
  }

  try {
    // Fetch user with children, their preferences, activities, and favorites
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        children: {
          where: { isActive: true },
          include: {
            preferences: true,
            childActivities: {
              include: {
                activity: {
                  select: { id: true, name: true, category: true },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
            childFavorites: {
              include: {
                activity: {
                  select: { id: true, name: true, category: true },
                },
              },
              take: 10,
            },
          },
        },
      },
    });

    if (!user) {
      return getDefaultFamilyContext();
    }

    // Calculate ages and build child profiles with enhanced data
    const children: ChildProfile[] = (user.children || []).map((child: any) => {
      const age = calculateAge(child.dateOfBirth);
      const childPrefs = child.preferences;

      // Build activity history summary
      const activityHistory: { enrolled: string[]; completed: string[]; interested: string[] } = {
        enrolled: [],
        completed: [],
        interested: [],
      };
      if (child.childActivities) {
        for (const ca of child.childActivities) {
          if (ca.status === 'enrolled') activityHistory.enrolled.push(ca.activity.name);
          else if (ca.status === 'completed') activityHistory.completed.push(ca.activity.name);
          else if (ca.status === 'interested') activityHistory.interested.push(ca.activity.name);
        }
      }

      // Build favorites list
      const favorites = child.childFavorites?.map((f: any) => f.activity.name) || [];

      return {
        child_id: child.id,
        name: child.name,
        age,
        gender: child.gender,
        age_range: { min: Math.max(0, age - 1), max: age + 1 },
        interests: child.interests || [],
        // Include enhanced data as additional fields
        preferences: childPrefs ? {
          activity_types: childPrefs.preferredActivityTypes || [],
          days_of_week: childPrefs.daysOfWeek || [],
          time_preferences: childPrefs.timePreferences,
          budget_max: childPrefs.priceRangeMax,
          distance_km: childPrefs.distanceRadiusKm,
          environment: childPrefs.environmentFilter,
        } : undefined,
        activity_history: activityHistory,
        favorites,
      };
    });

    // Parse user preferences (stored as JSON in preferences field)
    const prefs = parseUserPreferences(user.preferences);

    // Merge child preferences into family preferences
    // Use union of all children's preferred activity types
    const allChildActivityTypes = new Set<string>();
    const allChildDays = new Set<string>();
    for (const child of user.children || []) {
      if (child.preferences?.preferredActivityTypes) {
        child.preferences.preferredActivityTypes.forEach((t: string) => allChildActivityTypes.add(t));
      }
      if (child.preferences?.daysOfWeek) {
        child.preferences.daysOfWeek.forEach((d: string) => allChildDays.add(d));
      }
    }

    // Merge child preferences with user preferences (child preferences take priority)
    if (allChildActivityTypes.size > 0 && !prefs.preferred_categories?.length) {
      prefs.preferred_categories = Array.from(allChildActivityTypes);
    }
    if (allChildDays.size > 0 && allChildDays.size < 7 && !prefs.days_of_week?.length) {
      prefs.days_of_week = Array.from(allChildDays);
    }

    // Build location from child preferences first, then user preferences
    // DEBUG: Log all child preferences to see what savedAddress looks like
    console.log('[Context Builder] Child preferences for location:', user.children?.map((c: any) => ({
      childName: c.name,
      hasPreferences: !!c.preferences,
      savedAddress: c.preferences?.savedAddress,
      savedAddressType: typeof c.preferences?.savedAddress,
    })));

    const childWithLocation = user.children?.find((c: any) => c.preferences?.savedAddress);
    let locationData;

    if (childWithLocation?.preferences?.savedAddress) {
      const addr = childWithLocation.preferences.savedAddress as any;
      console.log('[Context Builder] Found child with location:', {
        childName: childWithLocation.name,
        rawSavedAddress: childWithLocation.preferences.savedAddress,
        parsedAddr: addr,
      });
      locationData = {
        city: addr.city,
        latitude: addr.latitude,
        longitude: addr.longitude,
      };
    } else {
      console.log('[Context Builder] No child with savedAddress found, falling back to user preferences');
      const rawPrefs = typeof user.preferences === 'string'
        ? JSON.parse(user.preferences)
        : user.preferences || {};

      locationData = rawPrefs.locations && rawPrefs.locations.length > 0
        ? { city: rawPrefs.locations[0], cities: rawPrefs.locations }
        : rawPrefs.preferredLocation
          ? { city: rawPrefs.preferredLocation }
          : undefined;
    }

    console.log('[Context Builder] Built family context:', {
      childCount: children.length,
      childAges: children.map(c => c.age),
      childNames: children.map(c => c.name),
      hasLocation: !!locationData,
      locationCity: locationData?.city,
      preferredCategories: prefs.preferred_categories || [],
      childActivityTypes: Array.from(allChildActivityTypes),
    });

    return {
      children,
      preferences: prefs,
      location: locationData
    };
  } catch (error) {
    console.error('[Context Builder] Error fetching family context:', error);
    return getDefaultFamilyContext();
  }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: Date | string | null): number {
  if (!dateOfBirth) return 5; // Default assumption
  
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return Math.max(0, Math.min(18, age));
}

/**
 * Parse user preferences from stored JSON
 */
function parseUserPreferences(preferences: any): FamilyPreferences {
  if (!preferences) return {};
  
  // Handle string JSON
  const prefs = typeof preferences === 'string' 
    ? JSON.parse(preferences) 
    : preferences;

  return {
    budget_monthly: prefs.priceRange?.max || prefs.maxPrice,
    max_distance_km: prefs.maxDistance,
    days_of_week: prefs.daysOfWeek || prefs.preferredDays,
    preferred_categories: prefs.preferredActivityTypes || prefs.preferredCategories || prefs.activityTypes,
    excluded_categories: prefs.excludedCategories,
    // Include location preferences
    locations: prefs.locations || (prefs.preferredLocation ? [prefs.preferredLocation] : undefined)
  };
}

/**
 * Get default family context when no user data available
 */
function getDefaultFamilyContext(): FamilyContext {
  return {
    children: [],
    preferences: {},
    location: undefined
  };
}

/**
 * Build a simple family context from request filters
 * Used when we don't have a logged-in user
 */
export function buildContextFromFilters(filters: any): FamilyContext {
  const children: ChildProfile[] = [];
  
  // If age filters provided, create a synthetic child
  if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
    const ageMin = filters.ageMin ?? 0;
    const ageMax = filters.ageMax ?? 18;
    const avgAge = Math.round((ageMin + ageMax) / 2);
    
    children.push({
      child_id: 'filter-child',
      age: avgAge,
      age_range: { min: ageMin, max: ageMax },
      interests: []
    });
  }

  return {
    children,
    preferences: {
      max_distance_km: filters.maxDistance,
      days_of_week: filters.dayOfWeek,
      budget_monthly: filters.costMax ? filters.costMax * 4 : undefined // Weekly to monthly
    },
    location: filters.location ? { city: filters.location } : undefined
  };
}

/**
 * Build enhanced family context with favorites, calendar activities, and computed preferences
 * Used by the chat agent for personalized recommendations
 * @param userId User ID
 * @param selectedChildIds Optional array of specific child IDs to include
 * @param mode How to select children: 'specific' (only selectedChildIds), 'all' (all children), 'auto' (selectedChildIds if provided, else all)
 * @param filterMode For multi-child selection: 'or' (activities for ANY child) or 'and' (activities ALL children can do together)
 */
export async function buildEnhancedFamilyContext(
  userId: string,
  selectedChildIds?: string[],
  mode: 'specific' | 'all' | 'auto' = 'all',
  filterMode: 'or' | 'and' = 'or'
): Promise<EnhancedFamilyContext> {
  const prisma = getPrismaEnhanced();

  // Get user with preferences (location stored in preferences JSON) - kept for fallback
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferences: true,
    },
  });

  // Get children with their activities, favorites, watching, waitlist, AND child-specific preferences
  const children = await prisma.child.findMany({
    where: {
      userId,
      isActive: true,
      ...(selectedChildIds?.length && mode === 'specific' ? { id: { in: selectedChildIds } } : {}),
    },
    include: {
      childActivities: {
        include: {
          activity: {
            select: { id: true, name: true, category: true, cost: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30, // Increased to capture more history
      },
      skillProgress: {
        select: { skillCategory: true, currentLevel: true },
      },
      // Include child-specific preferences
      preferences: true,
      // Child-specific favorites
      childFavorites: {
        include: {
          activity: {
            select: { id: true, name: true, category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      },
      // Child-specific watching (monitoring for notifications)
      childWatching: {
        include: {
          activity: {
            select: { id: true, name: true, category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      // Child-specific waitlist
      childWaitlistEntries: {
        include: {
          activity: {
            select: { id: true, name: true, category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  // Get user favorites as fallback (for backwards compatibility)
  const userFavorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      activity: {
        select: { id: true, name: true, category: true, ageMin: true, ageMax: true },
      },
    },
    take: 30,
    orderBy: { createdAt: 'desc' },
  });

  // Build enhanced profiles for each child
  const enhancedChildren: EnhancedChildProfile[] = children.map(child => {
    const age = calculateAgeEnhanced(child.dateOfBirth);
    const childPrefs = child.preferences;

    // Use child-specific favorites, or fall back to user favorites filtered by age
    const favorites = child.childFavorites?.length
      ? child.childFavorites.map(f => ({ activity: f.activity }))
      : userFavorites.filter(f => {
          const minAge = f.activity.ageMin ?? 0;
          const maxAge = f.activity.ageMax ?? 99;
          return age >= minAge && age <= maxAge;
        });

    // Compute category preferences from behavior + explicit preferences
    const categoryCount: Record<string, number> = {};
    [...favorites.map(f => f.activity), ...child.childActivities.map(ca => ca.activity)]
      .forEach(a => {
        if (a.category) {
          categoryCount[a.category] = (categoryCount[a.category] || 0) + 1;
        }
      });

    const computedCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);

    // Combine explicit preferences with computed ones (explicit takes priority)
    const preferredCategories = childPrefs?.preferredActivityTypes?.length
      ? childPrefs.preferredActivityTypes
      : computedCategories;

    return {
      child_id: child.id,
      name: child.name,
      age,
      gender: child.gender || undefined,
      interests: child.interests || [],
      favorites: favorites.slice(0, 15).map(f => ({
        activityName: f.activity.name,
        category: f.activity.category,
      })),
      // Activities being watched for notifications (spots available, price changes)
      watching: child.childWatching?.map(w => ({
        activityName: w.activity.name,
        category: w.activity.category,
      })) || [],
      // Activities on waitlist
      waitlisted: child.childWaitlistEntries?.map(w => ({
        activityName: w.activity.name,
        category: w.activity.category,
      })) || [],
      calendarActivities: child.childActivities.map(ca => ({
        name: ca.activity.name,
        category: ca.activity.category,
        status: ca.status,
      })),
      // Include child-specific preferences
      preferences: childPrefs ? {
        location: childPrefs.savedAddress as any,
        activityTypes: childPrefs.preferredActivityTypes || [],
        daysOfWeek: childPrefs.daysOfWeek || [],
        timePreferences: childPrefs.timePreferences as any,
        budget: {
          min: childPrefs.priceRangeMin || 0,
          max: childPrefs.priceRangeMax || 999999,
        },
        distanceRadiusKm: childPrefs.distanceRadiusKm || 25,
        environmentFilter: childPrefs.environmentFilter as 'all' | 'indoor' | 'outdoor',
      } : undefined,
      computedPreferences: {
        preferredCategories,
        preferredDays: childPrefs?.daysOfWeek || [],
      },
    };
  });

  // Get location from first selected child's preferences, or fallback to user preferences
  const firstChildWithLocation = enhancedChildren.find(c => c.preferences?.location?.latitude);
  const userPrefs = typeof user?.preferences === 'string'
    ? JSON.parse(user.preferences)
    : user?.preferences || {};

  // Determine location: child preferences first, then user preferences fallback
  let location;
  if (firstChildWithLocation?.preferences?.location) {
    const childLoc = firstChildWithLocation.preferences.location;
    location = {
      city: childLoc.city || userPrefs.locations?.[0],
      province: childLoc.state || userPrefs.province,
      lat: childLoc.latitude,
      lng: childLoc.longitude,
    };
  } else {
    const locationCity = userPrefs.locations?.[0] || userPrefs.preferredLocation || userPrefs.city;
    location = locationCity ? {
      city: locationCity,
      province: userPrefs.province || undefined,
      lat: userPrefs.latitude || undefined,
      lng: userPrefs.longitude || undefined,
    } : undefined;
  }

  return {
    children: enhancedChildren,
    location,
    filterMode, // Include filter mode for OR/AND logic
  };
}

/**
 * Calculate age for enhanced context
 */
function calculateAgeEnhanced(dateOfBirth: Date | string | null): number {
  if (!dateOfBirth) return 5;

  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return Math.max(0, Math.min(18, age));
}

/**
 * Merge child preferences based on filter mode
 * OR mode: Union of preferences (activities suitable for ANY child)
 * AND mode: Intersection (activities ALL children can do together)
 */
function mergeChildPreferences(
  children: any[],
  filterMode: 'or' | 'and'
): {
  activityTypes?: string[];
  daysOfWeek?: string[];
  priceRange?: { min?: number; max?: number };
  timePreferences?: { morning: boolean; afternoon: boolean; evening: boolean };
  distanceRadiusKm?: number;
  environmentFilter?: 'all' | 'indoor' | 'outdoor';
} {
  const childrenWithPrefs = children.filter(c => c.preferences);

  if (childrenWithPrefs.length === 0) {
    return {};
  }

  if (filterMode === 'or') {
    // OR mode: Union - show activities for ANY selected child
    const activityTypes = new Set<string>();
    const daysOfWeek = new Set<string>();
    let priceMin = Infinity;
    let priceMax = 0;
    let maxDistance = 0;
    const timePreferences = { morning: false, afternoon: false, evening: false };

    for (const child of childrenWithPrefs) {
      const prefs = child.preferences;

      // Union of activity types
      (prefs.preferredActivityTypes || []).forEach((t: string) => activityTypes.add(t));

      // Union of days
      (prefs.daysOfWeek || []).forEach((d: string) => daysOfWeek.add(d));

      // Widest price range
      priceMin = Math.min(priceMin, prefs.priceRangeMin || 0);
      priceMax = Math.max(priceMax, prefs.priceRangeMax || 999999);

      // Maximum distance
      maxDistance = Math.max(maxDistance, prefs.distanceRadiusKm || 25);

      // Any time is true
      const tp = prefs.timePreferences as any;
      if (tp?.morning) timePreferences.morning = true;
      if (tp?.afternoon) timePreferences.afternoon = true;
      if (tp?.evening) timePreferences.evening = true;
    }

    return {
      activityTypes: activityTypes.size > 0 ? Array.from(activityTypes) : undefined,
      daysOfWeek: daysOfWeek.size > 0 ? Array.from(daysOfWeek) : undefined,
      priceRange: { min: priceMin === Infinity ? 0 : priceMin, max: priceMax },
      timePreferences,
      distanceRadiusKm: maxDistance || undefined,
      environmentFilter: 'all', // In OR mode, show all environments
    };
  } else {
    // AND mode: Intersection - show activities ALL children can do together
    let activityTypes = childrenWithPrefs[0]?.preferences?.preferredActivityTypes || [];
    let daysOfWeek = childrenWithPrefs[0]?.preferences?.daysOfWeek || [];
    let priceMin = 0;
    let priceMax = 999999;
    let minDistance = Infinity;
    const timePreferences = { morning: true, afternoon: true, evening: true };

    for (const child of childrenWithPrefs) {
      const prefs = child.preferences;

      // Intersection of activity types
      if (prefs.preferredActivityTypes?.length) {
        const childTypes = new Set(prefs.preferredActivityTypes);
        activityTypes = activityTypes.filter((t: string) => childTypes.has(t));
      }

      // Intersection of days
      if (prefs.daysOfWeek?.length) {
        const childDays = new Set(prefs.daysOfWeek);
        daysOfWeek = daysOfWeek.filter((d: string) => childDays.has(d));
      }

      // Tightest price range
      priceMin = Math.max(priceMin, prefs.priceRangeMin || 0);
      priceMax = Math.min(priceMax, prefs.priceRangeMax || 999999);

      // Minimum distance (must be reachable by all)
      minDistance = Math.min(minDistance, prefs.distanceRadiusKm || 25);

      // All times must be true
      const tp = prefs.timePreferences as any;
      if (!tp?.morning) timePreferences.morning = false;
      if (!tp?.afternoon) timePreferences.afternoon = false;
      if (!tp?.evening) timePreferences.evening = false;
    }

    return {
      activityTypes: activityTypes.length > 0 ? activityTypes : undefined,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
      priceRange: { min: priceMin, max: priceMax },
      timePreferences,
      distanceRadiusKm: minDistance === Infinity ? undefined : minDistance,
      environmentFilter: 'all', // Could compute intersection if needed
    };
  }
}

/**
 * Build scoring context for the tiered scoring system
 * Combines user profile, preferences, behavioral data, and computed signals
 * Now uses child-level preferences instead of user-level preferences
 */
export async function buildScoringContext(
  userId: string,
  options?: {
    selectedChildIds?: string[];
    includeRecentActivity?: boolean;
    includeFavorites?: boolean;
    filterMode?: 'or' | 'and';
  }
): Promise<ScoringContext> {
  const prisma = getPrismaEnhanced();
  const { selectedChildIds, includeRecentActivity = true, includeFavorites = true, filterMode = 'or' } = options || {};

  // Fetch user with preferences (fallback only)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferences: true,
    },
  });

  // Parse user preferences (fallback)
  const userPrefs = typeof user?.preferences === 'string'
    ? JSON.parse(user.preferences)
    : user?.preferences || {};

  // Fetch children with their preferences
  const children = await prisma.child.findMany({
    where: {
      userId,
      isActive: true,
      ...(selectedChildIds?.length ? { id: { in: selectedChildIds } } : {}),
    },
    include: {
      childActivities: includeRecentActivity ? {
        select: {
          activityId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      } : false,
      skillProgress: {
        select: { skillCategory: true, currentLevel: true },
      },
      // Include child-specific preferences
      preferences: true,
    },
  });

  // Fetch favorites if requested
  let favorites: any[] = [];
  let favoriteProviders: string[] = [];
  let favoriteActivityTypes: string[] = [];

  if (includeFavorites) {
    favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        activity: {
          select: {
            id: true,
            category: true,
            providerId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Extract favorite providers
    favoriteProviders = [
      ...new Set(favorites.map(f => f.activity.providerId).filter(Boolean)),
    ] as string[];

    // Extract favorite activity types
    const typeCounts: Record<string, number> = {};
    for (const fav of favorites) {
      const category = fav.activity.category;
      if (category) {
        typeCounts[category] = (typeCounts[category] || 0) + 1;
      }
    }
    favoriteActivityTypes = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);
  }

  // Build child profiles for scorer
  const childProfiles: ScorerChildProfile[] = children.map(child => {
    const age = calculateAgeEnhanced(child.dateOfBirth);

    // Build skill progress map
    const skillProgress: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {};
    if (child.skillProgress) {
      for (const sp of child.skillProgress) {
        const level = sp.currentLevel?.toLowerCase();
        if (level === 'beginner' || level === 'intermediate' || level === 'advanced') {
          skillProgress[sp.skillCategory] = level;
        }
      }
    }

    return {
      id: child.id,
      name: child.name,
      age,
      interests: child.interests || [],
      skillProgress,
    };
  });

  // Extract recent activity IDs for diversity scoring
  const recentActivities: string[] = [];
  if (includeRecentActivity) {
    for (const child of children) {
      if (child.childActivities) {
        for (const ca of child.childActivities) {
          if (!recentActivities.includes(ca.activityId)) {
            recentActivities.push(ca.activityId);
          }
        }
      }
    }
  }

  // Build merged preferences from children's preferences
  // In OR mode: union of preferences (show activities for ANY child)
  // In AND mode: intersection (show activities ALL children can do together)
  const mergedPreferences = mergeChildPreferences(children, filterMode);

  // Build user preferences from merged child preferences, with user prefs as fallback
  const preferences: UserPreferences = {
    preferredActivityTypes: mergedPreferences.activityTypes?.length
      ? mergedPreferences.activityTypes
      : userPrefs.preferredActivityTypes || userPrefs.activityTypes,
    daysOfWeek: mergedPreferences.daysOfWeek?.length && mergedPreferences.daysOfWeek.length < 7
      ? mergedPreferences.daysOfWeek
      : userPrefs.daysOfWeek || userPrefs.preferredDays,
    priceRange: mergedPreferences.priceRange || userPrefs.priceRange || (userPrefs.maxPrice ? { max: userPrefs.maxPrice } : undefined),
    timePreferences: mergedPreferences.timePreferences || userPrefs.timePreferences,
    environmentPreference: mergedPreferences.environmentFilter !== 'all'
      ? mergedPreferences.environmentFilter
      : userPrefs.environmentPreference,
    distanceRadiusKm: mergedPreferences.distanceRadiusKm || userPrefs.maxDistance || userPrefs.distanceRadiusKm || 50,
  };

  // Extract location from first child's preferences, or fall back to user preferences
  const firstChildWithLocation = children.find(c => c.preferences?.savedAddress);
  const childLoc = firstChildWithLocation?.preferences?.savedAddress as any;

  const latitude = childLoc?.latitude || userPrefs.latitude || 49.2827; // Default to Vancouver
  const longitude = childLoc?.longitude || userPrefs.longitude || -123.1207;
  const city = childLoc?.city || userPrefs.locations?.[0] || userPrefs.preferredLocation || userPrefs.city;

  return {
    userLocation: {
      latitude,
      longitude,
      city,
    },
    children: childProfiles,
    preferences,
    recentActivities: recentActivities.length > 0 ? recentActivities : undefined,
    favoriteProviders: favoriteProviders.length > 0 ? favoriteProviders : undefined,
    favoriteActivityTypes: favoriteActivityTypes.length > 0 ? favoriteActivityTypes : undefined,
    filterMode, // Include for downstream scoring
  };
}

/**
 * Build scoring context from filters (for non-authenticated requests)
 */
export function buildScoringContextFromFilters(filters: {
  latitude?: number;
  longitude?: number;
  city?: string;
  ageMin?: number;
  ageMax?: number;
  activityTypes?: string[];
  daysOfWeek?: string[];
  maxPrice?: number;
  maxDistance?: number;
}): ScoringContext {
  const children: ScorerChildProfile[] = [];

  // Create synthetic child if age provided
  if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
    const ageMin = filters.ageMin ?? 0;
    const ageMax = filters.ageMax ?? 18;
    const avgAge = Math.round((ageMin + ageMax) / 2);

    children.push({
      id: 'filter-child',
      name: 'Child',
      age: avgAge,
      interests: [],
    });
  }

  return {
    userLocation: {
      latitude: filters.latitude || 49.2827,
      longitude: filters.longitude || -123.1207,
      city: filters.city,
    },
    children,
    preferences: {
      preferredActivityTypes: filters.activityTypes,
      daysOfWeek: filters.daysOfWeek,
      priceRange: filters.maxPrice ? { max: filters.maxPrice } : undefined,
      distanceRadiusKm: filters.maxDistance || 50,
    },
  };
}
