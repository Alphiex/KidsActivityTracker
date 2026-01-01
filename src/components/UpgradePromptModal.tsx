/**
 * UpgradePromptModal - Shows when users hit a subscription limit
 * Provides context-specific messaging and upgrade CTA
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { analyticsService } from '../services/analyticsService';

export type UpgradeFeature =
  | 'children'
  | 'favorites'
  | 'sharing'
  | 'filters'
  | 'calendar'
  | 'alerts'
  | 'savedSearches'
  | 'waitlist'
  | 'ai_search';

interface FeatureConfig {
  icon: string;
  title: string;
  message: string;
  benefit: string;
}

const FEATURE_CONFIGS: Record<UpgradeFeature, FeatureConfig> = {
  children: {
    icon: 'account-child',
    title: 'Child Limit Reached',
    message: "You've reached the maximum of 2 child profiles on the free plan.",
    benefit: 'Add unlimited children with Premium',
  },
  favorites: {
    icon: 'heart',
    title: 'Favorites Limit Reached',
    message: "You've saved 10 favorites, the maximum for free users.",
    benefit: 'Save unlimited favorites with Premium',
  },
  sharing: {
    icon: 'account-group',
    title: 'Sharing Limit Reached',
    message: "You can only share with 1 person on the free plan.",
    benefit: 'Share with unlimited family members with Premium',
  },
  filters: {
    icon: 'filter-variant',
    title: 'Advanced Filters',
    message: 'Advanced filtering options are a Premium feature.',
    benefit: 'Filter by budget, time, and more with Premium',
  },
  calendar: {
    icon: 'calendar-export',
    title: 'Calendar Export',
    message: 'Exporting to your calendar is a Premium feature.',
    benefit: 'Export activities to any calendar app with Premium',
  },
  alerts: {
    icon: 'bell-ring',
    title: 'Instant Alerts',
    message: 'Real-time availability alerts are a Premium feature.',
    benefit: 'Get notified instantly when spots open up',
  },
  savedSearches: {
    icon: 'bookmark',
    title: 'Saved Searches',
    message: 'Saving search presets is a Premium feature.',
    benefit: 'Save up to 10 search presets with Premium',
  },
  waitlist: {
    icon: 'bell-ring',
    title: 'Waiting List Limit Reached',
    message: "You've reached the maximum of 4 waiting list items on the free plan.",
    benefit: 'Monitor unlimited activities with Premium',
  },
  ai_search: {
    icon: 'robot',
    title: 'AI-Powered Search',
    message: 'AI Match uses advanced AI to find the perfect activities for your family.',
    benefit: 'Get personalized AI recommendations with Premium',
  },
};

interface UpgradePromptModalProps {
  visible: boolean;
  feature: UpgradeFeature;
  onClose: () => void;
  currentCount?: number;
  limit?: number;
}

const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  visible,
  feature,
  onClose,
  currentCount,
  limit,
}) => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const config = FEATURE_CONFIGS[feature] || FEATURE_CONFIGS.favorites;

  // Track when modal is shown
  useEffect(() => {
    if (visible) {
      analyticsService.trackUpgradePromptShown(feature, currentCount, limit);
    }
  }, [visible, feature, currentCount, limit]);

  const handleUpgrade = () => {
    analyticsService.trackUpgradePromptAccepted(feature);
    onClose();
    navigation.navigate('Paywall');
  };

  const handleDismiss = () => {
    analyticsService.trackUpgradePromptDismissed(feature);
    onClose();
  };

  const getMessage = () => {
    if (currentCount !== undefined && limit !== undefined) {
      if (feature === 'children') {
        return `You have ${currentCount} of ${limit} child profiles. Upgrade to add more.`;
      }
      if (feature === 'favorites') {
        return `You have ${currentCount} of ${limit} favorites saved. Upgrade for unlimited.`;
      }
      if (feature === 'sharing') {
        return `You're sharing with ${currentCount} of ${limit} allowed. Upgrade to share with more.`;
      }
      if (feature === 'waitlist') {
        return `You have ${currentCount} of ${limit} waiting list items. Upgrade for unlimited.`;
      }
    }
    return config.message;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Icon name={config.icon} size={40} color={colors.primary} />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>

              {/* Message */}
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {getMessage()}
              </Text>

              {/* Benefit */}
              <View style={[styles.benefitContainer, { backgroundColor: colors.success + '15' }]}>
                <Icon name="check-circle" size={20} color={colors.success} />
                <Text style={[styles.benefitText, { color: colors.text }]}>
                  {config.benefit}
                </Text>
              </View>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
                  onPress={handleUpgrade}
                >
                  <Icon name="crown" size={20} color="#fff" />
                  <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleDismiss}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                    Maybe Later
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  benefitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  benefitText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
  },
});

export default UpgradePromptModal;
