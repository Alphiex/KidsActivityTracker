/**
 * Auth E2E Tests
 * End-to-end tests for authentication flows
 */
import { device, element, by, expect, waitFor } from 'detox';
import {
  login,
  logout,
  waitForElement,
  typeText,
  tapElement,
  TIMEOUT,
} from '../utils/testHelpers';
import { AUTH, DASHBOARD } from '../utils/testIds';

describe('Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Login', () => {
    it('should display login screen on app launch', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await expect(element(by.id(AUTH.EMAIL_INPUT))).toBeVisible();
      await expect(element(by.id(AUTH.PASSWORD_INPUT))).toBeVisible();
      await expect(element(by.id(AUTH.LOGIN_BUTTON))).toBeVisible();
    });

    it('should show validation error for empty email', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await tapElement(AUTH.LOGIN_BUTTON);

      await expect(element(by.text('Email is required'))).toBeVisible();
    });

    it('should show validation error for invalid email format', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await typeText(AUTH.EMAIL_INPUT, 'invalid-email');
      await typeText(AUTH.PASSWORD_INPUT, 'password123');
      await tapElement(AUTH.LOGIN_BUTTON);

      await expect(element(by.text('Please enter a valid email'))).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await typeText(AUTH.EMAIL_INPUT, 'wrong@example.com');
      await typeText(AUTH.PASSWORD_INPUT, 'wrongpassword');
      await tapElement(AUTH.LOGIN_BUTTON);

      await waitFor(element(by.id(AUTH.LOGIN_ERROR)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should login successfully with valid credentials', async () => {
      await login('demo@kidsactivity.com', 'DemoUser123!');

      await waitFor(element(by.id(DASHBOARD.SCREEN)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);

      await expect(element(by.id(DASHBOARD.WELCOME_MESSAGE))).toBeVisible();
    });

    it('should persist login session after app restart', async () => {
      await login('demo@kidsactivity.com', 'DemoUser123!');
      await waitForElement(DASHBOARD.SCREEN);

      // Restart app
      await device.launchApp({ newInstance: false });

      // Should still be logged in
      await expect(element(by.id(DASHBOARD.SCREEN))).toBeVisible();
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      await login('demo@kidsactivity.com', 'DemoUser123!');
      await waitForElement(DASHBOARD.SCREEN);
    });

    it('should logout and return to login screen', async () => {
      await logout();

      await expect(element(by.id(AUTH.LOGIN_SCREEN))).toBeVisible();
    });
  });

  describe('Registration', () => {
    it('should navigate to registration screen', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await tapElement(AUTH.CREATE_ACCOUNT_LINK);

      await expect(element(by.id(AUTH.REGISTER_SCREEN))).toBeVisible();
    });

    it('should show validation errors for empty form', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await tapElement(AUTH.CREATE_ACCOUNT_LINK);
      await waitForElement(AUTH.REGISTER_SCREEN);

      await tapElement(AUTH.REGISTER_BUTTON);

      await expect(element(by.text('Name is required'))).toBeVisible();
    });

    it('should navigate back to login', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await tapElement(AUTH.CREATE_ACCOUNT_LINK);
      await waitForElement(AUTH.REGISTER_SCREEN);

      await tapElement(AUTH.BACK_TO_LOGIN_BUTTON);

      await expect(element(by.id(AUTH.LOGIN_SCREEN))).toBeVisible();
    });
  });

  describe('Forgot Password', () => {
    it('should navigate to forgot password screen', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await tapElement(AUTH.FORGOT_PASSWORD_BUTTON);

      await expect(element(by.id(AUTH.FORGOT_PASSWORD_SCREEN))).toBeVisible();
    });

    it('should show validation for empty email', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await tapElement(AUTH.FORGOT_PASSWORD_BUTTON);
      await waitForElement(AUTH.FORGOT_PASSWORD_SCREEN);

      await tapElement(AUTH.RESET_PASSWORD_BUTTON);

      await expect(element(by.text('Email is required'))).toBeVisible();
    });

    it('should show success message for valid email', async () => {
      await waitForElement(AUTH.LOGIN_SCREEN);
      await tapElement(AUTH.FORGOT_PASSWORD_BUTTON);
      await waitForElement(AUTH.FORGOT_PASSWORD_SCREEN);

      await typeText(AUTH.EMAIL_INPUT, 'demo@kidsactivity.com');
      await tapElement(AUTH.RESET_PASSWORD_BUTTON);

      await waitFor(element(by.text(/email sent/i)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });
});
