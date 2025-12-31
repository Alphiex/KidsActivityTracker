/**
 * ActivityService Unit Tests
 * Tests for the activity service
 */
import { mockApiClient } from '../../mocks/services';

// Mock the API client
jest.mock('../../../../src/services/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

import activityService from '../../../../src/services/activityService';

describe('ActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.get.mockResolvedValue({ data: [] });
    mockApiClient.post.mockResolvedValue({ data: {} });
  });

  describe('searchActivities', () => {
    it('should call API with search params', async () => {
      const searchParams = { query: 'swimming', minAge: 5, maxAge: 10 };

      mockApiClient.get.mockResolvedValue({
        data: {
          activities: [],
          total: 0,
          page: 1,
          totalPages: 0,
        },
      });

      await activityService.searchActivities(searchParams);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/activities'),
        expect.objectContaining({ params: expect.any(Object) })
      );
    });

    it('should return activity list', async () => {
      const mockActivities = [
        { id: '1', title: 'Swimming' },
        { id: '2', title: 'Art Class' },
      ];

      mockApiClient.get.mockResolvedValue({
        data: {
          activities: mockActivities,
          total: 2,
          page: 1,
          totalPages: 1,
        },
      });

      const result = await activityService.searchActivities({});

      expect(result.activities).toHaveLength(2);
      expect(result.activities[0].title).toBe('Swimming');
    });

    it('should handle empty results', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          activities: [],
          total: 0,
          page: 1,
          totalPages: 0,
        },
      });

      const result = await activityService.searchActivities({ query: 'nonexistent' });

      expect(result.activities).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle API error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(activityService.searchActivities({})).rejects.toThrow();
    });
  });

  describe('getActivityById', () => {
    it('should fetch single activity', async () => {
      const mockActivity = { id: '1', title: 'Swimming Lessons' };
      mockApiClient.get.mockResolvedValue({ data: mockActivity });

      const result = await activityService.getActivityById('1');

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/activities/1'));
      expect(result.title).toBe('Swimming Lessons');
    });

    it('should handle activity not found', async () => {
      mockApiClient.get.mockRejectedValue({ response: { status: 404 } });

      await expect(activityService.getActivityById('nonexistent')).rejects.toThrow();
    });
  });

  describe('getRecommendations', () => {
    it('should fetch recommended activities', async () => {
      const mockActivities = [{ id: '1', title: 'Recommended Activity' }];
      mockApiClient.get.mockResolvedValue({ data: mockActivities });

      const result = await activityService.getRecommendations();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('recommend')
      );
      expect(result).toHaveLength(1);
    });

    it('should accept child ID parameter', async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });

      await activityService.getRecommendations('child-1');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('child-1')
      );
    });
  });

  describe('getActivitiesByDate', () => {
    it('should fetch activities for specific date', async () => {
      const mockActivities = [{ id: '1', title: 'Saturday Class' }];
      mockApiClient.get.mockResolvedValue({ data: mockActivities });

      const date = new Date('2025-01-15');
      const result = await activityService.getActivitiesByDate(date);

      expect(mockApiClient.get).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('getActivitiesForChild', () => {
    it('should fetch activities suitable for child', async () => {
      const mockActivities = [{ id: '1', title: 'Kids Swimming' }];
      mockApiClient.get.mockResolvedValue({ data: mockActivities });

      const result = await activityService.getActivitiesForChild('child-1');

      expect(mockApiClient.get).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
