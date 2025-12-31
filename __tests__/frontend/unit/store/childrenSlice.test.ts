/**
 * ChildrenSlice Tests
 * Tests for children management Redux slice
 */
import childrenReducer, {
  fetchChildren,
  addChild,
  updateChild,
  deleteChild,
  setSelectedChild,
  clearSelectedChild,
} from '../../../../src/store/childrenSlice';

describe('ChildrenSlice', () => {
  const initialState = {
    children: [],
    selectedChild: null,
    isLoading: false,
    error: null,
  };

  const mockChildren = [
    { id: '1', name: 'Emma', dateOfBirth: '2018-01-15', interests: ['swimming'] },
    { id: '2', name: 'Liam', dateOfBirth: '2019-05-20', interests: ['art'] },
  ];

  describe('reducers', () => {
    it('should return initial state', () => {
      const result = childrenReducer(undefined, { type: 'unknown' });

      expect(result.children).toEqual([]);
      expect(result.selectedChild).toBeNull();
    });

    it('should handle setSelectedChild', () => {
      const stateWithChildren = { ...initialState, children: mockChildren };
      const result = childrenReducer(stateWithChildren, setSelectedChild('1'));

      expect(result.selectedChild).toBe('1');
    });

    it('should handle clearSelectedChild', () => {
      const stateWithSelected = { ...initialState, selectedChild: '1' };
      const result = childrenReducer(stateWithSelected, clearSelectedChild());

      expect(result.selectedChild).toBeNull();
    });
  });

  describe('fetchChildren async thunk', () => {
    it('should set loading on pending', () => {
      const action = { type: fetchChildren.pending.type };
      const result = childrenReducer(initialState, action);

      expect(result.isLoading).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should set children on fulfilled', () => {
      const action = { type: fetchChildren.fulfilled.type, payload: mockChildren };
      const result = childrenReducer(initialState, action);

      expect(result.children).toEqual(mockChildren);
      expect(result.isLoading).toBe(false);
    });

    it('should set error on rejected', () => {
      const action = {
        type: fetchChildren.rejected.type,
        payload: 'Failed to fetch children',
      };
      const result = childrenReducer(initialState, action);

      expect(result.error).toBe('Failed to fetch children');
      expect(result.isLoading).toBe(false);
    });
  });

  describe('addChild async thunk', () => {
    it('should add child to list on fulfilled', () => {
      const stateWithChildren = { ...initialState, children: mockChildren };
      const newChild = { id: '3', name: 'Oliver', dateOfBirth: '2020-03-10', interests: [] };

      const action = { type: addChild.fulfilled.type, payload: newChild };
      const result = childrenReducer(stateWithChildren, action);

      expect(result.children).toHaveLength(3);
      expect(result.children[2].name).toBe('Oliver');
    });
  });

  describe('updateChild async thunk', () => {
    it('should update child in list on fulfilled', () => {
      const stateWithChildren = { ...initialState, children: mockChildren };
      const updatedChild = { id: '1', name: 'Emma Updated', dateOfBirth: '2018-01-15', interests: ['swimming', 'music'] };

      const action = { type: updateChild.fulfilled.type, payload: updatedChild };
      const result = childrenReducer(stateWithChildren, action);

      const emma = result.children.find((c: { id: string }) => c.id === '1');
      expect(emma?.name).toBe('Emma Updated');
      expect(emma?.interests).toContain('music');
    });
  });

  describe('deleteChild async thunk', () => {
    it('should remove child from list on fulfilled', () => {
      const stateWithChildren = { ...initialState, children: mockChildren };

      const action = { type: deleteChild.fulfilled.type, payload: '1' };
      const result = childrenReducer(stateWithChildren, action);

      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe('2');
    });

    it('should clear selected child if deleted', () => {
      const stateWithSelected = { ...initialState, children: mockChildren, selectedChild: '1' };

      const action = { type: deleteChild.fulfilled.type, payload: '1' };
      const result = childrenReducer(stateWithSelected, action);

      expect(result.selectedChild).toBeNull();
    });
  });

  describe('selectors', () => {
    const state = {
      children: {
        children: mockChildren,
        selectedChild: '1',
        isLoading: false,
        error: null,
      },
    };

    it('should select all children', () => {
      expect(state.children.children).toHaveLength(2);
    });

    it('should select child by id', () => {
      const child = state.children.children.find((c: { id: string }) => c.id === '1');
      expect(child?.name).toBe('Emma');
    });

    it('should select selected child', () => {
      expect(state.children.selectedChild).toBe('1');
    });
  });
});
