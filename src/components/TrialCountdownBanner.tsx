/**
 * TrialCountdownBanner - Shows trial countdown at top of Dashboard
 *
 * Displays days remaining in trial with a CTA to subscribe
 * - Days 7-4: Casual reminder, can be dismissed
 * - Days 3-1: Urgent styling, persists
 * - Day 0: "Trial ends today!" with strong CTA
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TrialCountdownBannerProps {
  /** Days remaining in trial */
  daysRemaining: number;
  /** Whether user is currently trialing */
  isTrialing: boolean;
  /** Custom onPress handler */
  onPress?: () => void;
  /** Whether banner can be dismissed */
  dismissable?: boolean;
}

const DISMISSED_KEY = '@trial_banner_dismissed_date';

const TrialCountdownBanner: React.FC<TrialCountdownBannerProps> = ({
  daysRemaining,
  isTrialing,
  onPress,
  dismissable = true,
}) => {
  const navigation = useNavigation<any>();
  const [isDismissed, setIsDismissed] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Check if dismissed today
    checkDismissed();
  }, []);

  const checkDismissed = async () => {
    try {
      const dismissedDate = await AsyncStorage.getItem(DISMISSED_KEY);
      if (dismissedDate) {
        const today = new Date().toDateString();
        // Reset if it's a new day
        if (dismissedDate !== today) {
          await AsyncStorage.removeItem(DISMISSED_KEY);
          setIsDismissed(false);
        } else {
          setIsDismissed(true);
        }
      }
    } catch {
      // Ignore errors
    }
  };

  const handleDismiss = async () => {
    // Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(async () => {
      setIsDismissed(true);
      try {
        await AsyncStorage.setItem(DISMISSED_KEY, new Date().toDateString());
      } catch {
        // Ignore errors
      }
    });
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Paywall', { source: 'trial_banner' });
    }
  };

  // Don't show if not trialing or dismissed
  if (!isTrialing || daysRemaining < 0) {
    return null;
  }

  // Don't show if dismissed (but only if days > 3 and dismissable)
  const canDismiss = dismissable && daysRemaining > 3;
  if (isDismissed && canDismiss) {
    return null;
  }

  // Determine styling based on urgency
  const isUrgent = daysRemaining <= 3;
  const isFinalDay = daysRemaining === 0;

  const getGradientColors = (): string[] => {
    if (isFinalDay) {
      return ['#FF6B6B', '#FF4757', '#EE5A24']; // Red/orange for final day
    }
    if (isUrgent) {
      return ['#FFA502', '#FF6B6B', '#FF4757']; // Orange/red for urgent
    }
    return ['#FFB5C5', '#E8638B', '#D53F8C']; // Pink for normal
  };

  const getMessage = () => {
    if (isFinalDay) {
      return 'Your trial ends today!';
    }
    if (daysRemaining === 1) {
      return 'Last day of your free trial!';
    }
    return `${daysRemaining} days left in your free trial`;
  };

  const getSubMessage = () => {
    if (isFinalDay) {
      return "Subscribe now to keep all premium features";
    }
    if (isUrgent) {
      return "Don't lose your premium features";
    }
    return "You're enjoying Premium features!";
  };

  const getIcon = () => {
    if (isFinalDay) {
      return 'alert-circle';
    }
    if (isUrgent) {
      return 'clock-alert';
    }
    return 'party-popper';
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <TouchableOpacity
          style={styles.content}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <View style={styles.iconContainer}>
            <Icon name={getIcon()} size={24} color="#fff" />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{getMessage()}</Text>
            <Text style={styles.subtitle}>{getSubMessage()}</Text>
          </View>

          <View style={styles.buttonContainer}>
            <View style={styles.button}>
              <Text style={styles.buttonText}>
                {isFinalDay ? 'Subscribe' : 'Keep Premium'}
              </Text>
              <Icon name="chevron-right" size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Dismiss button - only for non-urgent days */}
        {canDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

/**
 * TrialExpiredBanner - Shows when trial has ended
 */
interface TrialExpiredBannerProps {
  onPress?: () => void;
}

export const TrialExpiredBanner: React.FC<TrialExpiredBannerProps> = ({ onPress }) => {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Paywall', { source: 'trial_expired' });
    }
  };

  return (
    <TouchableOpacity
      style={styles.expiredContainer}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#636e72', '#2d3436']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Icon name="clock-remove" size={24} color="#fff" />
          <View style={styles.textContainer}>
            <Text style={styles.title}>Your trial has ended</Text>
            <Text style={styles.subtitle}>Subscribe to unlock all features</Text>
          </View>
          <View style={[styles.button, styles.expiredButton]}>
            <Text style={styles.buttonText}>Subscribe</Text>
            <Icon name="chevron-right" size={16} color="#fff" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  buttonContainer: {
    marginLeft: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiredContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  expiredButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});

export default TrialCountdownBanner;
