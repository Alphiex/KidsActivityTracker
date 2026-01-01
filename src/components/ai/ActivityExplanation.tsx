import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import aiService from '../../services/aiService';
import { aiRobotImage } from '../../assets/images';
import { ActivityExplanation as ExplanationType } from '../../types/ai';

interface ActivityExplanationProps {
  activityId: string;
  childIds?: string[];
  compact?: boolean;
  autoExpand?: boolean;
}

/**
 * Get icon for benefit category
 */
const getCategoryIcon = (category: string): string => {
  switch (category) {
    case 'Physical':
      return 'run';
    case 'Social':
      return 'account-group';
    case 'Cognitive':
      return 'brain';
    case 'Creative':
      return 'palette';
    case 'Emotional':
      return 'heart';
    default:
      return 'star';
  }
};

/**
 * Get color for benefit category
 */
const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'Physical':
      return '#10B981'; // green
    case 'Social':
      return '#E8638B'; // pink
    case 'Cognitive':
      return '#8B5CF6'; // purple
    case 'Creative':
      return '#F59E0B'; // amber
    case 'Emotional':
      return '#E8638B'; // pink
    default:
      return '#6B7280'; // gray
  }
};

/**
 * AI-powered activity explanation component
 * Shows why an activity is good for specific children
 */
export const ActivityExplanation: React.FC<ActivityExplanationProps> = ({
  activityId,
  childIds,
  compact = false,
  autoExpand = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [isLoading, setIsLoading] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, ExplanationType> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animatedHeight] = useState(new Animated.Value(0));

  /**
   * Fetch explanations from AI
   */
  const fetchExplanations = async () => {
    if (explanations) return; // Already fetched
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await aiService.explainActivity(activityId, childIds);
      if (result.success && Object.keys(result.explanations).length > 0) {
        setExplanations(result.explanations);
      } else {
        setError('Unable to generate explanation');
      }
    } catch (err) {
      console.error('Failed to get explanation:', err);
      setError('Failed to load explanation');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle expand/collapse
   */
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded && !explanations && !isLoading) {
      fetchExplanations();
    }

    Animated.timing(animatedHeight, {
      toValue: newExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Auto-expand and fetch on mount if autoExpand is true
  useEffect(() => {
    if (autoExpand && !explanations && !isLoading) {
      fetchExplanations();
    }
  }, [autoExpand]);

  /**
   * Render match score circle
   */
  const renderMatchScore = (score: number) => (
    <View style={[styles.scoreCircle, { borderColor: getScoreColor(score) }]}>
      <Text style={[styles.scoreText, { color: getScoreColor(score) }]}>
        {score}
      </Text>
      <Text style={styles.scoreLabel}>match</Text>
    </View>
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  /**
   * Render a single explanation for a child
   */
  const renderExplanation = (childId: string, explanation: ExplanationType) => (
    <View key={childId} style={styles.explanationCard}>
      <View style={styles.explanationHeader}>
        <Text style={styles.childName}>
          {childId === 'default' ? 'Your Child' : `Child`}
        </Text>
        {renderMatchScore(explanation.match_score)}
      </View>

      <Text style={styles.summaryText}>{explanation.summary}</Text>

      <View style={styles.benefitsContainer}>
        {explanation.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: getCategoryColor(benefit.category) + '20' }]}>
              <Icon 
                name={getCategoryIcon(benefit.category)} 
                size={16} 
                color={getCategoryColor(benefit.category)} 
              />
            </View>
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitCategory, { color: getCategoryColor(benefit.category) }]}>
                {benefit.category}
              </Text>
              <Text style={styles.benefitDescription}>{benefit.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.ageSection}>
        <Icon name="cake-variant" size={16} color="#6B7280" />
        <Text style={styles.ageText}>{explanation.age_appropriateness}</Text>
      </View>
    </View>
  );

  if (compact) {
    // Compact mode: Mini gradient button with robot
    return (
      <View style={styles.compactWrapper}>
        <TouchableOpacity style={styles.compactButton} onPress={handleToggle} activeOpacity={0.8}>
          <LinearGradient
            colors={['#E8638B', '#D53F8C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.compactGradient}
          >
            <Text style={styles.compactButtonText}>Why this activity?</Text>
            <Icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#FFFFFF"
            />
          </LinearGradient>
        </TouchableOpacity>
        <Image source={aiRobotImage} style={styles.compactRobotImage} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Toggle header with gradient and robot overlay */}
      <View style={styles.headerWrapper}>
        <TouchableOpacity style={styles.header} onPress={handleToggle} activeOpacity={0.8}>
          <LinearGradient
            colors={['#E8638B', '#D53F8C', '#D53F8C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Why this activity?</Text>
              <Text style={styles.headerSubtitle}>AI-powered activity analysis</Text>
            </View>
            <Icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color="#FFFFFF"
            />
          </LinearGradient>
        </TouchableOpacity>
        <Image source={aiRobotImage} style={styles.robotImageOverlay} />
      </View>

      {/* Expandable content */}
      {isExpanded && (
        <View style={styles.content}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#E8638B" />
              <Text style={styles.loadingText}>Analyzing activity...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchExplanations}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {explanations && Object.keys(explanations).length > 0 && (
            <View style={styles.explanationsContainer}>
              {Object.entries(explanations).map(([childId, explanation]) =>
                renderExplanation(childId, explanation)
              )}
            </View>
          )}

          {/* AI badge */}
          <View style={styles.aiBadge}>
            <Icon name="sparkles" size={12} color="#6B7280" />
            <Text style={styles.aiBadgeText}>AI-generated explanation</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    marginTop: 35, // Space for robot overflow
  },
  headerWrapper: {
    position: 'relative',
    zIndex: 1,
  },
  header: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    paddingRight: 95, // Space for robot image
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  robotImageOverlay: {
    position: 'absolute',
    right: -10,
    top: -40,
    width: 110,
    height: 110,
    resizeMode: 'contain',
    zIndex: 10,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E5E7EB',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
  },
  retryText: {
    fontSize: 14,
    color: '#E8638B',
    fontWeight: '600',
    marginLeft: 8,
  },
  explanationsContainer: {
    gap: 12,
  },
  explanationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  explanationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  childName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: -2,
  },
  summaryText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
  },
  benefitsContainer: {
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitCategory: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  ageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  ageText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  compactWrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  compactButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  compactGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 50, // Space for robot
    gap: 6,
  },
  compactButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  compactRobotImage: {
    position: 'absolute',
    right: -5,
    top: -15,
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
});

export default ActivityExplanation;
