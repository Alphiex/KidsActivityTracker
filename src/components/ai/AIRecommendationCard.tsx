import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { AIRecommendation, AISourceType } from '../../types/ai';
import { Activity } from '../../types';
import AISourceBadge from './AISourceBadge';
import { OptimizedActivityImage } from '../OptimizedActivityImage';

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  activity: Activity;
  source: AISourceType;
  onPress?: () => void;
  showExplanation?: boolean;
}

/**
 * Activity card enhanced with AI recommendation explanation
 * Shows "why" reasons and fit score
 */
const AIRecommendationCard: React.FC<AIRecommendationCardProps> = ({
  recommendation,
  activity,
  source,
  onPress,
  showExplanation = true
}) => {
  const { colors } = useTheme();
  
  // Format fit score as percentage
  const fitScoreLabel = recommendation.fit_score >= 90 
    ? 'Excellent Match' 
    : recommendation.fit_score >= 70 
      ? 'Good Match' 
      : 'Possible Match';
  
  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Rank badge */}
      <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.rankText}>#{recommendation.rank}</Text>
      </View>
      
      {/* Sponsored label */}
      {recommendation.is_sponsored && (
        <View style={[styles.sponsoredBadge, { backgroundColor: '#F59E0B20' }]}>
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>
      )}
      
      <View style={styles.content}>
        {/* Activity image */}
        <View style={styles.imageContainer}>
          <OptimizedActivityImage
            activity={activity}
            style={styles.image}
          />
        </View>
        
        {/* Activity info */}
        <View style={styles.info}>
          <View style={styles.header}>
            <Text 
              style={[styles.title, { color: colors.text }]} 
              numberOfLines={2}
            >
              {activity.name}
            </Text>
            <AISourceBadge source={source} compact />
          </View>
          
          {/* Provider name */}
          {activity.provider?.name && (
            <Text 
              style={[styles.provider, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {activity.provider.name}
            </Text>
          )}
          
          {/* Price and fit score */}
          <View style={styles.metaRow}>
            <Text style={[styles.price, { color: colors.primary }]}>
              {activity.cost === 0 ? 'Free' : `$${activity.cost}`}
            </Text>
            
            <View style={styles.fitScore}>
              <Icon 
                name="star" 
                size={14} 
                color={recommendation.fit_score >= 70 ? '#10B981' : colors.textSecondary} 
              />
              <Text 
                style={[
                  styles.fitScoreText, 
                  { color: recommendation.fit_score >= 70 ? '#10B981' : colors.textSecondary }
                ]}
              >
                {fitScoreLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      {/* Why section */}
      {showExplanation && recommendation.why && recommendation.why.length > 0 && (
        <View style={[styles.whySection, { borderTopColor: colors.border }]}>
          <Text style={[styles.whyTitle, { color: colors.textSecondary }]}>
            Why this matches:
          </Text>
          {recommendation.why.map((reason, index) => (
            <View key={index} style={styles.whyItem}>
              <Icon name="check-circle" size={14} color="#10B981" />
              <Text style={[styles.whyText, { color: colors.text }]}>
                {reason}
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {/* Warnings */}
      {recommendation.warnings && recommendation.warnings.length > 0 && (
        <View style={[styles.warningsSection, { borderTopColor: colors.border }]}>
          {recommendation.warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Icon name="alert-circle" size={14} color="#F59E0B" />
              <Text style={[styles.warningText, { color: '#F59E0B' }]}>
                {warning}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  rankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  sponsoredText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 40, // Space for rank badge
    gap: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  provider: {
    fontSize: 13,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
  },
  fitScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fitScoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
  whySection: {
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  whyTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  whyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  whyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  warningsSection: {
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 4,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});

export default AIRecommendationCard;
