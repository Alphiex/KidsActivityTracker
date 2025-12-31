/**
 * AuthSlice Tests
 * Tests for authentication Redux slice
 */
import authReducer, {
  login,
  logout,
  setUser,
  setToken,
  setLoading,
  setError,
  clearError,
} from '../../../../src/store/authSlice';

describe('AuthSlice', () => {
  const initialState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };

  describe('reducers', () => {
    it('should return initial state', () => {
      const result = authReducer(undefined, { type: 'unknown' });

      expect(result.user).toBeNull();
      expect(result.isAuthenticated).toBe(false);
    });

    it('should handle setUser', () => {
      const user = { id: '1', email: 'test@example.com', name: 'Test User' };
      const result = authReducer(initialState, setUser(user));

      expect(result.user).toEqual(user);
    });

    it('should handle setToken', () => {
      const result = authReducer(initialState, setToken('test-token'));

      expect(result.token).toBe('test-token');
    });

    it('should handle setLoading', () => {
      const result = authReducer(initialState, setLoading(true));

      expect(result.isLoading).toBe(true);
    });

    it('should handle setError', () => {
      const result = authReducer(initialState, setError('Login failed'));

      expect(result.error).toBe('Login failed');
    });

    it('should handle clearError', () => {
      const stateWithError = { ...initialState, error: 'Some error' };
      const result = authReducer(stateWithError, clearError());

      expect(result.error).toBeNull();
    });
  });

  describe('async thunks', () => {
    describe('login', () => {
      it('should set loading on pending', () => {
        const action = { type: login.pending.type };
        const result = authReducer(initialState, action);

        expect(result.isLoading).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should set user and token on fulfilled', () => {
        const payload = {
          user: { id: '1', email: 'test@example.com' },
          token: 'mock-token',
        };
        const action = { type: login.fulfilled.type, payload };
        const result = authReducer(initialState, action);

        expect(result.user).toEqual(payload.user);
        expect(result.token).toBe('mock-token');
        expect(result.isAuthenticated).toBe(true);
        expect(result.isLoading).toBe(false);
      });

      it('should set error on rejected', () => {
        const action = {
          type: login.rejected.type,
          payload: 'Invalid credentials',
        };
        const result = authReducer(initialState, action);

        expect(result.error).toBe('Invalid credentials');
        expect(result.isLoading).toBe(false);
        expect(result.isAuthenticated).toBe(false);
      });
    });

    describe('logout', () => {
      it('should clear auth state on fulfilled', () => {
        const authenticatedState = {
          user: { id: '1', email: 'test@example.com' },
          token: 'mock-token',
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };

        const action = { type: logout.fulfilled.type };
        const result = authReducer(authenticatedState, action);

        expect(result.user).toBeNull();
        expect(result.token).toBeNull();
        expect(result.isAuthenticated).toBe(false);
      });
    });
  });

  describe('selectors', () => {
    const state = {
      auth: {
        user: { id: '1', email: 'test@example.com' },
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
    };

    it('should select isAuthenticated', () => {
      expect(state.auth.isAuthenticated).toBe(true);
    });

    it('should select user', () => {
      expect(state.auth.user?.email).toBe('test@example.com');
    });

    it('should select loading state', () => {
      expect(state.auth.isLoading).toBe(false);
    });

    it('should select error', () => {
      expect(state.auth.error).toBeNull();
    });
  });
});
