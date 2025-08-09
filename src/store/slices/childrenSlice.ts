import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import childrenService from '../../services/childrenService';
import { RootState } from '../index';

export interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
  interests?: string[];
  avatar?: string;
  allergies?: string[];
  medicalInfo?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChildrenState {
  children: Child[];
  selectedChild: Child | null;
  loading: boolean;
  error: string | null;
}

const initialState: ChildrenState = {
  children: [],
  selectedChild: null,
  loading: false,
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
        state.children.push(action.payload);
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
        if (state.selectedChild?.id === action.payload) {
          state.selectedChild = null;
        }
      })
      .addCase(deleteChild.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete child';
      });
  },
});

export const { selectChild, clearSelectedChild, clearError } = childrenSlice.actions;

export const selectAllChildren = (state: RootState) => state.children.children;
export const selectSelectedChild = (state: RootState) => state.children.selectedChild;
export const selectChildrenLoading = (state: RootState) => state.children.loading;
export const selectChildrenError = (state: RootState) => state.children.error;

export default childrenSlice.reducer;