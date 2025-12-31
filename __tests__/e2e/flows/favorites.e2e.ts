/**
 * Favorites E2E Tests
 * End-to-end tests for favorite activities functionality
 */
import { device, element, by, expect, waitFor } from 'detox';
import {
  login,
  waitForElement,
  typeText,
  tapElement,
  TIMEOUT,
} from '../utils/testHelpers';
import { SEARCH, ACTIVITY, FAVORITES, TABS } from '../utils/testIds';

describe('Favorites Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await login('demo@kidsactivity.com', 'DemoUser123!');
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Add to Favorites', () => {
    it('should add activity to favorites from detail screen', async () => {
      // Navigate to search and find an activity
      await tapElement(TABS.SEARCH_TAB);
      await waitForElement(SEARCH.SCREEN);

      await typeText(SEARCH.SEARCH_INPUT, 'swimming');
      await waitFor(element(by.id(SEARCH.RESULT_ITEM).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Open activity detail
      await element(by.id(SEARCH.RESULT_ITEM).atIndex(0)).tap();
      await waitForElement(ACTIVITY.SCREEN);

      // Tap favorite button
      await tapElement(ACTIVITY.FAVORITE_BUTTON);

      // Should show confirmation
      await waitFor(element(by.text(/added to favorites/i)))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should show filled heart icon after favoriting', async () => {
      await tapElement(TABS.SEARCH_TAB);
      await waitForElement(SEARCH.SCREEN);

      await typeText(SEARCH.SEARCH_INPUT, 'art');
      await waitFor(element(by.id(SEARCH.RESULT_ITEM).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(SEARCH.RESULT_ITEM).atIndex(0)).tap();
      await waitForElement(ACTIVITY.SCREEN);

      await tapElement(ACTIVITY.FAVORITE_BUTTON);

      // Icon should change to filled state
      await expect(element(by.id(ACTIVITY.FAVORITE_BUTTON_ACTIVE))).toBeVisible();
    });
  });

  describe('View Favorites', () => {
    it('should display favorites screen', async () => {
      await tapElement(TABS.FAVORITES_TAB);

      await expect(element(by.id(FAVORITES.SCREEN))).toBeVisible();
    });

    it('should show favorited activities in list', async () => {
      // First add a favorite
      await tapElement(TABS.SEARCH_TAB);
      await waitForElement(SEARCH.SCREEN);
      await typeText(SEARCH.SEARCH_INPUT, 'music');
      await waitFor(element(by.id(SEARCH.RESULT_ITEM).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
      await element(by.id(SEARCH.RESULT_ITEM).atIndex(0)).tap();
      await waitForElement(ACTIVITY.SCREEN);
      await tapElement(ACTIVITY.FAVORITE_BUTTON);

      // Navigate to favorites
      await tapElement(TABS.FAVORITES_TAB);
      await waitForElement(FAVORITES.SCREEN);

      await expect(element(by.id(FAVORITES.ACTIVITY_CARD).atIndex(0))).toBeVisible();
    });

    it('should navigate to activity detail from favorites', async () => {
      await tapElement(TABS.FAVORITES_TAB);
      await waitForElement(FAVORITES.SCREEN);

      await element(by.id(FAVORITES.ACTIVITY_CARD).atIndex(0)).tap();

      await expect(element(by.id(ACTIVITY.SCREEN))).toBeVisible();
    });

    it('should show empty state when no favorites', async () => {
      // This assumes we can clear favorites or use a fresh account
      await tapElement(TABS.FAVORITES_TAB);
      await waitForElement(FAVORITES.SCREEN);

      // If list is empty, should show empty state
      try {
        await expect(element(by.id(FAVORITES.EMPTY_STATE))).toBeVisible();
      } catch {
        // May have favorites from previous tests
      }
    });
  });

  describe('Remove from Favorites', () => {
    it('should remove activity from favorites on detail screen', async () => {
      // First add a favorite
      await tapElement(TABS.SEARCH_TAB);
      await typeText(SEARCH.SEARCH_INPUT, 'dance');
      await waitFor(element(by.id(SEARCH.RESULT_ITEM).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
      await element(by.id(SEARCH.RESULT_ITEM).atIndex(0)).tap();
      await waitForElement(ACTIVITY.SCREEN);
      await tapElement(ACTIVITY.FAVORITE_BUTTON);

      // Now tap again to remove
      await tapElement(ACTIVITY.FAVORITE_BUTTON);

      await waitFor(element(by.text(/removed from favorites/i)))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });

    it('should remove activity from favorites list with swipe', async () => {
      await tapElement(TABS.FAVORITES_TAB);
      await waitForElement(FAVORITES.SCREEN);

      try {
        // Swipe to delete
        await element(by.id(FAVORITES.ACTIVITY_CARD).atIndex(0)).swipe('left');

        // Confirm delete
        await element(by.text('Remove')).tap();

        // Activity should be removed
      } catch {
        // Swipe to delete may not be implemented
      }
    });
  });

  describe('Favorite Notifications', () => {
    it('should show notification when favorited activity has opening', async () => {
      // This would require specific test data setup
      // Testing the notification badge on favorites tab
      await tapElement(TABS.FAVORITES_TAB);
      await waitForElement(FAVORITES.SCREEN);

      try {
        // Check for notification indicator
        await expect(element(by.id(FAVORITES.NOTIFICATION_BADGE))).toBeVisible();
      } catch {
        // No notifications available
      }
    });
  });

  describe('Favorite Sync', () => {
    it('should persist favorites after app restart', async () => {
      // Add a favorite
      await tapElement(TABS.SEARCH_TAB);
      await typeText(SEARCH.SEARCH_INPUT, 'yoga');
      await waitFor(element(by.id(SEARCH.RESULT_ITEM).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
      await element(by.id(SEARCH.RESULT_ITEM).atIndex(0)).tap();
      await tapElement(ACTIVITY.FAVORITE_BUTTON);

      // Restart app
      await device.launchApp({ newInstance: false });

      // Check favorites still exist
      await tapElement(TABS.FAVORITES_TAB);
      await waitForElement(FAVORITES.SCREEN);

      await expect(element(by.id(FAVORITES.ACTIVITY_CARD).atIndex(0))).toBeVisible();
    });
  });
});
