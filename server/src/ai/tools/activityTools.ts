/**
 * Activity Tools for LangChain Agent
 *
 * These tools allow the AI agent to search activities, get child context,
 * retrieve activity details, and compare activities.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaClient } from '../../../generated/prisma';
import { calculateAge } from '../../utils/dateUtils';

// Singleton prisma instance
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

/**
 * Tool: Search Activities
 * Searches the activity database with various filters
 */
export const searchActivitiesTool = new DynamicStructuredTool({
  name: 'search_activities',
  description: 'Search for kids activities with filters like category, age range, location, price, and schedule. Use this to find activities matching parent requests.',
  schema: z.object({
    category: z.string().optional().describe('Activity category (e.g., sports, arts, music, dance, stem, camps, swimming, martial arts)'),
    minAge: z.number().optional().describe('Minimum age for the activity'),
    maxAge: z.number().optional().describe('Maximum age for the activity'),
    city: z.string().optional().describe('City name to search in'),
    maxPrice: z.number().optional().describe('Maximum price in dollars'),
    daysOfWeek: z.array(z.string()).optional().describe('Preferred days (e.g., ["Saturday", "Sunday"])'),
    searchTerm: z.string().optional().describe('General search term for activity name or description'),
    limit: z.number().optional().default(10).describe('Number of results to return (max 20)'),
  }),
  func: async ({ category, minAge, maxAge, city, maxPrice, daysOfWeek, searchTerm, limit }) => {
    const prisma = getPrisma();

    try {
      // Build where clause
      const where: any = {
        isActive: true,
      };

      // Age filtering in database - activity is suitable if child's age falls within activity's range
      // Child age (minAge/maxAge params) should be within activity's ageMin-ageMax range
      if (minAge !== undefined || maxAge !== undefined) {
        const childAge = maxAge ?? minAge ?? 5; // Use the age we're searching for
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { ageMin: null }, // No min age restriction
              { ageMin: { lte: childAge } }, // Activity accepts this age
            ],
          },
          {
            OR: [
              { ageMax: null }, // No max age restriction
              { ageMax: { gte: childAge } }, // Activity accepts this age
            ],
          },
        ];
      }

      if (city) {
        where.location = { city: { contains: city, mode: 'insensitive' } };
      }

      if (maxPrice) {
        where.cost = { lte: maxPrice };
      }

      // Handle category and searchTerm together
      if (searchTerm && category) {
        // Search term OR category match
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
              { category: { contains: category, mode: 'insensitive' } },
              { category: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ];
      } else if (searchTerm) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
              { category: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ];
      } else if (category) {
        where.category = { contains: category, mode: 'insensitive' };
      }

      console.log('[searchActivities] Query where:', JSON.stringify(where, null, 2));

      const activities = await prisma.activity.findMany({
        where,
        include: {
          location: true,
          provider: { select: { name: true } },
        },
        take: Math.min(limit || 10, 20),
        orderBy: [
          { registrationStatus: 'asc' }, // Open registration first
          { name: 'asc' },
        ],
      });

      // Activities are already filtered by age in the query
      const filteredActivities = activities;

      // Format response
      const result = filteredActivities.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category,
        price: a.cost ?? 'Contact for price',
        ageRange: a.ageMin || a.ageMax ? `${a.ageMin ?? 0}-${a.ageMax ?? 18} years` : 'All ages',
        location: a.location?.city ?? 'Various locations',
        locationName: a.location?.name,
        provider: a.provider?.name,
        schedule: formatSchedule(a),
        status: a.registrationStatus ?? 'Unknown',
      }));

      if (result.length === 0) {
        return JSON.stringify({
          message: 'No activities found matching your criteria. Try broadening your search.',
          suggestions: ['Remove the price filter', 'Try a different category', 'Search nearby cities'],
        });
      }

      return JSON.stringify({
        count: result.length,
        activities: result,
      });
    } catch (error: any) {
      console.error('[searchActivities] Error:', error);
      return JSON.stringify({ error: 'Failed to search activities', details: error.message });
    }
  },
});

/**
 * Tool: Get Child Context
 * Retrieves detailed context for a specific child or all children
 */
