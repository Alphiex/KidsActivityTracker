import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Theme } from '../../theme';

export interface SkillProgress {
  id: string;
  childId: string;
  skillCategory: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  activitiesCompleted: number;
  totalHours: number;
  lastActivityDate?: string;
  lastActivityName?: string;
  notes?: string;
  achievements: string[];
}

interface SkillProgressCardProps {
  skill: SkillProgress;
  onPress?: () => void;
  compact?: boolean;
}

const SKILL_ICONS: { [key: string]: string } = {
  swimming: 'swim',
  skating: 'skate',
  'ice-skating': 'skate',
  music: 'music-note',
  dance: 'dance-ballroom',
  'martial-arts': 'karate',
  sports: 'basketball',
  'team-sports': 'soccer',
  gymnastics: 'gymnastics',
  art: 'palette',
  'visual-arts': 'brush',
  coding: 'code-tags',
  stem: 'flask',
  cooking: 'chef-hat',
  'outdoor-adventure': 'pine-tree',
  camps: 'tent',
  fitness: 'weight-lifter',
  yoga: 'meditation',
  default: 'star',
};

const LEVEL_COLORS: { [key: string]: string } = {
  beginner: '#60A5FA', // Blue
  intermediate: '#34D399', // Green
  advanced: '#F59E0B', // Amber
  expert: '#8B5CF6', // Purple
};

const LEVEL_PROGRESS: { [key: string]: number } = {
  beginner: 0.25,
  intermediate: 0.5,
  advanced: 0.75,
  expert: 1,
};

const SkillProgressCard: React.FC<SkillProgressCardProps> = ({
  skill,
  onPress,
  compact = false,
}) => {
  const getIcon = () => {
    return SKILL_ICONS[skill.skillCategory.toLowerCase()] || SKILL_ICONS.default;
  };

  const getLevelColor = () => {
    return LEVEL_COLORS[skill.currentLevel] || LEVEL_COLORS.beginner;
  };

  const getLevelProgress = () => {
    return LEVEL_PROGRESS[skill.currentLevel] || 0.25;
  };

  const formatSkillName = (category: string) => {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatLevel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.compactCard} 
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={[styles.compactIconContainer, { backgroundColor: getLevelColor() + '20' }]}>
          <Icon name={getIcon()} size={20} color={getLevelColor()} />
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactSkillName}>{formatSkillName(skill.skillCategory)}</Text>
          <Text style={[styles.compactLevel, { color: getLevelColor() }]}>
            {formatLevel(skill.currentLevel)}
          </Text>
        </View>
        <View style={styles.compactStats}>
          <Text style={styles.compactCount}>{skill.activitiesCompleted}</Text>
          <Text style={styles.compactLabel}>activities</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: getLevelColor() + '20' }]}>
          <Icon name={getIcon()} size={28} color={getLevelColor()} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.skillName}>{formatSkillName(skill.skillCategory)}</Text>
          <View style={[styles.levelBadge, { backgroundColor: getLevelColor() }]}>
            <Text style={styles.levelText}>{formatLevel(skill.currentLevel)}</Text>
          </View>
        </View>
        {skill.achievements.length > 0 && (
          <View style={styles.achievementBadge}>
            <Icon name="trophy" size={16} color="#FFB800" />
            <Text style={styles.achievementCount}>{skill.achievements.length}</Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${getLevelProgress() * 100}%`,
                backgroundColor: getLevelColor() 
              }
            ]} 
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>Beginner</Text>
          <Text style={styles.progressLabel}>Expert</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Icon name="checkbox-marked-circle" size={18} color={Colors.success} />
          <Text style={styles.statValue}>{skill.activitiesCompleted}</Text>
          <Text style={styles.statLabel}>Activities</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Icon name="clock-outline" size={18} color={Colors.primary} />
          <Text style={styles.statValue}>{Math.round(skill.totalHours)}h</Text>
          <Text style={styles.statLabel}>Total Time</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Icon name="calendar" size={18} color={Colors.secondary} />
          <Text style={styles.statValue}>{formatDate(skill.lastActivityDate)}</Text>
          <Text style={styles.statLabel}>Last Active</Text>
        </View>
      </View>

      {/* Last Activity */}
      {skill.lastActivityName && (
        <View style={styles.lastActivity}>
          <Text style={styles.lastActivityLabel}>Last: </Text>
          <Text style={styles.lastActivityName} numberOfLines={1}>
            {skill.lastActivityName}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  skillName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 4,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  achievementCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  lastActivity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastActivityLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  lastActivityName: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  // Compact styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...Theme.shadows.sm,
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactContent: {
    flex: 1,
  },
  compactSkillName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
  },
  compactLevel: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactStats: {
    alignItems: 'center',
  },
  compactCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
  },
  compactLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
});

export default SkillProgressCard;
