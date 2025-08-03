import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { Activity, User, Filter, Child, SiteAccount } from '../types';

// Lazy initialize MMKV to avoid New Architecture initialization issues
let storage: MMKV | null = null;
const getStorage = () => {
  if (!storage) {
    storage = new MMKV();
  }
  return storage;
};

interface AppState {
  // User data
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Activities data
  activities: Activity[];
  setActivities: (activities: Activity[]) => void;
  favoriteActivities: string[];
  toggleFavorite: (activityId: string) => void;
  
  // Filters
  activeFilter: Filter;
  setFilter: (filter: Filter) => void;
  
  // Children management
  addChild: (child: Child) => void;
  updateChild: (childId: string, child: Partial<Child>) => void;
  deleteChild: (childId: string) => void;
  
  // Site accounts
  addSiteAccount: (account: SiteAccount) => void;
  updateSiteAccount: (accountId: string, account: Partial<SiteAccount>) => void;
  deleteSiteAccount: (accountId: string) => void;
  
  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Persistence
  hydrate: () => void;
  persist: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  activities: [],
  favoriteActivities: [],
  activeFilter: {},
  isLoading: false,

  setUser: (user) => {
    set({ user });
    get().persist();
  },

  setActivities: (activities) => set({ activities }),

  toggleFavorite: (activityId) => {
    const { favoriteActivities } = get();
    const updated = favoriteActivities.includes(activityId)
      ? favoriteActivities.filter(id => id !== activityId)
      : [...favoriteActivities, activityId];
    set({ favoriteActivities: updated });
    get().persist();
  },

  setFilter: (filter) => set({ activeFilter: filter }),

  addChild: (child) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = {
      ...user,
      children: [...user.children, child]
    };
    set({ user: updatedUser });
    get().persist();
  },

  updateChild: (childId, childUpdate) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = {
      ...user,
      children: user.children.map(child => 
        child.id === childId ? { ...child, ...childUpdate } : child
      )
    };
    set({ user: updatedUser });
    get().persist();
  },

  deleteChild: (childId) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = {
      ...user,
      children: user.children.filter(child => child.id !== childId)
    };
    set({ user: updatedUser });
    get().persist();
  },

  addSiteAccount: (account) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = {
      ...user,
      siteAccounts: [...user.siteAccounts, account]
    };
    set({ user: updatedUser });
    get().persist();
  },

  updateSiteAccount: (accountId, accountUpdate) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = {
      ...user,
      siteAccounts: user.siteAccounts.map(account => 
        account.id === accountId ? { ...account, ...accountUpdate } : account
      )
    };
    set({ user: updatedUser });
    get().persist();
  },

  deleteSiteAccount: (accountId) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = {
      ...user,
      siteAccounts: user.siteAccounts.filter(account => account.id !== accountId)
    };
    set({ user: updatedUser });
    get().persist();
  },

  setLoading: (loading) => set({ isLoading: loading }),

  hydrate: () => {
    try {
      const userString = getStorage().getString('user');
      const favoritesString = getStorage().getString('favorites');
      
      if (userString) {
        set({ user: JSON.parse(userString) });
      }
      
      if (favoritesString) {
        set({ favoriteActivities: JSON.parse(favoritesString) });
      }
    } catch (error) {
      console.warn('Error hydrating store:', error);
    }
  },

  persist: () => {
    try {
      const { user, favoriteActivities } = get();
      
      if (user) {
        getStorage().set('user', JSON.stringify(user));
      } else {
        getStorage().delete('user');
      }
      
      getStorage().set('favorites', JSON.stringify(favoriteActivities));
    } catch (error) {
      console.warn('Error persisting store:', error);
    }
  }
}));