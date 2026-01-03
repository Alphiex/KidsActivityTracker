/**
 * Hook to get child assignment status for an activity
 * Aggregates favorite, watching, and calendar status from Redux
 */

import { useMemo } from 'react';
import { useAppSelector } from '../store';
import { selectAllChildren } from '../store/slices/childrenSlice';
import {
  selectChildrenWhoFavoritedWithDetails,
  selectChildrenOnWaitlistWithDetails,
  ChildAssignment,
} from '../store/slices/childFavoritesSlice';
import { selectActivityChildren } from '../store/slices/childActivitiesSlice';

export interface ActivityChildStatus {
  // Children who have favorited this activity
  favoriteChildren: ChildAssignment[];
  // Children who are watching/on waitlist for this activity
  watchingChildren: ChildAssignment[];
  // Children who have this activity on their calendar
  calendarChildren: ChildAssignment[];
  // Quick boolean checks
  isAnyFavorite: boolean;
  isAnyWatching: boolean;
  isAnyOnCalendar: boolean;
}

/**
 * Get child assignment status for an activity
 * Returns which children have the activity favorited, watching, or on calendar
 */
export function useActivityChildStatus(activityId: string): ActivityChildStatus {
  const allChildren = useAppSelector(selectAllChildren);
  const favoriteChildren = useAppSelector(selectChildrenWhoFavoritedWithDetails(activityId));
  const watchingChildren = useAppSelector(selectChildrenOnWaitlistWithDetails(activityId));
  const calendarChildIds = useAppSelector(selectActivityChildren(activityId));

  // Debug logging
  console.log('[useActivityChildStatus] activityId:', activityId);
  console.log('[useActivityChildStatus] watchingChildren:', watchingChildren);
  console.log('[useActivityChildStatus] calendarChildIds:', calendarChildIds);

  // Convert calendar child IDs to full ChildAssignment objects
  const calendarChildren = useMemo(() => {
    return calendarChildIds
      .map(childId => {
        const child = allChildren.find(c => c.id === childId);
        return child ? { childId: child.id, name: child.name, colorId: child.colorId || 1 } : null;
      })
      .filter((c): c is ChildAssignment => c !== null);
  }, [calendarChildIds, allChildren]);

  return {
    favoriteChildren,
    watchingChildren,
    calendarChildren,
    isAnyFavorite: favoriteChildren.length > 0,
    isAnyWatching: watchingChildren.length > 0,
    isAnyOnCalendar: calendarChildren.length > 0,
  };
}

export default useActivityChildStatus;
