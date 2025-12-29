const crypto = require('crypto');

/**
 * Stable ID Generator for Activities
 *
 * Priority order for generating externalId:
 * 1. Native ID from source (courseId, activityId, programCode, etc.)
 * 2. Stable hash from truly immutable fields (name + location only)
 *
 * IMPORTANT: Do NOT include volatile fields in hash:
 * - cost (can change)
 * - dates (sessions change)
 * - times (schedules change)
 * - spots (availability changes)
 */

/**
 * Normalize a string for consistent hashing
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove common prefixes/suffixes that might vary
    .replace(/^(the|a|an)\s+/i, '')
    // Remove special characters that might be inconsistent
    .replace(/['".,!?;:()[\]{}]/g, '')
    // Normalize dashes and underscores
    .replace(/[-_]/g, ' ')
    .trim();
}

/**
 * Generate a stable hash ID for an activity when no native ID exists.
 * Uses ONLY truly stable fields that don't change between sessions.
 *
 * @param {Object} activity - Activity object
 * @param {string} prefix - Provider prefix (e.g., 'pm', 'an', 'qd')
 * @returns {string} Stable hash ID
 */
function generateStableHash(activity, prefix = 'gen') {
  // ONLY use truly stable fields - name and location
  // These identify the "same" activity across different sessions/prices
  const key = [
    normalizeString(activity.name || ''),
    normalizeString(activity.location || activity.locationName || '')
  ].join('|');

  if (!key || key === '|') {
    // Fallback to a more unique but less stable hash if no name/location
    const fallbackKey = [
      activity.name || '',
      activity.category || '',
      activity.description?.substring(0, 50) || ''
    ].join('|').toLowerCase();

    const hash = crypto.createHash('md5').update(fallbackKey).digest('hex').substring(0, 16);
    return `${prefix}-fallback-${hash}`;
  }

  const hash = crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
  return `${prefix}-${hash}`;
}

/**
 * Extract native ID from various source formats
 * Each platform has different ways of providing IDs
 *
 * @param {Object} rawActivity - Raw activity data from scraper
 * @param {Object} options - Options for extraction
 * @returns {string|null} Native ID or null if not found
 */
function extractNativeId(rawActivity, options = {}) {
  const { platform = 'unknown', providerCode = '' } = options;

  // Common ID field names across platforms
  const idFields = [
    'courseId',
    'activityId',
    'programId',
    'programCode',
    'id',
    'externalId',
    'code',
    'itemId',
    'eventId',
    'classId',
    'sessionId',
    'registrationId'
  ];

  // Try to find a native ID from common fields
  for (const field of idFields) {
    const value = rawActivity[field];
    if (value && typeof value === 'string' && value.trim()) {
      // Prefix with provider code for uniqueness across providers
      return providerCode ? `${providerCode}-${value.trim()}` : value.trim();
    }
    if (value && typeof value === 'number') {
      return providerCode ? `${providerCode}-${value}` : String(value);
    }
  }

  // Try to extract from URL patterns
  const url = rawActivity.registrationUrl || rawActivity.detailUrl || rawActivity.url || '';
  if (url) {
    // Common URL patterns for activity IDs
    const patterns = [
      /courseId=([^&]+)/i,
      /activityId=([^&]+)/i,
      /programId=([^&]+)/i,
      /id=([^&]+)/i,
      /\/activity\/(\d+)/i,
      /\/course\/(\d+)/i,
      /\/program\/(\d+)/i,
      /\/event\/(\d+)/i,
      /fmId=([^&]+)/i,
      /itemId=([^&]+)/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return providerCode ? `${providerCode}-${match[1]}` : match[1];
      }
    }
  }

  return null;
}

/**
 * Generate an externalId for an activity
 * Prioritizes native IDs, falls back to stable hash
 *
 * @param {Object} activity - Activity data
 * @param {Object} options - Generation options
 * @returns {string} External ID
 */
function generateExternalId(activity, options = {}) {
  const {
    platform = 'unknown',
    providerCode = '',
    hashPrefix = 'gen'
  } = options;

  // 1. Try to extract native ID first (PREFERRED)
  const nativeId = extractNativeId(activity, { platform, providerCode });
  if (nativeId) {
    return nativeId;
  }

  // 2. Fall back to stable hash (only name + location)
  return generateStableHash(activity, hashPrefix);
}

/**
 * Check if two activities might be the same (for duplicate detection)
 * Uses fuzzy matching on stable fields
 *
 * @param {Object} activity1 - First activity
 * @param {Object} activity2 - Second activity
 * @returns {Object} Match result with confidence score
 */
function checkSimilarity(activity1, activity2) {
  const name1 = normalizeString(activity1.name || '');
  const name2 = normalizeString(activity2.name || '');
  const loc1 = normalizeString(activity1.locationName || activity1.location || '');
  const loc2 = normalizeString(activity2.locationName || activity2.location || '');

  // Exact name match
  if (name1 && name2 && name1 === name2) {
    // Same name, check location
    if (loc1 === loc2) {
      return { isSimilar: true, confidence: 1.0, reason: 'exact_match' };
    }
    // Same name, no location or one missing
    if (!loc1 || !loc2) {
      return { isSimilar: true, confidence: 0.9, reason: 'name_match_no_location' };
    }
    // Same name, different location - might be same activity at different venue
    return { isSimilar: false, confidence: 0.5, reason: 'name_match_different_location' };
  }

  // Check if names are similar (one contains the other)
  if (name1 && name2) {
    if (name1.includes(name2) || name2.includes(name1)) {
      if (loc1 === loc2) {
        return { isSimilar: true, confidence: 0.8, reason: 'partial_name_match' };
      }
    }
  }

  return { isSimilar: false, confidence: 0, reason: 'no_match' };
}

/**
 * Find potential duplicate activities in existing list
 * Used before creating "new" activities to detect renames
 *
 * @param {Object} newActivity - New activity being created
 * @param {Array} existingActivities - List of existing activities
 * @param {number} threshold - Minimum confidence threshold (0-1)
 * @returns {Array} List of potential duplicates with confidence scores
 */
function findPotentialDuplicates(newActivity, existingActivities, threshold = 0.7) {
  const duplicates = [];

  for (const existing of existingActivities) {
    const result = checkSimilarity(newActivity, existing);
    if (result.confidence >= threshold) {
      duplicates.push({
        existing,
        ...result
      });
    }
  }

  // Sort by confidence descending
  return duplicates.sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
  normalizeString,
  generateStableHash,
  extractNativeId,
  generateExternalId,
  checkSimilarity,
  findPotentialDuplicates
};
