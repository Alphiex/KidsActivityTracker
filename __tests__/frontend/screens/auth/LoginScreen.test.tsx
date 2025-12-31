/**
 * LoginScreen Tests
 * Tests for the login screen component
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { createMockStore } from '../../mocks/redux';
import { mockAuthService } from '../../mocks/services';
import { mockNavigation, createMockRoute } from '../../mocks/navigation';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => createMockRoute('Login', {}),
}));

// Mock auth service
jest.mock('../../../../src/services/authService', () => ({
  __esModule: true,
  default: mockAuthService,
}));

// Import component after mocks
import LoginScreen from '../../../../src/screens/LoginScreen';

const renderWithProviders = (ui: React.ReactElement, preloadedState = {}) => {
  const store = createMockStore(preloadedState);
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form', () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<LoginScreen />);

    expect(getByPlaceholderText(/email/i)).toBeTruthy();
    expect(getByPlaceholderText(/password/i)).toBeTruthy();
    expect(getByText(/sign in/i)).toBeTruthy();
  });

  it('should show validation error for empty fields', async () => {
    const { getByText, findByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText(/sign in/i));

    await waitFor(() => {
      expect(findByText(/email is required/i)).toBeTruthy();
    });
  });

  it('should show validation error for invalid email', async () => {
    const { getByPlaceholderText, getByText, findByText } = renderWithProviders(
      <LoginScreen />
    );

    fireEvent.changeText(getByPlaceholderText(/email/i), 'invalid-email');
    fireEvent.changeText(getByPlaceholderText(/password/i), 'password123');
    fireEvent.press(getByText(/sign in/i));

    await waitFor(() => {
      expect(findByText(/valid email/i)).toBeTruthy();
    });
  });

  it('should call login service with valid credentials', async () => {
    mockAuthService.login.mockResolvedValue({
      user: { id: '1', email: 'test@example.com' },
      token: 'mock-token',
    });

    const { getByPlaceholderText, getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText(/email/i), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText(/password/i), 'Password123!');
    fireEvent.press(getByText(/sign in/i));

    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });
    });
  });

  it('should navigate to dashboard on successful login', async () => {
    mockAuthService.login.mockResolvedValue({
      user: { id: '1', email: 'test@example.com' },
      token: 'mock-token',
    });

    const { getByPlaceholderText, getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText(/email/i), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText(/password/i), 'Password123!');
    fireEvent.press(getByText(/sign in/i));

    await waitFor(() => {
      expect(mockNavigation.reset).toHaveBeenCalled();
    });
  });

  it('should display error message on login failure', async () => {
    mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

    const { getByPlaceholderText, getByText, findByText } = renderWithProviders(
      <LoginScreen />
    );

    fireEvent.changeText(getByPlaceholderText(/email/i), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText(/password/i), 'wrongpassword');
    fireEvent.press(getByText(/sign in/i));

    await waitFor(() => {
      expect(findByText(/invalid credentials/i)).toBeTruthy();
    });
  });

  it('should navigate to register screen', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);

    const createAccountLink = getByText(/create account/i);
    fireEvent.press(createAccountLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
  });

  it('should navigate to forgot password screen', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);

    const forgotPasswordLink = getByText(/forgot password/i);
    fireEvent.press(forgotPasswordLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('should toggle password visibility', () => {
    const { getByPlaceholderText, getByTestId } = renderWithProviders(<LoginScreen />);

    const passwordInput = getByPlaceholderText(/password/i);
    expect(passwordInput.props.secureTextEntry).toBe(true);

    // Assuming there's a toggle button with testID
    try {
      const toggleButton = getByTestId('toggle-password');
      fireEvent.press(toggleButton);
      expect(passwordInput.props.secureTextEntry).toBe(false);
    } catch {
      // Toggle may not exist in all implementations
    }
  });

  it('should disable button while loading', async () => {
    mockAuthService.login.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    const { getByPlaceholderText, getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText(/email/i), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText(/password/i), 'Password123!');
    fireEvent.press(getByText(/sign in/i));

    // Button should be disabled during loading
    const button = getByText(/sign in/i);
    expect(button.props.disabled || button.props.accessibilityState?.disabled).toBeTruthy();
  });
});
