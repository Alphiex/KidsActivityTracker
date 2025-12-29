import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { AISourceType } from '../../types/ai';

interface AISourceBadgeProps {
  source: AISourceType;
  compact?: boolean;
}

/**
 * Badge showing the source of AI recommendations
 * Provides transparency about how results were generated
 */
const AISourceBadge: React.FC<AISourceBadgeProps> = ({ source, compact = false }) => {
  const { colors } = useTheme();
  
  const getSourceInfo = () => {
    switch (source) {
      case 'llm':
        return {
          icon: 'auto-fix',
          label: 'AI Pick',
          color: '#8B5CF6' // Purple for AI
        };
      case 'cache':
        return {
          icon: 'lightning-bolt',
          label: 'Instant',
          color: '#10B981' // Green for cached
        };
      case 'heuristic':
        return {
          icon: 'flash',
          label: 'Quick Match',
          color: '#F59E0B' // Amber for heuristic
        };
      default:
        return {
          icon: 'help-circle',
          label: 'Match',
          color: colors.textSecondary
        };
    }
  };
  
  const info = getSourceInfo();
  
  if (compact) {
    return (
      <View style={[styles.compactBadge, { backgroundColor: info.color + '20' }]}>
        <Icon name={info.icon} size={12} color={info.color} />
      </View>
    );
  }
  
  return (
    <View style={[styles.badge, { backgroundColor: info.color + '20' }]}>
      <Icon name={info.icon} size={14} color={info.color} />
      <Text style={[styles.label, { color: info.color }]}>{info.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  compactBadge: {
    padding: 4,
    borderRadius: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default AISourceBadge;
