/**
 * Tests for validating filter combinations return correct results
 */

import {
  mockActivities,
  filterMockActivities,
  createMockActivityService,
} from '../mocks/activityServiceMock';

describe('Filter Combinations', () => {
  const mockService = createMockActivityService();

  describe('Single Filter Tests', () => {
    describe('Activity Type Filter', () => {
      it('should filter by single activity type', () => {
        const results = filterMockActivities({ activityTypes: ['sports'] });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          const typeCode = typeof activity.activityType === 'object' 
            ? activity.activityType.code 
            : activity.activityType;
          expect(typeCode).toBe('sports');
        });
      });

      it('should filter by arts activity type', () => {
        const results = filterMockActivities({ activityTypes: ['arts'] });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          const typeCode = typeof activity.activityType === 'object' 
            ? activity.activityType.code 
            : activity.activityType;
          expect(typeCode).toBe('arts');
        });
      });

      it('should filter by multiple activity types', () => {
        const results = filterMockActivities({ activityTypes: ['sports', 'music'] });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          const typeCode = typeof activity.activityType === 'object' 
            ? activity.activityType.code 
            : activity.activityType;
          expect(['sports', 'music']).toContain(typeCode);
        });
      });

      it('should return empty array for non-existent activity type', () => {
        const results = filterMockActivities({ activityTypes: ['nonexistent'] });
        expect(results.length).toBe(0);
      });
    });

    describe('Age Range Filter', () => {
      it('should filter by toddler age range (3-5)', () => {
        const results = filterMockActivities({ ageMin: 3, ageMax: 5 });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          // Activity should overlap with the requested age range
          expect(activity.ageMax).toBeGreaterThanOrEqual(3);
          expect(activity.ageMin).toBeLessThanOrEqual(5);
        });
      });

      it('should filter by school-age range (6-12)', () => {
        const results = filterMockActivities({ ageMin: 6, ageMax: 12 });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.ageMax).toBeGreaterThanOrEqual(6);
          expect(activity.ageMin).toBeLessThanOrEqual(12);
        });
      });

      it('should filter by teen age range (13-18)', () => {
        const results = filterMockActivities({ ageMin: 13, ageMax: 18 });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.ageMax).toBeGreaterThanOrEqual(13);
          expect(activity.ageMin).toBeLessThanOrEqual(18);
        });
      });

      it('should return all activities for full age range (0-18)', () => {
        const results = filterMockActivities({ ageMin: 0, ageMax: 18 });
        expect(results.length).toBe(mockActivities.length);
      });

      it('should filter by minimum age only', () => {
        const results = filterMockActivities({ ageMin: 8 });
        
        results.forEach(activity => {
          expect(activity.ageMax).toBeGreaterThanOrEqual(8);
        });
      });

      it('should filter by maximum age only', () => {
        const results = filterMockActivities({ ageMax: 5 });
        
        results.forEach(activity => {
          expect(activity.ageMin).toBeLessThanOrEqual(5);
        });
      });
    });

    describe('Cost Filter', () => {
      it('should filter by free activities only (cost = 0)', () => {
        const results = filterMockActivities({ costMax: 0 });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.cost).toBe(0);
        });
      });

      it('should filter by activities under $100', () => {
        const results = filterMockActivities({ costMax: 100 });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.cost).toBeLessThanOrEqual(100);
        });
      });

      it('should filter by activities between $50 and $200', () => {
        const results = filterMockActivities({ costMin: 50, costMax: 200 });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.cost).toBeGreaterThanOrEqual(50);
          expect(activity.cost).toBeLessThanOrEqual(200);
        });
      });

      it('should filter by activities over $150', () => {
        const results = filterMockActivities({ costMin: 150 });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.cost).toBeGreaterThanOrEqual(150);
        });
      });
    });

    describe('Location Filter', () => {
      it('should filter by single city', () => {
        const results = filterMockActivities({ location: 'Vancouver' });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.city).toBe('Vancouver');
        });
      });

      it('should filter by multiple cities', () => {
        const results = filterMockActivities({ locations: ['Vancouver', 'Burnaby'] });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(['Vancouver', 'Burnaby']).toContain(activity.city);
        });
      });

      it('should return empty array for city with no activities', () => {
        const results = filterMockActivities({ location: 'NonExistentCity' });
        expect(results.length).toBe(0);
      });
    });

    describe('Day of Week Filter', () => {
      it('should filter by weekend days (Saturday, Sunday)', () => {
        const results = filterMockActivities({ daysOfWeek: ['Saturday', 'Sunday'] });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          const hasWeekendDay = activity.dayOfWeek?.some(
            day => ['Saturday', 'Sunday'].includes(day)
          );
          expect(hasWeekendDay).toBe(true);
        });
      });

      it('should filter by weekdays', () => {
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const results = filterMockActivities({ daysOfWeek: weekdays });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          const hasWeekday = activity.dayOfWeek?.some(day => weekdays.includes(day));
          expect(hasWeekday).toBe(true);
        });
      });

      it('should filter by single day', () => {
        const results = filterMockActivities({ daysOfWeek: ['Saturday'] });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          expect(activity.dayOfWeek).toContain('Saturday');
        });
      });
    });

    describe('Search Text Filter', () => {
      it('should filter by activity name', () => {
        const results = filterMockActivities({ search: 'swimming' });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          const nameMatch = activity.name.toLowerCase().includes('swimming');
          const providerMatch = activity.provider.toLowerCase().includes('swimming');
          expect(nameMatch || providerMatch).toBe(true);
        });
      });

      it('should filter by provider name', () => {
        const results = filterMockActivities({ search: 'vancouver parks' });
        
        expect(results.length).toBeGreaterThan(0);
        results.forEach(activity => {
          const nameMatch = activity.name.toLowerCase().includes('vancouver parks');
          const providerMatch = activity.provider.toLowerCase().includes('vancouver parks');
          expect(nameMatch || providerMatch).toBe(true);
        });
      });

      it('should be case-insensitive', () => {
        const resultsLower = filterMockActivities({ search: 'soccer' });
        const resultsUpper = filterMockActivities({ search: 'SOCCER' });
        const resultsMixed = filterMockActivities({ search: 'SoCcEr' });
        
        expect(resultsLower.length).toBe(resultsUpper.length);
        expect(resultsLower.length).toBe(resultsMixed.length);
      });

      it('should return empty array for non-matching search', () => {
        const results = filterMockActivities({ search: 'xyznonexistent123' });
        expect(results.length).toBe(0);
      });
    });
  });

  describe('Multi-Filter Combinations', () => {
    it('should filter by activity type + age range', () => {
      const results = filterMockActivities({
        activityTypes: ['sports'],
        ageMin: 6,
        ageMax: 12,
      });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(activity => {
        const typeCode = typeof activity.activityType === 'object' 
          ? activity.activityType.code 
          : activity.activityType;
        expect(typeCode).toBe('sports');
        expect(activity.ageMax).toBeGreaterThanOrEqual(6);
        expect(activity.ageMin).toBeLessThanOrEqual(12);
      });
    });

    it('should filter by location + cost (free in Vancouver)', () => {
      const results = filterMockActivities({
        location: 'Vancouver',
        costMax: 0,
      });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(activity => {
        expect(activity.city).toBe('Vancouver');
        expect(activity.cost).toBe(0);
      });
    });

    it('should filter by day + age (Saturday for toddlers)', () => {
      const results = filterMockActivities({
        daysOfWeek: ['Saturday'],
        ageMin: 3,
        ageMax: 5,
      });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(activity => {
        expect(activity.dayOfWeek).toContain('Saturday');
        expect(activity.ageMax).toBeGreaterThanOrEqual(3);
        expect(activity.ageMin).toBeLessThanOrEqual(5);
      });
    });

    it('should filter by activity type + location + age + cost', () => {
      const results = filterMockActivities({
        activityTypes: ['sports'],
        location: 'Vancouver',
        ageMin: 6,
        ageMax: 16,
        costMax: 100,
      });
      
      results.forEach(activity => {
        const typeCode = typeof activity.activityType === 'object' 
          ? activity.activityType.code 
          : activity.activityType;
        expect(typeCode).toBe('sports');
        expect(activity.city).toBe('Vancouver');
        expect(activity.ageMax).toBeGreaterThanOrEqual(6);
        expect(activity.ageMin).toBeLessThanOrEqual(16);
        expect(activity.cost).toBeLessThanOrEqual(100);
      });
    });

    it('should filter by weekend + sports + Vancouver', () => {
      const results = filterMockActivities({
        daysOfWeek: ['Saturday', 'Sunday'],
        activityTypes: ['sports'],
        location: 'Vancouver',
      });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(activity => {
        const typeCode = typeof activity.activityType === 'object' 
          ? activity.activityType.code 
          : activity.activityType;
        expect(typeCode).toBe('sports');
        expect(activity.city).toBe('Vancouver');
        const hasWeekendDay = activity.dayOfWeek?.some(
          day => ['Saturday', 'Sunday'].includes(day)
        );
        expect(hasWeekendDay).toBe(true);
      });
    });

    it('should return empty array when filters are mutually exclusive', () => {
      const results = filterMockActivities({
        activityTypes: ['dance'],
        location: 'Calgary', // No dance activities in Calgary in mock data
      });
      
      expect(results.length).toBe(0);
    });

    it('should handle search + other filters combined', () => {
      const results = filterMockActivities({
        search: 'soccer',
        location: 'Vancouver',
        costMax: 50,
      });
      
      results.forEach(activity => {
        expect(activity.city).toBe('Vancouver');
        expect(activity.cost).toBeLessThanOrEqual(50);
        const nameMatch = activity.name.toLowerCase().includes('soccer');
        const providerMatch = activity.provider.toLowerCase().includes('soccer');
        expect(nameMatch || providerMatch).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return all activities when no filters applied', () => {
      const results = filterMockActivities({});
      expect(results.length).toBe(mockActivities.length);
    });

    it('should handle empty array filters gracefully', () => {
      const results = filterMockActivities({
        activityTypes: [],
        daysOfWeek: [],
        locations: [],
      });
      // Empty arrays should not filter anything
      expect(results.length).toBe(mockActivities.length);
    });

    it('should handle undefined filters gracefully', () => {
      const results = filterMockActivities({
        activityTypes: undefined,
        ageMin: undefined,
        costMax: undefined,
      });
      expect(results.length).toBe(mockActivities.length);
    });

    it('should preserve activity order when filtering', () => {
      const allActivities = filterMockActivities({});
      const sportsActivities = filterMockActivities({ activityTypes: ['sports'] });
      
      // Filtered activities should maintain relative order from original
      const sportsIds = sportsActivities.map(a => a.id);
      const allSportsIds = allActivities
        .filter(a => {
          const typeCode = typeof a.activityType === 'object' 
            ? a.activityType.code 
            : a.activityType;
          return typeCode === 'sports';
        })
        .map(a => a.id);
      
      expect(sportsIds).toEqual(allSportsIds);
    });
  });

  describe('Service Integration', () => {
    it('should work with mock service searchActivities', async () => {
      const results = await mockService.searchActivities({
        activityTypes: ['sports'],
      });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach((activity: any) => {
        const typeCode = typeof activity.activityType === 'object' 
          ? activity.activityType.code 
          : activity.activityType;
        expect(typeCode).toBe('sports');
      });
    });

    it('should work with mock service searchActivitiesPaginated', async () => {
      const results = await mockService.searchActivitiesPaginated({
        activityTypes: ['sports'],
        limit: 5,
        offset: 0,
      });
      
      expect(results).toHaveProperty('items');
      expect(results).toHaveProperty('total');
      expect(results).toHaveProperty('hasMore');
      expect(Array.isArray(results.items)).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const page1 = await mockService.searchActivitiesPaginated({
        limit: 2,
        offset: 0,
      });
      
      const page2 = await mockService.searchActivitiesPaginated({
        limit: 2,
        offset: 2,
      });
      
      // Pages should have different activities
      const page1Ids = page1.items.map((a: any) => a.id);
      const page2Ids = page2.items.map((a: any) => a.id);
      
      page1Ids.forEach((id: string) => {
        expect(page2Ids).not.toContain(id);
      });
    });
  });
});

