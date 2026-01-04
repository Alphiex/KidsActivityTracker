import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import aiService, { ChatMessage, ChatQuota } from '../services/aiService';
import { useAppSelector, useAppDispatch } from '../store';
import {
  addMessage,
  setMessages,
  setConversationId,
  setTurnsRemaining as setTurnsRemainingAction,
  setLastActivityIds,
  clearChat,
} from '../store/slices/chatSlice';
import {
  selectAllChildren,
  selectSelectedChildIds,
  selectFilterMode,
  fetchChildren,
} from '../store/slices/childrenSlice';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';
import { ActivityCardCompact } from '../components/ActivityCardCompact';
import { useTheme } from '../contexts/ThemeContext';
import { aiRobotImage } from '../assets/images';
import useSubscription from '../hooks/useSubscription';

/**
 * Calculate age from date of birth string
 */
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Extract activity IDs from text content using [activity:UUID] pattern
 */
const extractActivityIdsFromText = (text: string): string[] => {
  const pattern = /\[activity:([a-f0-9-]+)\]/gi;
  const ids: string[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
};

/**
 * Generate personalized prompts based on children's data and preferences
 */
const generatePersonalizedPrompts = (
  children: Array<{ name: string; dateOfBirth: string; preferences?: { preferredActivityTypes?: string[] } }>,
  locationName: string | undefined,
  _favoriteTypes: string[]
): string[] => {
  const prompts: string[] = [];

  // Get children's data with ages and preferences
  const childrenData = children.map(c => ({
    name: c.name,
    age: calculateAge(c.dateOfBirth),
    activityTypes: c.preferences?.preferredActivityTypes || []
  }));

  // Location-based suffix
  const locationSuffix = locationName ? ` in ${locationName}` : '';

  if (childrenData.length === 0) {
    // Default prompts if no children
    return [
      `What kids activities are available${locationSuffix}?`,
      `Find weekend activities for families`,
      `What's new this week near me?`,
      `What activities have spots available?`
    ];
  }

  // Single child - personalized prompts using their name and preferences
  if (childrenData.length === 1) {
    const child = childrenData[0];

    // Activity type prompt if they have preferences
    if (child.activityTypes.length > 0) {
      const activityType = child.activityTypes[0].toLowerCase();
      prompts.push(`Find ${activityType} classes for ${child.name}${locationSuffix}`);
    } else {
      prompts.push(`What activities would ${child.name} enjoy?`);
    }

    // Age-appropriate prompt
    if (child.age <= 3) {
      prompts.push(`Find toddler programs for ${child.name}`);
    } else if (child.age <= 6) {
      prompts.push(`What preschool activities are good for ${child.name}?`);
    } else {
      prompts.push(`Find weekend activities for ${child.name}`);
    }

    // Time-based prompt
    prompts.push(`What's available for ${child.name} this week?`);

    // Availability prompt
    prompts.push(`Find activities with spots open for ${child.name}`);
  }
  // Multiple children - mix of individual and group prompts
  else {
    const childNames = childrenData.map(c => c.name);
    const firstChild = childrenData[0];
    const secondChild = childrenData[1];

    // Sibling activity prompt
    if (childrenData.length === 2) {
      prompts.push(`Find activities ${childNames[0]} and ${childNames[1]} can do together`);
    } else {
      prompts.push(`Find activities all my kids can do together`);
    }

    // Individual child prompt with their preference
    if (firstChild.activityTypes.length > 0) {
      const activityType = firstChild.activityTypes[0].toLowerCase();
      prompts.push(`Find ${activityType} for ${firstChild.name}${locationSuffix}`);
    } else {
      prompts.push(`What would ${firstChild.name} enjoy this weekend?`);
    }

    // Second child prompt
    if (secondChild.activityTypes.length > 0) {
      const activityType = secondChild.activityTypes[0].toLowerCase();
      prompts.push(`Find ${activityType} classes for ${secondChild.name}`);
    } else {
      prompts.push(`What activities are good for ${secondChild.name}?`);
    }

    // Availability prompt
    prompts.push(`What has spots available for my kids?`);
  }

  return prompts.slice(0, 4); // Limit to 4 prompts
};

/**
 * Render message text with tappable activity links
 * Parses [activity:UUID] patterns and makes them tappable
 */
interface ParsedTextProps {
  content: string;
  style: any;
  onActivityPress: (activityId: string) => void;
}

const ParsedMessageText: React.FC<ParsedTextProps> = ({ content, style, onActivityPress }) => {
  // Pattern to match [activity:UUID] - we'll remove these from display
  // and make the preceding **Activity Name** clickable
  const activityLinkPattern = /\*\*([^*]+)\*\*\s*\[activity:([a-f0-9-]+)\]/gi;

  // Split content into parts - text and activity links
  const parts: Array<{ type: 'text' | 'activityLink'; content: string; activityId?: string }> = [];
  let lastIndex = 0;
  let match;

  // Reset regex
  activityLinkPattern.lastIndex = 0;

  while ((match = activityLinkPattern.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
    }

    // Add the activity link (activity name becomes tappable, UUID is hidden)
    parts.push({
      type: 'activityLink',
      content: match[1], // Activity name
      activityId: match[2], // UUID
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.substring(lastIndex) });
  }

  // If no activity links found, just render plain text
  if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
    return <Text style={style}>{content}</Text>;
  }

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.type === 'activityLink' && part.activityId) {
          return (
            <Text
              key={index}
              style={[{ fontWeight: '700', color: '#E8638B', textDecorationLine: 'underline' }]}
              onPress={() => onActivityPress(part.activityId!)}
            >
              {part.content}
            </Text>
          );
        }
        return <Text key={index}>{part.content}</Text>;
      })}
    </Text>
  );
};

