import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * A nicely styled empty state component for when there are no results.
 * Use this instead of ugly grey boxes.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'magnify',
  title,
  subtitle,
  style,
  compact = false,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={[compact ? styles.compactContainer : styles.container, style]}>
      <View style={compact ? styles.compactIconContainer : styles.iconContainer}>
        <Icon name={icon} size={compact ? 28 : 40} color="#E8638B" />
      </View>
      <Text style={compact ? styles.compactTitle : styles.title}>{title}</Text>
      {subtitle && (
        <Text style={compact ? styles.compactSubtitle : styles.subtitle}>{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  compactContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 120,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF5F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  compactIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF5F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
    textAlign: 'center',
    marginBottom: 8,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  compactSubtitle: {
    fontSize: 13,
    color: '#717171',
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 16,
    backgroundColor: '#E8638B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default EmptyState;
