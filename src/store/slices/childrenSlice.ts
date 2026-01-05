import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import childrenService from '../../services/childrenService';
import childPreferencesService, { ChildPreferences } from '../../services/childPreferencesService';
import { RootState } from '../index';

export interface Child {
  id: string;
  name: string;
  dateOfBirth?: string;  // Optional - can be set later
  gender?: 'male' | 'female' | null; // 'male', 'female', or null for prefer not to say
  interests?: string[];
  avatar?: string;           // Legacy: URL to custom avatar image
  avatarId?: number;         // 1-10, references bundled animal avatar
  colorId?: number;          // 1-10, references pastel color for child
  allergies?: string[];
  medicalInfo?: string;
  location?: string;
  locationDetails?: {
    formattedAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Child with preferences attached
 */
export interface ChildWithPreferences extends Child {
  preferences?: ChildPreferences;
}

/**
 * Filter mode for multi-child selection
 * - 'or': Show activities suitable for ANY selected child (default, free)
 * - 'and': Show activities suitable for ALL selected children together (premium)
 */
export type ChildFilterMode = 'or' | 'and';

interface ChildrenState {
  children: ChildWithPreferences[];
  selectedChild: ChildWithPreferences | null;
  // Multi-child selection for filtering
  selectedChildIds: string[];  // IDs of children selected for filtering
  filterMode: ChildFilterMode; // 'or' (any child) or 'and' (all together)
  // Loading states
  loading: boolean;
  preferencesLoading: boolean;
  error: string | null;
}

const initialState: ChildrenState = {
  children: [],
  selectedChild: null,
  selectedChildIds: [], // Will be initialized to all children when loaded
  filterMode: 'or',     // Default: show activities for ANY selected child
  loading: false,
  preferencesLoading: false,
  error: null,
};

// Async thunks
export const fetchChildren = createAsyncThunk(
  'children/fetchChildren',
  async () => {
    const response = await childrenService.getChildren();
    return response;
  }
);

export const addChild = createAsyncThunk(
  'children/addChild',
  async (childData: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>) => {
    const response = await childrenService.createChild(childData);
    return response;
  }
);

export const updateChild = createAsyncThunk(
  'children/updateChild',
  async ({ id, data }: { id: string; data: Partial<Child> }) => {
    const response = await childrenService.updateChild(id, data);
    return response;
  }
);

export const deleteChild = createAsyncThunk(
  'children/deleteChild',
  async (id: string) => {
    await childrenService.deleteChild(id);
    return id;
  }
);

export const fetchChildActivities = createAsyncThunk(
  'children/fetchChildActivities',
  async (childId: string) => {
    const response = await childrenService.getChildActivities(childId);
    return { childId, activities: response };
  }
);

// Fetch preferences for a single child
export const fetchChildPreferences = createAsyncThunk(
  'children/fetchChildPreferences',
  async (childId: string) => {
    const preferences = await childPreferencesService.getChildPreferences(childId);
    return { childId, preferences };
  }
);

// Update preferences for a child
export const updateChildPreferences = createAsyncThunk(
  'children/updateChildPreferences',
  async ({ childId, updates }: { childId: string; updates: Partial<ChildPreferences> }) => {
    const preferences = await childPreferencesService.updateChildPreferences(childId, updates);
    return { childId, preferences };
  }
);

// Copy preferences from one child to another
export const copyChildPreferences = createAsyncThunk(
  'children/copyChildPreferences',
  async ({ sourceChildId, targetChildId }: { sourceChildId: string; targetChildId: string }) => {
    const preferences = await childPreferencesService.copyPreferences(sourceChildId, targetChildId);
    return { childId: targetChildId, preferences };
  }
);

// Initialize preferences for a child from user's preferences (migration)
export const initializeChildPreferences = createAsyncThunk(
  'children/initializeChildPreferences',
  async (childId: string) => {
    const preferences = await childPreferencesService.initializeFromUserPreferences(childId);
    return { childId, preferences };
  }
);

const childrenSlice = createSlice({
  name: 'children',
  initialState,
  reducers: {
    selectChild: (state, action: PayloadAction<string>) => {
      state.selectedChild = state.children.find(child => child.id === action.payload) || null;
    },
    clearSelectedChild: (state) => {
      state.selectedChild = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    // Multi-child selection reducers
    setSelectedChildIds: (state, action: PayloadAction<string[]>) => {
      state.selectedChildIds = action.payload || [];
    },
    toggleChildSelection: (state, action: PayloadAction<string>) => {
      const childId = action.payload;
      // Ensure selectedChildIds is an array (for migration safety)
      if (!state.selectedChildIds) {
        state.selectedChildIds = state.children.map(c => c.id);
      }
      const index = state.selectedChildIds.indexOf(childId);
      if (index === -1) {
        state.selectedChildIds.push(childId);
      } else {
        // Allow deselecting all children - this disables child-based filtering
        // When no children selected, only global filters (from FiltersScreen) apply
        state.selectedChildIds.splice(index, 1);
      }
    },
    selectAllChildren: (state) => {
      state.selectedChildIds = state.children.map(c => c.id);
    },
    setFilterMode: (state, action: PayloadAction<ChildFilterMode>) => {
      state.filterMode = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch children
      .addCase(fetchChildren.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChildren.fulfilled, (state, action) => {
        state.loading = false;
        state.children = action.payload;

        // Ensure selectedChildIds contains only valid child IDs
        const validChildIds = action.payload.map((c: ChildWithPreferences) => c.id);
        const currentlyValidSelected = state.selectedChildIds.filter(id => validChildIds.includes(id));

        // If no valid selections remain OR selectedChildIds was empty, select all children
        if (currentlyValidSelected.length === 0 && action.payload.length > 0) {
          state.selectedChildIds = validChildIds;
          console.log('[childrenSlice] Initialized selectedChildIds to all children:', validChildIds);
        } else if (currentlyValidSelected.length !== state.selectedChildIds.length) {
          // Remove stale IDs that no longer exist
          state.selectedChildIds = currentlyValidSelected;
          console.log('[childrenSlice] Cleaned up stale selectedChildIds:', currentlyValidSelected);
        }
      })
      .addCase(fetchChildren.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch children';
      })
      // Add child
      .addCase(addChild.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addChild.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.children.push(action.payload);
          // Add new child to selected children (if not already there)
          if (!state.selectedChildIds.includes(action.payload.id)) {
            state.selectedChildIds.push(action.payload.id);
          }
          console.log('[childrenSlice] Added child:', action.payload.id, 'selectedChildIds:', state.selectedChildIds);
        }
      })
      .addCase(addChild.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add child';
      })
      // Update child
      .addCase(updateChild.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateChild.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.children.findIndex(child => child.id === action.payload.id);
        if (index !== -1) {
          state.children[index] = action.payload;
        }
        if (state.selectedChild?.id === action.payload.id) {
          state.selectedChild = action.payload;
        }
      })
      .addCase(updateChild.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update child';
      })
      // Delete child
      .addCase(deleteChild.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteChild.fulfilled, (state, action) => {
        state.loading = false;
        state.children = state.children.filter(child => child.id !== action.payload);
        // Remove from selectedChildIds
        state.selectedChildIds = state.selectedChildIds.filter(id => id !== action.payload);
        if (state.selectedChild?.id === action.payload) {
          state.selectedChild = null;
        }
      })
      .addCase(deleteChild.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete child';
      })
      // Fetch child preferences
      .addCase(fetchChildPreferences.pending, (state) => {
        state.preferencesLoading = true;
      })
      .addCase(fetchChildPreferences.fulfilled, (state, action) => {
        state.preferencesLoading = false;
        const { childId, preferences } = action.payload;
        const childIndex = state.children.findIndex(c => c.id === childId);
        if (childIndex !== -1) {
          state.children[childIndex].preferences = preferences;
        }
        if (state.selectedChild?.id === childId) {
          state.selectedChild.preferences = preferences;
        }
      })
      .addCase(fetchChildPreferences.rejected, (state, action) => {
        state.preferencesLoading = false;
        state.error = action.error.message || 'Failed to fetch child preferences';
      })
      // Update child preferences
      .addCase(updateChildPreferences.pending, (state) => {
        state.preferencesLoading = true;
      })
      .addCase(updateChildPreferences.fulfilled, (state, action) => {
        state.preferencesLoading = false;
        const { childId, preferences } = action.payload;
        const childIndex = state.children.findIndex(c => c.id === childId);
        if (childIndex !== -1) {
          state.children[childIndex].preferences = preferences;
        }
        if (state.selectedChild?.id === childId) {
          state.selectedChild.preferences = preferences;
        }
      })
      .addCase(updateChildPreferences.rejected, (state, action) => {
        state.preferencesLoading = false;
        state.error = action.error.message || 'Failed to update child preferences';
      })
      // Copy child preferences
      .addCase(copyChildPreferences.pending, (state) => {
        state.preferencesLoading = true;
      })
      .addCase(copyChildPreferences.fulfilled, (state, action) => {
        state.preferencesLoading = false;
        const { childId, preferences } = action.payload;
        const childIndex = state.children.findIndex(c => c.id === childId);
        if (childIndex !== -1) {
          state.children[childIndex].preferences = preferences;
        }
        if (state.selectedChild?.id === childId) {
          state.selectedChild.preferences = preferences;
        }
      })
      .addCase(copyChildPreferences.rejected, (state, action) => {
        state.preferencesLoading = false;
        state.error = action.error.message || 'Failed to copy child preferences';
      })
      // Initialize child preferences
      .addCase(initializeChildPreferences.pending, (state) => {
        state.preferencesLoading = true;
      })
      .addCase(initializeChildPreferences.fulfilled, (state, action) => {
        state.preferencesLoading = false;
        const { childId, preferences } = action.payload;
        const childIndex = state.children.findIndex(c => c.id === childId);
        if (childIndex !== -1) {
          state.children[childIndex].preferences = preferences;
        }
        if (state.selectedChild?.id === childId) {
          state.selectedChild.preferences = preferences;
        }
      })
      .addCase(initializeChildPreferences.rejected, (state, action) => {
        state.preferencesLoading = false;
        state.error = action.error.message || 'Failed to initialize child preferences';
      });
  },
});

