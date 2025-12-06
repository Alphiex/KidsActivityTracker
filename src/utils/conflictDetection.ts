import { ChildActivity } from '../services/childrenService';
import { format, parseISO } from 'date-fns';

export interface TimeSlot {
  date: string; // yyyy-MM-dd format
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

export type OverlapType = 'full' | 'partial-start' | 'partial-end' | 'contains' | 'none';

export interface Conflict {
  existingActivity: ChildActivity;
  existingActivityName: string;
  overlapType: OverlapType;
  overlapMinutes: number;
  overlapDescription: string;
}

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

/**
 * Format minutes to human-readable time
 */
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Calculate the overlap between two time ranges
 */
const calculateOverlap = (
  newStart: string,
  newEnd: string,
  existStart: string,
  existEnd: string
): { type: OverlapType; minutes: number } => {
  const ns = timeToMinutes(newStart);
  const ne = timeToMinutes(newEnd);
  const es = timeToMinutes(existStart);
  const ee = timeToMinutes(existEnd);

  // Handle edge cases
  if (ne <= ns || ee <= es) {
    return { type: 'none', minutes: 0 };
  }

  // No overlap - new activity ends before or starts after existing
  if (ne <= es || ns >= ee) {
    return { type: 'none', minutes: 0 };
  }

  // New activity completely contains existing activity
  if (ns <= es && ne >= ee) {
    return { type: 'contains', minutes: ee - es };
  }

  // Existing activity completely contains new activity
  if (es <= ns && ee >= ne) {
    return { type: 'full', minutes: ne - ns };
  }

  // Partial overlap at the end (new starts before existing ends)
  if (ns < es && ne > es && ne < ee) {
    return { type: 'partial-end', minutes: ne - es };
  }

  // Partial overlap at the start (new ends after existing starts)
  if (ns > es && ns < ee && ne > ee) {
    return { type: 'partial-start', minutes: ee - ns };
  }

  // Shouldn't reach here, but default to partial
  const overlapStart = Math.max(ns, es);
  const overlapEnd = Math.min(ne, ee);
  return { type: 'partial-start', minutes: overlapEnd - overlapStart };
};

/**
 * Get description of overlap type for user display
 */
const getOverlapDescription = (type: OverlapType, minutes: number): string => {
  const duration = formatMinutes(minutes);
  switch (type) {
    case 'full':
      return `Completely overlaps (${duration})`;
    case 'contains':
      return `Covers entire activity (${duration})`;
    case 'partial-start':
      return `Overlaps at the start (${duration})`;
    case 'partial-end':
      return `Overlaps at the end (${duration})`;
    default:
      return '';
  }
};

/**
 * Format date for comparison
 */
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return '';
  if (typeof date === 'string') {
    try {
      return format(parseISO(date), 'yyyy-MM-dd');
    } catch {
      return date;
    }
  }
  return format(date, 'yyyy-MM-dd');
};

/**
 * Detect conflicts between a new time slot and existing activities for a child
 */
export const detectConflicts = (
  newSlot: TimeSlot,
  childId: string,
  existingActivities: ChildActivity[]
): Conflict[] => {
  const conflicts: Conflict[] = [];

  // Filter activities for the same child and same date
  const childActivities = existingActivities.filter(activity => {
    if (activity.childId !== childId) return false;

    const activityDate = formatDate(activity.scheduledDate);
    return activityDate === newSlot.date;
  });

  for (const existing of childActivities) {
    const existingStart = existing.startTime || '00:00';
    const existingEnd = existing.endTime || '23:59';

    const overlap = calculateOverlap(
      newSlot.startTime,
      newSlot.endTime,
      existingStart,
      existingEnd
    );

    if (overlap.type !== 'none' && overlap.minutes > 0) {
      conflicts.push({
        existingActivity: existing,
        existingActivityName: existing.activity?.name || 'Unknown Activity',
        overlapType: overlap.type,
        overlapMinutes: overlap.minutes,
        overlapDescription: getOverlapDescription(overlap.type, overlap.minutes),
      });
    }
  }

  return conflicts;
};

/**
 * Check if rescheduling an activity would create conflicts
 */
