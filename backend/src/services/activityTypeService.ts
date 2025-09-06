/**
 * Service for handling activity types and subtypes
 * Gets data directly from activities to ensure consistency
 */

import ActivityService from './activityService';

interface ActivityTypeInfo {
  name: string;
  code: string;
  subtypes: Array<{
    name: string;
    count: number;
  }>;
  totalCount: number;
}

class ActivityTypeService {
  private static instance: ActivityTypeService;
  private activityService: ActivityService;

  private constructor() {
    this.activityService = ActivityService.getInstance();
  }

  static getInstance(): ActivityTypeService {
    if (!ActivityTypeService.instance) {
      ActivityTypeService.instance = new ActivityTypeService();
    }
    return ActivityTypeService.instance;
  }

  /**
   * Get all unique activity subtypes for a given activity type
   * by querying actual activities in the database
   */
  async getActivityTypeWithSubtypes(typeName: string): Promise<ActivityTypeInfo> {
    try {
      // First, get all activities for this type to extract unique subtypes
      // We need to check for both the clean name and variations
      const possibleTypeNames = this.getPossibleTypeNames(typeName);
      
      // Get a sample of activities to extract subtypes
      const activities = [];
      for (const searchType of possibleTypeNames) {
        const result = await this.activityService.searchActivitiesPaginated({
          activityType: searchType,
          limit: 500, // Get enough to find all subtypes
          offset: 0
        });
        
        if (result.items && result.items.length > 0) {
          activities.push(...result.items);
        }
      }

      // Extract unique subtypes with counts
      const subtypeMap = new Map<string, number>();
      activities.forEach(activity => {
        if (activity.activitySubtype) {
          const count = subtypeMap.get(activity.activitySubtype) || 0;
          subtypeMap.set(activity.activitySubtype, count + 1);
        }
      });

      // Convert to array and sort by count
      const subtypes = Array.from(subtypeMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Get total count for this activity type
      let totalCount = 0;
      for (const searchType of possibleTypeNames) {
        const result = await this.activityService.searchActivitiesPaginated({
          activityType: searchType,
          limit: 1,
          offset: 0
        });
        totalCount += result.total || 0;
      }

      return {
        name: typeName,
        code: this.getTypeCode(typeName),
        subtypes,
        totalCount
      };
    } catch (error) {
      console.error('Error getting activity type with subtypes:', error);
      throw error;
    }
  }

  /**
   * Get possible type names to search for
   * Handles inconsistencies between API names and database values
   */
  private getPossibleTypeNames(typeName: string): string[] {
    // Map of display names to possible database values
    const variations: { [key: string]: string[] } = {
      'Team Sports': ['Team Sports', 'Sports - Team'],
      'Individual Sports': ['Individual Sports', 'Sports - Individual'],
      'Visual Arts': ['Visual Arts', 'Arts & Crafts'],
      'Swimming & Aquatics': ['Swimming & Aquatics', 'Swimming'],
    };

    return variations[typeName] || [typeName];
  }

  /**
   * Convert type name to code
   */
  private getTypeCode(typeName: string): string {
    return typeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get accurate count for an activity type including all variations
   */
  async getActivityTypeCount(typeName: string, filters?: any): Promise<number> {
    const possibleTypeNames = this.getPossibleTypeNames(typeName);
    let totalCount = 0;

    for (const searchType of possibleTypeNames) {
      const result = await this.activityService.searchActivitiesPaginated({
        ...filters,
        activityType: searchType,
        limit: 1,
        offset: 0
      });
      totalCount += result.total || 0;
    }

    return totalCount;
  }
}

export default ActivityTypeService;