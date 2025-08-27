interface SearchParams {
    search?: string;
    category?: string;
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
    private getActivitySelect;
    searchActivities(params: SearchParams): Promise<{
        activities: any;
        pagination: {
            total: any;
            limit: number;
            offset: number;
            pages: number;
        };
    }>;
    getActivityById(id: string): Promise<any>;
    getUpcomingActivities(params?: {
        daysAhead?: number;
        limit?: number;
        offset?: number;
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
    getActivityStatusCounts(): Promise<{
        open: any;
        waitlist: any;
        closed: any;
        total: any;
    }>;
    toggleFavorite(activityId: string, userId: string): Promise<{
        added: boolean;
    }>;
    getUserFavorites(userId: string, params?: SearchParams): Promise<{
        activities: any;
        pagination: {
            total: any;
            limit: number;
            offset: number;
            pages: number;
        };
    }>;
    private buildWhereClause;
}
export {};
//# sourceMappingURL=activityService.enhanced.updated.d.ts.map