/**
 * AI Chat Screen
 *
 * Conversational AI assistant for finding kids activities
 */
const AIChatScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const dispatch = useAppDispatch();

  // Ensure children are loaded into Redux on mount
  useEffect(() => {
    dispatch(fetchChildren());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get children and filter state from Redux store
  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const filterMode = useAppSelector(selectFilterMode);

  // Use selected children IDs or all children if none selected
  const effectiveChildIds = useMemo(() => {
    if (selectedChildIds?.length > 0) return selectedChildIds;
    return children.map(c => c.id);
  }, [children, selectedChildIds]);

  // Generate personalized prompts based on child data
  const suggestedPrompts = useMemo(() => {
    // Get location from first child's saved address (child preferences)
    const selectedChild = children.find(c => selectedChildIds.includes(c.id)) || children[0];
    const childAddr = selectedChild?.preferences?.savedAddress as any;
    const locationName = childAddr?.city || childAddr?.locality;
    // Activity types come from child.preferences inside generatePersonalizedPrompts
    return generatePersonalizedPrompts(children, locationName, []);
  }, [children, selectedChildIds]);

  // Subscription
  const { isPremium, openPaywall } = useSubscription();

  // Redux persisted state
  const messages = useAppSelector((state) => state.chat.messages);
  const conversationId = useAppSelector((state) => state.chat.conversationId);
  const turnsRemaining = useAppSelector((state) => state.chat.turnsRemaining);
  const lastActivityIds = useAppSelector((state) => state.chat.lastActivityIds);

  // Local state (doesn't need persistence)
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quota, setQuota] = useState<ChatQuota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Animation for typing indicator
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Fetch quota on mount with retry for auth timing
  useEffect(() => {
    // Small delay to let Firebase auth initialize
    const timer = setTimeout(() => {
      fetchQuota();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate typing indicator
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const fetchQuota = async (retryCount = 0) => {
    try {
      const q = await aiService.getChatQuota();
      setQuota(q);
    } catch (err) {
      console.log('[AIChatScreen] Error fetching quota:', err);
      // Retry once after a delay if first attempt fails
      if (retryCount < 1) {
        setTimeout(() => fetchQuota(retryCount + 1), 1500);
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    dispatch(addMessage(userMessage));
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await aiService.chat(
        text.trim(),
        conversationId || undefined,
        effectiveChildIds,
        filterMode
      );

      dispatch(setConversationId(response.conversationId));
      dispatch(setTurnsRemainingAction(response.turnsRemaining));

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        activities: response.activities,
        followUpPrompts: response.followUpPrompts,
        blocked: response.blocked,
      };

      dispatch(addMessage(assistantMessage));

      // Store activity IDs for "View All" functionality
      if (response.activities && response.activities.length > 0) {
        const activityIds = response.activities
          .map((a: any) => a.id)
          .filter((id: string) => id);
        dispatch(setLastActivityIds(activityIds));
      }

      // Update quota
      if (response.quota) {
        setQuota((prev) => prev ? { ...prev, daily: response.quota.daily, monthly: response.quota.monthly } : null);
      }
    } catch (err: any) {
      console.error('[AIChatScreen] Chat error:', err.message);
      const errorMessage = err.message || 'Failed to get response';

      // Check if rate limited
      if (errorMessage.toLowerCase().includes('rate limit') || err?.response?.status === 429) {
        setIsRateLimited(true);
        setError('You\'ve reached your message limit. Upgrade to Premium for unlimited access.');
      } else {
        setError(errorMessage);
        setTimeout(() => setError(null), 5000);
      }
      // Add assistant error response
      const errorAssistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I couldn't process that request. Please try again.",
        timestamp: new Date(),
      };
      dispatch(addMessage(errorAssistantMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleActivityPress = (activity: any) => {
    navigation.navigate('ActivityDetail' as never, { activity } as never);
  };

  // Handle tapping an activity ID from the parsed text
  const handleActivityIdPress = (activityId: string) => {
    // Navigate to activity detail with just the ID - the screen will fetch details
    navigation.navigate('ActivityDetail' as never, { activityId } as never);
  };

  const startNewConversation = () => {
    if (conversationId) {
      aiService.endConversation(conversationId);
    }
    dispatch(clearChat());
    setError(null);
  };

  // Handle "View All" activities - navigate to results screen with activity IDs
  const handleViewAllActivities = (activityIds: string[]) => {
    if (activityIds.length > 0) {
      navigation.navigate('UnifiedResults' as never, {
        activityIds,
        title: 'AI Recommendations',
        fromScreen: 'AIChat',
      } as never);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const hasActivities = item.activities && item.activities.length > 0;

    // Extract activity IDs mentioned in text (for View All fallback)
    const textActivityIds = item.content ? extractActivityIdsFromText(item.content) : [];
    const hasTextActivityIds = textActivityIds.length > 0;

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.assistantMessageContainer]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Image source={aiRobotImage} style={styles.avatarImage} />
            </View>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            item.blocked && styles.blockedBubble,
          ]}
        >
          {/* Activity Cards - Show ABOVE text for better UX */}
          {hasActivities && (
            <View style={styles.activitiesContainer}>
              <View style={styles.activitiesHeader}>
                <Text style={styles.activitiesLabel}>
                  Found {item.activities!.length} {item.activities!.length === 1 ? 'activity' : 'activities'}
                </Text>
                {item.activities!.length > 1 && (
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => handleViewAllActivities(item.activities!.map((a: any) => a.id).filter(Boolean))}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Icon name="arrow-right" size={14} color="#E8638B" />
                  </TouchableOpacity>
                )}
              </View>
              {item.activities!.slice(0, 3).map((activity: any, index: number) => (
                <ActivityCardCompact
                  key={activity.id || index}
                  activity={activity}
                  onPress={() => handleActivityPress(activity)}
                />
              ))}
              {item.activities!.length > 3 && (
                <TouchableOpacity
                  style={styles.viewMoreButton}
                  onPress={() => handleViewAllActivities(item.activities!.map((a: any) => a.id).filter(Boolean))}
                >
                  <Text style={styles.viewMoreText}>
                    View {item.activities!.length - 3} more activities
                  </Text>
                  <Icon name="chevron-right" size={16} color="#E8638B" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Show View All button for text-mentioned activities when no cards */}
          {!hasActivities && hasTextActivityIds && !isUser && (
            <TouchableOpacity
              style={styles.textActivityViewAllButton}
              onPress={() => handleViewAllActivities(textActivityIds)}
            >
              <Text style={styles.textActivityViewAllText}>
                View all {textActivityIds.length} recommended activities
              </Text>
              <Icon name="chevron-right" size={16} color="#E8638B" />
            </TouchableOpacity>
          )}

          {/* AI Response Text - Show BELOW activities */}
          {item.content && (
            isUser ? (
              <Text style={[styles.messageText, styles.userMessageText]}>
                {item.content}
              </Text>
            ) : (
              <ParsedMessageText
                content={item.content}
                style={[
                  styles.messageText,
                  hasActivities && styles.aiResponseText,
                ]}
                onActivityPress={handleActivityIdPress}
              />
            )
          )}

          {/* Follow-up Prompts */}
          {item.followUpPrompts && item.followUpPrompts.length > 0 && (
            <View style={styles.followUpContainer}>
              {item.followUpPrompts.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.followUpButton}
                  onPress={() => handleSuggestedPrompt(prompt)}
                >
                  <Text style={styles.followUpText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyAvatarContainer}>
        <Image source={aiRobotImage} style={styles.emptyAvatar} />
      </View>
      <Text style={styles.emptyTitle}>Hi! I'm your Activity Assistant</Text>
      <Text style={styles.emptySubtitle}>
        Ask me anything about finding activities for your kids. I can help with recommendations,
        schedules, and more!
      </Text>
      <View style={styles.suggestedPromptsContainer}>
        <Text style={styles.suggestedLabel}>Try asking:</Text>
        {suggestedPrompts.map((prompt, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestedPrompt}
            onPress={() => handleSuggestedPrompt(prompt)}
          >
            <Icon name="lightbulb-outline" size={16} color="#E8638B" />
            <Text style={styles.suggestedPromptText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTypingIndicator = () => {
    if (!isLoading) return null;

    return (
      <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Image source={aiRobotImage} style={styles.avatarImage} />
          </View>
        </View>
        <Animated.View style={[styles.typingBubble, { opacity: typingAnim }]}>
          <Text style={styles.typingText}>Thinking...</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Tab Navigation */}
        <TopTabNavigation />

        {/* Sub-header with turns and new chat */}
        <View style={styles.subHeader}>
          <View style={styles.subHeaderLeft}>
            {/* Only show turns remaining for non-premium users */}
            {!isPremium && turnsRemaining !== null && (
              <Text style={styles.turnsText}>{turnsRemaining} turns remaining</Text>
            )}
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={startNewConversation} style={styles.newChatButton}>
              <Icon name="plus" size={18} color="#E8638B" />
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quota Warning - only for non-premium users */}
        {!isPremium && quota && !quota.allowed && quota.message && (
          <View style={styles.quotaWarning}>
            <Icon name="alert-circle" size={16} color="#FFF" />
            <Text style={styles.quotaWarningText}>
              {quota.message}
            </Text>
          </View>
        )}

        {/* Error / Rate Limit Banner */}
        {error && (
          <View style={[styles.errorBanner, isRateLimited && styles.rateLimitBanner]}>
            <View style={styles.errorContent}>
              <Icon name={isRateLimited ? 'crown' : 'alert-circle'} size={16} color="#FFF" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            {isRateLimited && !isPremium && (
              <TouchableOpacity
                style={styles.upgradeSmallButton}
                onPress={() => {
                  setError(null);
                  setIsRateLimited(false);
                  openPaywall();
                }}
              >
                <Text style={styles.upgradeSmallButtonText}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messagesList,
              messages.length === 0 && styles.emptyList,
            ]}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderTypingIndicator}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: true });
              }
            }}
          />

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about activities..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              editable={!isLoading && (quota?.allowed !== false)}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              selectionColor={colors.primary}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Icon name="send" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  subHeaderLeft: {
    flex: 1,
  },
  turnsText: {
    fontSize: 12,
    color: '#666',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  newChatText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E8638B',
  },
  quotaWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quotaWarningText: {
    color: '#FFF',
    fontSize: 13,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  rateLimitBanner: {
    backgroundColor: '#E8638B',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  errorText: {
    color: '#FFF',
    fontSize: 13,
    flex: 1,
  },
  upgradeSmallButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  upgradeSmallButtonText: {
    color: '#E8638B',
    fontSize: 13,
    fontWeight: '600',
  },
  messagesList: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#E8638B',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  blockedBubble: {
    backgroundColor: '#FEF3C7',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFF',
  },
  activitiesContainer: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activitiesLabel: {
    fontSize: 12,
    color: '#666',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    color: '#E8638B',
    fontWeight: '500',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  activityCardContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  activityLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  activityLocation: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  activityDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  activityDates: {
    fontSize: 11,
    color: '#888',
    flex: 1,
  },
  activityDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  activityDaysText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E8638B',
    flex: 1,
  },
  activityBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  costBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
  },
  costBadgeFree: {
    backgroundColor: '#DCFCE7',
  },
  costText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  costTextFree: {
    color: '#166534',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
  },
  statusOpen: {
    backgroundColor: '#DCFCE7',
  },
  statusWaitlist: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  statusTextOpen: {
    color: '#166534',
  },
  statusTextWaitlist: {
    color: '#92400E',
  },
  spotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  spotsText: {
    fontSize: 10,
    color: '#6B7280',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
  },
  distanceText: {
    fontSize: 10,
    color: '#4F46E5',
  },
  aiResponseText: {
    marginTop: 0,
    fontSize: 14,
    color: '#555',
  },
  activityChevron: {
    marginLeft: 8,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  viewMoreText: {
    fontSize: 13,
    color: '#E8638B',
    fontWeight: '500',
  },
  textActivityViewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5F7',
    borderRadius: 8,
    marginBottom: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  textActivityViewAllText: {
    fontSize: 13,
    color: '#E8638B',
    fontWeight: '500',
  },
  moreActivities: {
    fontSize: 12,
    color: '#E8638B',
    textAlign: 'center',
    marginTop: 4,
  },
  followUpContainer: {
    marginTop: 12,
    gap: 6,
  },
  followUpButton: {
    backgroundColor: '#FFF5F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  followUpText: {
    fontSize: 13,
    color: '#E8638B',
  },
  typingBubble: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  typingText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyAvatarContainer: {
    width: 65,
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyAvatar: {
    width: 65,
    height: 65,
    resizeMode: 'contain',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  suggestedPromptsContainer: {
    width: '100%',
  },
  suggestedLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  suggestedPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestedPromptText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 48,
    fontSize: 15,
    maxHeight: 100,
    color: '#333',
  },
  sendButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8638B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
});

export default AIChatScreen;
