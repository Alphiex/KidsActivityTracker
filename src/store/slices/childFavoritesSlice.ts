/**
 * Redux slice for child-centric favorites and waitlist
 * Manages favorites and waitlist entries on a per-child basis
 */
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { childFavoritesService, ChildFavorite, ChildWaitlistEntry, ActivityChildStatus } from '../../services/childFavoritesService';
import { RootState } from '../index';

interface ChildFavoritesState {
  // Favorites
  favorites: ChildFavorite[];
  favoritesByChild: Record<string, ChildFavorite[]>;
  favoritesLoading: boolean;
  favoritesError: string | null;

  // Waitlist
  waitlist: ChildWaitlistEntry[];
  waitlistByChild: Record<string, ChildWaitlistEntry[]>;
  waitlistLoading: boolean;
  waitlistError: string | null;

  // Activity status cache (for UI state)
  activityStatus: Record<string, ActivityChildStatus[]>;
  statusLoading: boolean;

  // Last refresh timestamp
  lastFetch: number | null;
}

const initialState: ChildFavoritesState = {
  favorites: [],
  favoritesByChild: {},
  favoritesLoading: false,
  favoritesError: null,

  waitlist: [],
  waitlistByChild: {},
  waitlistLoading: false,
  waitlistError: null,

  activityStatus: {},
  statusLoading: false,

  lastFetch: null,
};

// Helper to organize favorites by child
const organizeFavoritesByChild = (favorites: ChildFavorite[]): Record<string, ChildFavorite[]> => {
  const byChild: Record<string, ChildFavorite[]> = {};
  for (const fav of favorites) {
    if (!byChild[fav.childId]) {
      byChild[fav.childId] = [];
    }
    byChild[fav.childId].push(fav);
  }
  return byChild;
};

// Helper to organize waitlist by child
const organizeWaitlistByChild = (entries: ChildWaitlistEntry[]): Record<string, ChildWaitlistEntry[]> => {
  const byChild: Record<string, ChildWaitlistEntry[]> = {};
  for (const entry of entries) {
    if (!byChild[entry.childId]) {
      byChild[entry.childId] = [];
    }
    byChild[entry.childId].push(entry);
  }
  return byChild;
};

// ============= ASYNC THUNKS =============

// Fetch favorites for multiple children
export const fetchChildFavorites = createAsyncThunk(
  'childFavorites/fetchFavorites',
  async (childIds: string[]) => {
    const favorites = await childFavoritesService.getFavoritesForChildren(childIds);
    return favorites;
  }
);

// Fetch waitlist for multiple children
export const fetchChildWaitlist = createAsyncThunk(
  'childFavorites/fetchWaitlist',
  async (childIds: string[]) => {
    const waitlist = await childFavoritesService.getWaitlistForChildren(childIds);
    return waitlist;
  }
);

// Add favorite for a child
export const addChildFavorite = createAsyncThunk(
  'childFavorites/addFavorite',
  async ({ childId, activityId }: { childId: string; activityId: string }) => {
    await childFavoritesService.addFavorite(childId, activityId);
    return { childId, activityId };
  }
);

// Remove favorite for a child
export const removeChildFavorite = createAsyncThunk(
  'childFavorites/removeFavorite',
  async ({ childId, activityId }: { childId: string; activityId: string }) => {
    await childFavoritesService.removeFavorite(childId, activityId);
    return { childId, activityId };
  }
);

// Join waitlist for a child
export const joinChildWaitlist = createAsyncThunk(
  'childFavorites/joinWaitlist',
  async ({ childId, activityId }: { childId: string; activityId: string }) => {
    await childFavoritesService.joinWaitlist(childId, activityId);
    return { childId, activityId };
  }
);

// Leave waitlist for a child
export const leaveChildWaitlist = createAsyncThunk(
  'childFavorites/leaveWaitlist',
  async ({ childId, activityId }: { childId: string; activityId: string }) => {
    await childFavoritesService.leaveWaitlist(childId, activityId);
    return { childId, activityId };
  }
);

// Fetch activity status for multiple children
export const fetchActivityStatus = createAsyncThunk(
  'childFavorites/fetchActivityStatus',
  async ({ activityId, childIds }: { activityId: string; childIds: string[] }) => {
    const status = await childFavoritesService.getActivityStatusForChildren(activityId, childIds);
    return { activityId, status };
  }
);

// Migrate user favorites to a child
export const migrateUserFavorites = createAsyncThunk(
  'childFavorites/migrate',
  async (childId: string) => {
    const result = await childFavoritesService.migrateUserFavoritesToChild(childId);
    return { childId, ...result };
  }
);

// ============= SLICE =============

