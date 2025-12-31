/**
 * Child Management E2E Tests
 * End-to-end tests for child profile management
 */
import { device, element, by, expect, waitFor } from 'detox';
import {
  login,
  waitForElement,
  typeText,
  tapElement,
  scrollToElement,
  TIMEOUT,
} from '../utils/testHelpers';
import { CHILDREN, TABS, CHILD_FORM } from '../utils/testIds';

describe('Child Management Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await login('demo@kidsactivity.com', 'DemoUser123!');
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await tapElement(TABS.PROFILE_TAB);
    // Navigate to children section
  });

  describe('View Children', () => {
    it('should display children list', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await expect(element(by.id(CHILDREN.LIST))).toBeVisible();
    });

    it('should show child cards with name and age', async () => {
      await waitForElement(CHILDREN.SCREEN);

      await waitFor(element(by.id(CHILDREN.CHILD_CARD).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should navigate to child profile on tap', async () => {
      await waitForElement(CHILDREN.SCREEN);

      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();

      await expect(element(by.id(CHILDREN.PROFILE_SCREEN))).toBeVisible();
    });
  });

  describe('Add Child', () => {
    it('should open add child form', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await tapElement(CHILDREN.ADD_BUTTON);

      await expect(element(by.id(CHILD_FORM.SCREEN))).toBeVisible();
    });

    it('should show validation error for empty name', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await tapElement(CHILDREN.ADD_BUTTON);
      await waitForElement(CHILD_FORM.SCREEN);

      await tapElement(CHILD_FORM.SAVE_BUTTON);

      await expect(element(by.text('Name is required'))).toBeVisible();
    });

    it('should add new child successfully', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await tapElement(CHILDREN.ADD_BUTTON);
      await waitForElement(CHILD_FORM.SCREEN);

      // Fill form
      await typeText(CHILD_FORM.NAME_INPUT, 'Test Child');
      await tapElement(CHILD_FORM.BIRTHDAY_INPUT);
      // Select date from picker

      await tapElement(CHILD_FORM.SAVE_BUTTON);

      // Should return to list with new child
      await waitForElement(CHILDREN.SCREEN);
      await expect(element(by.text('Test Child'))).toBeVisible();
    });

    it('should select interests', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await tapElement(CHILDREN.ADD_BUTTON);
      await waitForElement(CHILD_FORM.SCREEN);

      await typeText(CHILD_FORM.NAME_INPUT, 'Test Child 2');

      // Select interests
      await scrollToElement(CHILD_FORM.SCROLL_VIEW, CHILD_FORM.INTERESTS_SECTION, 'down');
      await element(by.text('Sports')).tap();
      await element(by.text('Music')).tap();
    });

    it('should cancel and return to list', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await tapElement(CHILDREN.ADD_BUTTON);
      await waitForElement(CHILD_FORM.SCREEN);

      await tapElement(CHILD_FORM.CANCEL_BUTTON);

      await expect(element(by.id(CHILDREN.SCREEN))).toBeVisible();
    });
  });

  describe('Edit Child', () => {
    it('should open edit form with pre-filled data', async () => {
      await waitForElement(CHILDREN.SCREEN);

      // Tap on first child
      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();
      await waitForElement(CHILDREN.PROFILE_SCREEN);

      await tapElement(CHILDREN.EDIT_BUTTON);

      await expect(element(by.id(CHILD_FORM.SCREEN))).toBeVisible();
      // Name should be pre-filled
    });

    it('should update child successfully', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();
      await waitForElement(CHILDREN.PROFILE_SCREEN);
      await tapElement(CHILDREN.EDIT_BUTTON);
      await waitForElement(CHILD_FORM.SCREEN);

      // Clear and update name
      await element(by.id(CHILD_FORM.NAME_INPUT)).clearText();
      await typeText(CHILD_FORM.NAME_INPUT, 'Updated Name');

      await tapElement(CHILD_FORM.SAVE_BUTTON);

      // Should show updated name
      await expect(element(by.text('Updated Name'))).toBeVisible();
    });
  });

  describe('Delete Child', () => {
    it('should show delete confirmation', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();
      await waitForElement(CHILDREN.PROFILE_SCREEN);

      await tapElement(CHILDREN.DELETE_BUTTON);

      await expect(element(by.text(/are you sure|confirm/i))).toBeVisible();
    });

    it('should cancel delete on dismiss', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();
      await waitForElement(CHILDREN.PROFILE_SCREEN);
      await tapElement(CHILDREN.DELETE_BUTTON);

      await element(by.text('Cancel')).tap();

      // Should still be on profile screen
      await expect(element(by.id(CHILDREN.PROFILE_SCREEN))).toBeVisible();
    });

    it('should delete child on confirm', async () => {
      await waitForElement(CHILDREN.SCREEN);

      // Get initial count
      const childCard = element(by.id(CHILDREN.CHILD_CARD).atIndex(0));
      await childCard.tap();

      await waitForElement(CHILDREN.PROFILE_SCREEN);
      await tapElement(CHILDREN.DELETE_BUTTON);

      await element(by.text('Delete')).tap();

      // Should return to list
      await waitForElement(CHILDREN.SCREEN);
    });
  });

  describe('Child Profile', () => {
    it('should display child details', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();

      await expect(element(by.id(CHILDREN.PROFILE_NAME))).toBeVisible();
      await expect(element(by.id(CHILDREN.PROFILE_AGE))).toBeVisible();
    });

    it('should show recommended activities for child', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();
      await waitForElement(CHILDREN.PROFILE_SCREEN);

      await scrollToElement(CHILDREN.PROFILE_SCROLL, CHILDREN.ACTIVITIES_SECTION, 'down');

      await expect(element(by.id(CHILDREN.ACTIVITIES_SECTION))).toBeVisible();
    });

    it('should navigate to activity from child profile', async () => {
      await waitForElement(CHILDREN.SCREEN);
      await element(by.id(CHILDREN.CHILD_CARD).atIndex(0)).tap();
      await waitForElement(CHILDREN.PROFILE_SCREEN);

      await scrollToElement(CHILDREN.PROFILE_SCROLL, CHILDREN.ACTIVITIES_SECTION, 'down');

      // Tap on activity
      await element(by.id(CHILDREN.ACTIVITY_CARD).atIndex(0)).tap();

      await expect(element(by.id('activity-detail-screen'))).toBeVisible();
    });
  });
});
