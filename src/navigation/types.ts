import { Activity, Filter } from '../types';

export type RootStackParamList = {
  Home: { filter?: Filter } | undefined;
  ActivityDetail: { activity: Activity };
  Filter: { currentFilter?: Filter };
  Favorites: undefined;
  WaitingList: undefined;
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