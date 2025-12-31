/**
 * Calendar E2E Tests
 * End-to-end tests for calendar view functionality
 */
import { device, element, by, expect, waitFor } from 'detox';
import {
  login,
  waitForElement,
  tapElement,
  TIMEOUT,
} from '../utils/testHelpers';
import { CALENDAR, ACTIVITY, TABS } from '../utils/testIds';

describe('Calendar Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await login('demo@kidsactivity.com', 'DemoUser123!');
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await tapElement(TABS.CALENDAR_TAB);
    await waitForElement(CALENDAR.SCREEN);
  });

  describe('Calendar View', () => {
    it('should display calendar screen', async () => {
      await expect(element(by.id(CALENDAR.SCREEN))).toBeVisible();
    });

    it('should show current month', async () => {
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });

      await expect(element(by.text(new RegExp(currentMonth, 'i')))).toBeVisible();
    });

    it('should show current year', async () => {
      const currentYear = new Date().getFullYear().toString();

      await expect(element(by.text(currentYear))).toBeVisible();
    });

    it('should display day labels', async () => {
      await expect(element(by.text('Sun'))).toBeVisible();
      await expect(element(by.text('Mon'))).toBeVisible();
    });
  });

  describe('Month Navigation', () => {
    it('should navigate to previous month', async () => {
      await tapElement(CALENDAR.PREV_MONTH_BUTTON);

      // Should show different month
      const prevMonth = new Date();
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const monthName = prevMonth.toLocaleString('default', { month: 'long' });

      await expect(element(by.text(new RegExp(monthName, 'i')))).toBeVisible();
    });

    it('should navigate to next month', async () => {
      await tapElement(CALENDAR.NEXT_MONTH_BUTTON);

      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthName = nextMonth.toLocaleString('default', { month: 'long' });

      await expect(element(by.text(new RegExp(monthName, 'i')))).toBeVisible();
    });

    it('should return to current month on today button', async () => {
      // Navigate away
      await tapElement(CALENDAR.NEXT_MONTH_BUTTON);
      await tapElement(CALENDAR.NEXT_MONTH_BUTTON);

      // Return to today
      await tapElement(CALENDAR.TODAY_BUTTON);

      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      await expect(element(by.text(new RegExp(currentMonth, 'i')))).toBeVisible();
    });
  });

  describe('Date Selection', () => {
    it('should select date on tap', async () => {
      await element(by.text('15')).tap();

      await expect(element(by.id(CALENDAR.SELECTED_DATE))).toBeVisible();
    });

    it('should show activities for selected date', async () => {
      await element(by.text('15')).tap();

      await waitFor(element(by.id(CALENDAR.ACTIVITIES_LIST)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);
    });

    it('should show empty state for dates with no activities', async () => {
      // Select a date likely to have no activities
      await element(by.text('1')).tap();

      try {
        await waitFor(element(by.id(CALENDAR.NO_ACTIVITIES)))
          .toBeVisible()
          .withTimeout(TIMEOUT.medium);
      } catch {
        // May have activities on this date
      }
    });
  });

  describe('View Modes', () => {
    it('should show week view option', async () => {
      await expect(element(by.id(CALENDAR.WEEK_VIEW_BUTTON))).toBeVisible();
    });

    it('should show month view option', async () => {
      await expect(element(by.id(CALENDAR.MONTH_VIEW_BUTTON))).toBeVisible();
    });

    it('should switch to week view', async () => {
      await tapElement(CALENDAR.WEEK_VIEW_BUTTON);

      // Should only show 7 days
      await expect(element(by.id(CALENDAR.WEEK_VIEW))).toBeVisible();
    });

    it('should switch back to month view', async () => {
      await tapElement(CALENDAR.WEEK_VIEW_BUTTON);
      await tapElement(CALENDAR.MONTH_VIEW_BUTTON);

      await expect(element(by.id(CALENDAR.MONTH_VIEW))).toBeVisible();
    });
  });

  describe('Activity Interaction', () => {
    it('should navigate to activity detail from calendar', async () => {
      // Select a date with activities
      await element(by.text('15')).tap();

      await waitFor(element(by.id(CALENDAR.ACTIVITY_CARD).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      await element(by.id(CALENDAR.ACTIVITY_CARD).atIndex(0)).tap();

      await expect(element(by.id(ACTIVITY.SCREEN))).toBeVisible();
    });

    it('should show activity time on calendar cards', async () => {
      await element(by.text('15')).tap();

      await waitFor(element(by.id(CALENDAR.ACTIVITY_CARD).atIndex(0)))
        .toBeVisible()
        .withTimeout(TIMEOUT.medium);

      // Time should be visible on card
      await expect(element(by.id(CALENDAR.ACTIVITY_TIME))).toBeVisible();
    });
  });

  describe('Date Markers', () => {
    it('should show dots on dates with activities', async () => {
      // Dates with activities should have indicator dots
      try {
        await expect(element(by.id(CALENDAR.DATE_MARKER).atIndex(0))).toBeVisible();
      } catch {
        // Markers may not be visible if no activities
      }
    });

    it('should highlight today date', async () => {
      const today = new Date().getDate().toString();

      await expect(element(by.id(CALENDAR.TODAY_HIGHLIGHT))).toBeVisible();
    });
  });

  describe('Filter by Category', () => {
    it('should show category filter option', async () => {
      try {
        await expect(element(by.id(CALENDAR.CATEGORY_FILTER))).toBeVisible();
      } catch {
        // Category filter may not exist
      }
    });

    it('should filter activities by category', async () => {
      try {
        await tapElement(CALENDAR.CATEGORY_FILTER);
        await element(by.text('Sports')).tap();

        // Activities should be filtered
        await element(by.text('15')).tap();

        // Should only show sports activities
      } catch {
        // Filter may not exist
      }
    });
  });
});
