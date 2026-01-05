/**
 * Aggregation types for dynamic filter options
 * These match the server-side types in server/src/services/aggregationService.ts
 */

export interface AgeGroupAggregation {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface CostBracketAggregation {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface DayOfWeekAggregation {
  day: string;
  count: number;
}

export interface ActivityTypeAggregation {
  code: string;
  name: string;
  iconName: string;
  count: number;
}

export interface CityAggregation {
  city: string;
  province: string;
  count: number;
}

export interface EnvironmentAggregation {
  type: 'indoor' | 'outdoor';
  count: number;
}

export interface Aggregations {
  ageGroups: AgeGroupAggregation[];
  costBrackets: CostBracketAggregation[];
  daysOfWeek: DayOfWeekAggregation[];
  activityTypes: ActivityTypeAggregation[];
  cities: CityAggregation[];
  environments: EnvironmentAggregation[];
}
