import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme';
import rateLimitHelper from '../../utils/rateLimitHelper';

interface RateLimitScreenProps {
  onRetry: () => void;
  endpoint?: string;
}

const RateLimitScreen: React.FC<RateLimitScreenProps> = ({ onRetry, endpoint = 'auth_login' }) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const checkRateLimit = () => {
      const { wait, timeRemaining: remaining } = rateLimitHelper.shouldWait(endpoint);
      if (wait && remaining) {
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(0);
      }
    };

    // Check immediately
    checkRateLimit();

    // Update every second
    const interval = setInterval(checkRateLimit, 1000);

    return () => clearInterval(interval);
  }, [endpoint]);

  const handleClearAndRetry = () => {
    rateLimitHelper.clearAll();
    onRetry();
  };

  if (timeRemaining === 0) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Icon name="timer-sand" size={80} color={colors.warning} />
        
        <Text style={styles.title}>Rate Limited</Text>
        
        <Text style={styles.message}>
          Too many authentication attempts.{'\n'}
          Please wait before trying again.
        </Text>
        
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{timeRemaining}</Text>
          <Text style={styles.timerLabel}>seconds remaining</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={onRetry}
          disabled={timeRemaining > 0}
        >
          {timeRemaining > 0 ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Try Again</Text>
          )}
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleClearAndRetry}
          >
            <Text style={styles.secondaryButtonText}>
              Clear Rate Limit (Dev Only)
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoContainer}>
          <Icon name="information-outline" size={20} color={colors.gray} />
          <Text style={styles.infoText}>
            The API limits authentication attempts to prevent abuse.
            {__DEV__ && '\nIn development, you can clear the rate limit manually.'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.warning,
  },
  timerLabel: {
    fontSize: 16,
    color: colors.gray,
    marginTop: 5,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray,
    marginLeft: 10,
    lineHeight: 20,
  },
});

export default RateLimitScreen;