const childFavoritesSlice = createSlice({
  name: 'childFavorites',
  initialState,
  reducers: {
    clearFavoritesError: (state) => {
      state.favoritesError = null;
    },
    clearWaitlistError: (state) => {
      state.waitlistError = null;
    },
    // Optimistically update favorite status (for instant UI feedback)
    setOptimisticFavorite: (state, action: PayloadAction<{ childId: string; activityId: string; isFavorited: boolean }>) => {
      const { activityId, childId, isFavorited } = action.payload;
      const statusList = state.activityStatus[activityId];
      if (statusList) {
        const statusIndex = statusList.findIndex(s => s.childId === childId);
        if (statusIndex !== -1) {
          statusList[statusIndex].isFavorited = isFavorited;
        }
      }
    },
    // Optimistically update waitlist status
    setOptimisticWaitlist: (state, action: PayloadAction<{ childId: string; activityId: string; isOnWaitlist: boolean }>) => {
      const { activityId, childId, isOnWaitlist } = action.payload;
      const statusList = state.activityStatus[activityId];
      if (statusList) {
        const statusIndex = statusList.findIndex(s => s.childId === childId);
        if (statusIndex !== -1) {
          statusList[statusIndex].isOnWaitlist = isOnWaitlist;
        }
      }
    },
    // Clear all cached data (on logout)
    clearAllChildFavorites: (state) => {
      state.favorites = [];
      state.favoritesByChild = {};
      state.waitlist = [];
      state.waitlistByChild = {};
      state.activityStatus = {};
      state.lastFetch = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch favorites
      .addCase(fetchChildFavorites.pending, (state) => {
        state.favoritesLoading = true;
        state.favoritesError = null;
      })
      .addCase(fetchChildFavorites.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        state.favorites = action.payload;
        state.favoritesByChild = organizeFavoritesByChild(action.payload);
        state.lastFetch = Date.now();
      })
      .addCase(fetchChildFavorites.rejected, (state, action) => {
        state.favoritesLoading = false;
        state.favoritesError = action.error.message || 'Failed to fetch favorites';
      })

      // Fetch waitlist
      .addCase(fetchChildWaitlist.pending, (state) => {
        state.waitlistLoading = true;
        state.waitlistError = null;
      })
      .addCase(fetchChildWaitlist.fulfilled, (state, action) => {
        state.waitlistLoading = false;
        state.waitlist = action.payload;
        state.waitlistByChild = organizeWaitlistByChild(action.payload);
      })
      .addCase(fetchChildWaitlist.rejected, (state, action) => {
        state.waitlistLoading = false;
        state.waitlistError = action.error.message || 'Failed to fetch waitlist';
      })

      // Add favorite - optimistic update
      .addCase(addChildFavorite.pending, (state, action) => {
        const { childId, activityId } = action.meta.arg;
        // Optimistically add to status
        const statusList = state.activityStatus[activityId];
        if (statusList) {
          const statusIndex = statusList.findIndex(s => s.childId === childId);
          if (statusIndex !== -1) {
            statusList[statusIndex].isFavorited = true;
          }
        }
        // ALSO add to favorites array for selector to pick up
        const alreadyExists = state.favorites.some(
          f => f.childId === childId && f.activityId === activityId
        );
        if (!alreadyExists) {
          const optimisticFavorite = {
            id: `temp-${childId}-${activityId}`, // Temporary ID until server confirms
            childId,
            activityId,
            childName: '', // Will be populated from children slice
            notifyOnChange: false,
            createdAt: new Date().toISOString(),
            activity: {
              id: activityId,
              name: '',
              category: '',
              cost: 0,
            },
          };
          state.favorites.push(optimisticFavorite as any);
          // Update favoritesByChild
          if (!state.favoritesByChild[childId]) {
            state.favoritesByChild[childId] = [];
          }
          state.favoritesByChild[childId].push(optimisticFavorite as any);
        }
      })
      .addCase(addChildFavorite.fulfilled, (state, action) => {
        // State already updated optimistically
      })
      .addCase(addChildFavorite.rejected, (state, action) => {
        // Revert optimistic update
        const { childId, activityId } = action.meta.arg;
        const statusList = state.activityStatus[activityId];
        if (statusList) {
          const statusIndex = statusList.findIndex(s => s.childId === childId);
          if (statusIndex !== -1) {
            statusList[statusIndex].isFavorited = false;
          }
        }
        // Remove from favorites array
        state.favorites = state.favorites.filter(
          f => !(f.childId === childId && f.activityId === activityId)
        );
        if (state.favoritesByChild[childId]) {
          state.favoritesByChild[childId] = state.favoritesByChild[childId].filter(
            f => f.activityId !== activityId
          );
        }
        state.favoritesError = action.error.message || 'Failed to add favorite';
      })

      // Remove favorite - optimistic update
      .addCase(removeChildFavorite.pending, (state, action) => {
        const { childId, activityId } = action.meta.arg;
        // Optimistically remove from status
        const statusList = state.activityStatus[activityId];
        if (statusList) {
          const statusIndex = statusList.findIndex(s => s.childId === childId);
          if (statusIndex !== -1) {
            statusList[statusIndex].isFavorited = false;
          }
        }
        // Remove from favorites list
        state.favorites = state.favorites.filter(
          f => !(f.childId === childId && f.activityId === activityId)
        );
        // Update favoritesByChild
        if (state.favoritesByChild[childId]) {
          state.favoritesByChild[childId] = state.favoritesByChild[childId].filter(
            f => f.activityId !== activityId
          );
        }
      })
      .addCase(removeChildFavorite.fulfilled, (state, action) => {
        // State already updated optimistically
      })
      .addCase(removeChildFavorite.rejected, (state, action) => {
        // Need to refetch to restore state
        state.favoritesError = action.error.message || 'Failed to remove favorite';
      })

      // Join waitlist - optimistic update
      .addCase(joinChildWaitlist.pending, (state, action) => {
        const { childId, activityId } = action.meta.arg;
        const statusList = state.activityStatus[activityId];
        if (statusList) {
          const statusIndex = statusList.findIndex(s => s.childId === childId);
          if (statusIndex !== -1) {
            statusList[statusIndex].isOnWaitlist = true;
          }
        }
        // ALSO add to waitlist array for selector to pick up
        const alreadyExists = state.waitlist.some(
          w => w.childId === childId && w.activityId === activityId
        );
        if (!alreadyExists) {
          const optimisticWaitlist = {
            id: `temp-${childId}-${activityId}`, // Temporary ID until server confirms
            childId,
            activityId,
            childName: '', // Will be populated from children slice
            joinedAt: new Date().toISOString(),
            activity: {
              id: activityId,
              name: '',
              category: '',
              cost: 0,
            },
          };
          state.waitlist.push(optimisticWaitlist as any);
          // Update waitlistByChild
          if (!state.waitlistByChild[childId]) {
            state.waitlistByChild[childId] = [];
          }
          state.waitlistByChild[childId].push(optimisticWaitlist as any);
        }
      })
      .addCase(joinChildWaitlist.fulfilled, (state, action) => {
        // State already updated optimistically
      })
      .addCase(joinChildWaitlist.rejected, (state, action) => {
        const { childId, activityId } = action.meta.arg;
        const statusList = state.activityStatus[activityId];
        if (statusList) {
          const statusIndex = statusList.findIndex(s => s.childId === childId);
          if (statusIndex !== -1) {
            statusList[statusIndex].isOnWaitlist = false;
          }
        }
        // Remove from waitlist array
        state.waitlist = state.waitlist.filter(
          w => !(w.childId === childId && w.activityId === activityId)
        );
        if (state.waitlistByChild[childId]) {
          state.waitlistByChild[childId] = state.waitlistByChild[childId].filter(
            w => w.activityId !== activityId
          );
        }
        state.waitlistError = action.error.message || 'Failed to join waitlist';
      })

      // Leave waitlist - optimistic update
      .addCase(leaveChildWaitlist.pending, (state, action) => {
        const { childId, activityId } = action.meta.arg;
        const statusList = state.activityStatus[activityId];
        if (statusList) {
          const statusIndex = statusList.findIndex(s => s.childId === childId);
          if (statusIndex !== -1) {
            statusList[statusIndex].isOnWaitlist = false;
          }
        }
        // Remove from waitlist list
        state.waitlist = state.waitlist.filter(
          e => !(e.childId === childId && e.activityId === activityId)
        );
        // Update waitlistByChild
        if (state.waitlistByChild[childId]) {
          state.waitlistByChild[childId] = state.waitlistByChild[childId].filter(
            e => e.activityId !== activityId
          );
        }
      })
      .addCase(leaveChildWaitlist.fulfilled, (state, action) => {
        // State already updated optimistically
      })
      .addCase(leaveChildWaitlist.rejected, (state, action) => {
        state.waitlistError = action.error.message || 'Failed to leave waitlist';
      })

      // Fetch activity status
      .addCase(fetchActivityStatus.pending, (state) => {
        state.statusLoading = true;
      })
      .addCase(fetchActivityStatus.fulfilled, (state, action) => {
        state.statusLoading = false;
        const { activityId, status } = action.payload;
        state.activityStatus[activityId] = status;
      })
      .addCase(fetchActivityStatus.rejected, (state) => {
        state.statusLoading = false;
      })

      // Migrate favorites
      .addCase(migrateUserFavorites.fulfilled, (state, action) => {
        // Trigger refetch after migration
        state.lastFetch = null;
      });
  },
});

