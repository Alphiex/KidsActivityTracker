/**
 * E2E Test Helpers
 * Common utilities for Detox E2E tests
 */
import { device, element, by, expect, waitFor } from 'detox';

// Timeouts
export const TIMEOUT = {
  short: 5000,
  medium: 10000,
  long: 30000,
  veryLong: 60000,
};

// Wait for element to be visible
export const waitForElement = async (
  testId: string,
  timeout = TIMEOUT.medium
) => {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
};

// Wait for element to disappear
export const waitForElementToDisappear = async (
  testId: string,
  timeout = TIMEOUT.medium
) => {
  await waitFor(element(by.id(testId)))
    .not.toBeVisible()
    .withTimeout(timeout);
};

// Tap element by test ID
export const tapElement = async (testId: string) => {
  await waitForElement(testId);
  await element(by.id(testId)).tap();
};

// Type text into input
export const typeText = async (testId: string, text: string) => {
  await waitForElement(testId);
  await element(by.id(testId)).clearText();
  await element(by.id(testId)).typeText(text);
};

// Clear and type text
export const replaceText = async (testId: string, text: string) => {
  await waitForElement(testId);
  await element(by.id(testId)).replaceText(text);
};

// Scroll to element
export const scrollToElement = async (
  scrollViewId: string,
  targetId: string,
  direction: 'up' | 'down' = 'down'
) => {
  await waitFor(element(by.id(targetId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewId))
    .scroll(100, direction);
};

// Login helper
export const login = async (
  email = 'test@example.com',
  password = 'Password123!'
) => {
  await waitForElement('login-screen');
  await typeText('email-input', email);
  await typeText('password-input', password);
  await tapElement('login-button');
  await waitForElement('dashboard-screen');
};

// Logout helper
export const logout = async () => {
  await tapElement('profile-tab');
  await waitForElement('profile-screen');
  await scrollToElement('profile-scroll', 'logout-button', 'down');
  await tapElement('logout-button');
  await tapElement('confirm-logout-button');
  await waitForElement('login-screen');
};

// Navigate to tab
export const navigateToTab = async (
  tabName: 'home' | 'search' | 'calendar' | 'favorites' | 'profile'
) => {
  await tapElement(`${tabName}-tab`);
  await waitForElement(`${tabName}-screen`);
};

// Check if element exists
export const elementExists = async (testId: string): Promise<boolean> => {
  try {
    await expect(element(by.id(testId))).toExist();
    return true;
  } catch {
    return false;
  }
};

// Check if element is visible
export const isVisible = async (testId: string): Promise<boolean> => {
  try {
    await expect(element(by.id(testId))).toBeVisible();
    return true;
  } catch {
    return false;
  }
};

// Dismiss keyboard
export const dismissKeyboard = async () => {
  if (device.getPlatform() === 'ios') {
    await element(by.id('scroll-view')).tap({ x: 0, y: 0 });
  } else {
    await device.pressBack();
  }
};

// Pull to refresh
export const pullToRefresh = async (scrollViewId: string) => {
  await element(by.id(scrollViewId)).scroll(200, 'down', NaN, 0.85);
};

// Swipe actions
export const swipeLeft = async (testId: string) => {
  await element(by.id(testId)).swipe('left', 'fast');
};

export const swipeRight = async (testId: string) => {
  await element(by.id(testId)).swipe('right', 'fast');
};

// Take screenshot for debugging
export const takeDebugScreenshot = async (name: string) => {
  await device.takeScreenshot(name);
};

// Wait for network idle (approximate)
export const waitForNetworkIdle = async (timeout = TIMEOUT.medium) => {
  // Wait for loading indicators to disappear
  try {
    await waitFor(element(by.id('loading-indicator')))
      .not.toBeVisible()
      .withTimeout(timeout);
  } catch {
    // Loading indicator may not exist, which is fine
  }
};

// Assert text content
export const assertText = async (testId: string, expectedText: string) => {
  await waitForElement(testId);
  await expect(element(by.id(testId))).toHaveText(expectedText);
};

// Assert element count
export const assertElementCount = async (testId: string, count: number) => {
  // Detox doesn't have a direct count assertion, so we check indices
  for (let i = 0; i < count; i++) {
    await expect(element(by.id(testId)).atIndex(i)).toExist();
  }
};

// Reset app state
export const resetAppState = async () => {
  await device.launchApp({ delete: true });
};

// Relaunch app
export const relaunchApp = async () => {
  await device.launchApp({ newInstance: true });
};

// Permissions handling
export const grantLocationPermission = async () => {
  await device.launchApp({
    permissions: { location: 'always' },
  });
};

export const grantNotificationPermission = async () => {
  await device.launchApp({
    permissions: { notifications: 'YES' },
  });
};

// Deep link handling
export const openDeepLink = async (url: string) => {
  await device.openURL({ url });
};

// Background/foreground
export const sendToBackground = async () => {
  await device.sendToHome();
};

export const bringToForeground = async () => {
  await device.launchApp({ newInstance: false });
};

// Shake device (for triggering dev menu in debug)
export const shakeDevice = async () => {
  await device.shake();
};

// Set dark mode
export const setDarkMode = async (enabled: boolean) => {
  await device.setStatusBar({
    time: '12:00',
    style: enabled ? 'dark' : 'light',
  });
};
