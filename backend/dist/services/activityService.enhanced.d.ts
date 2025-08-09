import { Prisma } from '../../generated/prisma';
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
    searchActivities(params: SearchParams): Promise<{
        activities: ({
            _count: {
                favorites: number;
            };
            provider: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                website: string;
                scraperConfig: Prisma.JsonValue;
            };
            location: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                address: string;
                city: string;
                province: string;
                postalCode: string | null;
                country: string;
                latitude: number | null;
                longitude: number | null;
                facility: string | null;
            };
        } & {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            providerId: string;
            externalId: string;
            category: string;
            subcategory: string | null;
            description: string | null;
            schedule: string | null;
            dateStart: Date | null;
            dateEnd: Date | null;
            registrationDate: Date | null;
            ageMin: number | null;
            ageMax: number | null;
            cost: number;
            spotsAvailable: number | null;
            totalSpots: number | null;
            locationId: string | null;
            locationName: string | null;
            registrationUrl: string | null;
            courseId: string | null;
            lastSeenAt: Date;
            rawData: Prisma.JsonValue | null;
            dayOfWeek: string[];
        })[];
        pagination: {
            total: number;
            limit: number;
            offset: number;
            pages: number;
        };
    }>;
    getActivity(id: string, includeInactive?: boolean): Promise<{
        _count: {
            favorites: number;
            childActivities: number;
        };
        provider: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            website: string;
            scraperConfig: Prisma.JsonValue;
        };
        location: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string;
            city: string;
            province: string;
            postalCode: string | null;
            country: string;
            latitude: number | null;
            longitude: number | null;
            facility: string | null;
        };
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        providerId: string;
        externalId: string;
        category: string;
        subcategory: string | null;
        description: string | null;
        schedule: string | null;
        dateStart: Date | null;
        dateEnd: Date | null;
        registrationDate: Date | null;
        ageMin: number | null;
        ageMax: number | null;
        cost: number;
        spotsAvailable: number | null;
        totalSpots: number | null;
        locationId: string | null;
        locationName: string | null;
        registrationUrl: string | null;
        courseId: string | null;
        lastSeenAt: Date;
        rawData: Prisma.JsonValue | null;
        dayOfWeek: string[];
    }>;
    getActivityByProviderAndCourseId(providerId: string, courseId: string): Promise<{
        provider: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            website: string;
            scraperConfig: Prisma.JsonValue;
        };
        location: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string;
            city: string;
            province: string;
            postalCode: string | null;
            country: string;
            latitude: number | null;
            longitude: number | null;
            facility: string | null;
        };
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        providerId: string;
        externalId: string;
        category: string;
        subcategory: string | null;
        description: string | null;
        schedule: string | null;
        dateStart: Date | null;
        dateEnd: Date | null;
        registrationDate: Date | null;
        ageMin: number | null;
        ageMax: number | null;
        cost: number;
        spotsAvailable: number | null;
        totalSpots: number | null;
        locationId: string | null;
        locationName: string | null;
        registrationUrl: string | null;
        courseId: string | null;
        lastSeenAt: Date;
        rawData: Prisma.JsonValue | null;
        dayOfWeek: string[];
    }>;
    getUpcomingActivities(params: {
        limit?: number;
        offset?: number;
        daysAhead?: number;
    }): Promise<{
        activities: ({
            _count: {
                favorites: number;
            };
            provider: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                website: string;
                scraperConfig: Prisma.JsonValue;
            };
            location: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                address: string;
                city: string;
                province: string;
                postalCode: string | null;
                country: string;
                latitude: number | null;
                longitude: number | null;
                facility: string | null;
            };
        } & {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            providerId: string;
            externalId: string;
            category: string;
            subcategory: string | null;
            description: string | null;
            schedule: string | null;
            dateStart: Date | null;
            dateEnd: Date | null;
            registrationDate: Date | null;
            ageMin: number | null;
            ageMax: number | null;
            cost: number;
            spotsAvailable: number | null;
            totalSpots: number | null;
            locationId: string | null;
            locationName: string | null;
            registrationUrl: string | null;
            courseId: string | null;
            lastSeenAt: Date;
            rawData: Prisma.JsonValue | null;
            dayOfWeek: string[];
        })[];
        pagination: {
            total: number;
            limit: number;
            offset: number;
            pages: number;
        };
    }>;
    getActivitiesByCategory(): Promise<{
        category: string;
        count: number;
    }[]>;
    getActivityHistory(activityId: string): Promise<{
        id: string;
        createdAt: Date;
        activityId: string;
        changeType: string;
        previousData: Prisma.JsonValue | null;
        newData: Prisma.JsonValue | null;
        changedFields: string[];
    }[]>;
    getProviderStats(providerId: string): Promise<{
        activeActivities: number;
        inactiveActivities: number;
        totalActivities: number;
        lastScraperRun: {
            id: string;
            status: string;
            completedAt: Date | null;
            providerId: string;
            startedAt: Date;
            activitiesFound: number;
            activitiesCreated: number;
            activitiesUpdated: number;
            activitiesDeactivated: number;
            activitiesPurged: number;
            errorMessage: string | null;
            logs: Prisma.JsonValue | null;
        };
    }>;
    cleanup(): Promise<void>;
}
export declare const activityService: EnhancedActivityService;
export {};
//# sourceMappingURL=activityService.enhanced.d.ts.map