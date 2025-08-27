interface SearchParams {
    search?: string;
    category?: string;
    categories?: string;
    ageMin?: number;
    ageMax?: number;
    costMin?: number;
    costMax?: number;
    startDate?: Date;
    endDate?: Date;
    dayOfWeek?: string[];
    location?: string;
    providerId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    includeInactive?: boolean;
}
export declare class EnhancedActivityService {
    private prisma;
    constructor();
    searchActivities(params: SearchParams): Promise<{
        activities: any;
        pagination: {
            total: any;
            limit: number;
            offset: number;
            pages: number;
        };
    }>;
    getActivity(id: string, includeInactive?: boolean): Promise<any>;
    getActivityByProviderAndCourseId(providerId: string, courseId: string): Promise<any>;
    getUpcomingActivities(params: {
        limit?: number;
        offset?: number;
        daysAhead?: number;
    }): Promise<{
        activities: any;
        pagination: {
            total: any;
            limit: number;
            offset: number;
            pages: number;
        };
    }>;
    getActivitiesByCategory(): Promise<any>;
    getActivityHistory(activityId: string): Promise<any>;
    getProviderStats(providerId: string): Promise<{
        activeActivities: any;
        inactiveActivities: any;
        totalActivities: any;
        lastScraperRun: any;
    }>;
    cleanup(): Promise<void>;
}
export declare const activityService: EnhancedActivityService;
export {};
//# sourceMappingURL=activityService.enhanced.d.ts.map