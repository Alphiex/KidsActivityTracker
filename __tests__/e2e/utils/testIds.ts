/**
 * Test IDs
 * Centralized test ID constants for E2E tests
 * These should match the testID props in the React Native components
 */

// Authentication screens
export const AUTH = {
  LOGIN_SCREEN: 'login-screen',
  REGISTER_SCREEN: 'register-screen',
  FORGOT_PASSWORD_SCREEN: 'forgot-password-screen',
  EMAIL_INPUT: 'email-input',
  PASSWORD_INPUT: 'password-input',
  CONFIRM_PASSWORD_INPUT: 'confirm-password-input',
  NAME_INPUT: 'name-input',
  LOGIN_BUTTON: 'login-button',
  REGISTER_BUTTON: 'register-button',
  FORGOT_PASSWORD_BUTTON: 'forgot-password-button',
  RESET_PASSWORD_BUTTON: 'reset-password-button',
  BACK_TO_LOGIN_BUTTON: 'back-to-login-button',
  CREATE_ACCOUNT_LINK: 'create-account-link',
  LOGIN_ERROR: 'login-error',
  REGISTER_ERROR: 'register-error',
};

// Tab navigation
export const TABS = {
  HOME_TAB: 'home-tab',
  SEARCH_TAB: 'search-tab',
  CALENDAR_TAB: 'calendar-tab',
  FAVORITES_TAB: 'favorites-tab',
  PROFILE_TAB: 'profile-tab',
};

// Dashboard/Home screen
export const DASHBOARD = {
  SCREEN: 'dashboard-screen',
  SCROLL_VIEW: 'dashboard-scroll',
  WELCOME_MESSAGE: 'welcome-message',
  RECOMMENDATIONS_SECTION: 'recommendations-section',
  NEARBY_SECTION: 'nearby-section',
  UPCOMING_SECTION: 'upcoming-section',
  ACTIVITY_CARD: 'activity-card',
  SEE_ALL_BUTTON: 'see-all-button',
};

// Search screen
export const SEARCH = {
  SCREEN: 'search-screen',
  RESULTS_SCREEN: 'search-results-screen',
  SEARCH_INPUT: 'search-input',
  SEARCH_BUTTON: 'search-button',
  FILTER_BUTTON: 'filter-button',
  CLEAR_FILTERS_BUTTON: 'clear-filters-button',
  RESULTS_LIST: 'results-list',
  RESULT_ITEM: 'result-item',
  NO_RESULTS: 'no-results',
  LOADING_INDICATOR: 'loading-indicator',
  RESULTS_COUNT: 'results-count',
};

// Filter screen
export const FILTERS = {
  SCREEN: 'filters-screen',
  AGE_SLIDER: 'age-slider',
  MIN_AGE_INPUT: 'min-age-input',
  MAX_AGE_INPUT: 'max-age-input',
  CATEGORY_SELECT: 'category-select',
  CITY_SELECT: 'city-select',
  COST_SLIDER: 'cost-slider',
  MAX_COST_INPUT: 'max-cost-input',
  DISTANCE_SLIDER: 'distance-slider',
  DATE_START_PICKER: 'date-start-picker',
  DATE_END_PICKER: 'date-end-picker',
  DAYS_OF_WEEK: 'days-of-week',
  AVAILABLE_SPOTS_TOGGLE: 'available-spots-toggle',
  APPLY_BUTTON: 'apply-filters-button',
  RESET_BUTTON: 'reset-filters-button',
};

// Activity detail screen
export const ACTIVITY = {
  SCREEN: 'activity-detail-screen',
  SCROLL_VIEW: 'activity-scroll',
  TITLE: 'activity-title',
  DESCRIPTION: 'activity-description',
  PROVIDER: 'activity-provider',
  LOCATION: 'activity-location',
  COST: 'activity-cost',
  AGE_RANGE: 'activity-age-range',
  DATES: 'activity-dates',
  TIME: 'activity-time',
  DAYS: 'activity-days',
  SPOTS: 'activity-spots',
  REGISTER_BUTTON: 'register-button',
  FAVORITE_BUTTON: 'favorite-button',
  SHARE_BUTTON: 'share-button',
  MAP_VIEW: 'map-view',
  WAITLIST_BUTTON: 'waitlist-button',
};

// Calendar screen
export const CALENDAR = {
  SCREEN: 'calendar-screen',
  MONTH_VIEW: 'month-view',
  WEEK_VIEW: 'week-view',
  DAY_VIEW: 'day-view',
  VIEW_TOGGLE: 'view-toggle',
  PREV_BUTTON: 'prev-button',
  NEXT_BUTTON: 'next-button',
  TODAY_BUTTON: 'today-button',
  DATE_HEADER: 'date-header',
  EVENT_ITEM: 'event-item',
  EXPORT_BUTTON: 'export-button',
};

