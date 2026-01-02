/**
 * SelectorDiscoveryAgent.js
 *
 * Uses Claude to analyze HTML and discover CSS selectors for missing fields.
 * Generates extraction code that can be patched into scrapers.
 */

const Anthropic = require('@anthropic-ai/sdk');

class SelectorDiscoveryAgent {
  constructor(options = {}) {
    this.client = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = options.model || 'claude-sonnet-4-20250514';
    this.maxTokens = options.maxTokens || 4000;

    // Track API usage
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
  }

  /**
   * Analyze HTML to find selectors for a specific field
   * @param {string} html - HTML content to analyze
   * @param {string} fieldName - Field to find selector for
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Selector suggestions and extraction code
   */
  async discoverSelector(html, fieldName, context = {}) {
    const { expectedValue, platform, activityName } = context;

    const prompt = this.buildSelectorPrompt(html, fieldName, expectedValue, platform, activityName);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Track usage
      this.totalInputTokens += response.usage?.input_tokens || 0;
      this.totalOutputTokens += response.usage?.output_tokens || 0;

      const responseText = response.content[0]?.text || '';
      const result = this.parseResponse(responseText);

      return {
        success: true,
        field: fieldName,
        ...result,
        tokensUsed: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
        cost: this.calculateCost(
          response.usage?.input_tokens || 0,
          response.usage?.output_tokens || 0
        ),
      };

    } catch (error) {
      return {
        success: false,
        field: fieldName,
        error: error.message,
      };
    }
  }

  /**
   * Build the prompt for selector discovery
   */
  buildSelectorPrompt(html, fieldName, expectedValue, platform, activityName) {
    const fieldDescriptions = {
      instructor: 'the instructor, teacher, coach, leader, supervisor, facilitator, or staff member name',
      sessionCount: 'the number of sessions, classes, or meetings',
      cost: 'the price, cost, or fee amount',
      registrationStatus: 'the registration status (Open, Full, Waitlist, Closed)',
      spotsAvailable: 'the number of available spots or openings',
      ageMin: 'the minimum age requirement',
      ageMax: 'the maximum age requirement',
      ageRange: 'the age range (e.g., "6-12 years")',
      location: 'the location, venue, or facility name',
      room: 'the room number or specific location within a facility',
      startTime: 'the start time of the activity',
      endTime: 'the end time of the activity',
      dayOfWeek: 'the day(s) of the week the activity runs',
      startDate: 'the start date of the activity',
      endDate: 'the end date of the activity',
    };

    const fieldDesc = fieldDescriptions[fieldName] || `the ${fieldName}`;
    const expectedInfo = expectedValue ? `\nExpected value (from screenshot): "${expectedValue}"` : '';
    const platformInfo = platform ? `\nPlatform: ${platform}` : '';
    const activityInfo = activityName ? `\nActivity: ${activityName}` : '';

    return `You are an expert web scraper developer. Analyze this HTML to find ${fieldDesc}.
${expectedInfo}${platformInfo}${activityInfo}

HTML to analyze:
\`\`\`html
${html.substring(0, 60000)}
\`\`\`

Your task:
1. Find the CSS selector that would extract ${fieldDesc}
2. Write JavaScript extraction code using Puppeteer
3. Rate your confidence in the selector (0-100)

Return a JSON object with this exact structure:
{
  "found": true/false,
  "selector": "CSS selector string",
  "alternativeSelectors": ["backup selector 1", "backup selector 2"],
  "extractionCode": "// Puppeteer code to extract the value",
  "extractedValue": "The value found in the HTML (if visible)",
  "confidence": 0-100,
  "notes": "Any notes about the extraction approach",
  "htmlSnippet": "The relevant HTML snippet where the value was found"
}

IMPORTANT:
- Use ONLY standard CSS selectors (no jQuery extensions like :contains())
- Prefer specific selectors over generic ones
- Use attribute selectors when classes seem auto-generated
- For label-value pairs (like "Supervisor: John Smith"), provide extractionCode that finds the label and gets adjacent/sibling text
- The extractionCode should work with Puppeteer's page.evaluate() using standard DOM APIs
- If the field is not present in the HTML, set found: false
- Include fallback selectors in alternativeSelectors

For label-value extraction, use this pattern in extractionCode:
\`\`\`javascript
// Find label, then get sibling value
const labels = document.querySelectorAll('.label-class');
for (const label of labels) {
  if (label.textContent.includes('LabelText')) {
    const value = label.nextElementSibling?.textContent || label.parentElement?.querySelector('.value-class')?.textContent;
    return value?.trim();
  }
}
\`\`\`

Return ONLY the JSON object.`;
  }

  /**
   * Analyze multiple HTML samples to find the most reliable selector
   * @param {Array<Object>} samples - Array of {html, expectedValue} objects
   * @param {string} fieldName - Field to find selector for
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Best selector with confidence
   */
  async discoverSelectorFromSamples(samples, fieldName, context = {}) {
    const { platform } = context;

    // Analyze each sample
    const results = [];
    for (const sample of samples.slice(0, 5)) { // Limit to 5 samples
      const result = await this.discoverSelector(
        sample.html,
        fieldName,
        {
          expectedValue: sample.expectedValue,
          platform,
          activityName: sample.activityName,
        }
      );
      if (result.success && result.found) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        field: fieldName,
        error: 'Could not find selector in any samples',
      };
    }

    // Find the most common selector
    const selectorCounts = {};
    for (const result of results) {
      const selector = result.selector;
      if (!selectorCounts[selector]) {
        selectorCounts[selector] = {
          count: 0,
          confidence: 0,
          results: [],
        };
      }
      selectorCounts[selector].count++;
      selectorCounts[selector].confidence += result.confidence;
      selectorCounts[selector].results.push(result);
    }

    // Pick the best selector (most common + highest confidence)
    const sortedSelectors = Object.entries(selectorCounts)
      .map(([selector, data]) => ({
        selector,
        count: data.count,
        avgConfidence: data.confidence / data.count,
        score: data.count * 20 + (data.confidence / data.count),
        extractionCode: data.results[0].extractionCode,
        alternativeSelectors: data.results[0].alternativeSelectors,
      }))
      .sort((a, b) => b.score - a.score);

    const best = sortedSelectors[0];

    // Collect all unique alternatives
    const allAlternatives = new Set();
    for (const result of results) {
      if (result.alternativeSelectors) {
        result.alternativeSelectors.forEach(s => allAlternatives.add(s));
      }
      if (result.selector !== best.selector) {
        allAlternatives.add(result.selector);
      }
    }

    return {
      success: true,
      field: fieldName,
      selector: best.selector,
      confidence: Math.round(best.avgConfidence),
      sampleMatches: best.count,
      totalSamples: results.length,
      extractionCode: best.extractionCode,
      alternativeSelectors: [...allAlternatives].slice(0, 5),
      allCandidates: sortedSelectors,
    };
  }

  /**
   * Generate complete scraper patch for a platform
   * @param {string} platform - Platform name (e.g., "PerfectMind")
   * @param {Array<Object>} fieldFixes - Array of selector discoveries
   * @returns {Promise<Object>} Generated patch code
   */
  async generateScraperPatch(platform, fieldFixes) {
    const fixesJson = JSON.stringify(fieldFixes, null, 2);

    const prompt = `You are an expert at writing web scrapers. Generate JavaScript code to add these field extractions to a ${platform} scraper.

Field fixes needed:
${fixesJson}

The scraper uses Puppeteer and has this general structure:
- extractActivityDetails(page, activity) method that extracts details from an activity page
- Uses page.evaluate() for DOM extraction
- Returns an object with activity fields

Generate a JavaScript object with:
1. fieldsToAdd: Object mapping field names to extraction functions
2. patchCode: Complete code that could be added to the scraper's extractActivityDetails method
3. testCode: Code to test the extraction on a page

Return a JSON object:
{
  "platform": "${platform}",
  "fieldsToAdd": {
    "fieldName": {
      "selector": "CSS selector",
      "extractionFn": "async (page) => { ... }",
      "fallbackSelectors": ["alt1", "alt2"]
    }
  },
  "patchCode": "// JavaScript code to add to scraper",
  "testCode": "// Code to test the extraction"
}

Return ONLY the JSON object.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      this.totalInputTokens += response.usage?.input_tokens || 0;
      this.totalOutputTokens += response.usage?.output_tokens || 0;

      const responseText = response.content[0]?.text || '';
      return {
        success: true,
        ...this.parseResponse(responseText),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse JSON response from Claude
   */
  parseResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { parseError: true, rawText: responseText };
    } catch (error) {
      return { parseError: true, error: error.message, rawText: responseText };
    }
  }

  /**
   * Calculate API cost
   */
  calculateCost(inputTokens, outputTokens) {
    // Claude Sonnet pricing
    const inputCostPer1M = 3.00;
    const outputCostPer1M = 15.00;
    return (inputTokens / 1_000_000) * inputCostPer1M +
           (outputTokens / 1_000_000) * outputCostPer1M;
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCost: this.calculateCost(this.totalInputTokens, this.totalOutputTokens),
    };
  }

  /**
   * Reset usage tracking
   */
  resetUsageStats() {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
  }
}

module.exports = SelectorDiscoveryAgent;
