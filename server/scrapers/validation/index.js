/**
 * Scraper Validation Module
 *
 * Tools for validating scraper accuracy by comparing parsed data
 * against source screenshots using Claude AI vision.
 *
 * Also includes the Auto-Fix Pipeline for automatic scraper improvements.
 */

const ValidationSampler = require('./ValidationSampler');
const ScreenshotCapture = require('./ScreenshotCapture');
const ClaudeVisionExtractor = require('./ClaudeVisionExtractor');
const DataComparator = require('./DataComparator');
const ReportGenerator = require('./ReportGenerator');

// Auto-Fix Pipeline components
const DiscrepancyAnalyzer = require('./DiscrepancyAnalyzer');
const HTMLCapture = require('./HTMLCapture');
const SelectorDiscoveryAgent = require('./SelectorDiscoveryAgent');
const ScraperPatcher = require('./ScraperPatcher');
const FixValidator = require('./FixValidator');
const AutoFixPipeline = require('./AutoFixPipeline');
const PlatformAnalyzer = require('./PlatformAnalyzer');

module.exports = {
  // Original validation components
  ValidationSampler,
  ScreenshotCapture,
  ClaudeVisionExtractor,
  DataComparator,
  ReportGenerator,

  // Auto-Fix Pipeline components
  DiscrepancyAnalyzer,
  HTMLCapture,
  SelectorDiscoveryAgent,
  ScraperPatcher,
  FixValidator,
  AutoFixPipeline,
  PlatformAnalyzer,
};