export const {
  clearFavoritesError,
  clearWaitlistError,
  setOptimisticFavorite,
  setOptimisticWaitlist,
  clearAllChildFavorites,
} = childFavoritesSlice.actions;

// ============= SELECTORS =============

// Basic selectors
export const selectAllChildFavorites = (state: RootState) => state.childFavorites.favorites;
export const selectFavoritesByChild = (state: RootState) => state.childFavorites.favoritesByChild;
export const selectFavoritesLoading = (state: RootState) => state.childFavorites.favoritesLoading;
export const selectFavoritesError = (state: RootState) => state.childFavorites.favoritesError;

export const selectAllChildWaitlist = (state: RootState) => state.childFavorites.waitlist;
export const selectWaitlistByChild = (state: RootState) => state.childFavorites.waitlistByChild;
export const selectWaitlistLoading = (state: RootState) => state.childFavorites.waitlistLoading;
export const selectWaitlistError = (state: RootState) => state.childFavorites.waitlistError;

export const selectActivityStatus = (activityId: string) => (state: RootState) =>
  state.childFavorites.activityStatus[activityId] || [];
export const selectStatusLoading = (state: RootState) => state.childFavorites.statusLoading;

// Derived selectors

// Get favorites for a specific child
export const selectChildFavorites = (childId: string) => (state: RootState) =>
  state.childFavorites.favoritesByChild[childId] || [];

