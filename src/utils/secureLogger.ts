/**
 * Secure Logger Utility
 *
 * Sanitizes sensitive data before logging to prevent
 * tokens, passwords, and PII from appearing in device logs.
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'key',
  'authorization',
  'passwordHash',
  'resetToken',
  'verificationToken',
  'apiKey',
  'credential',
];

const sanitize = (data: any, depth = 0): any => {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';

  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact strings that look like tokens (long alphanumeric strings)
    if (data.length > 50 && /^[A-Za-z0-9._-]+$/.test(data)) {
      return `[REDACTED:${data.substring(0, 10)}...]`;
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};

  for (const key in data) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(k => lowerKey.includes(k.toLowerCase()));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      sanitized[key] = sanitize(data[key], depth + 1);
    } else {
      sanitized[key] = data[key];
    }
  }

  return sanitized;
};

/**
 * Log a message with sanitized data (development only)
 */
export const secureLog = (message: string, data?: any): void => {
  if (__DEV__) {
    if (data !== undefined) {
      console.log(message, sanitize(data));
    } else {
      console.log(message);
    }
  }
};

/**
 * Log a warning with sanitized data (development only)
 */
export const secureWarn = (message: string, data?: any): void => {
  if (__DEV__) {
    if (data !== undefined) {
      console.warn(message, sanitize(data));
    } else {
      console.warn(message);
    }
  }
};

/**
 * Log an error with sanitized data (always logs, but sanitizes in production)
 */
export const secureError = (message: string, error?: any): void => {
  const sanitizedError = error ? sanitize(error) : undefined;

  if (__DEV__) {
    console.error(message, sanitizedError);
  } else {
    // In production, log minimal info
    console.error(message, sanitizedError?.message || 'Unknown error');
  }
};

/**
 * Create a sanitized copy of an object for logging
 */
export const sanitizeForLogging = (data: any): any => {
  return sanitize(data);
};

export default {
  log: secureLog,
  warn: secureWarn,
  error: secureError,
  sanitize: sanitizeForLogging,
};
