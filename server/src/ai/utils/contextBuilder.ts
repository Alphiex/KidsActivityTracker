import { FamilyContext, ChildProfile, FamilyPreferences } from '../types/ai.types';
import { EnhancedChildProfile, EnhancedFamilyContext } from '../agents/activityAssistantAgent';
import { PrismaClient } from '../../../generated/prisma';

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
 */
export async function buildFamilyContext(
  userId: string | undefined,
  prisma: any
): Promise<FamilyContext> {
  if (!userId) {
    return getDefaultFamilyContext();
  }

  try {
    // Fetch user with children and preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            dateOfBirth: true,
            interests: true,
            gender: true
          }
        }
      }
    });

    if (!user) {
      return getDefaultFamilyContext();
    }

    // Calculate ages and build child profiles
    const children: ChildProfile[] = (user.children || []).map((child: any) => {
      const age = calculateAge(child.dateOfBirth);
      return {
        child_id: child.id,
        name: child.name,
        age,
        age_range: { min: Math.max(0, age - 1), max: age + 1 },
        interests: child.interests || []
      };
    });

    // Parse user preferences (stored as JSON in preferences field)
    const prefs = parseUserPreferences(user.preferences);

    // Build location from preferences
    const rawPrefs = typeof user.preferences === 'string' 
      ? JSON.parse(user.preferences) 
      : user.preferences || {};
    
    const locationData = rawPrefs.locations && rawPrefs.locations.length > 0
      ? { city: rawPrefs.locations[0], cities: rawPrefs.locations }
      : rawPrefs.preferredLocation
        ? { city: rawPrefs.preferredLocation }
        : undefined;

    console.log('[Context Builder] Built family context:', {
      childCount: children.length,
      childAges: children.map(c => c.age),
      hasLocation: !!locationData,
      locationCities: locationData?.cities || [],
      preferredCategories: prefs.preferred_categories || []
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
 */
export async function buildEnhancedFamilyContext(
  userId: string,
  selectedChildIds?: string[],
  mode: 'specific' | 'all' | 'auto' = 'all'
): Promise<EnhancedFamilyContext> {
  const prisma = getPrismaEnhanced();

  // Get user with preferences (location stored in preferences JSON)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferences: true,
    },
  });

  // Get children with their activities
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
        take: 15,
      },
      skillProgress: {
        select: { skillCategory: true, currentLevel: true },
      },
    },
  });

  // Get user favorites
  const favorites = await prisma.favorite.findMany({
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

    // Filter favorites by age match
    const childFavorites = favorites.filter(f => {
      const minAge = f.activity.ageMin ?? 0;
      const maxAge = f.activity.ageMax ?? 99;
      return age >= minAge && age <= maxAge;
    });

    // Compute category preferences
    const categoryCount: Record<string, number> = {};
    [...childFavorites.map(f => f.activity), ...child.childActivities.map(ca => ca.activity)]
      .forEach(a => {
        if (a.category) {
          categoryCount[a.category] = (categoryCount[a.category] || 0) + 1;
        }
      });

    const preferredCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);

    return {
      child_id: child.id,
      name: child.name,
      age,
      interests: child.interests || [],
      favorites: childFavorites.slice(0, 10).map(f => ({
        activityName: f.activity.name,
        category: f.activity.category,
      })),
      calendarActivities: child.childActivities.map(ca => ({
        name: ca.activity.name,
        category: ca.activity.category,
        status: ca.status,
      })),
      computedPreferences: {
        preferredCategories,
        preferredDays: [], // Could compute from calendar if schedule data available
      },
    };
  });

  // Parse location from user preferences JSON
  const prefs = typeof user?.preferences === 'string'
    ? JSON.parse(user.preferences)
    : user?.preferences || {};

  // Extract location from preferences
  const locationCity = prefs.locations?.[0] || prefs.preferredLocation || prefs.city;

  return {
    children: enhancedChildren,
    location: locationCity ? {
      city: locationCity,
      province: prefs.province || undefined,
      lat: prefs.latitude || undefined,
      lng: prefs.longitude || undefined,
    } : undefined,
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