// Favorites screen
export const FAVORITES = {
  SCREEN: 'favorites-screen',
  LIST: 'favorites-list',
  EMPTY_STATE: 'favorites-empty',
  FAVORITE_ITEM: 'favorite-item',
  REMOVE_BUTTON: 'remove-favorite-button',
};

// Children screen
export const CHILDREN = {
  LIST_SCREEN: 'children-list-screen',
  PROFILE_SCREEN: 'child-profile-screen',
  ADD_EDIT_SCREEN: 'add-edit-child-screen',
  CHILDREN_LIST: 'children-list',
  CHILD_CARD: 'child-card',
  ADD_BUTTON: 'add-child-button',
  EDIT_BUTTON: 'edit-child-button',
  DELETE_BUTTON: 'delete-child-button',
  NAME_INPUT: 'child-name-input',
  DOB_PICKER: 'child-dob-picker',
  INTERESTS_SELECT: 'child-interests-select',
  SAVE_BUTTON: 'save-child-button',
  CANCEL_BUTTON: 'cancel-button',
};

// Profile screen
export const PROFILE = {
  SCREEN: 'profile-screen',
  SCROLL_VIEW: 'profile-scroll',
  USER_NAME: 'user-name',
  USER_EMAIL: 'user-email',
  EDIT_PROFILE_BUTTON: 'edit-profile-button',
  SETTINGS_BUTTON: 'settings-button',
  NOTIFICATIONS_BUTTON: 'notifications-button',
  SUBSCRIPTION_BUTTON: 'subscription-button',
  CHILDREN_BUTTON: 'children-button',
  FAMILY_SHARING_BUTTON: 'family-sharing-button',
  HELP_BUTTON: 'help-button',
  LOGOUT_BUTTON: 'logout-button',
  CONFIRM_LOGOUT_BUTTON: 'confirm-logout-button',
};

// Settings screen
export const SETTINGS = {
  SCREEN: 'settings-screen',
  DARK_MODE_TOGGLE: 'dark-mode-toggle',
  PUSH_NOTIFICATIONS_TOGGLE: 'push-notifications-toggle',
  EMAIL_NOTIFICATIONS_TOGGLE: 'email-notifications-toggle',
  LOCATION_TOGGLE: 'location-toggle',
  PRIVACY_POLICY_BUTTON: 'privacy-policy-button',
  TERMS_BUTTON: 'terms-button',
  DELETE_ACCOUNT_BUTTON: 'delete-account-button',
};

// Notification preferences
export const NOTIFICATIONS = {
  SCREEN: 'notification-preferences-screen',
  ENABLED_TOGGLE: 'notifications-enabled-toggle',
  NEW_ACTIVITIES_TOGGLE: 'new-activities-toggle',
  DAILY_DIGEST_TOGGLE: 'daily-digest-toggle',
  WEEKLY_DIGEST_TOGGLE: 'weekly-digest-toggle',
  CAPACITY_ALERTS_TOGGLE: 'capacity-alerts-toggle',
  PRICE_DROPS_TOGGLE: 'price-drops-toggle',
  WAITLIST_TOGGLE: 'waitlist-toggle',
  TEST_EMAIL_BUTTON: 'test-email-button',
  SAVE_BUTTON: 'save-preferences-button',
};

// Subscription/Paywall
export const SUBSCRIPTION = {
  SCREEN: 'paywall-screen',
  MONTHLY_PLAN: 'monthly-plan',
  YEARLY_PLAN: 'yearly-plan',
  SUBSCRIBE_BUTTON: 'subscribe-button',
  RESTORE_BUTTON: 'restore-purchases-button',
  CLOSE_BUTTON: 'close-paywall-button',
  FEATURE_LIST: 'feature-list',
};

// Onboarding
export const ONBOARDING = {
  SCREEN: 'onboarding-screen',
  NEXT_BUTTON: 'next-button',
  SKIP_BUTTON: 'skip-button',
  GET_STARTED_BUTTON: 'get-started-button',
  PAGE_INDICATOR: 'page-indicator',
};

// Common/Shared
export const COMMON = {
  LOADING_INDICATOR: 'loading-indicator',
  ERROR_MESSAGE: 'error-message',
  SUCCESS_MESSAGE: 'success-message',
  MODAL: 'modal',
  MODAL_CLOSE: 'modal-close',
  BACK_BUTTON: 'back-button',
  HEADER_TITLE: 'header-title',
  EMPTY_STATE: 'empty-state',
  PULL_TO_REFRESH: 'pull-to-refresh',
};
