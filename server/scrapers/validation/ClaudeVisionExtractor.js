/**
 * ClaudeVisionExtractor.js
 *
 * Uses Claude's vision capabilities to extract structured data from
 * screenshots of activity pages. Returns standardized field values
 * for comparison with our parsed data.
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');

class ClaudeVisionExtractor {
  constructor(options = {}) {
    this.client = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = options.model || 'claude-sonnet-4-20250514';
    this.maxTokens = options.maxTokens || 2000;

    // Track API costs
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
  }

  /**
   * Extract activity data from a screenshot
   * @param {string} screenshotPath - Path to screenshot file
   * @param {Object} context - Optional context about the activity
   * @returns {Promise<Object>} - Extracted data and metadata
   */
  async extractFromScreenshot(screenshotPath, context = {}) {
    const { activityName, platform, courseId } = context;

    try {
      // Read and encode image
      const imageBuffer = await fs.readFile(screenshotPath);
      const base64Image = imageBuffer.toString('base64');
      const mediaType = 'image/png';

      // Build the extraction prompt
      const prompt = this.buildExtractionPrompt(activityName, platform, courseId);

      // Call Claude API with vision
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      // Track token usage
      this.totalInputTokens += response.usage?.input_tokens || 0;
      this.totalOutputTokens += response.usage?.output_tokens || 0;

      // Parse the response
      const responseText = response.content[0]?.text || '';
      const extractedData = this.parseResponse(responseText);

      return {
        success: true,
        extractedData,
        rawResponse: responseText,
        confidence: extractedData._confidence || 0.8,
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
      console.error(`Error extracting from ${screenshotPath}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        extractedData: null,
      };
    }
  }

  /**
   * Build the extraction prompt
   */
  buildExtractionPrompt(activityName, platform, courseId) {
    let contextInfo = '';
    if (activityName) {
      contextInfo += `\nActivity name we're looking for: "${activityName}"`;
    }
    if (courseId) {
      contextInfo += `\nCourse ID/Number: ${courseId}`;
    }
    if (platform) {
      contextInfo += `\nPlatform: ${platform}`;
    }

    return `You are analyzing a screenshot of a recreation activity registration page. Extract the following information about the activity shown.${contextInfo}

IMPORTANT: Extract EXACTLY what you see on the page. Do not infer or guess values.

Return a JSON object with these fields (use null if not visible):

{
  "name": "Activity name exactly as shown",
  "courseId": "Course number/ID if visible (e.g., #00393057)",
  "dates": {
    "startDate": "Start date in format YYYY-MM-DD or as shown",
    "endDate": "End date in format YYYY-MM-DD or as shown",
    "dateRange": "Full date range text as displayed"
  },
  "schedule": {
    "daysOfWeek": ["Monday", "Tuesday", etc.],
    "startTime": "Start time in format HH:MM AM/PM",
    "endTime": "End time in format HH:MM AM/PM",
    "scheduleText": "Full schedule text as displayed"
  },
  "sessions": {
    "count": number of sessions if shown,
    "sessionDates": ["list of individual session dates if visible"]
  },
  "cost": {
    "amount": numeric value,
    "currency": "CAD",
    "costText": "Full cost text as displayed (e.g., '$81.99', 'Free')"
  },
  "availability": {
    "spotsAvailable": number or null,
    "totalSpots": number or null,
    "status": "Open", "Full", "Waitlist", "Closed", etc.,
    "statusText": "Full status text as displayed"
  },
  "location": {
    "name": "Location/Facility name",
    "address": "Address if visible",
    "room": "Room/specific location if shown"
  },
  "ageRange": {
    "minAge": number or null,
    "maxAge": number or null,
    "ageText": "Age range text as displayed (e.g., '3-6 yrs')"
  },
  "category": "Activity category if shown",
  "instructor": "Instructor name if visible",
  "description": "Brief description if visible (first 200 chars)",
  "_confidence": 0.0 to 1.0 confidence in extraction accuracy,
  "_notes": "Any notes about ambiguous or unclear information"
}

Return ONLY the JSON object, no other text.`;
  }

  /**
   * Parse Claude's response into structured data
   */
  parseResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, return raw text
      return {
        _parseError: true,
        _rawText: responseText,
      };
    } catch (error) {
      return {
        _parseError: true,
        _error: error.message,
        _rawText: responseText,
      };
    }
  }

  /**
   * Extract from multiple screenshots
   */
  async extractMany(screenshots, options = {}) {
    const { onProgress = null, delayBetween = 500 } = options;

    const results = [];

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];

      const result = await this.extractFromScreenshot(
        screenshot.screenshotPath,
        {
          activityName: screenshot.activityName || screenshot.name,
          platform: screenshot.platform,
          courseId: screenshot.courseId,
        }
      );

      results.push({
        ...result,
        activityId: screenshot.activityId || screenshot.id,
        screenshotPath: screenshot.screenshotPath,
      });

      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: screenshots.length,
          percent: Math.round(((i + 1) / screenshots.length) * 100),
          lastResult: result,
        });
      }

      // Rate limiting
      if (i < screenshots.length - 1) {
        await this.delay(delayBetween);
      }
    }

    return results;
  }

  /**
   * Calculate API cost
   * Prices as of Dec 2024 for Claude Sonnet
   */
  calculateCost(inputTokens, outputTokens) {
    // Claude Sonnet pricing
    const inputCostPer1M = 3.00;  // $3 per 1M input tokens
    const outputCostPer1M = 15.00; // $15 per 1M output tokens

    const inputCost = (inputTokens / 1_000_000) * inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * outputCostPer1M;

    return inputCost + outputCost;
  }

  /**
   * Get total API usage stats
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

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ClaudeVisionExtractor;
