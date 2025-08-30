import { ActivityShare, ActivityShareProfile, Child, ChildActivity } from '../../generated/prisma';
interface ShareConfiguration {
    sharedWithUserId: string;
    permissionLevel: 'view_all' | 'view_registered' | 'view_future';
    expiresAt?: Date;
    childPermissions: {
        childId: string;
        canViewInterested: boolean;
        canViewRegistered: boolean;
        canViewCompleted: boolean;
        canViewNotes: boolean;
    }[];
}
interface UpdateShareData {
    permissionLevel?: 'view_all' | 'view_registered' | 'view_future';
    expiresAt?: Date | null;
    isActive?: boolean;
}
interface UpdateChildPermissionData {
    canViewInterested?: boolean;
    canViewRegistered?: boolean;
    canViewCompleted?: boolean;
    canViewNotes?: boolean;
}
interface SharedChildWithActivities extends Child {
    activities: ChildActivity[];
    shareProfile: ActivityShareProfile;
}
export declare class SharingService {
    configureSharing(userId: string, config: ShareConfiguration): Promise<ActivityShare>;
    getUserShares(userId: string): Promise<{
        myShares: ({
            profiles: ({
                child: {
                    name: string;
                    id: string;
                    dateOfBirth: Date;
                    avatarUrl: string;
                };
            } & {
                id: string;
                createdAt: Date;
                childId: string;
                activityShareId: string;
                canViewInterested: boolean;
                canViewRegistered: boolean;
                canViewCompleted: boolean;
                canViewNotes: boolean;
            })[];
            sharedWithUser: {
                name: string;
                email: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sharingUserId: string;
            sharedWithUserId: string;
            permissionLevel: string;
            expiresAt: Date | null;
        })[];
        sharedWithMe: ({
            profiles: ({
                child: {
                    name: string;
                    id: string;
                    dateOfBirth: Date;
                    avatarUrl: string;
                    interests: string[];
                };
            } & {
                id: string;
                createdAt: Date;
                childId: string;
                activityShareId: string;
                canViewInterested: boolean;
                canViewRegistered: boolean;
                canViewCompleted: boolean;
                canViewNotes: boolean;
            })[];
            sharingUser: {
                name: string;
                email: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sharingUserId: string;
            sharedWithUserId: string;
            permissionLevel: string;
            expiresAt: Date | null;
        })[];
    }>;
    getSharedChildren(userId: string, sharingUserId?: string): Promise<SharedChildWithActivities[]>;
    updateShare(shareId: string, userId: string, data: UpdateShareData): Promise<ActivityShare>;
    updateChildPermissions(shareId: string, childId: string, userId: string, data: UpdateChildPermissionData): Promise<ActivityShareProfile>;
    removeChildFromShare(shareId: string, childId: string, userId: string): Promise<void>;
    addChildToShare(shareId: string, childId: string, userId: string, permissions: UpdateChildPermissionData): Promise<ActivityShareProfile>;
    getSharingStats(userId: string): Promise<{
        sharingWith: number;
        sharedWithMe: number;
        childrenShared: number;
    }>;
    cleanupExpiredShares(): Promise<number>;
    hasAccessToChild(viewerId: string, childId: string): Promise<boolean>;
}
export declare const sharingService: SharingService;
export {};
//# sourceMappingURL=sharingService.d.ts.map