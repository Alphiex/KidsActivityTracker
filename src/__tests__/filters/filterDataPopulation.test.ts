/**
 * Tests for validating filter options are correctly populated from API
 */

import {
  mockActivityTypes,
  mockAgeGroups,
  mockCities,
  mockLocations,
  createMockActivityService,
} from '../mocks/activityServiceMock';

describe('Filter Data Population', () => {
  describe('Activity Types', () => {
    const mockService = createMockActivityService();

    it('should return activity types with expected structure', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      
      expect(types).toBeDefined();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('should have required fields for each activity type', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      
      types.forEach((type: any) => {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('code');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('activityCount');
        expect(typeof type.id).toBe('string');
        expect(typeof type.code).toBe('string');
        expect(typeof type.name).toBe('string');
        expect(typeof type.activityCount).toBe('number');
      });
    });

    it('should include subtypes array for each activity type', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      
      types.forEach((type: any) => {
        expect(type).toHaveProperty('subtypes');
        expect(Array.isArray(type.subtypes)).toBe(true);
      });
    });

    it('should have valid subtype structure when subtypes exist', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      const typesWithSubtypes = types.filter((t: any) => t.subtypes.length > 0);
      
      expect(typesWithSubtypes.length).toBeGreaterThan(0);
      
      typesWithSubtypes.forEach((type: any) => {
        type.subtypes.forEach((subtype: any) => {
          expect(subtype).toHaveProperty('id');
          expect(subtype).toHaveProperty('code');
          expect(subtype).toHaveProperty('name');
          expect(subtype).toHaveProperty('activityCount');
        });
      });
    });

    it('should have activity counts greater than or equal to zero', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      
      types.forEach((type: any) => {
        expect(type.activityCount).toBeGreaterThanOrEqual(0);
        type.subtypes.forEach((subtype: any) => {
          expect(subtype.activityCount).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should include expected activity type codes', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      const codes = types.map((t: any) => t.code);
      
      // Verify some expected types are present
      expect(codes).toContain('sports');
      expect(codes).toContain('arts');
      expect(codes).toContain('music');
    });
  });

  describe('Age Groups', () => {
    const mockService = createMockActivityService();

    it('should return age groups with expected structure', async () => {
      const groups = await mockService.getAgeGroups();
      
      expect(groups).toBeDefined();
      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThan(0);
    });

    it('should have required fields for each age group', async () => {
      const groups = await mockService.getAgeGroups();
      
      groups.forEach((group: any) => {
        expect(group).toHaveProperty('code');
        expect(group).toHaveProperty('label');
        expect(group).toHaveProperty('minAge');
        expect(group).toHaveProperty('maxAge');
        expect(typeof group.code).toBe('string');
        expect(typeof group.label).toBe('string');
        expect(typeof group.minAge).toBe('number');
        expect(typeof group.maxAge).toBe('number');
      });
    });

    it('should have valid age ranges (min <= max)', async () => {
      const groups = await mockService.getAgeGroups();
      
      groups.forEach((group: any) => {
        expect(group.minAge).toBeLessThanOrEqual(group.maxAge);
      });
    });

    it('should cover full age range from 0 to 18', async () => {
      const groups = await mockService.getAgeGroups();
      
      const minAges = groups.map((g: any) => g.minAge);
      const maxAges = groups.map((g: any) => g.maxAge);
      
      expect(Math.min(...minAges)).toBe(0);
      expect(Math.max(...maxAges)).toBe(18);
    });

    it('should have age groups in ascending order', async () => {
      const groups = await mockService.getAgeGroups();
      
      for (let i = 1; i < groups.length; i++) {
        expect(groups[i].minAge).toBeGreaterThanOrEqual(groups[i - 1].minAge);
      }
    });
  });

  describe('Cities', () => {
    const mockService = createMockActivityService();

    it('should return cities with expected structure', async () => {
      const cities = await mockService.getCities();
      
      expect(cities).toBeDefined();
      expect(Array.isArray(cities)).toBe(true);
      expect(cities.length).toBeGreaterThan(0);
    });

    it('should have required fields for each city', async () => {
      const cities = await mockService.getCities();
      
      cities.forEach((city: any) => {
        expect(city).toHaveProperty('id');
        expect(city).toHaveProperty('name');
        expect(city).toHaveProperty('province');
        expect(typeof city.id).toBe('string');
        expect(typeof city.name).toBe('string');
        expect(typeof city.province).toBe('string');
      });
    });

    it('should have activity count for each city', async () => {
      const cities = await mockService.getCities();
      
      cities.forEach((city: any) => {
        expect(city).toHaveProperty('activityCount');
        expect(typeof city.activityCount).toBe('number');
        expect(city.activityCount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include expected provinces', async () => {
      const cities = await mockService.getCities();
      const provinces = [...new Set(cities.map((c: any) => c.province))];
      
      expect(provinces).toContain('BC');
    });
  });

  describe('Locations', () => {
    const mockService = createMockActivityService();

    it('should return locations with expected structure', async () => {
      const locations = await mockService.getLocations();
      
      expect(locations).toBeDefined();
      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);
    });

    it('should have required fields for each location', async () => {
      const locations = await mockService.getLocations();
      
      locations.forEach((location: any) => {
        expect(location).toHaveProperty('id');
        expect(location).toHaveProperty('name');
        expect(location).toHaveProperty('city');
        expect(typeof location.id).toBe('string');
        expect(typeof location.name).toBe('string');
        expect(typeof location.city).toBe('string');
      });
    });

    it('should have activity count for each location', async () => {
      const locations = await mockService.getLocations();
      
      locations.forEach((location: any) => {
        expect(location).toHaveProperty('_count');
        expect(location._count).toHaveProperty('activities');
        expect(typeof location._count.activities).toBe('number');
      });
    });
  });

  describe('Data Consistency', () => {
    const mockService = createMockActivityService();

    it('should have matching city names in locations and cities', async () => {
      const cities = await mockService.getCities();
      const locations = await mockService.getLocations();
      
      const cityNames = cities.map((c: any) => c.name);
      const locationCities = locations.map((l: any) => l.city);
      
      // All location cities should exist in cities list
      locationCities.forEach((city: string) => {
        expect(cityNames).toContain(city);
      });
    });

    it('should have unique activity type codes', async () => {
      const types = await mockService.getActivityTypesWithCounts();
      const codes = types.map((t: any) => t.code);
      const uniqueCodes = [...new Set(codes)];
      
      expect(codes.length).toBe(uniqueCodes.length);
    });

    it('should have unique age group codes', async () => {
      const groups = await mockService.getAgeGroups();
      const codes = groups.map((g: any) => g.code);
      const uniqueCodes = [...new Set(codes)];
      
      expect(codes.length).toBe(uniqueCodes.length);
    });
  });
});

