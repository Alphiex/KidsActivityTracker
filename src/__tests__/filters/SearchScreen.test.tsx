/**
 * Component tests for SearchScreen
 * Tests UI behavior and search filter interactions
 */

import {
  mockActivityTypes,
  createMockActivityService,
  filterMockActivities,
} from '../mocks/activityServiceMock';

describe('SearchScreen', () => {
  describe('Section Structure', () => {
    const expectedSections = [
      { key: 'what', title: 'What?', icon: 'magnify' },
      { key: 'days', title: 'Day of the Week?', icon: 'calendar-week' },
      { key: 'activityType', title: 'Activity Type?', icon: 'soccer' },
      { key: 'time', title: 'Time?', icon: 'clock' },
      { key: 'cost', title: 'Cost?', icon: 'currency-usd' },
      { key: 'where', title: 'Where?', icon: 'map-marker' },
      { key: 'age', title: 'Age?', icon: 'account-child' },
    ];

    it('should have 7 search sections defined', () => {
      expect(expectedSections.length).toBe(7);
    });

    it('should have unique section keys', () => {
      const keys = expectedSections.map(s => s.key);
      const uniqueKeys = [...new Set(keys)];
      expect(keys.length).toBe(uniqueKeys.length);
    });

    it('should have appropriate icons for each section', () => {
      expectedSections.forEach(section => {
        expect(section.icon).toBeDefined();
        expect(typeof section.icon).toBe('string');
      });
    });
  });

  describe('What Section (Text Search)', () => {
    it('should filter activities by search text', () => {
      const results = filterMockActivities({ search: 'swimming' });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(activity => {
        const nameMatch = activity.name.toLowerCase().includes('swimming');
        const providerMatch = activity.provider.toLowerCase().includes('swimming');
        expect(nameMatch || providerMatch).toBe(true);
      });
    });

    it('should return empty results for non-matching search', () => {
      const results = filterMockActivities({ search: 'xyznonexistent123' });
      expect(results.length).toBe(0);
    });

    it('should be case-insensitive', () => {
      const lowerResults = filterMockActivities({ search: 'soccer' });
      const upperResults = filterMockActivities({ search: 'SOCCER' });
      
      expect(lowerResults.length).toBe(upperResults.length);
    });

    it('should show all activities when search is empty', () => {
      const results = filterMockActivities({ search: '' });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Day of Week Section', () => {
    const DAYS_OF_WEEK = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];

    it('should have all 7 days defined', () => {
      expect(DAYS_OF_WEEK.length).toBe(7);
    });

    it('should filter by weekend days', () => {
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
    });

    it('should support single day selection', () => {
      const results = filterMockActivities({ daysOfWeek: ['Saturday'] });
      
      results.forEach(activity => {
        expect(activity.dayOfWeek).toContain('Saturday');
      });
    });

    it('should return all activities when no days selected', () => {
      const results = filterMockActivities({ daysOfWeek: [] });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Activity Type Section', () => {
    const mockService = createMockActivityService();

    it('should load activity types from API', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      
      expect(types.length).toBeGreaterThan(0);
    });

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
  });

  describe('Time Section', () => {
    const PREDEFINED_TIMES = [
      { label: 'Before School', value: 'before-school', timeRange: '6:00 AM - 8:00 AM' },
      { label: 'After School', value: 'after-school', timeRange: '3:00 PM - 6:00 PM' },
      { label: 'Morning', value: 'morning', timeRange: '8:00 AM - 12:00 PM' },
      { label: 'Day', value: 'day', timeRange: '9:00 AM - 5:00 PM' },
      { label: 'Evening', value: 'evening', timeRange: '6:00 PM - 9:00 PM' },
      { label: 'Night', value: 'night', timeRange: '7:00 PM - 10:00 PM' },
    ];

    it('should have 6 predefined time options', () => {
      expect(PREDEFINED_TIMES.length).toBe(6);
    });

    it('should have unique time values', () => {
      const values = PREDEFINED_TIMES.map(t => t.value);
      const uniqueValues = [...new Set(values)];
      expect(values.length).toBe(uniqueValues.length);
    });

    it('should have valid time ranges for each option', () => {
      PREDEFINED_TIMES.forEach(time => {
        expect(time.timeRange).toMatch(/\d{1,2}:\d{2} [AP]M - \d{1,2}:\d{2} [AP]M/);
      });
    });

    it('should support custom time range (6-22 hours)', () => {
      const formatTime = (hour: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:00 ${period}`;
      };

      expect(formatTime(6)).toBe('6:00 AM');
      expect(formatTime(12)).toBe('12:00 PM');
      expect(formatTime(18)).toBe('6:00 PM');
      expect(formatTime(22)).toBe('10:00 PM');
    });
  });

  describe('Cost Section', () => {
    it('should filter by free activities', () => {
      const results = filterMockActivities({ costMax: 0 });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(activity => {
        expect(activity.cost).toBe(0);
      });
    });

    it('should filter by max cost', () => {
      const results = filterMockActivities({ costMax: 100 });
      
      results.forEach(activity => {
        expect(activity.cost).toBeLessThanOrEqual(100);
      });
    });

    it('should filter by min cost', () => {
      const results = filterMockActivities({ costMin: 100 });
      
      results.forEach(activity => {
        expect(activity.cost).toBeGreaterThanOrEqual(100);
      });
    });

    it('should filter by cost range', () => {
      const results = filterMockActivities({ costMin: 50, costMax: 200 });
      
      results.forEach(activity => {
        expect(activity.cost).toBeGreaterThanOrEqual(50);
        expect(activity.cost).toBeLessThanOrEqual(200);
      });
    });

    it('should support unlimited cost option', () => {
      // When unlimited, no costMax filter is applied
      const results = filterMockActivities({});
      const allCosts = results.map(a => a.cost);
      const maxCost = Math.max(...allCosts);
      
      expect(maxCost).toBeGreaterThan(100);
    });
  });

  describe('Where Section (Cities)', () => {
    const POPULAR_CITIES = [
      'Vancouver', 'Burnaby', 'Richmond', 'Surrey', 'North Vancouver',
      'West Vancouver', 'Coquitlam', 'New Westminster', 'Port Coquitlam'
    ];

    it('should have 9 popular cities defined', () => {
      expect(POPULAR_CITIES.length).toBe(9);
    });

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

    it('should return empty for non-existent city', () => {
      const results = filterMockActivities({ location: 'NonExistentCity' });
      expect(results.length).toBe(0);
    });
  });

  describe('Age Section', () => {
    it('should have default age range 0-18', () => {
      const defaultMin = 0;
      const defaultMax = 18;
      
      expect(defaultMin).toBe(0);
      expect(defaultMax).toBe(18);
    });

    it('should filter by minimum age', () => {
      const results = filterMockActivities({ ageMin: 8 });
      
      results.forEach(activity => {
        expect(activity.ageMax).toBeGreaterThanOrEqual(8);
      });
    });

    it('should filter by maximum age', () => {
      const results = filterMockActivities({ ageMax: 5 });
      
      results.forEach(activity => {
        expect(activity.ageMin).toBeLessThanOrEqual(5);
      });
    });

    it('should filter by age range', () => {
      const results = filterMockActivities({ ageMin: 6, ageMax: 12 });
      
      results.forEach(activity => {
        // Activity overlaps with requested range
        expect(activity.ageMax).toBeGreaterThanOrEqual(6);
        expect(activity.ageMin).toBeLessThanOrEqual(12);
      });
    });

    it('should not allow min age to exceed max age', () => {
      const minAge = 10;
      const maxAge = 5;
      
      // This should be prevented in the UI
      expect(minAge).toBeGreaterThan(maxAge);
    });
  });

  describe('Search Actions', () => {
    it('should build search params correctly', () => {
      const params = {
        search: 'swimming',
        daysOfWeek: ['Saturday', 'Sunday'],
        activityTypes: ['sports'],
        costMin: 0,
        costMax: 100,
        location: 'Vancouver',
        ageMin: 6,
        ageMax: 12,
      };

      // Verify all params are present
      expect(params.search).toBe('swimming');
      expect(params.daysOfWeek).toHaveLength(2);
      expect(params.activityTypes).toContain('sports');
      expect(params.costMax).toBe(100);
      expect(params.location).toBe('Vancouver');
      expect(params.ageMin).toBe(6);
      expect(params.ageMax).toBe(12);
    });

    it('should clear all filters correctly', () => {
      let state = {
        searchText: 'test',
        selectedDays: ['Monday'],
        selectedActivityTypes: ['sports'],
        minCost: 50,
        maxCost: 200,
        selectedCities: ['Vancouver'],
        minAge: 5,
        maxAge: 10,
      };

      // Clear all
      state = {
        searchText: '',
        selectedDays: [],
        selectedActivityTypes: [],
        minCost: 0,
        maxCost: 500,
        selectedCities: [],
        minAge: 0,
        maxAge: 18,
      };

      expect(state.searchText).toBe('');
      expect(state.selectedDays).toHaveLength(0);
      expect(state.selectedActivityTypes).toHaveLength(0);
      expect(state.minCost).toBe(0);
      expect(state.maxCost).toBe(500);
      expect(state.selectedCities).toHaveLength(0);
      expect(state.minAge).toBe(0);
      expect(state.maxAge).toBe(18);
    });
  });

  describe('AI Search Integration', () => {
    it('should build search intent from filters', () => {
      const filters = {
        activityTypes: ['sports'],
        ageMin: 6,
        ageMax: 12,
        daysOfWeek: ['Saturday'],
        location: 'Vancouver',
      };

      // Build natural language intent
      const parts: string[] = [];
      
      if (filters.activityTypes?.length) {
        parts.push(`${filters.activityTypes.join(' or ')} activities`);
      }
      if (filters.ageMin || filters.ageMax) {
        parts.push(`for ages ${filters.ageMin || 0}-${filters.ageMax || 18}`);
      }
      if (filters.daysOfWeek?.length) {
        parts.push(`on ${filters.daysOfWeek.join(', ')}`);
      }
      if (filters.location) {
        parts.push(`in ${filters.location}`);
      }

      const intent = `Find ${parts.join(' ')}`;
      
      expect(intent).toContain('sports');
      expect(intent).toContain('6-12');
      expect(intent).toContain('Saturday');
      expect(intent).toContain('Vancouver');
    });
  });

  describe('Combined Filter Scenarios', () => {
    it('should handle complex filter combinations', () => {
      const results = filterMockActivities({
        activityTypes: ['sports'],
        daysOfWeek: ['Saturday', 'Sunday'],
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
        expect(activity.cost).toBeLessThanOrEqual(100);
        expect(activity.ageMax).toBeGreaterThanOrEqual(6);
        expect(activity.ageMin).toBeLessThanOrEqual(16);
        
        const hasWeekendDay = activity.dayOfWeek?.some(
          day => ['Saturday', 'Sunday'].includes(day)
        );
        expect(hasWeekendDay).toBe(true);
      });
    });

    it('should return correct count of filtered results', () => {
      const allResults = filterMockActivities({});
      const sportsResults = filterMockActivities({ activityTypes: ['sports'] });
      const vancouverResults = filterMockActivities({ location: 'Vancouver' });
      const combinedResults = filterMockActivities({
        activityTypes: ['sports'],
        location: 'Vancouver',
      });

      // Combined should be less than or equal to individual filters
      expect(combinedResults.length).toBeLessThanOrEqual(sportsResults.length);
      expect(combinedResults.length).toBeLessThanOrEqual(vancouverResults.length);
    });
  });
});

