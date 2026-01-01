import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import aiService, { ChatMessage, ChatResponse, ChatQuota } from '../services/aiService';
import { useAppSelector } from '../store';
import ActivityCard from '../components/ActivityCard';

const { width } = Dimensions.get('window');

// Suggested prompts for new conversations
const SUGGESTED_PROMPTS = [
  "What activities are good for my kids this weekend?",
  "Find swimming lessons near me",
  "What's new for toddlers?",
  "Outdoor activities for the whole family",
];

/**
 * AI Chat Screen
 *
 * Conversational AI assistant for finding kids activities
 */
const AIChatScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Get children from Redux store
  const children = useAppSelector((state) => state.children?.children || []);

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

  // Fetch quota on mount
  useEffect(() => {
    fetchQuota();
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
  }, [isLoading]);

  const fetchQuota = async () => {
    try {
      const q = await aiService.getChatQuota();
      setQuota(q);
    } catch (err) {
      console.log('[AIChatScreen] Error fetching quota:', err);
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
      setError(err.message || 'Failed to get response');
      // Remove the user message if there was an error
      setMessages((prev) => prev.slice(0, -1));
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
            <LinearGradient
              colors={['#FFB5C5', '#E8638B']}
              style={styles.avatar}
            >
              <Icon name="robot" size={20} color="#FFF" />
            </LinearGradient>
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
      <LinearGradient
        colors={['#FFB5C5', '#E8638B']}
        style={styles.emptyAvatar}
      >
        <Icon name="robot" size={40} color="#FFF" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>Hi! I'm your Activity Assistant</Text>
      <Text style={styles.emptySubtitle}>
        Ask me anything about finding activities for your kids. I can help with recommendations,
        schedules, and more!
      </Text>
      <View style={styles.suggestedPromptsContainer}>
        <Text style={styles.suggestedLabel}>Try asking:</Text>
        {SUGGESTED_PROMPTS.map((prompt, index) => (
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
          <LinearGradient
            colors={['#FFB5C5', '#E8638B']}
            style={styles.avatar}
          >
            <Icon name="robot" size={20} color="#FFF" />
          </LinearGradient>
        </View>
        <Animated.View style={[styles.typingBubble, { opacity: typingAnim }]}>
          <Text style={styles.typingText}>Thinking...</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          {turnsRemaining !== null && (
            <Text style={styles.turnsText}>{turnsRemaining} turns left</Text>
          )}
        </View>
        <TouchableOpacity onPress={startNewConversation} style={styles.newChatButton}>
          <Icon name="plus" size={24} color="#E8638B" />
        </TouchableOpacity>
      </View>

      {/* Quota Warning */}
      {quota && !quota.allowed && (
        <View style={styles.quotaWarning}>
          <Icon name="alert-circle" size={16} color="#FFF" />
          <Text style={styles.quotaWarningText}>
            {quota.message || 'Daily limit reached. Upgrade to Pro for unlimited access!'}
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  turnsText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  newChatButton: {
    padding: 4,
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
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
