import { Activity, ActivitySnapshot } from '../../generated/prisma';
import { prisma } from '../lib/prisma';

export interface PriceDropEvent {
  activityId: string;
  activity: Activity;
  oldPrice: number;
  newPrice: number;
  dropAmount: number;
  dropPercent: number;
}

export interface CapacityChangeEvent {
  activityId: string;
  activity: Activity;
  oldSpots: number;
  newSpots: number;
  isCritical: boolean; // true if spots <= 3
}

export interface SpotsAvailableEvent {
  activityId: string;
  activity: Activity;
  spotsAvailable: number;
}

/**
 * Service for capturing and tracking activity state changes
 * Used for detecting price drops, capacity changes, and spots becoming available
 */
export class ActivitySnapshotService {
  /**
   * Capture a snapshot of a single activity's current state
   */
  async captureSnapshot(activityId: string): Promise<ActivitySnapshot | null> {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, spotsAvailable: true, cost: true, isActive: true }
    });

    if (!activity || !activity.isActive) {
      return null;
    }

    return prisma.activitySnapshot.create({
      data: {
        activityId: activity.id,
        spotsAvailable: activity.spotsAvailable,
        cost: activity.cost
      }
    });
  }

  /**
   * Capture snapshots for all activities from a specific provider
   * Called after each scraper run completes
   */
  async captureProviderSnapshots(providerId: string): Promise<number> {
    const activities = await prisma.activity.findMany({
      where: { providerId, isActive: true },
      select: { id: true, spotsAvailable: true, cost: true }
    });

    if (activities.length === 0) {
      return 0;
    }

    const snapshots = activities.map(activity => ({
      activityId: activity.id,
      spotsAvailable: activity.spotsAvailable,
      cost: activity.cost
    }));

    const result = await prisma.activitySnapshot.createMany({
      data: snapshots,
      skipDuplicates: true
    });

    return result.count;
  }

  /**
   * Get the previous snapshot for an activity (before the most recent)
   */
  async getPreviousSnapshot(activityId: string): Promise<ActivitySnapshot | null> {
    const snapshots = await prisma.activitySnapshot.findMany({
      where: { activityId },
      orderBy: { capturedAt: 'desc' },
      take: 2
    });

    // Return second-to-last snapshot if it exists
    return snapshots[1] || null;
  }

  /**
   * Detect price drops since a given date
   * Compares current activity prices to their previous snapshots
   */
  async detectPriceDrops(since: Date, minDropPercent: number = 5): Promise<PriceDropEvent[]> {
    // Get activities with snapshots from before and after the since date
    const recentSnapshots = await prisma.activitySnapshot.findMany({
      where: { capturedAt: { gte: since } },
      include: {
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      },
      orderBy: { capturedAt: 'desc' }
    });

    const priceDrops: PriceDropEvent[] = [];
    const processedActivities = new Set<string>();

    for (const snapshot of recentSnapshots) {
      // Skip if already processed or activity is inactive
      if (processedActivities.has(snapshot.activityId) || !snapshot.activity.isActive) {
        continue;
      }
      processedActivities.add(snapshot.activityId);

      // Get previous snapshot
      const previousSnapshot = await this.getPreviousSnapshot(snapshot.activityId);
      if (!previousSnapshot || previousSnapshot.cost === null || snapshot.activity.cost === null) {
        continue;
      }

      const oldPrice = previousSnapshot.cost;
      const newPrice = snapshot.activity.cost;

      // Only detect drops (not increases)
      if (newPrice < oldPrice) {
        const dropAmount = oldPrice - newPrice;
        const dropPercent = (dropAmount / oldPrice) * 100;

        if (dropPercent >= minDropPercent) {
          priceDrops.push({
            activityId: snapshot.activityId,
            activity: snapshot.activity,
            oldPrice,
            newPrice,
            dropAmount,
            dropPercent
          });
        }
      }
    }

    return priceDrops;
  }

  /**
   * Detect capacity changes (spots decreasing toward threshold)
   * Useful for alerting users when favorites are filling up
   */
  async detectCapacityChanges(since: Date, criticalThreshold: number = 3): Promise<CapacityChangeEvent[]> {
    const recentSnapshots = await prisma.activitySnapshot.findMany({
      where: { capturedAt: { gte: since } },
      include: {
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      },
      orderBy: { capturedAt: 'desc' }
    });

    const capacityChanges: CapacityChangeEvent[] = [];
    const processedActivities = new Set<string>();

    for (const snapshot of recentSnapshots) {
      if (processedActivities.has(snapshot.activityId) || !snapshot.activity.isActive) {
        continue;
      }
      processedActivities.add(snapshot.activityId);

      const previousSnapshot = await this.getPreviousSnapshot(snapshot.activityId);
      if (!previousSnapshot || previousSnapshot.spotsAvailable === null) {
        continue;
      }

      const oldSpots = previousSnapshot.spotsAvailable;
      const newSpots = snapshot.activity.spotsAvailable;

      // Detect when spots decreased and is now at or below critical threshold
      if (newSpots !== null && newSpots < oldSpots && newSpots <= criticalThreshold && oldSpots > criticalThreshold) {
        capacityChanges.push({
          activityId: snapshot.activityId,
          activity: snapshot.activity,
          oldSpots,
          newSpots,
          isCritical: newSpots <= criticalThreshold
        });
      }
    }

    return capacityChanges;
  }

  /**
   * Detect activities where spots became available (was 0, now > 0)
   * Used for waitlist notifications
   */
  async detectNewlyAvailable(since: Date): Promise<SpotsAvailableEvent[]> {
    const recentSnapshots = await prisma.activitySnapshot.findMany({
      where: { capturedAt: { gte: since } },
      include: {
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      },
      orderBy: { capturedAt: 'desc' }
    });

    const newlyAvailable: SpotsAvailableEvent[] = [];
    const processedActivities = new Set<string>();

    for (const snapshot of recentSnapshots) {
      if (processedActivities.has(snapshot.activityId) || !snapshot.activity.isActive) {
        continue;
      }
      processedActivities.add(snapshot.activityId);

      const previousSnapshot = await this.getPreviousSnapshot(snapshot.activityId);
      if (!previousSnapshot) {
        continue;
      }

      const oldSpots = previousSnapshot.spotsAvailable;
      const newSpots = snapshot.activity.spotsAvailable;

      // Was full (0 spots) or null, now has spots
      if ((oldSpots === 0 || oldSpots === null) && newSpots !== null && newSpots > 0) {
        newlyAvailable.push({
          activityId: snapshot.activityId,
          activity: snapshot.activity,
          spotsAvailable: newSpots
        });
      }
    }

    return newlyAvailable;
  }

  /**
   * Clean up old snapshots to prevent database bloat
   * Keeps only the last N days of snapshots
   */
  async cleanupOldSnapshots(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.activitySnapshot.deleteMany({
      where: { capturedAt: { lt: cutoffDate } }
    });

    return result.count;
  }
}

export const activitySnapshotService = new ActivitySnapshotService();
