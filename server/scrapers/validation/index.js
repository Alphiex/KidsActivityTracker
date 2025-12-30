/**
 * Scraper Validation Module
 *
 * Tools for validating scraper accuracy by comparing parsed data
 * against source screenshots using Claude AI vision.
 */

const ValidationSampler = require('./ValidationSampler');
const ScreenshotCapture = require('./ScreenshotCapture');
const ClaudeVisionExtractor = require('./ClaudeVisionExtractor');
const DataComparator = require('./DataComparator');
const ReportGenerator = require('./ReportGenerator');

module.exports = {
  ValidationSampler,
  ScreenshotCapture,
  ClaudeVisionExtractor,
  DataComparator,
  ReportGenerator,
};
