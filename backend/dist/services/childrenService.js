"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.childrenService = exports.ChildrenService = void 0;
const prisma_1 = require("../../generated/prisma");
const dateUtils_1 = require("../utils/dateUtils");
const prisma = new prisma_1.PrismaClient();
class ChildrenService {
    async createChild(data) {
        return await prisma.child.create({
            data: {
                userId: data.userId,
                name: data.name,
                dateOfBirth: data.dateOfBirth,
                gender: data.gender,
                avatarUrl: data.avatarUrl,
                interests: data.interests || [],
                notes: data.notes
            }
        });
    }
    async getChildrenByUserId(userId, includeInactive = false) {
        const children = await prisma.child.findMany({
            where: {
                userId,
                ...(includeInactive ? {} : { isActive: true })
            },
            orderBy: {
                dateOfBirth: 'asc'
            }
        });
        return children.map(child => ({
            ...child,
            age: (0, dateUtils_1.calculateAge)(child.dateOfBirth),
            ageInMonths: (0, dateUtils_1.calculateAge)(child.dateOfBirth, true)
        }));
    }
    async getChildById(childId, userId) {
        const child = await prisma.child.findFirst({
            where: {
                id: childId,
                userId
            }
        });
        if (!child)
            return null;
        return {
            ...child,
            age: (0, dateUtils_1.calculateAge)(child.dateOfBirth),
            ageInMonths: (0, dateUtils_1.calculateAge)(child.dateOfBirth, true)
        };
    }
    async updateChild(childId, userId, data) {
        const child = await prisma.child.findFirst({
            where: { id: childId, userId }
        });
        if (!child)
            return null;
        return await prisma.child.update({
            where: { id: childId },
            data
        });
    }
    async deleteChild(childId, userId) {
        const child = await prisma.child.findFirst({
            where: { id: childId, userId }
        });
        if (!child)
            return false;
        await prisma.child.update({
            where: { id: childId },
            data: { isActive: false }
        });
        return true;
    }
    async permanentlyDeleteChild(childId, userId) {
        const child = await prisma.child.findFirst({
            where: { id: childId, userId }
        });
        if (!child)
            return false;
        await prisma.child.delete({
            where: { id: childId }
        });
        return true;
    }
    async getChildrenWithActivityStats(userId) {
        const children = await prisma.child.findMany({
            where: {
                userId,
                isActive: true
            },
            include: {
                activities: {
                    select: {
                        status: true
                    }
                }
            }
        });
        return children.map(child => {
            const stats = {
                interested: 0,
                registered: 0,
                completed: 0,
                cancelled: 0
            };
            child.activities.forEach(activity => {
                stats[activity.status]++;
            });
            const { activities, ...childData } = child;
            return {
                ...childData,
                age: (0, dateUtils_1.calculateAge)(child.dateOfBirth),
                ageInMonths: (0, dateUtils_1.calculateAge)(child.dateOfBirth, true),
                activityStats: stats
            };
        });
    }
    async verifyChildOwnership(childId, userId) {
        const child = await prisma.child.findFirst({
            where: {
                id: childId,
                userId
            }
        });
        return !!child;
    }
    async getChildrenByAgeRange(userId, minAge, maxAge) {
        const children = await prisma.child.findMany({
            where: {
                userId,
                isActive: true
            }
        });
        return children
            .map(child => ({
            ...child,
            age: (0, dateUtils_1.calculateAge)(child.dateOfBirth),
            ageInMonths: (0, dateUtils_1.calculateAge)(child.dateOfBirth, true)
        }))
            .filter(child => child.age >= minAge && child.age <= maxAge);
    }
    async searchChildren(userId, query) {
        const children = await prisma.child.findMany({
            where: {
                userId,
                isActive: true,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { interests: { hasSome: [query] } },
                    { notes: { contains: query, mode: 'insensitive' } }
                ]
            }
        });
        return children.map(child => ({
            ...child,
            age: (0, dateUtils_1.calculateAge)(child.dateOfBirth),
            ageInMonths: (0, dateUtils_1.calculateAge)(child.dateOfBirth, true)
        }));
    }
    async updateChildInterests(childId, userId, interests) {
        const child = await prisma.child.findFirst({
            where: { id: childId, userId }
        });
        if (!child)
            return null;
        return await prisma.child.update({
            where: { id: childId },
            data: { interests }
        });
    }
    async getSharedChildren(userId) {
        const shares = await prisma.activityShare.findMany({
            where: {
                sharedWithUserId: userId,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            include: {
                profiles: {
                    include: {
                        child: true
                    }
                },
                sharingUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
        const sharedChildren = [];
        shares.forEach(share => {
            share.profiles.forEach(profile => {
                sharedChildren.push({
                    ...profile.child,
                    age: (0, dateUtils_1.calculateAge)(profile.child.dateOfBirth),
                    ageInMonths: (0, dateUtils_1.calculateAge)(profile.child.dateOfBirth, true),
                    sharedBy: share.sharingUser,
                    shareId: share.id,
                    permissions: {
                        canViewInterested: profile.canViewInterested,
                        canViewRegistered: profile.canViewRegistered,
                        canViewCompleted: profile.canViewCompleted,
                        canViewNotes: profile.canViewNotes
                    }
                });
            });
        });
        return sharedChildren;
    }
    async bulkCreateChildren(userId, children) {
        const data = children.map(child => ({
            ...child,
            userId,
            interests: child.interests || []
        }));
        return await prisma.$transaction(data.map(childData => prisma.child.create({ data: childData })));
    }
}
exports.ChildrenService = ChildrenService;
exports.childrenService = new ChildrenService();
//# sourceMappingURL=childrenService.js.map