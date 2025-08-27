const router = require('express').Router();
const { ACTIVITY_TYPES } = require('../../constants/activityTypes');

/**
 * GET /api/v1/preferences/activity-types
 * Get all valid activity types for user preferences
 */
router.get('/activity-types', (req, res) => {
  res.json({
    success: true,
    activityTypes: ACTIVITY_TYPES,
    message: 'Use these activity types for user preferences instead of categories'
  });
});

module.exports = router;