// Get waitlist for a specific child
export const selectChildWaitlistEntries = (childId: string) => (state: RootState) =>
  state.childFavorites.waitlistByChild[childId] || [];

// Check if activity is favorited by any selected child
export const selectIsAnyChildFavorited = (activityId: string, selectedChildIds: string[]) => (state: RootState) => {
  const { favoritesByChild } = state.childFavorites;
  for (const childId of selectedChildIds) {
    const childFavs = favoritesByChild[childId] || [];
    if (childFavs.some(f => f.activityId === activityId)) {
      return true;
    }
  }
  return false;
};

// Check if activity is on waitlist for any selected child
export const selectIsAnyChildOnWaitlist = (activityId: string, selectedChildIds: string[]) => (state: RootState) => {
  const { waitlistByChild } = state.childFavorites;
  for (const childId of selectedChildIds) {
    const childWaitlist = waitlistByChild[childId] || [];
    if (childWaitlist.some(e => e.activityId === activityId)) {
      return true;
    }
  }
  return false;
};

// Get children who have favorited a specific activity
export const selectChildrenWhoFavorited = (activityId: string) => (state: RootState) => {
  const favorites = state.childFavorites.favorites.filter(f => f.activityId === activityId);
  return favorites.map(f => ({ childId: f.childId, childName: f.childName }));
};

// Get total favorite count across all selected children
export const selectTotalFavoriteCount = (selectedChildIds: string[]) => (state: RootState) => {
  const { favoritesByChild } = state.childFavorites;
  let count = 0;
  for (const childId of selectedChildIds) {
    count += (favoritesByChild[childId] || []).length;
  }
  return count;
};

// Get unique favorited activities (deduplicated across children)
export const selectUniqueFavoritedActivities = (selectedChildIds: string[]) => (state: RootState) => {
  const { favoritesByChild } = state.childFavorites;
  const activityIds = new Set<string>();
  const activities: ChildFavorite['activity'][] = [];

  for (const childId of selectedChildIds) {
    const childFavs = favoritesByChild[childId] || [];
    for (const fav of childFavs) {
      if (!activityIds.has(fav.activityId)) {
        activityIds.add(fav.activityId);
        activities.push(fav.activity);
      }
    }
  }

  return activities;
};

// Child assignment type with full details
export interface ChildAssignment {
  childId: string;
  name: string;
  colorId: number;
}

// Get children (with full details including colorId) who have favorited an activity
export const selectChildrenWhoFavoritedWithDetails = (activityId: string) => (state: RootState): ChildAssignment[] => {
  const favorites = state.childFavorites.favorites.filter(f => f.activityId === activityId);
  const children = state.children.children;

  return favorites
    .map(f => {
      const child = children.find(c => c.id === f.childId);
      return child ? { childId: child.id, name: child.name, colorId: child.colorId || 1 } : null;
    })
    .filter((c): c is ChildAssignment => c !== null);
};

// Get children (with full details including colorId) who are on waitlist for an activity
export const selectChildrenOnWaitlistWithDetails = (activityId: string) => (state: RootState): ChildAssignment[] => {
  const waitlist = state.childFavorites.waitlist.filter(w => w.activityId === activityId);
  const children = state.children.children;

  return waitlist
    .map(w => {
      const child = children.find(c => c.id === w.childId);
      return child ? { childId: child.id, name: child.name, colorId: child.colorId || 1 } : null;
    })
    .filter((c): c is ChildAssignment => c !== null);
};

export default childFavoritesSlice.reducer;