export const {
  selectChild,
  clearSelectedChild,
  clearError,
  setSelectedChildIds,
  toggleChildSelection,
  selectAllChildren: selectAllChildrenAction,
  setFilterMode,
} = childrenSlice.actions;

// Basic selectors
export const selectAllChildren = (state: RootState) => state.children.children;
export const selectSelectedChild = (state: RootState) => state.children.selectedChild;
export const selectChildrenLoading = (state: RootState) => state.children.loading;
export const selectChildrenError = (state: RootState) => state.children.error;

// Multi-child selection selectors (with fallbacks for migration safety)
export const selectSelectedChildIds = (state: RootState) => state.children.selectedChildIds || [];
export const selectFilterMode = (state: RootState) => state.children.filterMode || 'or';
export const selectPreferencesLoading = (state: RootState) => state.children.preferencesLoading;

// Derived selectors
export const selectSelectedChildren = (state: RootState): ChildWithPreferences[] => {
  const { children, selectedChildIds } = state.children;
  const safeSelectedIds = selectedChildIds || [];
  return children.filter(c => safeSelectedIds.includes(c.id));
};

export const selectChildById = (childId: string) => (state: RootState): ChildWithPreferences | undefined => {
  return state.children.children.find(c => c.id === childId);
};

export const selectChildPreferences = (childId: string) => (state: RootState): ChildPreferences | undefined => {
  const child = state.children.children.find(c => c.id === childId);
  return child?.preferences;
};

export default childrenSlice.reducer;