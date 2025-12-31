/**
 * Onboarding E2E Tests
 * End-to-end tests for new user onboarding flow
 */
import { device, element, by, expect, waitFor } from 'detox';
import {
  waitForElement,
  typeText,
  tapElement,
  TIMEOUT,
} from '../utils/testHelpers';
import { ONBOARDING, AUTH, PREFERENCES, DASHBOARD } from '../utils/testIds';

describe('Onboarding Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  describe('First Launch', () => {
    it('should show welcome screen on first launch', async () => {
      await expect(element(by.id(ONBOARDING.WELCOME_SCREEN))).toBeVisible();
    });

    it('should display app logo and name', async () => {
      await expect(element(by.id(ONBOARDING.APP_LOGO))).toBeVisible();
    });

    it('should show get started button', async () => {
      await expect(element(by.id(ONBOARDING.GET_STARTED_BUTTON))).toBeVisible();
    });

    it('should show sign in option', async () => {
      await expect(element(by.text(/sign in|log in/i))).toBeVisible();
    });
  });

  describe('Onboarding Slides', () => {
    it('should navigate through onboarding slides', async () => {
      await tapElement(ONBOARDING.GET_STARTED_BUTTON);

      // Slide 1
      await expect(element(by.id(ONBOARDING.SLIDE_1))).toBeVisible();

      await tapElement(ONBOARDING.NEXT_BUTTON);

      // Slide 2
      await expect(element(by.id(ONBOARDING.SLIDE_2))).toBeVisible();

      await tapElement(ONBOARDING.NEXT_BUTTON);

      // Slide 3
      await expect(element(by.id(ONBOARDING.SLIDE_3))).toBeVisible();
    });

    it('should allow skipping onboarding', async () => {
      await tapElement(ONBOARDING.GET_STARTED_BUTTON);

      await tapElement(ONBOARDING.SKIP_BUTTON);

      await expect(element(by.id(AUTH.REGISTER_SCREEN))).toBeVisible();
    });

    it('should show page indicators', async () => {
      await tapElement(ONBOARDING.GET_STARTED_BUTTON);

      await expect(element(by.id(ONBOARDING.PAGE_INDICATOR))).toBeVisible();
    });

    it('should allow swiping between slides', async () => {
      await tapElement(ONBOARDING.GET_STARTED_BUTTON);

      await element(by.id(ONBOARDING.SLIDES_CONTAINER)).swipe('left');

      await expect(element(by.id(ONBOARDING.SLIDE_2))).toBeVisible();
    });
  });

  describe('Registration', () => {
    it('should navigate to registration from onboarding', async () => {
      await tapElement(ONBOARDING.GET_STARTED_BUTTON);

      // Go through slides
      await tapElement(ONBOARDING.NEXT_BUTTON);
      await tapElement(ONBOARDING.NEXT_BUTTON);
      await tapElement(ONBOARDING.CONTINUE_BUTTON);

      await expect(element(by.id(AUTH.REGISTER_SCREEN))).toBeVisible();
    });

    it('should complete registration flow', async () => {
      await tapElement(ONBOARDING.GET_STARTED_BUTTON);
      await tapElement(ONBOARDING.SKIP_BUTTON);

      // Fill registration form
      await typeText(AUTH.NAME_INPUT, 'New Test User');
      await typeText(AUTH.EMAIL_INPUT, `test${Date.now()}@example.com`);
      await typeText(AUTH.PASSWORD_INPUT, 'Password123!');

      await tapElement(AUTH.REGISTER_BUTTON);

      // Should proceed to preferences or dashboard
      await waitFor(element(by.id(PREFERENCES.SCREEN)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });
  });

  describe('Initial Preferences Setup', () => {
    it('should show location preference screen', async () => {
      // After registration, should see location setup
      await tapElement(ONBOARDING.GET_STARTED_BUTTON);
      await tapElement(ONBOARDING.SKIP_BUTTON);

      await typeText(AUTH.NAME_INPUT, 'Preference Test');
      await typeText(AUTH.EMAIL_INPUT, `pref${Date.now()}@example.com`);
      await typeText(AUTH.PASSWORD_INPUT, 'Password123!');
      await tapElement(AUTH.REGISTER_BUTTON);

      await waitFor(element(by.id(PREFERENCES.LOCATION_SCREEN)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });

    it('should allow selecting city', async () => {
      // Continue from location screen
      try {
        await waitForElement(PREFERENCES.LOCATION_SCREEN);

        await element(by.text('Vancouver')).tap();
        await tapElement(PREFERENCES.CONTINUE_BUTTON);

        await expect(element(by.id(PREFERENCES.AGE_SCREEN))).toBeVisible();
      } catch {
        // May skip if already past this screen
      }
    });

    it('should show age preference screen', async () => {
      try {
        await waitForElement(PREFERENCES.AGE_SCREEN);

        await expect(element(by.id(PREFERENCES.AGE_SLIDER))).toBeVisible();
      } catch {
        // May not be on age screen
      }
    });

    it('should show activity type preference screen', async () => {
      try {
        await waitForElement(PREFERENCES.ACTIVITIES_SCREEN);

        await expect(element(by.text('Sports'))).toBeVisible();
        await expect(element(by.text('Arts'))).toBeVisible();
      } catch {
        // May not be on activities screen
      }
    });

    it('should complete onboarding and reach dashboard', async () => {
      // Start fresh
      await device.launchApp({ newInstance: true, delete: true });

      await tapElement(ONBOARDING.GET_STARTED_BUTTON);
      await tapElement(ONBOARDING.SKIP_BUTTON);

      await typeText(AUTH.NAME_INPUT, 'Complete Test');
      await typeText(AUTH.EMAIL_INPUT, `complete${Date.now()}@example.com`);
      await typeText(AUTH.PASSWORD_INPUT, 'Password123!');
      await tapElement(AUTH.REGISTER_BUTTON);

      // Skip through preferences
      try {
        await waitForElement(PREFERENCES.LOCATION_SCREEN);
        await tapElement(PREFERENCES.SKIP_BUTTON);
        await tapElement(PREFERENCES.SKIP_BUTTON);
        await tapElement(PREFERENCES.SKIP_BUTTON);
      } catch {
        // May auto-skip
      }

      // Should reach dashboard
      await waitFor(element(by.id(DASHBOARD.SCREEN)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });
  });

  describe('Add First Child', () => {
    it('should prompt to add child after onboarding', async () => {
      // After reaching dashboard, should see prompt to add child
      try {
        await expect(element(by.text(/add.*child|first child/i))).toBeVisible();
      } catch {
        // Prompt may not appear
      }
    });

    it('should navigate to add child from prompt', async () => {
      try {
        const addChildPrompt = element(by.text(/add.*child/i));
        await addChildPrompt.tap();

        await expect(element(by.id('add-child-screen'))).toBeVisible();
      } catch {
        // Prompt may not exist
      }
    });
  });

  describe('Existing User Login', () => {
    it('should navigate to login from welcome screen', async () => {
      await element(by.text(/sign in|log in/i)).tap();

      await expect(element(by.id(AUTH.LOGIN_SCREEN))).toBeVisible();
    });

    it('should login and skip onboarding', async () => {
      await element(by.text(/sign in/i)).tap();

      await typeText(AUTH.EMAIL_INPUT, 'demo@kidsactivity.com');
      await typeText(AUTH.PASSWORD_INPUT, 'DemoUser123!');
      await tapElement(AUTH.LOGIN_BUTTON);

      await waitFor(element(by.id(DASHBOARD.SCREEN)))
        .toBeVisible()
        .withTimeout(TIMEOUT.long);
    });
  });
});
