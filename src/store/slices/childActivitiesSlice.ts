import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import childActivityService from '../../services/childActivityService';
import { RootState } from '../index';
import { Activity } from '../../types/activity';

export type ActivityStatus = 'planned' | 'in_progress' | 'completed';

export interface ChildActivity {
  id: string;
  childId: string;
  activityId: string;
  status: ActivityStatus;
  notes?: string;
  rating?: number;
  registeredAt?: Date;
  completedAt?: Date;
  createdAt: string;
  updatedAt: string;
  activity?: Activity;
}

export interface LinkActivityInput {
  childId: string;
  activityId: string;
  status: ActivityStatus;
  notes?: string;
}

export interface UpdateActivityStatusInput {
  status: ActivityStatus;
  notes?: string;
  rating?: number;
}

interface ChildActivitiesState {
  childActivities: Record<string, ChildActivity[]>; // Keyed by childId
  activityChildren: Record<string, string[]>; // Keyed by activityId, contains childIds
  loading: boolean;
  error: string | null;
}

const initialState: ChildActivitiesState = {
  childActivities: {},
  activityChildren: {},
  loading: false,
  error: null,
};

// Async thunks
export const linkActivity = createAsyncThunk(
  'childActivities/linkActivity',
  async (input: LinkActivityInput) => {
    const response = await childActivityService.linkActivity(input);
    return response;
  }
);

export const updateActivityStatus = createAsyncThunk(
  'childActivities/updateActivityStatus',
  async ({ childId, activityId, input }: { 
    childId: string; 
    activityId: string; 
    input: UpdateActivityStatusInput 
  }) => {
    const response = await childActivityService.updateActivityStatus(childId, activityId, input);
    return response;
  }
);

export const unlinkActivity = createAsyncThunk(
  'childActivities/unlinkActivity',
  async ({ childId, activityId }: { childId: string; activityId: string }) => {
    await childActivityService.unlinkActivity(childId, activityId);
    return { childId, activityId };
  }
);

export const fetchChildActivities = createAsyncThunk(
  'childActivities/fetchChildActivities',
  async (childId: string) => {
    const response = await childActivityService.getChildActivities(childId);
    return { childId, activities: response };
  }
);

export const fetchActivityChildren = createAsyncThunk(
  'childActivities/fetchActivityChildren',
  async (activityId: string) => {
    const response = await childActivityService.getActivityChildren(activityId);
    return { activityId, children: response };
  }
);

export const fetchChildActivityHistory = createAsyncThunk(
  'childActivities/fetchChildActivityHistory',
  async (filters: {
    childId?: string;
    status?: ActivityStatus;
    startDate?: Date;
    endDate?: Date;
  }) => {
    const response = await childActivityService.getActivityHistory(filters);
    return response;
  }
);

const childActivitiesSlice = createSlice({
  name: 'childActivities',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearChildActivities: (state, action: PayloadAction<string>) => {
      delete state.childActivities[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      // Link activity
      .addCase(linkActivity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(linkActivity.fulfilled, (state, action) => {
        state.loading = false;
        const childActivity = action.payload;
        
        // Update child activities
        if (!state.childActivities[childActivity.childId]) {
          state.childActivities[childActivity.childId] = [];
        }
        state.childActivities[childActivity.childId].push(childActivity);
        
        // Update activity children
        if (!state.activityChildren[childActivity.activityId]) {
          state.activityChildren[childActivity.activityId] = [];
        }
        if (!state.activityChildren[childActivity.activityId].includes(childActivity.childId)) {
          state.activityChildren[childActivity.activityId].push(childActivity.childId);
        }
      })
      .addCase(linkActivity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to link activity';
      })
      
      // Update activity status
      .addCase(updateActivityStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateActivityStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updatedActivity = action.payload;
        
        // Update in child activities
        const childActivities = state.childActivities[updatedActivity.childId];
        if (childActivities) {
          const index = childActivities.findIndex(ca => ca.id === updatedActivity.id);
          if (index !== -1) {
            childActivities[index] = updatedActivity;
          }
        }
      })
      .addCase(updateActivityStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update activity status';
      })
      
      // Unlink activity
      .addCase(unlinkActivity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(unlinkActivity.fulfilled, (state, action) => {
        state.loading = false;
        const { childId, activityId } = action.payload;
        
        // Remove from child activities
        if (state.childActivities[childId]) {
          state.childActivities[childId] = state.childActivities[childId].filter(
            ca => ca.activityId !== activityId
          );
        }
        
        // Remove from activity children
        if (state.activityChildren[activityId]) {
          state.activityChildren[activityId] = state.activityChildren[activityId].filter(
            id => id !== childId
          );
        }
      })
      .addCase(unlinkActivity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to unlink activity';
      })
      
      // Fetch child activities
      .addCase(fetchChildActivities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChildActivities.fulfilled, (state, action) => {
        state.loading = false;
        const { childId, activities } = action.payload;
        state.childActivities[childId] = activities;
        
        // Update activity children mapping
        activities.forEach((activity: ChildActivity) => {
          if (!state.activityChildren[activity.activityId]) {
            state.activityChildren[activity.activityId] = [];
          }
          if (!state.activityChildren[activity.activityId].includes(childId)) {
            state.activityChildren[activity.activityId].push(childId);
          }
        });
      })
      .addCase(fetchChildActivities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch child activities';
      })
      
      // Fetch activity children
      .addCase(fetchActivityChildren.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActivityChildren.fulfilled, (state, action) => {
        state.loading = false;
        const { activityId, children } = action.payload;
        state.activityChildren[activityId] = children;
      })
      .addCase(fetchActivityChildren.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch activity children';
      });
  },
});

export const { clearError, clearChildActivities } = childActivitiesSlice.actions;

// Selectors - with null safety for when slice hasn't loaded yet
export const selectChildActivities = (childId: string) => (state: RootState) =>
  state.childActivities?.childActivities?.[childId] || [];

export const selectActivityChildren = (activityId: string) => (state: RootState) =>
  state.childActivities?.activityChildren?.[activityId] || [];

export const selectChildActivityStatus = (childId: string, activityId: string) => (state: RootState) => {
  const childActivities = state.childActivities?.childActivities?.[childId];
  if (!childActivities) return null;
  const activity = childActivities.find(ca => ca.activityId === activityId);
  return activity?.status || null;
};

export const selectChildActivitiesLoading = (state: RootState) => state.childActivities?.loading ?? false;
export const selectChildActivitiesError = (state: RootState) => state.childActivities?.error ?? null;

export default childActivitiesSlice.reducer;