export const detectRescheduleConflicts = (
  activityId: string,
  newSlot: TimeSlot,
  childId: string,
  existingActivities: ChildActivity[]
): Conflict[] => {
  // Filter out the activity being rescheduled
  const otherActivities = existingActivities.filter(a => a.id !== activityId);
  return detectConflicts(newSlot, childId, otherActivities);
};

/**
 * Get all conflicts for a specific date across all children
 */
export const detectDayConflicts = (
  date: string,
  allActivities: ChildActivity[]
): Map<string, Conflict[]> => {
  const conflictsByChild = new Map<string, Conflict[]>();

  // Group activities by child
  const activitiesByChild = new Map<string, ChildActivity[]>();
  for (const activity of allActivities) {
    const activityDate = formatDate(activity.scheduledDate);
    if (activityDate !== date) continue;

    const childActivities = activitiesByChild.get(activity.childId) || [];
    childActivities.push(activity);
    activitiesByChild.set(activity.childId, childActivities);
  }

  // Check for conflicts within each child's activities
  for (const [childId, activities] of activitiesByChild) {
    if (activities.length < 2) continue;

    const childConflicts: Conflict[] = [];

    for (let i = 0; i < activities.length; i++) {
      for (let j = i + 1; j < activities.length; j++) {
        const activity1 = activities[i];
        const activity2 = activities[j];

        const overlap = calculateOverlap(
          activity1.startTime || '00:00',
          activity1.endTime || '23:59',
          activity2.startTime || '00:00',
          activity2.endTime || '23:59'
        );

        if (overlap.type !== 'none' && overlap.minutes > 0) {
          childConflicts.push({
            existingActivity: activity2,
            existingActivityName: activity2.activity?.name || 'Unknown Activity',
            overlapType: overlap.type,
            overlapMinutes: overlap.minutes,
            overlapDescription: getOverlapDescription(overlap.type, overlap.minutes),
          });
        }
      }
    }

    if (childConflicts.length > 0) {
      conflictsByChild.set(childId, childConflicts);
    }
  }

  return conflictsByChild;
};

/**
 * Suggest alternative times to avoid conflicts
 */
export const suggestAlternativeTimes = (
  slot: TimeSlot,
  childId: string,
  existingActivities: ChildActivity[],
  durationMinutes: number = 60
): TimeSlot[] => {
  const alternatives: TimeSlot[] = [];

  // Get all activities for this child on this date
  const dayActivities = existingActivities.filter(a => {
    if (a.childId !== childId) return false;
    return formatDate(a.scheduledDate) === slot.date;
  });

  // Sort by start time
  dayActivities.sort((a, b) =>
    timeToMinutes(a.startTime || '00:00') - timeToMinutes(b.startTime || '00:00')
  );

  // Find gaps between activities
  let currentTime = 8 * 60; // Start at 8am
  const endOfDay = 20 * 60; // End at 8pm

  for (const activity of dayActivities) {
    const actStart = timeToMinutes(activity.startTime || '00:00');
    const actEnd = timeToMinutes(activity.endTime || '23:59');

    // Check if there's a gap before this activity
    if (actStart - currentTime >= durationMinutes) {
      const startHour = Math.floor(currentTime / 60);
      const startMin = currentTime % 60;
      const endTime = currentTime + durationMinutes;
      const endHour = Math.floor(endTime / 60);
      const endMin = endTime % 60;

      alternatives.push({
        date: slot.date,
        startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
      });
    }

    currentTime = Math.max(currentTime, actEnd);
  }

  // Check if there's time after the last activity
  if (endOfDay - currentTime >= durationMinutes) {
    const startHour = Math.floor(currentTime / 60);
    const startMin = currentTime % 60;
    const endTime = currentTime + durationMinutes;
    const endHour = Math.floor(endTime / 60);
    const endMin = endTime % 60;

    alternatives.push({
      date: slot.date,
      startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
    });
  }

  return alternatives.slice(0, 3); // Return up to 3 alternatives
};

export default {
  detectConflicts,
  detectRescheduleConflicts,
  detectDayConflicts,
  suggestAlternativeTimes,
};
