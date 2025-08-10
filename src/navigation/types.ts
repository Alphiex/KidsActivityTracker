import { Activity, Filter } from '../types';

export type RootStackParamList = {
  Home: { filter?: Filter } | undefined;
  ActivityDetail: { activity: any }; // TODO: Fix Activity type conflict
  Filter: { currentFilter?: Filter };
  Favorites: undefined;
  Search: undefined;
  Settings: undefined;
  Children: undefined;
};

export type ChildrenStackParamList = {
  ChildrenList: undefined;
  AddEditChild: { childId?: string };
  ChildProfile: { childId: string };
  ChildActivityHistory: { childId: string; childName: string };
};