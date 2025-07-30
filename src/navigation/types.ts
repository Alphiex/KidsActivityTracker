import { Activity, Filter } from '../types/activity';

export type RootStackParamList = {
  Home: { filter?: Filter } | undefined;
  ActivityDetail: { activity: Activity };
  Filter: { currentFilter?: Filter };
  Favorites: undefined;
  Search: undefined;
  Settings: undefined;
};