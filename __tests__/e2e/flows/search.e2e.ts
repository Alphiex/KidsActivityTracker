/**
 * Search E2E Tests
 * End-to-end tests for search and filter functionality
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
import { SEARCH, FILTERS, ACTIVITY, TABS } from '../utils/testIds';

describe('Search Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await login('demo@kidsactivity.com', 'DemoUser123!');
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await tapElement(TABS.SEARCH_TAB);
    await waitForElement(SEARCH.SCREEN);
  });

  describe('Basic Search', () => {
    it('should display search screen with input', async () => {
      await expect(element(by.id(SEARCH.SEARCH_INPUT))).toBeVisible();
    });

    it('should search by keyword', async () => {
      await typeText(SEARCH.SEARCH_INPUT, 'swimming');

      await waitFor(element(by.id(SEARCH.RESULTS_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Should show results
      await expect(element(by.id(SEARCH.RESULT_ITEM).atIndex(0))).toBeVisible();
    });

    it('should show no results message for invalid search', async () => {
      await typeText(SEARCH.SEARCH_INPUT, 'xyznonexistent123');

      await waitFor(element(by.id(SEARCH.NO_RESULTS)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should navigate to activity detail on tap', async () => {
      await typeText(SEARCH.SEARCH_INPUT, 'swimming');

      await waitFor(element(by.id(SEARCH.RESULT_ITEM).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(SEARCH.RESULT_ITEM).atIndex(0)).tap();

      await expect(element(by.id(ACTIVITY.SCREEN))).toBeVisible();
    });

    it('should show results count', async () => {
      await typeText(SEARCH.SEARCH_INPUT, 'art');

      await waitFor(element(by.id(SEARCH.RESULTS_COUNT)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });

  describe('Filters', () => {
    it('should open filters screen', async () => {
      await tapElement(SEARCH.FILTER_BUTTON);

      await expect(element(by.id(FILTERS.SCREEN))).toBeVisible();
    });

    it('should filter by age range', async () => {
      await tapElement(SEARCH.FILTER_BUTTON);
      await waitForElement(FILTERS.SCREEN);

      // Set age range
      await element(by.id(FILTERS.MIN_AGE_INPUT)).replaceText('5');
      await element(by.id(FILTERS.MAX_AGE_INPUT)).replaceText('8');

      await tapElement(FILTERS.APPLY_BUTTON);

      await waitFor(element(by.id(SEARCH.RESULTS_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Verify filtered results (activities should be age-appropriate)
      await expect(element(by.id(SEARCH.RESULT_ITEM).atIndex(0))).toBeVisible();
    });

    it('should filter by category', async () => {
      await tapElement(SEARCH.FILTER_BUTTON);
      await waitForElement(FILTERS.SCREEN);

      await tapElement(FILTERS.CATEGORY_SELECT);
      await element(by.text('Sports')).tap();

      await tapElement(FILTERS.APPLY_BUTTON);

      await waitFor(element(by.id(SEARCH.RESULTS_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should filter by max cost', async () => {
      await tapElement(SEARCH.FILTER_BUTTON);
      await waitForElement(FILTERS.SCREEN);

      await element(by.id(FILTERS.MAX_COST_INPUT)).replaceText('50');

      await tapElement(FILTERS.APPLY_BUTTON);

      await waitFor(element(by.id(SEARCH.RESULTS_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should filter by available spots only', async () => {
      await tapElement(SEARCH.FILTER_BUTTON);
      await waitForElement(FILTERS.SCREEN);

      await tapElement(FILTERS.AVAILABLE_SPOTS_TOGGLE);
      await tapElement(FILTERS.APPLY_BUTTON);

      await waitFor(element(by.id(SEARCH.RESULTS_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should reset filters', async () => {
      await tapElement(SEARCH.FILTER_BUTTON);
      await waitForElement(FILTERS.SCREEN);

      // Apply some filters
      await element(by.id(FILTERS.MAX_COST_INPUT)).replaceText('100');
      await tapElement(FILTERS.APPLY_BUTTON);

      // Open filters again and reset
      await tapElement(SEARCH.FILTER_BUTTON);
      await tapElement(FILTERS.RESET_BUTTON);
      await tapElement(FILTERS.APPLY_BUTTON);

      // Should show all results again
      await waitFor(element(by.id(SEARCH.RESULTS_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should combine multiple filters', async () => {
      await tapElement(SEARCH.FILTER_BUTTON);
      await waitForElement(FILTERS.SCREEN);

      // Set multiple filters
      await element(by.id(FILTERS.MIN_AGE_INPUT)).replaceText('4');
      await element(by.id(FILTERS.MAX_AGE_INPUT)).replaceText('8');
      await element(by.id(FILTERS.MAX_COST_INPUT)).replaceText('150');
      await tapElement(FILTERS.AVAILABLE_SPOTS_TOGGLE);

      await tapElement(FILTERS.APPLY_BUTTON);

      await waitFor(element(by.id(SEARCH.RESULTS_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });
  });

  describe('Activity Detail', () => {
    beforeEach(async () => {
      await typeText(SEARCH.SEARCH_INPUT, 'swimming');
      await waitFor(element(by.id(SEARCH.RESULT_ITEM).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
      await element(by.id(SEARCH.RESULT_ITEM).atIndex(0)).tap();
      await waitForElement(ACTIVITY.SCREEN);
    });

    it('should display activity details', async () => {
      await expect(element(by.id(ACTIVITY.TITLE))).toBeVisible();
      await expect(element(by.id(ACTIVITY.DESCRIPTION))).toBeVisible();
      await expect(element(by.id(ACTIVITY.COST))).toBeVisible();
    });

    it('should show register button', async () => {
      await scrollToElement(ACTIVITY.SCROLL_VIEW, ACTIVITY.REGISTER_BUTTON, 'down');
      await expect(element(by.id(ACTIVITY.REGISTER_BUTTON))).toBeVisible();
    });

    it('should toggle favorite', async () => {
      await tapElement(ACTIVITY.FAVORITE_BUTTON);

      // Should show some feedback (toast, icon change, etc.)
      await waitFor(element(by.text(/added to favorites/i)))
        .toBeVisible()
        .withTimeout(TIMEOUT.short);
    });
  });
});
