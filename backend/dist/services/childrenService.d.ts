import { Child } from '../../generated/prisma';
export interface CreateChildInput {
    userId: string;
    name: string;
    dateOfBirth: Date;
    gender?: string;
    avatarUrl?: string;
    interests?: string[];
    notes?: string;
}
export interface UpdateChildInput {
    name?: string;
    dateOfBirth?: Date;
    gender?: string;
    avatarUrl?: string;
    interests?: string[];
    notes?: string;
    isActive?: boolean;
}
export interface ChildWithAge extends Child {
    age: number;
    ageInMonths: number;
}
export declare class ChildrenService {
    createChild(data: CreateChildInput): Promise<Child>;
    getChildrenByUserId(userId: string, includeInactive?: boolean): Promise<ChildWithAge[]>;
    getChildById(childId: string, userId: string): Promise<ChildWithAge | null>;
    updateChild(childId: string, userId: string, data: UpdateChildInput): Promise<Child | null>;
    deleteChild(childId: string, userId: string): Promise<boolean>;
    permanentlyDeleteChild(childId: string, userId: string): Promise<boolean>;
    getChildrenWithActivityStats(userId: string): Promise<any[]>;
    verifyChildOwnership(childId: string, userId: string): Promise<boolean>;
    getChildrenByAgeRange(userId: string, minAge: number, maxAge: number): Promise<ChildWithAge[]>;
    searchChildren(userId: string, query: string): Promise<ChildWithAge[]>;
    updateChildInterests(childId: string, userId: string, interests: string[]): Promise<Child | null>;
    getSharedChildren(userId: string): Promise<any[]>;
    bulkCreateChildren(userId: string, children: Omit<CreateChildInput, 'userId'>[]): Promise<Child[]>;
}
export declare const childrenService: ChildrenService;
//# sourceMappingURL=childrenService.d.ts.map