declare function authenticateUser(): Promise<string>;
declare function createChildren(): Promise<any[]>;
declare function getChildrenWithStats(): Promise<any>;
declare function linkActivitiesToChild(childId: string): Promise<void>;
declare function getRecommendations(childId: string): Promise<any>;
declare function getCalendarData(childIds?: string[]): Promise<Record<string, any[]>>;
declare function completeActivity(childId: string, activityId: string): Promise<void>;
declare function getActivityHistory(childId?: string): Promise<any>;
declare function updateChildInterests(childId: string): Promise<void>;
export { authenticateUser, createChildren, getChildrenWithStats, linkActivitiesToChild, getRecommendations, getCalendarData, completeActivity, getActivityHistory, updateChildInterests };
//# sourceMappingURL=children-api-examples.d.ts.map