import { PrismaClient, Child, Prisma } from '../../generated/prisma';
import { calculateAge } from '../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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

export class ChildrenService {
  /**
   * Create a new child profile
   */
  async createChild(data: CreateChildInput): Promise<Child> {
    return await prisma.child.create({
      data: {
        userId: data.userId,
        name: data.name,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        avatarUrl: data.avatarUrl,
        interests: data.interests || [],
        notes: data.notes,
      }
    });
  }

  /**
   * Get all children for a user
   */
  async getChildrenByUserId(userId: string, includeInactive = false): Promise<ChildWithAge[]> {
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
      age: calculateAge(child.dateOfBirth),
      ageInMonths: calculateAge(child.dateOfBirth, true)
    }));
  }

  /**
   * Get a single child by ID (with ownership check)
   */
  async getChildById(childId: string, userId: string): Promise<ChildWithAge | null> {
    const child = await prisma.child.findFirst({
      where: {
        id: childId,
        userId
      }
    });

    if (!child) return null;

    return {
      ...child,
      age: calculateAge(child.dateOfBirth),
      ageInMonths: calculateAge(child.dateOfBirth, true)
    };
  }

  /**
   * Update a child profile
   */
  async updateChild(childId: string, userId: string, data: UpdateChildInput): Promise<Child | null> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return null;

    return await prisma.child.update({
      where: { id: childId },
      data
    });
  }

  /**
   * Soft delete a child profile
   */
  async deleteChild(childId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return false;

    await prisma.child.update({
      where: { id: childId },
      data: { isActive: false }
    });

    return true;
  }

  /**
   * Permanently delete a child profile
   */
  async permanentlyDeleteChild(childId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return false;

    // This will cascade delete all related records (activities, shares, etc.)
    await prisma.child.delete({
      where: { id: childId }
    });

    return true;
  }

  /**
   * Get children with their activity counts
   */
  async getChildrenWithActivityStats(userId: string): Promise<any[]> {
    const children = await prisma.child.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        childActivities: {
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

      child.childActivities.forEach(activity => {
        stats[activity.status as keyof typeof stats]++;
      });

      const { childActivities, ...childData } = child;

      return {
        ...childData,
        age: calculateAge(child.dateOfBirth),
        ageInMonths: calculateAge(child.dateOfBirth, true),
        activityStats: stats
      };
    });
  }

  /**
   * Check if a user owns a child
   */
  async verifyChildOwnership(childId: string, userId: string): Promise<boolean> {
    const child = await prisma.child.findFirst({
      where: {
        id: childId,
        userId
      }
    });

    return !!child;
  }

  /**
   * Get children by age range
   */
  async getChildrenByAgeRange(userId: string, minAge: number, maxAge: number): Promise<ChildWithAge[]> {
    const children = await prisma.child.findMany({
      where: {
        userId,
        isActive: true
      }
    });

    return children
      .map(child => ({
        ...child,
        age: calculateAge(child.dateOfBirth),
        ageInMonths: calculateAge(child.dateOfBirth, true)
      }))
      .filter(child => child.age >= minAge && child.age <= maxAge);
  }

  /**
   * Search children by name or interests
   */
  async searchChildren(userId: string, query: string): Promise<ChildWithAge[]> {
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
      age: calculateAge(child.dateOfBirth),
      ageInMonths: calculateAge(child.dateOfBirth, true)
    }));
  }

  /**
   * Update child interests
   */
  async updateChildInterests(childId: string, userId: string, interests: string[]): Promise<Child | null> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return null;

    return await prisma.child.update({
      where: { id: childId },
      data: { interests }
    });
  }

  /**
   * Get shared children (children shared with the user)
   */
  async getSharedChildren(userId: string): Promise<any[]> {
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

    const sharedChildren: any[] = [];

    shares.forEach(share => {
      share.profiles.forEach(profile => {
        sharedChildren.push({
          ...profile.child,
          age: calculateAge(profile.child.dateOfBirth),
          ageInMonths: calculateAge(profile.child.dateOfBirth, true),
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

  /**
   * Bulk create children
   */
  async bulkCreateChildren(userId: string, children: Omit<CreateChildInput, 'userId'>[]): Promise<Child[]> {
    const data = children.map(child => ({
      ...child,
      userId,
      interests: child.interests || [],
    }));

    return await prisma.$transaction(
      data.map(childData => 
        prisma.child.create({ data: childData })
      )
    );
  }
}

export const childrenService = new ChildrenService();