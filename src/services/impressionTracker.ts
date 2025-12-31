import { Platform } from 'react-native';
import api from './apiClient';

export interface ImpressionEvent {
  activityId?: string;
  placement: 'activity_list' | 'activity_detail' | 'search_results' | 'dashboard';
  city?: string;
  province?: string;
  abTestId?: string;
  abVariant?: string;
}

interface QueuedImpression extends ImpressionEvent {
  platform: string;
  timestamp: number;
}

class ImpressionTracker {
  private queue: QueuedImpression[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushInterval = 30000; // 30 seconds
  private readonly maxQueueSize = 50;
  private isFlushingInProgress = false;

  constructor() {
    // Start periodic flush timer
    this.startFlushTimer();
  }

  /**
   * Track an impression event
   * Adds to queue and flushes if queue is full
   */
  track(event: ImpressionEvent): void {
    const impression: QueuedImpression = {
      ...event,
      platform: Platform.OS,
      timestamp: Date.now(),
    };

    this.queue.push(impression);

    // Flush immediately if queue is full
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * Track impression for a sponsored activity
   */
  trackSponsoredActivity(
    activityId: string,
    placement: ImpressionEvent['placement'],
    context?: { city?: string; province?: string }
  ): void {
    this.track({
      activityId,
      placement,
      city: context?.city,
      province: context?.province,
    });
  }

  /**
   * Track impressions for multiple activities at once
   * Useful for list views
   */
  trackBatch(
    activityIds: string[],
    placement: ImpressionEvent['placement'],
    context?: { city?: string; province?: string }
  ): void {
    activityIds.forEach(activityId => {
      this.track({
        activityId,
        placement,
        city: context?.city,
        province: context?.province,
      });
    });
  }

  /**
   * Flush queued impressions to the server
   */
  async flush(): Promise<void> {
    if (this.isFlushingInProgress || this.queue.length === 0) {
      return;
    }

    this.isFlushingInProgress = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      await api.post('/api/v1/analytics/impressions', {
        impressions: batch.map(imp => ({
          activityId: imp.activityId,
          placement: imp.placement,
          city: imp.city,
          province: imp.province,
          platform: imp.platform,
          abTestId: imp.abTestId,
          abVariant: imp.abVariant,
          timestamp: new Date(imp.timestamp).toISOString(),
        }))
      });
    } catch (error) {
      console.warn('[ImpressionTracker] Failed to flush impressions:', error);
      // Re-queue failed impressions (limit to prevent infinite growth)
      const requeued = batch.slice(-20);
      this.queue = [...requeued, ...this.queue].slice(0, this.maxQueueSize);
    } finally {
      this.isFlushingInProgress = false;
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop the flush timer and flush remaining impressions
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Get current queue size (for debugging)
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

// Export singleton instance
export const impressionTracker = new ImpressionTracker();

export default ImpressionTracker;
