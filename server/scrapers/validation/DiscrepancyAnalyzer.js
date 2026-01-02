/**
 * DiscrepancyAnalyzer.js
 *
 * Aggregates validation reports to identify systematic patterns in scraper failures.
 * Groups discrepancies by field, platform, and provider to prioritize fixes.
 */

const fs = require('fs').promises;
const path = require('path');

class DiscrepancyAnalyzer {
  constructor(options = {}) {
    this.reportsDir = options.reportsDir || path.join(__dirname, 'screenshots/comprehensive');
    this.minOccurrences = options.minOccurrences || 3; // Minimum occurrences to consider a pattern
    this.minMissRate = options.minMissRate || 0.5; // 50% miss rate threshold
  }

  /**
   * Load all validation reports from the reports directory
   * @returns {Promise<Array>} Array of validation report objects
   */
  async loadReports() {
    const files = await fs.readdir(this.reportsDir);
    const reportFiles = files.filter(f => f.startsWith('validation_report_') && f.endsWith('.json'));

    const reports = [];
    for (const file of reportFiles) {
      try {
        const content = await fs.readFile(path.join(this.reportsDir, file), 'utf-8');
        const report = JSON.parse(content);
        report._filename = file;
        report._timestamp = parseInt(file.match(/validation_report_(\d+)/)?.[1] || '0');
        reports.push(report);
      } catch (error) {
        console.warn(`Failed to load report ${file}: ${error.message}`);
      }
    }

    // Sort by timestamp, newest first
    return reports.sort((a, b) => b._timestamp - a._timestamp);
  }

  /**
   * Analyze discrepancies across all reports
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Aggregated analysis results
   */
  async analyze(options = {}) {
    const { maxReports = 20, recentOnly = true } = options;

    let reports = await this.loadReports();

    // Use only recent reports if specified
    if (recentOnly) {
      reports = reports.slice(0, maxReports);
    }

    if (reports.length === 0) {
      return { patterns: [], summary: { totalReports: 0 } };
    }

    // Aggregate discrepancies
    const fieldStats = {};
    const providerStats = {};
    const discrepancyDetails = [];

    for (const report of reports) {
      if (!report.results) continue;

      for (const [provider, activities] of Object.entries(report.results)) {
        if (!Array.isArray(activities)) continue;

        for (const activity of activities) {
          if (!activity.discrepancies) continue;

          // Track provider stats
          if (!providerStats[provider]) {
            providerStats[provider] = {
              totalActivities: 0,
              totalDiscrepancies: 0,
              byField: {},
              sampleUrls: [],
            };
          }
          providerStats[provider].totalActivities++;

          for (const disc of activity.discrepancies) {
            // Track field stats
            if (!fieldStats[disc.field]) {
              fieldStats[disc.field] = {
                total: 0,
                bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                byProvider: {},
                samples: [],
              };
            }

            fieldStats[disc.field].total++;
            fieldStats[disc.field].bySeverity[disc.severity] =
              (fieldStats[disc.field].bySeverity[disc.severity] || 0) + 1;

            if (!fieldStats[disc.field].byProvider[provider]) {
              fieldStats[disc.field].byProvider[provider] = 0;
            }
            fieldStats[disc.field].byProvider[provider]++;

            // Keep sample for debugging (collect all, shuffle later)
            fieldStats[disc.field].samples.push({
              provider,
              activityName: activity.activityName,
              sourceUrl: activity.sourceUrl,
              expected: disc.expected,
              actual: disc.actual,
              screenshotPath: activity.screenshotPath,
            });

            // Track provider stats
            providerStats[provider].totalDiscrepancies++;
            if (!providerStats[provider].byField[disc.field]) {
              providerStats[provider].byField[disc.field] = 0;
            }
            providerStats[provider].byField[disc.field]++;

            // Keep sample URLs for provider
            if (providerStats[provider].sampleUrls.length < 10 && activity.sourceUrl) {
              if (!providerStats[provider].sampleUrls.includes(activity.sourceUrl)) {
                providerStats[provider].sampleUrls.push(activity.sourceUrl);
              }
            }

            // Store full discrepancy detail
            discrepancyDetails.push({
              field: disc.field,
              severity: disc.severity,
              provider,
              activityId: activity.activityId,
              activityName: activity.activityName,
              sourceUrl: activity.sourceUrl,
              screenshotPath: activity.screenshotPath,
              expected: disc.expected,
              actual: disc.actual,
              extractedData: activity.extractedData,
              dbData: activity.dbData,
            });
          }
        }
      }
    }

    // Shuffle and limit samples to get random selection each run
    for (const field of Object.keys(fieldStats)) {
      fieldStats[field].samples = this.shuffleArray(fieldStats[field].samples).slice(0, 10);
    }
    for (const provider of Object.keys(providerStats)) {
      providerStats[provider].sampleUrls = this.shuffleArray(providerStats[provider].sampleUrls).slice(0, 10);
    }

    // Identify patterns (fields that consistently fail)
    const patterns = this.identifyPatterns(fieldStats, providerStats, reports.length);

    return {
      patterns,
      fieldStats,
      providerStats,
      discrepancyDetails,
      summary: {
        totalReports: reports.length,
        totalDiscrepancies: discrepancyDetails.length,
        uniqueFields: Object.keys(fieldStats).length,
        uniqueProviders: Object.keys(providerStats).length,
        reportDateRange: {
          oldest: new Date(reports[reports.length - 1]?._timestamp || 0).toISOString(),
          newest: new Date(reports[0]?._timestamp || 0).toISOString(),
        },
      },
    };
  }

