import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatMessage } from '../../services/aiService';

interface ChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  turnsRemaining: number | null;
  // Store activity IDs from the last response for "View All" functionality
  lastActivityIds: string[];
}

const initialState: ChatState = {
  messages: [],
  conversationId: null,
  turnsRemaining: null,
  lastActivityIds: [],
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
      // Extract activity IDs from assistant messages
      if (action.payload.role === 'assistant' && action.payload.activities) {
        state.lastActivityIds = action.payload.activities
          .map((a: any) => a.id)
          .filter((id: string | undefined) => id);
      }
    },
    setMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.messages = action.payload;
    },
    setConversationId: (state, action: PayloadAction<string | null>) => {
      state.conversationId = action.payload;
    },
    setTurnsRemaining: (state, action: PayloadAction<number | null>) => {
      state.turnsRemaining = action.payload;
    },
    setLastActivityIds: (state, action: PayloadAction<string[]>) => {
      state.lastActivityIds = action.payload;
    },
    clearChat: (state) => {
      state.messages = [];
      state.conversationId = null;
      state.turnsRemaining = null;
      state.lastActivityIds = [];
    },
  },
});

export const {
  addMessage,
  setMessages,
  setConversationId,
  setTurnsRemaining,
  setLastActivityIds,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
