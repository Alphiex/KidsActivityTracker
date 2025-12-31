/**
 * ChildrenService Unit Tests
 * Tests for the children management service
 */
import { mockApiClient } from '../../mocks/services';

// Mock the API client
jest.mock('../../../../src/services/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

import childrenService from '../../../../src/services/childrenService';

describe('ChildrenService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.get.mockResolvedValue({ data: [] });
    mockApiClient.post.mockResolvedValue({ data: {} });
    mockApiClient.put.mockResolvedValue({ data: {} });
    mockApiClient.delete.mockResolvedValue({ data: {} });
  });

  describe('getChildren', () => {
    it('should fetch all children for user', async () => {
      const mockChildren = [
        { id: '1', name: 'Emma', dateOfBirth: '2018-01-15' },
        { id: '2', name: 'Liam', dateOfBirth: '2019-05-20' },
      ];
      mockApiClient.get.mockResolvedValue({ data: mockChildren });

      const result = await childrenService.getChildren();

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/children'));
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Emma');
    });

    it('should return empty array if no children', async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });

      const result = await childrenService.getChildren();

      expect(result).toHaveLength(0);
    });
  });

  describe('getChildById', () => {
    it('should fetch single child by ID', async () => {
      const mockChild = { id: '1', name: 'Emma', dateOfBirth: '2018-01-15' };
      mockApiClient.get.mockResolvedValue({ data: mockChild });

      const result = await childrenService.getChildById('1');

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/children/1'));
      expect(result.name).toBe('Emma');
    });

    it('should throw if child not found', async () => {
      mockApiClient.get.mockRejectedValue({ response: { status: 404 } });

      await expect(childrenService.getChildById('nonexistent')).rejects.toThrow();
    });
  });

  describe('addChild', () => {
    it('should create new child', async () => {
      const newChild = {
        name: 'Oliver',
        dateOfBirth: '2020-03-10',
        interests: ['sports', 'music'],
      };
      const mockResponse = { id: '3', ...newChild };
      mockApiClient.post.mockResolvedValue({ data: mockResponse });

      const result = await childrenService.addChild(newChild);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/children'),
        expect.objectContaining({ name: 'Oliver' })
      );
      expect(result.id).toBe('3');
    });

    it('should validate child data', async () => {
      mockApiClient.post.mockRejectedValue({
        response: { status: 400, data: { message: 'Invalid data' } },
      });

      await expect(
        childrenService.addChild({ name: '', dateOfBirth: 'invalid' })
      ).rejects.toThrow();
    });
  });

  describe('updateChild', () => {
    it('should update existing child', async () => {
      const updates = { name: 'Emma Updated', interests: ['swimming', 'art'] };
      const mockResponse = { id: '1', ...updates };
      mockApiClient.put.mockResolvedValue({ data: mockResponse });

      const result = await childrenService.updateChild('1', updates);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        expect.stringContaining('/children/1'),
        expect.objectContaining({ name: 'Emma Updated' })
      );
      expect(result.name).toBe('Emma Updated');
    });

    it('should throw if child not found', async () => {
      mockApiClient.put.mockRejectedValue({ response: { status: 404 } });

      await expect(
        childrenService.updateChild('nonexistent', { name: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('deleteChild', () => {
    it('should delete child', async () => {
      mockApiClient.delete.mockResolvedValue({ data: { success: true } });

      const result = await childrenService.deleteChild('1');

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('/children/1')
      );
      expect(result.success).toBe(true);
    });

    it('should throw if child not found', async () => {
      mockApiClient.delete.mockRejectedValue({ response: { status: 404 } });

      await expect(childrenService.deleteChild('nonexistent')).rejects.toThrow();
    });
  });

  describe('calculateAge', () => {
    it('should calculate age from date of birth', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 7);

      const age = childrenService.calculateAge(dob.toISOString());

      expect(age).toBe(7);
    });
  });
});