export const getChildContextTool = new DynamicStructuredTool({
  name: 'get_child_context',
  description: 'Get detailed information about a child including their favorites, calendar activities, and computed preferences. Use this to personalize recommendations.',
  schema: z.object({
    userId: z.string().describe('User ID to get children for'),
    childName: z.string().optional().describe('Specific child name to look up'),
    childId: z.string().optional().describe('Specific child ID'),
  }),
  func: async ({ userId, childName, childId }) => {
    const prisma = getPrisma();

    try {
      const children = await prisma.child.findMany({
        where: {
          userId,
          isActive: true,
          ...(childId && { id: childId }),
          ...(childName && { name: { contains: childName, mode: 'insensitive' } }),
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

      // Load user favorites
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

      const result = children.map(child => {
        const age = calculateAge(child.dateOfBirth);

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
          .slice(0, 3)
          .map(([cat]) => cat);

        return {
          id: child.id,
          name: child.name,
          age,
          interests: child.interests || [],
          skillLevels: child.skillProgress.map(sp => ({
            skill: sp.skillCategory,
            level: sp.currentLevel,
          })),
          recentFavorites: childFavorites.slice(0, 5).map(f => ({
            name: f.activity.name,
            category: f.activity.category,
          })),
          calendarActivities: child.childActivities.map(ca => ({
            name: ca.activity.name,
            category: ca.activity.category,
            status: ca.status,
          })),
          preferredCategories,
          completedCount: child.childActivities.filter(a => a.status === 'completed').length,
          plannedCount: child.childActivities.filter(a => a.status === 'planned').length,
        };
      });

      if (result.length === 0) {
        return JSON.stringify({
          message: 'No children found for this user.',
          suggestion: 'Ask the user to add their children in the app first.',
        });
      }

      return JSON.stringify({ children: result });
    } catch (error: any) {
      console.error('[getChildContext] Error:', error);
      return JSON.stringify({ error: 'Failed to get child context', details: error.message });
    }
  },
});

/**
 * Tool: Get Activity Details
 * Gets detailed information about a specific activity
 */
export const getActivityDetailsTool = new DynamicStructuredTool({
  name: 'get_activity_details',
  description: 'Get detailed information about a specific activity by ID or name. Use this when the user asks about a particular activity.',
  schema: z.object({
    activityId: z.string().optional().describe('Activity ID'),
    activityName: z.string().optional().describe('Activity name to search'),
  }),
  func: async ({ activityId, activityName }) => {
    const prisma = getPrisma();

    try {
      const activity = await prisma.activity.findFirst({
        where: {
          ...(activityId && { id: activityId }),
          ...(activityName && { name: { contains: activityName, mode: 'insensitive' } }),
        },
        include: {
          location: true,
          provider: { select: { name: true, website: true } },
        },
      });

      if (!activity) {
        return JSON.stringify({ error: 'Activity not found' });
      }

      const schedule = activity.schedule as any;

      return JSON.stringify({
        id: activity.id,
        name: activity.name,
        description: activity.description || 'No description available',
        category: activity.category,
        price: activity.cost ? `$${activity.cost}` : 'Contact for pricing',
        ageRange: (activity.ageMin || activity.ageMax) ? `${activity.ageMin ?? 0}-${activity.ageMax ?? 18} years` : 'All ages',
        schedule: schedule ? {
          days: schedule.daysOfWeek || [],
          time: schedule.startTime ? `${schedule.startTime} - ${schedule.endTime || 'TBD'}` : 'See website',
          duration: schedule.duration || 'Varies',
        } : 'Contact provider for schedule',
        location: activity.location ? {
          name: activity.location.name,
          address: activity.location.address,
          city: activity.location.city,
          province: activity.location.province,
        } : 'Location TBD',
        provider: activity.provider?.name || 'Independent',
        registrationUrl: activity.registrationUrl,
        registrationStatus: activity.registrationStatus || 'Unknown',
        instructor: activity.instructor || 'Staff instructor',
      });
    } catch (error: any) {
      console.error('[getActivityDetails] Error:', error);
      return JSON.stringify({ error: 'Failed to get activity details', details: error.message });
    }
  },
});

/**
 * Tool: Compare Activities
 * Compares multiple activities side by side
 */
export const compareActivitiesTool = new DynamicStructuredTool({
  name: 'compare_activities',
  description: 'Compare multiple activities by their IDs. Use this when the user wants to compare options.',
  schema: z.object({
    activityIds: z.array(z.string()).describe('Array of activity IDs to compare (2-5 activities)'),
  }),
  func: async ({ activityIds }) => {
    const prisma = getPrisma();

    try {
      if (activityIds.length < 2) {
        return JSON.stringify({ error: 'Need at least 2 activities to compare' });
      }

      if (activityIds.length > 5) {
        activityIds = activityIds.slice(0, 5);
      }

      const activities = await prisma.activity.findMany({
        where: { id: { in: activityIds } },
        include: {
          location: { select: { city: true, name: true } },
          provider: { select: { name: true } },
        },
      });

      if (activities.length < 2) {
        return JSON.stringify({ error: 'Could not find enough activities to compare' });
      }

      const comparison = activities.map(a => {
        const schedule = a.schedule as any;

        return {
          id: a.id,
          name: a.name,
          category: a.category,
          price: a.cost ? `$${a.cost}` : 'Contact',
          ageRange: (a.ageMin || a.ageMax) ? `${a.ageMin ?? 0}-${a.ageMax ?? 18}` : 'All ages',
          location: a.location?.city ?? 'Various',
          provider: a.provider?.name ?? 'Independent',
          schedule: formatSchedule(schedule),
          status: a.registrationStatus ?? 'Unknown',
        };
      });

      // Generate comparison summary
      const prices = activities.map(a => a.cost).filter(p => p != null && p > 0) as number[];
      const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
      const cheapest = lowestPrice
        ? activities.find(a => a.cost === lowestPrice)?.name
        : null;

      return JSON.stringify({
        comparison,
        summary: {
          totalCompared: comparison.length,
          cheapestOption: cheapest,
          priceRange: prices.length > 0 ? `$${Math.min(...prices)} - $${Math.max(...prices)}` : 'Varies',
        },
      });
    } catch (error: any) {
      console.error('[compareActivities] Error:', error);
      return JSON.stringify({ error: 'Failed to compare activities', details: error.message });
    }
  },
});

/**
 * Helper: Format schedule for display
 */
function formatSchedule(schedule: any): string {
  if (!schedule) return 'Contact for schedule';

  const parts: string[] = [];

  if (schedule.daysOfWeek?.length) {
    parts.push(schedule.daysOfWeek.join(', '));
  }

  if (schedule.startTime) {
    parts.push(schedule.endTime ? `${schedule.startTime}-${schedule.endTime}` : `${schedule.startTime}`);
  }

  return parts.length > 0 ? parts.join(' @ ') : 'Contact for schedule';
}

/**
 * All activity tools exported for the agent
 */
export const activityTools = [
  searchActivitiesTool,
  getChildContextTool,
  getActivityDetailsTool,
  compareActivitiesTool,
];
