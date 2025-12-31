/**
 * Email Service Mock
 * Mock implementation for email sending functionality
 */

export const mockEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-verification',
  }),

  sendPasswordResetEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-reset',
  }),

  sendWelcomeEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-welcome',
  }),

  sendNotificationEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-notification',
  }),

  sendDigestEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-digest',
  }),

  sendDailyDigest: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-daily',
    recipientCount: 1,
  }),

  sendWeeklyDigest: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-weekly',
    recipientCount: 1,
  }),

  sendCapacityAlert: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-capacity',
  }),

  sendWaitlistNotification: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-waitlist',
  }),

  sendFamilyShareInvite: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-share',
  }),

  sendTestEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-test',
  }),

  // Batch sending
  sendBulkEmails: jest.fn().mockResolvedValue({
    success: true,
    sent: 10,
    failed: 0,
  }),

  // Template rendering
  renderTemplate: jest.fn().mockReturnValue('<html><body>Mock Email</body></html>'),

  // Validation
  validateEmail: jest.fn().mockReturnValue(true),
};

// Helper to setup specific email mock behaviors
export const setupEmailMockSuccess = () => {
  Object.values(mockEmailService).forEach((method) => {
    if (typeof method === 'function' && 'mockResolvedValue' in method) {
      method.mockResolvedValue({ success: true, messageId: 'mock-id' });
    }
  });
};

export const setupEmailMockFailure = (errorMessage = 'Email sending failed') => {
  Object.values(mockEmailService).forEach((method) => {
    if (typeof method === 'function' && 'mockRejectedValue' in method) {
      method.mockRejectedValue(new Error(errorMessage));
    }
  });
};

// Reset all email mocks
export const resetEmailMocks = () => {
  Object.values(mockEmailService).forEach((method) => {
    if (typeof method === 'function' && 'mockClear' in method) {
      (method as jest.Mock).mockClear();
    }
  });
};

export default mockEmailService;
