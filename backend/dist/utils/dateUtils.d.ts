export declare function calculateAge(dateOfBirth: Date, inMonths?: boolean): number;
export declare function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean;
export declare function formatDate(date: Date, format?: 'short' | 'long' | 'iso'): string;
export declare function getAgeAppropriateRange(age: number): {
    minAge: number;
    maxAge: number;
};
export declare function parseDateSafely(dateString: string): Date | null;
export declare function getCalendarWeek(date: Date): {
    year: number;
    week: number;
};
export declare function getCalendarDateRange(view: 'week' | 'month' | 'year', date?: Date): {
    start: Date;
    end: Date;
};
//# sourceMappingURL=dateUtils.d.ts.map