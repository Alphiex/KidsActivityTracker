import { ChildActivity, Activity } from '../../generated/prisma';
export type ActivityStatus = 'interested' | 'registered' | 'completed' | 'cancelled';
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
export interface ActivityHistoryFilters {
    childId?: string;
    status?: ActivityStatus;
    startDate?: Date;
    endDate?: Date;
    category?: string;
    minRating?: number;
}
export interface CalendarEvent {
    id: string;
    childId: string;
    childName: string;
    activityId: string;
    activityName: string;
    status: ActivityStatus;
    startDate: Date | null;
    endDate: Date | null;
    location: string | null;
    category: string;
}
export declare class ChildActivityService {
    linkActivity(userId: string, input: LinkActivityInput): Promise<ChildActivity>;
    updateActivityStatus(userId: string, childId: string, activityId: string, input: UpdateActivityStatusInput): Promise<ChildActivity>;
    unlinkActivity(userId: string, childId: string, activityId: string): Promise<boolean>;
    getActivityHistory(userId: string, filters?: ActivityHistoryFilters): Promise<any[]>;
    getAgeAppropriateActivities(userId: string, childId: string): Promise<Activity[]>;
    getChildFavorites(userId: string, childId: string): Promise<any[]>;
    getCalendarData(userId: string, view: 'week' | 'month' | 'year', date: Date, childIds?: string[]): Promise<CalendarEvent[]>;
    getActivityStats(userId: string, childIds?: string[]): Promise<any>;
    bulkLinkActivities(userId: string, childId: string, activityIds: string[], status?: ActivityStatus): Promise<number>;
    getUpcomingActivities(userId: string, days?: number): Promise<any[]>;
}
export declare const childActivityService: ChildActivityService;
//# sourceMappingURL=childActivityService.d.ts.map