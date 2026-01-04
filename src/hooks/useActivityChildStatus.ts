/**
 * Hook to get child assignment status for an activity
 * Aggregates favorite, watching, waitlist, and calendar status from Redux
 */

import { useMemo } from 'react';
import { useAppSelector } from '../store';
import { selectAllChildren } from '../store/slices/childrenSlice';
import {
  selectChildrenWhoFavoritedWithDetails,
  selectChildrenWatchingWithDetails,
  selectChildrenOnWaitlistWithDetails,
  ChildAssignment,
} from '../store/slices/childFavoritesSlice';
import { selectActivityChildren } from '../store/slices/childActivitiesSlice';

export interface ActivityChildStatus {
  // Children who have favorited this activity
  favoriteChildren: ChildAssignment[];
  // Children who are watching for availability notifications (bell icon)
  watchingChildren: ChildAssignment[];
  // Children who are on the waiting list (account-clock icon)
  waitlistChildren: ChildAssignment[];
  // Children who have this activity on their calendar
  calendarChildren: ChildAssignment[];
  // Quick boolean checks
  isAnyFavorite: boolean;
  isAnyWatching: boolean;
  isAnyOnWaitlist: boolean;
  isAnyOnCalendar: boolean;
}

/**
 * Get child assignment status for an activity
 * Returns which children have the activity favorited, watching, on waitlist, or on calendar
 */
export function useActivityChildStatus(activityId: string): ActivityChildStatus {
  const allChildren = useAppSelector(selectAllChildren);
  const favoriteChildren = useAppSelector(selectChildrenWhoFavoritedWithDetails(activityId));
  const watchingChildren = useAppSelector(selectChildrenWatchingWithDetails(activityId));
  const waitlistChildren = useAppSelector(selectChildrenOnWaitlistWithDetails(activityId));
  const calendarChildIds = useAppSelector(selectActivityChildren(activityId));

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
    waitlistChildren,
    calendarChildren,
    isAnyFavorite: favoriteChildren.length > 0,
    isAnyWatching: watchingChildren.length > 0,
    isAnyOnWaitlist: waitlistChildren.length > 0,
    isAnyOnCalendar: calendarChildren.length > 0,
  };
}

export default useActivityChildStatus;
