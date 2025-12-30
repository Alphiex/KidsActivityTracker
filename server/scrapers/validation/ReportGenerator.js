/**
 * ReportGenerator.js
 *
 * Generates HTML and JSON reports from validation results.
 * Provides side-by-side comparison views and summary statistics.
 */

const fs = require('fs').promises;
const path = require('path');

class ReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir ||
      path.join(__dirname, 'reports');
  }

  /**
   * Generate full validation report
   * @param {Object} validationRun - Validation run data
   * @param {Array} results - Array of validation results
   * @returns {Promise<Object>} - Generated report paths
   */
  async generateReport(validationRun, results) {
    await fs.mkdir(this.outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const baseName = `validation-${validationRun.id || timestamp}`;

    // Generate JSON report
    const jsonPath = path.join(this.outputDir, `${baseName}.json`);
    await this.generateJsonReport(validationRun, results, jsonPath);

    // Generate HTML report
    const htmlPath = path.join(this.outputDir, `${baseName}.html`);
    await this.generateHtmlReport(validationRun, results, htmlPath);

    return { jsonPath, htmlPath };
  }

  /**
   * Generate JSON report
   */
  async generateJsonReport(validationRun, results, outputPath) {
    const report = {
      meta: {
        generatedAt: new Date().toISOString(),
        validationRunId: validationRun.id,
        platform: validationRun.platform,
        providerId: validationRun.providerId,
      },
      summary: this.calculateSummary(results),
      fieldAnalysis: this.analyzeFields(results),
      results: results.map(r => ({
        activityId: r.activityId,
        activityName: r.parsedData?.name,
        providerName: r.providerName,
        status: r.status,
        matchScore: r.matchScore,
        discrepancies: r.discrepancies,
        sourceUrl: r.sourceUrl,
      })),
    };

    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    return outputPath;
  }

  /**
   * Generate HTML report
   */
  async generateHtmlReport(validationRun, results, outputPath) {
    const summary = this.calculateSummary(results);
    const fieldAnalysis = this.analyzeFields(results);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Validation Report - ${validationRun.id || new Date().toLocaleDateString()}</title>
  <style>
    :root {
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --info: #3b82f6;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; margin-bottom: 1rem; color: var(--text); }
    h3 { font-size: 1rem; margin-bottom: 0.5rem; }

    .header {
      background: linear-gradient(135deg, #7c3aed, #ec4899);
      color: white;
      padding: 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
    }
    .header-meta { opacity: 0.9; font-size: 0.875rem; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      background: var(--card);
      border-radius: 0.75rem;
      padding: 1.25rem;
      border: 1px solid var(--border);
    }
    .summary-card.success { border-left: 4px solid var(--success); }
    .summary-card.warning { border-left: 4px solid var(--warning); }
    .summary-card.error { border-left: 4px solid var(--error); }
    .summary-card.info { border-left: 4px solid var(--info); }
    .summary-value { font-size: 2rem; font-weight: 700; }
    .summary-label { color: var(--text-muted); font-size: 0.875rem; }

    .section {
      background: var(--card);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid var(--border);
    }

    .field-accuracy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
    }
    .field-card {
      padding: 0.75rem;
      border-radius: 0.5rem;
      background: var(--bg);
    }
    .field-name { font-weight: 600; font-size: 0.875rem; }
    .field-accuracy { font-size: 1.25rem; font-weight: 700; }
    .field-card.critical { background: #fef2f2; }
    .field-card.high { background: #fef9c3; }
    .field-card.medium { background: #f0f9ff; }
    .field-card.low { background: #f0fdf4; }

    .results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .results-table th, .results-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .results-table th { font-weight: 600; background: var(--bg); }
    .results-table tr:hover { background: var(--bg); }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge.passed { background: #dcfce7; color: #166534; }
    .badge.failed { background: #fee2e2; color: #991b1b; }
    .badge.needs-review { background: #fef3c7; color: #92400e; }
    .badge.error { background: #fee2e2; color: #991b1b; }

    .score-bar {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .score-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .score-fill.high { background: var(--success); }
    .score-fill.medium { background: var(--warning); }
    .score-fill.low { background: var(--error); }

    .discrepancy-list {
      margin-top: 0.5rem;
      font-size: 0.75rem;
    }
    .discrepancy-item {
      display: flex;
      gap: 0.5rem;
      padding: 0.25rem 0;
      border-bottom: 1px dashed var(--border);
    }
    .discrepancy-field { font-weight: 600; min-width: 100px; }
    .discrepancy-expected { color: var(--success); }
    .discrepancy-actual { color: var(--error); }

    .expandable { cursor: pointer; }
    .expandable:hover { background: #f1f5f9; }
    .detail-row { display: none; }
    .detail-row.visible { display: table-row; }
    .detail-content { padding: 1rem; background: #f8fafc; }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .comparison-col h4 {
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    @media (max-width: 768px) {
      .container { padding: 1rem; }
      .comparison-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Scraper Validation Report</h1>
      <div class="header-meta">
        Generated: ${new Date().toLocaleString()}<br>
        ${validationRun.platform ? `Platform: ${validationRun.platform}` : ''}
        ${validationRun.providerId ? ` | Provider: ${validationRun.providerId}` : ''}
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card info">
        <div class="summary-value">${summary.total}</div>
        <div class="summary-label">Total Validated</div>
      </div>
      <div class="summary-card success">
        <div class="summary-value">${summary.passed}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-card error">
        <div class="summary-value">${summary.failed}</div>
        <div class="summary-label">Failed</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-value">${summary.needsReview}</div>
        <div class="summary-label">Needs Review</div>
      </div>
      <div class="summary-card ${summary.accuracy >= 90 ? 'success' : summary.accuracy >= 70 ? 'warning' : 'error'}">
        <div class="summary-value">${summary.accuracy}%</div>
        <div class="summary-label">Overall Accuracy</div>
      </div>
    </div>

    <div class="section">
      <h2>Field-Level Accuracy</h2>
      <div class="field-accuracy-grid">
        ${Object.entries(fieldAnalysis)
          .sort((a, b) => a[1].accuracy - b[1].accuracy)
          .map(([field, data]) => `
            <div class="field-card ${data.severity}">
              <div class="field-name">${this.formatFieldName(field)}</div>
              <div class="field-accuracy">${data.accuracy}%</div>
              <div class="score-bar">
                <div class="score-fill ${data.accuracy >= 90 ? 'high' : data.accuracy >= 70 ? 'medium' : 'low'}"
                     style="width: ${data.accuracy}%"></div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${data.matched}/${data.total} matched
              </div>
            </div>
          `).join('')}
      </div>
    </div>

    <div class="section">
      <h2>Validation Results</h2>
      <table class="results-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Match Score</th>
            <th>Discrepancies</th>
          </tr>
        </thead>
        <tbody>
          ${results.map((r, idx) => `
            <tr class="expandable" onclick="toggleDetail(${idx})">
              <td>
                <strong>${this.escapeHtml(r.parsedData?.name || 'Unknown')}</strong><br>
                <small style="color: var(--text-muted)">${r.parsedData?.courseId || r.activityId?.substring(0, 8)}</small>
              </td>
              <td>${r.providerName || '-'}</td>
              <td><span class="badge ${r.status?.toLowerCase().replace('_', '-')}">${r.status}</span></td>
              <td>
                <div class="score-bar" style="width: 80px;">
                  <div class="score-fill ${r.matchScore >= 90 ? 'high' : r.matchScore >= 70 ? 'medium' : 'low'}"
                       style="width: ${r.matchScore || 0}%"></div>
                </div>
                <small>${r.matchScore || 0}%</small>
              </td>
              <td>${r.discrepancies?.length || 0} issues</td>
            </tr>
            <tr class="detail-row" id="detail-${idx}">
              <td colspan="5">
                <div class="detail-content">
                  ${r.discrepancies?.length > 0 ? `
                    <h4 style="margin-bottom: 0.5rem;">Discrepancies</h4>
                    <div class="discrepancy-list">
                      ${r.discrepancies.map(d => `
                        <div class="discrepancy-item">
                          <span class="discrepancy-field">${this.formatFieldName(d.field)}</span>
                          <span class="discrepancy-expected">Expected: ${this.escapeHtml(String(d.expected || 'null'))}</span>
                          <span class="discrepancy-actual">Actual: ${this.escapeHtml(String(d.actual || 'null'))}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : '<p>No discrepancies</p>'}
                  ${r.sourceUrl ? `<p style="margin-top: 0.5rem;"><a href="${r.sourceUrl}" target="_blank">View Source</a></p>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function toggleDetail(idx) {
      const detail = document.getElementById('detail-' + idx);
      detail.classList.toggle('visible');
    }
  </script>
</body>
</html>`;

    await fs.writeFile(outputPath, html);
    return outputPath;
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(results) {
    const summary = {
      total: results.length,
      passed: 0,
      failed: 0,
      needsReview: 0,
      errors: 0,
      accuracy: 0,
    };

    for (const r of results) {
      switch (r.status) {
        case 'PASSED': summary.passed++; break;
        case 'FAILED': summary.failed++; break;
        case 'NEEDS_REVIEW': summary.needsReview++; break;
        case 'ERROR': summary.errors++; break;
      }
    }

    if (summary.total > 0) {
      summary.accuracy = Math.round((summary.passed / summary.total) * 100);
    }

    return summary;
  }

  /**
   * Analyze accuracy by field
   */
  analyzeFields(results) {
    const fieldStats = {};

    for (const r of results) {
      if (!r.fieldResults) continue;

      for (const [field, data] of Object.entries(r.fieldResults)) {
        if (!fieldStats[field]) {
          fieldStats[field] = {
            total: 0,
            matched: 0,
            missing: 0,
            severity: data.severity,
          };
        }

        if (data.extracted !== null && data.extracted !== undefined) {
          fieldStats[field].total++;
          if (data.match) {
            fieldStats[field].matched++;
          }
        } else {
          fieldStats[field].missing++;
        }
      }
    }

    // Calculate accuracy percentages
    for (const field of Object.keys(fieldStats)) {
      const stats = fieldStats[field];
      stats.accuracy = stats.total > 0
        ? Math.round((stats.matched / stats.total) * 100)
        : 100;
    }

    return fieldStats;
  }

  /**
   * Format field name for display
   */
  formatFieldName(field) {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Escape HTML entities
   */
  escapeHtml(str) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, c => escapeMap[c]);
  }

  /**
   * Generate discrepancy-focused report
   */
  async generateDiscrepancyReport(results, outputPath) {
    const discrepancies = results
      .filter(r => r.discrepancies?.length > 0)
      .map(r => ({
        activityId: r.activityId,
        activityName: r.parsedData?.name,
        provider: r.providerName,
        platform: r.platform,
        sourceUrl: r.sourceUrl,
        discrepancies: r.discrepancies,
      }));

    // Group by field
    const byField = {};
    for (const r of discrepancies) {
      for (const d of r.discrepancies) {
        if (!byField[d.field]) {
          byField[d.field] = [];
        }
        byField[d.field].push({
          activity: r.activityName,
          provider: r.provider,
          expected: d.expected,
          actual: d.actual,
        });
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      totalDiscrepancies: discrepancies.reduce((sum, r) => sum + r.discrepancies.length, 0),
      activitiesWithIssues: discrepancies.length,
      byField,
      allDiscrepancies: discrepancies,
    };

    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    return outputPath;
  }
}

module.exports = ReportGenerator;
