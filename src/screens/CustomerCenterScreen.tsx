/**
 * CustomerCenterScreen
 * Displays RevenueCat's Customer Center for subscription management
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { revenueCatService } from '../services/revenueCatService';
import { useAppSelector } from '../store';
import { selectCurrentTier, selectIsTrialing } from '../store/slices/subscriptionSlice';
import { format } from 'date-fns';

const CustomerCenterScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const currentTier = useAppSelector(selectCurrentTier);
  const isTrialing = useAppSelector(selectIsTrialing);

  const [isLoading, setIsLoading] = useState(true);
  const [hasPresented, setHasPresented] = useState(false);

  // Present Customer Center on mount
  useEffect(() => {
    if (!hasPresented) {
      presentCustomerCenter();
    }
  }, []);

  /**
   * Present RevenueCat's Customer Center UI
   */
  const presentCustomerCenter = async () => {
    try {
      setIsLoading(true);
      setHasPresented(true);

      await revenueCatService.presentCustomerCenter();

      // Customer Center was dismissed, go back
      navigation.goBack();
    } catch (error: any) {
      console.error('[CustomerCenter] Error:', error);
      setIsLoading(false);

      // Show fallback UI or open management URL
      const managementURL = revenueCatService.getManagementURL();
      if (managementURL) {
        Alert.alert(
          'Manage Subscription',
          'Would you like to manage your subscription in the App Store?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
            {
              text: 'Open',
              onPress: () => {
                Linking.openURL(managementURL);
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        // Show fallback subscription info
        setIsLoading(false);
      }
    }
  };

  /**
   * Open native subscription management
   */
  const openManageSubscriptions = () => {
    const managementURL = revenueCatService.getManagementURL();
    if (managementURL) {
      Linking.openURL(managementURL);
    } else {
      // Fallback to platform-specific URLs
      const fallbackUrl = Platform.select({
        ios: 'https://apps.apple.com/account/subscriptions',
        android: 'https://play.google.com/store/account/subscriptions',
      });
      if (fallbackUrl) {
        Linking.openURL(fallbackUrl);
      }
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const expirationDate = revenueCatService.getExpirationDate();
  const willRenew = revenueCatService.willRenew();
  const isPro = revenueCatService.isPro();

  // Show loading while presenting Customer Center
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading subscription details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Fallback UI if Customer Center fails
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Subscription</Text>
        <View style={styles.closeButton} />
      </View>

      <View style={styles.content}>
        {/* Subscription Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface }]}>
          <View style={styles.statusHeader}>
            <Icon
              name={isPro ? 'crown' : 'account-outline'}
              size={40}
              color={isPro ? colors.warning : colors.textSecondary}
            />
            <View style={styles.statusTextContainer}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                {isPro ? 'KidsActivityTracker Premium' : 'Free Plan'}
              </Text>
              {isPro && isTrialing && (
                <View style={[styles.trialBadge, { backgroundColor: colors.info }]}>
                  <Text style={styles.trialBadgeText}>Trial</Text>
                </View>
              )}
            </View>
          </View>

          {isPro && expirationDate && (
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Icon name="calendar" size={20} color={colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  {willRenew ? 'Renews' : 'Expires'}:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {format(expirationDate, 'MMMM d, yyyy')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Icon
                  name={willRenew ? 'autorenew' : 'cancel'}
                  size={20}
                  color={willRenew ? colors.success : colors.error}
                />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Auto-renew:
                </Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: willRenew ? colors.success : colors.error },
                  ]}
                >
                  {willRenew ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {isPro ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface }]}
                onPress={openManageSubscriptions}
              >
                <Icon name="cog" size={24} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Manage Subscription
                </Text>
                <Icon name="chevron-right" size={24} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface }]}
                onPress={() => {
                  const url = Platform.select({
                    ios: 'https://support.apple.com/billing',
                    android: 'https://support.google.com/googleplay/answer/2479637',
                  });
                  if (url) Linking.openURL(url);
                }}
              >
                <Icon name="help-circle" size={24} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Billing Help
                </Text>
                <Icon name="chevron-right" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                navigation.goBack();
                // Navigate to paywall after a short delay
                setTimeout(() => {
                  (navigation as any).navigate('Paywall');
                }, 100);
              }}
            >
              <Icon name="crown" size={24} color="#fff" />
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          )}

          {/* Restore Purchases */}
          <TouchableOpacity
            style={[styles.restoreButton, { borderColor: colors.border }]}
            onPress={async () => {
              try {
                setIsLoading(true);
                await revenueCatService.restorePurchases();
                Alert.alert('Success', 'Purchases have been restored.');
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to restore purchases');
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <Text style={[styles.restoreButtonText, { color: colors.primary }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>
        </View>

        {/* Support Links */}
        <View style={styles.supportContainer}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://kidsactivitytracker.com/support')}
          >
            <Text style={[styles.supportLink, { color: colors.textSecondary }]}>
              Contact Support
            </Text>
          </TouchableOpacity>
          <Text style={[styles.supportSeparator, { color: colors.textSecondary }]}>•</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://kidsactivitytracker.com/terms')}
          >
            <Text style={[styles.supportLink, { color: colors.textSecondary }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    marginLeft: 16,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  trialBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  trialBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    marginLeft: 8,
    fontSize: 14,
  },
  detailValue: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  restoreButton: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  supportContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportLink: {
    fontSize: 14,
  },
  supportSeparator: {
    marginHorizontal: 12,
  },
});

export default CustomerCenterScreen;