  /**
   * Identify actionable patterns from the stats
   */
  identifyPatterns(fieldStats, providerStats, totalReports) {
    const patterns = [];

    // Pattern 1: Fields that are consistently missing across all providers
    for (const [field, stats] of Object.entries(fieldStats)) {
      const providers = Object.keys(stats.byProvider);
      const avgPerProvider = stats.total / providers.length;

      if (stats.total >= this.minOccurrences) {
        // Check if this is a "missing field" pattern (actual is null/undefined)
        const missingCount = stats.samples.filter(s =>
          s.actual === null || s.actual === undefined || s.actual === 'null'
        ).length;
        const isMissingPattern = missingCount / stats.samples.length > 0.8;

        // Auto-fixable if missing OR if it's a field we know how to extract
        const knownFixableFields = ['instructor', 'sessionCount', 'cost', 'registrationStatus', 'spotsAvailable', 'ageMin', 'ageMax', 'ageRange', 'location'];
        const isKnownField = knownFixableFields.includes(field);

        patterns.push({
          type: isMissingPattern ? 'missing_field' : 'incorrect_value',
          field,
          severity: this.calculatePatternSeverity(stats),
          totalOccurrences: stats.total,
          affectedProviders: providers,
          missRate: stats.total / (totalReports * 5), // Approximate
          samples: stats.samples,
          recommendation: isMissingPattern
            ? `Add extraction logic for '${field}' field`
            : `Fix extraction logic for '${field}' field`,
          autoFixable: isMissingPattern || isKnownField, // Auto-fix missing fields or known extractable fields
          priority: this.calculatePriority(stats),
        });
      }
    }

    // Pattern 2: Provider-specific issues
    for (const [provider, stats] of Object.entries(providerStats)) {
      if (stats.totalDiscrepancies >= this.minOccurrences) {
        const missRate = stats.totalDiscrepancies / stats.totalActivities;

        if (missRate > this.minMissRate) {
          // Find the most problematic fields for this provider
          const topFields = Object.entries(stats.byField)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([field, count]) => ({ field, count }));

          patterns.push({
            type: 'provider_issue',
            provider,
            severity: missRate > 0.8 ? 'critical' : missRate > 0.5 ? 'high' : 'medium',
            totalActivities: stats.totalActivities,
            totalDiscrepancies: stats.totalDiscrepancies,
            missRate,
            topFields,
            sampleUrls: stats.sampleUrls,
            recommendation: `Review scraper for ${provider} - ${Math.round(missRate * 100)}% error rate`,
            autoFixable: true,
            priority: Math.round(missRate * 100),
          });
        }
      }
    }

