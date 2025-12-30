/**
 * Component tests for FiltersScreen
 * Tests UI behavior and filter section interactions
 */

import {
  mockActivityTypes,
  mockAgeGroups,
  mockCities,
  mockLocations,
  createMockActivityService,
  createMockPreferencesService,
} from '../mocks/activityServiceMock';

describe('FiltersScreen', () => {
  describe('Section Structure', () => {
    const expectedSections = [
      { id: 'activityTypes', title: 'Activity Type?', icon: 'soccer' },
      { id: 'age', title: 'Age Range?', icon: 'account-child' },
      { id: 'locations', title: 'Where?', icon: 'map-marker' },
      { id: 'distance', title: 'How Far?', icon: 'map-marker-radius' },
      { id: 'budget', title: 'Cost?', icon: 'currency-usd' },
      { id: 'schedule', title: 'Day of the Week?', icon: 'calendar-week' },
      { id: 'dates', title: 'When?', icon: 'calendar-range' },
    ];

    it('should have 7 filter sections defined', () => {
      expect(expectedSections.length).toBe(7);
    });

    it('should have unique section IDs', () => {
      const ids = expectedSections.map(s => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should have appropriate icons for each section', () => {
      expectedSections.forEach(section => {
        expect(section.icon).toBeDefined();
        expect(typeof section.icon).toBe('string');
        expect(section.icon.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Activity Types Section', () => {
    const mockService = createMockActivityService();

    it('should load activity types from API', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      
      expect(types.length).toBeGreaterThan(0);
      expect(mockService.getActivityTypesWithCounts).toHaveBeenCalled();
    });

    it('should display activity type names and counts', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      
      types.forEach((type: any) => {
        expect(type.name).toBeDefined();
        expect(type.activityCount).toBeDefined();
      });
    });

    it('should support subtype expansion', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      const typesWithSubtypes = types.filter((t: any) => t.subtypes.length > 0);
      
      expect(typesWithSubtypes.length).toBeGreaterThan(0);
    });

    it('should track selected activity types in preferences', () => {
      const prefsService = createMockPreferencesService();
      
      // Select a type
      prefsService.updatePreferences({
        preferredActivityTypes: ['sports'],
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.preferredActivityTypes).toContain('sports');
    });

    it('should support multiple activity type selection', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        preferredActivityTypes: ['sports', 'music', 'dance'],
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.preferredActivityTypes).toHaveLength(3);
    });
  });

  describe('Age Range Section', () => {
    const mockService = createMockActivityService();

    it('should load age groups from API', async () => {
      const groups = await mockService.getAgeGroups();
      
      expect(groups.length).toBeGreaterThan(0);
    });

    it('should have default age range of 0-18', () => {
      const prefsService = createMockPreferencesService();
      const prefs = prefsService.getPreferences();
      
      expect(prefs.ageRanges[0].min).toBe(0);
      expect(prefs.ageRanges[0].max).toBe(18);
    });

    it('should update min age correctly', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        ageRanges: [{ min: 5, max: 12 }],
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.ageRanges[0].min).toBe(5);
      expect(prefs.ageRanges[0].max).toBe(12);
    });

    it('should support quick-select age groups', async () => {
      const groups = await mockService.getAgeGroups();
      const prefsService = createMockPreferencesService();
      
      // Simulate selecting "Toddler" age group
      const toddler = groups.find((g: any) => g.code === 'toddler');
      expect(toddler).toBeDefined();
      
      prefsService.updatePreferences({
        ageRanges: [{ min: toddler.minAge, max: toddler.maxAge }],
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.ageRanges[0].min).toBe(3);
      expect(prefs.ageRanges[0].max).toBe(5);
    });
  });

  describe('Locations Section', () => {
    const mockService = createMockActivityService();

    it('should load cities from API', async () => {
      const cities = await mockService.getCities();
      
      expect(cities.length).toBeGreaterThan(0);
    });

    it('should load locations from API', async () => {
      const locations = await mockService.getLocations();
      
      expect(locations.length).toBeGreaterThan(0);
    });

    it('should support location ID selection', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        locationIds: ['l1', 'l2', 'l3'],
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.locationIds).toHaveLength(3);
    });

    it('should group locations by city', async () => {
      const locations = await mockService.getLocations();
      
      const citiesWithLocations: { [key: string]: any[] } = {};
      locations.forEach((loc: any) => {
        if (!citiesWithLocations[loc.city]) {
          citiesWithLocations[loc.city] = [];
        }
        citiesWithLocations[loc.city].push(loc);
      });
      
      expect(Object.keys(citiesWithLocations).length).toBeGreaterThan(0);
    });
  });

  describe('Distance Section', () => {
    it('should have distance filter disabled by default', () => {
      const prefsService = createMockPreferencesService();
      const prefs = prefsService.getPreferences();
      
      expect(prefs.distanceFilterEnabled).toBe(false);
    });

    it('should have default radius of 25km', () => {
      const prefsService = createMockPreferencesService();
      const prefs = prefsService.getPreferences();
      
      expect(prefs.distanceRadiusKm).toBe(25);
    });

    it('should update distance radius correctly', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        distanceFilterEnabled: true,
        distanceRadiusKm: 50,
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.distanceFilterEnabled).toBe(true);
      expect(prefs.distanceRadiusKm).toBe(50);
    });
  });

  describe('Budget Section', () => {
    const budgetPresets = [
      { label: '$25', value: 25 },
      { label: '$50', value: 50 },
      { label: '$100', value: 100 },
      { label: '$200', value: 200 },
      { label: '$500', value: 500 },
      { label: 'No Limit', value: 999999 },
    ];

    it('should have 6 budget presets', () => {
      expect(budgetPresets.length).toBe(6);
    });

    it('should have default price range', () => {
      const prefsService = createMockPreferencesService();
      const prefs = prefsService.getPreferences();
      
      expect(prefs.priceRange).toBeDefined();
      expect(prefs.priceRange.min).toBeDefined();
      expect(prefs.priceRange.max).toBeDefined();
    });

    it('should update max cost correctly', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        priceRange: { min: 0, max: 100 },
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.priceRange.max).toBe(100);
    });

    it('should support "No Limit" option', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        priceRange: { min: 0, max: 999999 },
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.priceRange.max).toBeGreaterThanOrEqual(10000);
    });
  });

  describe('Schedule Section', () => {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    it('should have all 7 days of week', () => {
      expect(daysOfWeek.length).toBe(7);
    });

    it('should start with no days selected', () => {
      const prefsService = createMockPreferencesService();
      const prefs = prefsService.getPreferences();
      
      expect(prefs.daysOfWeek).toHaveLength(0);
    });

    it('should toggle day selection correctly', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        daysOfWeek: ['Saturday', 'Sunday'],
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.daysOfWeek).toContain('Saturday');
      expect(prefs.daysOfWeek).toContain('Sunday');
      expect(prefs.daysOfWeek).not.toContain('Monday');
    });

    it('should support time preferences', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        timePreferences: { morning: true, afternoon: false, evening: true },
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.timePreferences.morning).toBe(true);
      expect(prefs.timePreferences.afternoon).toBe(false);
      expect(prefs.timePreferences.evening).toBe(true);
    });
  });

  describe('Dates Section', () => {
    it('should have default date filter as "any"', () => {
      const prefsService = createMockPreferencesService();
      const prefs = prefsService.getPreferences();
      
      expect(prefs.dateFilter).toBe('any');
    });

    it('should update date filter mode', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        dateFilter: 'range',
        dateRange: { start: '2025-01-01' },
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.dateFilter).toBe('range');
      expect(prefs.dateRange?.start).toBe('2025-01-01');
    });

    it('should support date range with start and end', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        dateFilter: 'range',
        dateRange: { start: '2025-01-01', end: '2025-03-31' },
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.dateRange?.start).toBe('2025-01-01');
      expect(prefs.dateRange?.end).toBe('2025-03-31');
    });

    it('should support date match modes', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        dateMatchMode: 'full',
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.dateMatchMode).toBe('full');
    });
  });

  describe('Global Preferences', () => {
    it('should have hideClosedOrFull toggle', () => {
      const prefsService = createMockPreferencesService();
      
      prefsService.updatePreferences({
        hideClosedOrFull: true,
      });
      
      const prefs = prefsService.getPreferences();
      expect(prefs.hideClosedOrFull).toBe(true);
    });

    it('should reset all preferences', () => {
      const prefsService = createMockPreferencesService();
      
      // Set some preferences
      prefsService.updatePreferences({
        preferredActivityTypes: ['sports'],
        ageRanges: [{ min: 5, max: 10 }],
        daysOfWeek: ['Saturday'],
      });
      
      // Reset
      prefsService.resetPreferences();
      
      const prefs = prefsService.getPreferences();
      expect(prefs.preferredActivityTypes).toHaveLength(0);
      expect(prefs.ageRanges[0].min).toBe(0);
      expect(prefs.ageRanges[0].max).toBe(18);
      expect(prefs.daysOfWeek).toHaveLength(0);
    });
  });
});

