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
import { useAppSelector } from '../store';
import PreferencesService from '../services/preferencesService';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';
import { aiRobotImage } from '../assets/images';

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
 * Generate personalized prompts based on user data
 */
const generatePersonalizedPrompts = (
  children: Array<{ name: string; dateOfBirth: string }>,
  locationName: string | undefined,
  favoriteTypes: string[]
): string[] => {
  const prompts: string[] = [];

  // Get children's ages
  const childrenAges = children.map(c => ({
    name: c.name,
    age: calculateAge(c.dateOfBirth)
  }));

  // Location-based prompts
  const locationPrefix = locationName ? `in ${locationName}` : 'near me';

  // Age-specific prompts based on children
  if (childrenAges.length > 0) {
    const youngestChild = childrenAges.reduce((min, c) => c.age < min.age ? c : min, childrenAges[0]);
    const oldestChild = childrenAges.reduce((max, c) => c.age > max.age ? c : max, childrenAges[0]);

    if (youngestChild.age <= 3) {
      prompts.push(`What toddler activities are available ${locationPrefix}?`);
    } else if (youngestChild.age <= 6) {
      prompts.push(`What activities are good for preschoolers ${locationPrefix}?`);
    } else if (youngestChild.age <= 12) {
      prompts.push(`Find activities for kids ages ${youngestChild.age}-${oldestChild.age} ${locationPrefix}`);
    } else {
      prompts.push(`What teen activities are available ${locationPrefix}?`);
    }

    // Child name specific prompt
    if (childrenAges.length === 1) {
      prompts.push(`What weekend activities would ${childrenAges[0].name} enjoy?`);
    } else {
      prompts.push(`Find activities all my kids can do together`);
    }
  } else {
    // Default if no children
    prompts.push(`What kids activities are available ${locationPrefix}?`);
    prompts.push(`Find weekend activities for families ${locationPrefix}`);
  }

  // Favorite activity type prompts
  if (favoriteTypes.length > 0) {
    const topType = favoriteTypes[0];
    prompts.push(`Find more ${topType.toLowerCase()} classes ${locationPrefix}`);
  } else {
    prompts.push(`What's new this week ${locationPrefix}?`);
  }

  // General helpful prompt
  prompts.push(`What activities have spots available this month?`);

  return prompts.slice(0, 4); // Limit to 4 prompts
};

/**
 * AI Chat Screen
 *
 * Conversational AI assistant for finding kids activities
 */
const AIChatScreen = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Get children from Redux store
  const children = useAppSelector((state) => state.children?.children || []);

  // Get user preferences for personalized prompts
  const preferencesService = PreferencesService.getInstance();
  const preferences = preferencesService.getPreferences();

  // Generate personalized prompts based on user data
  const suggestedPrompts = useMemo(() => {
    const locationName = preferences.savedAddress?.city ||
                         (preferences.locationIds?.[0] ? undefined : undefined);
    const favoriteTypes = preferences.preferredActivityTypes || [];
    return generatePersonalizedPrompts(children, locationName, favoriteTypes);
  }, [children, preferences]);

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [quota, setQuota] = useState<ChatQuota | null>(null);
  const [turnsRemaining, setTurnsRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await aiService.chat(
        text.trim(),
        conversationId || undefined,
        children.map((c) => c.id)
      );

      setConversationId(response.conversationId);
      setTurnsRemaining(response.turnsRemaining);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        activities: response.activities,
        followUpPrompts: response.followUpPrompts,
        blocked: response.blocked,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update quota
      if (response.quota) {
        setQuota((prev) => prev ? { ...prev, daily: response.quota.daily, monthly: response.quota.monthly } : null);
      }
    } catch (err: any) {
      console.error('[AIChatScreen] Chat error:', err.message);
      // Show error briefly, then auto-clear
      setError(err.message || 'Failed to get response');
      setTimeout(() => setError(null), 5000);
      // Keep user message but add error indicator
      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === 'user') {
            // Add assistant error response
            updated.push({
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: "I couldn't process that request. Please try again.",
              timestamp: new Date(),
            });
          }
        }
        return updated;
      });
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

  const startNewConversation = () => {
    if (conversationId) {
      aiService.endConversation(conversationId);
    }
    setMessages([]);
    setConversationId(null);
    setTurnsRemaining(null);
    setError(null);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

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
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.content}
          </Text>

          {/* Activity Cards */}
          {item.activities && item.activities.length > 0 && (
            <View style={styles.activitiesContainer}>
              <Text style={styles.activitiesLabel}>
                Found {item.activities.length} activities:
              </Text>
              {item.activities.slice(0, 3).map((activity, index) => (
                <TouchableOpacity
                  key={activity.id || index}
                  style={styles.activityCard}
                  onPress={() => handleActivityPress(activity)}
                >
                  <Text style={styles.activityName} numberOfLines={1}>
                    {activity.name}
                  </Text>
                  <Text style={styles.activityMeta} numberOfLines={1}>
                    {activity.provider?.name} {activity.cost ? `• $${activity.cost}` : ''}
                  </Text>
                  <Icon name="chevron-right" size={16} color="#999" style={styles.activityChevron} />
                </TouchableOpacity>
              ))}
              {item.activities.length > 3 && (
                <Text style={styles.moreActivities}>
                  +{item.activities.length - 3} more activities
                </Text>
              )}
            </View>
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
            {turnsRemaining !== null && (
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

        {/* Quota Warning */}
        {quota && !quota.allowed && quota.message && (
          <View style={styles.quotaWarning}>
            <Icon name="alert-circle" size={16} color="#FFF" />
            <Text style={styles.quotaWarningText}>
              {quota.message}
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle" size={16} color="#FFF" />
            <Text style={styles.errorText}>{error}</Text>
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
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about activities..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              editable={!isLoading && (quota?.allowed !== false)}
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
  errorText: {
    color: '#FFF',
    fontSize: 13,
    flex: 1,
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
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  activitiesLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  activityName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  activityMeta: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  activityChevron: {
    marginLeft: 4,
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