    // Sort by priority (highest first)
    return patterns.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate severity based on field statistics
   */
  calculatePatternSeverity(stats) {
    const { bySeverity } = stats;
    if (bySeverity.critical > 0) return 'critical';
    if (bySeverity.high > stats.total * 0.3) return 'high';
    if (bySeverity.medium > stats.total * 0.3) return 'medium';
    return 'low';
  }

  /**
   * Calculate priority score for sorting
   */
  calculatePriority(stats) {
    const severityWeights = { critical: 100, high: 50, medium: 20, low: 5 };
    let score = 0;

    for (const [severity, count] of Object.entries(stats.bySeverity)) {
      score += (severityWeights[severity] || 0) * count;
    }

    return score;
  }

  /**
   * Fisher-Yates shuffle for random sampling
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get actionable fix targets - patterns that can be auto-fixed
   * @param {Object} analysis - Result from analyze()
   * @returns {Array} Array of fix targets with details
   */
  getFixTargets(analysis) {
    return analysis.patterns
      .filter(p => p.autoFixable && p.field) // Only include patterns with a valid field name
      .map(p => ({
        type: p.type,
        field: p.field,
        provider: p.provider || (p.affectedProviders?.[0]) || null,
        severity: p.severity,
        priority: p.priority,
        samples: p.samples || [],
        sampleUrls: p.sampleUrls || p.samples?.map(s => s.sourceUrl).filter(Boolean) || [],
        recommendation: p.recommendation,
      }));
  }

  /**
   * Generate a human-readable report
   */
  generateReport(analysis) {
    const lines = [];

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    SCRAPER DISCREPANCY ANALYSIS                ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  Reports Analyzed: ${analysis.summary.totalReports}`);
    lines.push(`  Total Discrepancies: ${analysis.summary.totalDiscrepancies}`);
    lines.push(`  Unique Fields: ${analysis.summary.uniqueFields}`);
    lines.push(`  Unique Providers: ${analysis.summary.uniqueProviders}`);
    lines.push(`  Date Range: ${analysis.summary.reportDateRange.oldest.split('T')[0]} to ${analysis.summary.reportDateRange.newest.split('T')[0]}`);
    lines.push('');

    // Patterns
    lines.push('IDENTIFIED PATTERNS (sorted by priority)');
    lines.push('───────────────────────────────────────────────────────────────');

    for (const pattern of analysis.patterns.slice(0, 10)) {
      const autoFix = pattern.autoFixable ? '✓ AUTO-FIXABLE' : '✗ Manual review';
      lines.push('');
      lines.push(`  [${pattern.severity.toUpperCase()}] ${pattern.type}`);
      if (pattern.field) {
        lines.push(`    Field: ${pattern.field}`);
        lines.push(`    Occurrences: ${pattern.totalOccurrences}`);
        lines.push(`    Affected Providers: ${pattern.affectedProviders?.join(', ')}`);
      }
      if (pattern.provider) {
        lines.push(`    Provider: ${pattern.provider}`);
        lines.push(`    Miss Rate: ${Math.round(pattern.missRate * 100)}%`);
        lines.push(`    Top Problem Fields: ${pattern.topFields?.map(f => f.field).join(', ')}`);
      }
      lines.push(`    Recommendation: ${pattern.recommendation}`);
      lines.push(`    Status: ${autoFix}`);
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

module.exports = DiscrepancyAnalyzer;
