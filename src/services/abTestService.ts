/**
 * A/B Test Service
 * Simple A/B testing infrastructure for paywall and other experiments
 *
 * Usage:
 * const variant = abTestService.getVariant('paywall_headline');
 * // Returns 'control' or 'variant_a' etc.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsService } from './analyticsService';

// Define experiments and their variants
interface Experiment {
  id: string;
  name: string;
  variants: string[];
  weights?: number[]; // Optional weights for each variant (must sum to 1)
  isActive: boolean;
}

// Active experiments configuration
const EXPERIMENTS: Experiment[] = [
  {
    id: 'paywall_headline',
    name: 'Paywall Headline Test',
    variants: ['control', 'family_focus', 'savings_focus'],
    weights: [0.34, 0.33, 0.33],
    isActive: true,
  },
  {
    id: 'paywall_price_display',
    name: 'Price Display Format',
    variants: ['control', 'monthly_equivalent'],
    weights: [0.5, 0.5],
    isActive: true,
  },
  {
    id: 'trial_cta',
    name: 'Trial CTA Copy',
    variants: ['control', 'start_free', 'try_premium'],
    weights: [0.34, 0.33, 0.33],
    isActive: true,
  },
  {
    id: 'upgrade_prompt_style',
    name: 'Upgrade Prompt Style',
    variants: ['control', 'minimal', 'detailed'],
    weights: [0.34, 0.33, 0.33],
    isActive: false, // Disabled for now
  },
];

const STORAGE_KEY = '@ab_test_assignments';

interface ExperimentAssignments {
  [experimentId: string]: {
    variant: string;
    assignedAt: number;
  };
}

class ABTestService {
  private assignments: ExperimentAssignments = {};
  private isInitialized = false;

  /**
   * Initialize A/B test service
   * Should be called once on app start
   */
  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.assignments = JSON.parse(stored);
      }
      this.isInitialized = true;
      console.log('[ABTest] Initialized with assignments:', this.assignments);
    } catch (error) {
      console.error('[ABTest] Failed to load assignments:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Get variant for an experiment
   * Will assign a variant if not already assigned
   */
  getVariant(experimentId: string): string {
    const experiment = EXPERIMENTS.find((e) => e.id === experimentId);

    if (!experiment || !experiment.isActive) {
      return 'control';
    }

    // Check if already assigned
    if (this.assignments[experimentId]) {
      return this.assignments[experimentId].variant;
    }

    // Assign a variant
    const variant = this.assignVariant(experiment);
    this.assignments[experimentId] = {
      variant,
      assignedAt: Date.now(),
    };

    // Persist assignment
    this.saveAssignments();

    // Track assignment
    analyticsService.track('app_opened', {
      experiment_id: experimentId,
      variant,
      event_type: 'ab_test_assignment',
    });

    return variant;
  }

  /**
   * Assign a variant based on weights
   */
  private assignVariant(experiment: Experiment): string {
    const { variants, weights } = experiment;

    if (!weights || weights.length !== variants.length) {
      // Equal distribution
      const index = Math.floor(Math.random() * variants.length);
      return variants[index];
    }

    // Weighted distribution
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return variants[i];
      }
    }

    return variants[variants.length - 1];
  }

  /**
   * Save assignments to storage
   */
  private async saveAssignments(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.assignments));
    } catch (error) {
      console.error('[ABTest] Failed to save assignments:', error);
    }
  }

  /**
   * Get all current assignments
   */
  getAssignments(): ExperimentAssignments {
    return { ...this.assignments };
  }

  /**
   * Force a specific variant (for testing)
   */
  async forceVariant(experimentId: string, variant: string): Promise<void> {
    this.assignments[experimentId] = {
      variant,
      assignedAt: Date.now(),
    };
    await this.saveAssignments();
  }

  /**
   * Reset all assignments (for testing)
   */
  async resetAssignments(): Promise<void> {
    this.assignments = {};
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Check if an experiment is active
   */
  isExperimentActive(experimentId: string): boolean {
    const experiment = EXPERIMENTS.find((e) => e.id === experimentId);
    return experiment?.isActive ?? false;
  }

  /**
   * Get experiment info
   */
  getExperimentInfo(experimentId: string): Experiment | undefined {
    return EXPERIMENTS.find((e) => e.id === experimentId);
  }
}

export const abTestService = new ABTestService();
export default ABTestService;

// Variant content for paywall A/B tests
export const PAYWALL_VARIANTS = {
  paywall_headline: {
    control: {
      title: 'Upgrade to Premium',
      subtitle: 'Unlock unlimited features for your family',
    },
    family_focus: {
      title: 'Give Your Family More',
      subtitle: 'Track all your children and never miss an activity',
    },
    savings_focus: {
      title: 'Save 30% with Annual',
      subtitle: 'The best value for busy parents',
    },
  },
  trial_cta: {
    control: 'Start 7-Day Free Trial',
    start_free: 'Start Free for 7 Days',
    try_premium: 'Try Premium Free',
  },
};
