/**
 * DataComparator.js
 *
 * Compares extracted data from screenshots with our parsed database data.
 * Uses fuzzy matching for strings, date normalization, and numeric tolerance.
 */

class DataComparator {
  constructor(options = {}) {
    this.tolerances = {
      cost: options.costTolerance || 0.01,     // $0.01 tolerance for prices
      time: options.timeTolerance || 5,         // 5 minute tolerance for times
      date: options.dateTolerance || 1,         // 1 day tolerance for dates
      stringMatch: options.stringMatch || 0.85, // 85% similarity threshold
    };
  }

  /**
   * Compare extracted data with parsed data
   * @param {Object} extracted - Data extracted from screenshot by Claude
   * @param {Object} parsed - Our parsed data from database
   * @returns {Object} - Comparison results with discrepancies
   */
  compare(extracted, parsed) {
    const results = {
      overallMatch: true,
      matchScore: 0,
      fieldResults: {},
      discrepancies: [],
      summary: {
        matched: 0,
        mismatched: 0,
        missing: 0,
        total: 0,
      },
    };

    // Define field comparisons
    const comparisons = [
      { field: 'name', compareFn: this.compareStrings.bind(this), severity: 'low' },
      { field: 'courseId', compareFn: this.compareCourseId.bind(this), severity: 'medium' },
      { field: 'dateStart', compareFn: this.compareDates.bind(this), extractPath: 'dates.startDate', severity: 'critical' },
      { field: 'dateEnd', compareFn: this.compareDates.bind(this), extractPath: 'dates.endDate', severity: 'critical' },
      { field: 'dayOfWeek', compareFn: this.compareDaysOfWeek.bind(this), extractPath: 'schedule.daysOfWeek', severity: 'critical' },
      { field: 'startTime', compareFn: this.compareTimes.bind(this), extractPath: 'schedule.startTime', severity: 'critical' },
      { field: 'endTime', compareFn: this.compareTimes.bind(this), extractPath: 'schedule.endTime', severity: 'critical' },
      { field: 'cost', compareFn: this.compareCost.bind(this), extractPath: 'cost.amount', severity: 'high' },
      { field: 'spotsAvailable', compareFn: this.compareNumbers.bind(this), extractPath: 'availability.spotsAvailable', severity: 'high' },
      { field: 'totalSpots', compareFn: this.compareNumbers.bind(this), extractPath: 'availability.totalSpots', severity: 'medium' },
      { field: 'registrationStatus', compareFn: this.compareStatus.bind(this), extractPath: 'availability.status', severity: 'high' },
      { field: 'locationName', compareFn: this.compareStrings.bind(this), extractPath: 'location.name', severity: 'high' },
      { field: 'ageMin', compareFn: this.compareNumbers.bind(this), extractPath: 'ageRange.minAge', severity: 'medium' },
      { field: 'ageMax', compareFn: this.compareNumbers.bind(this), extractPath: 'ageRange.maxAge', severity: 'medium' },
      { field: 'sessionCount', compareFn: this.compareNumbers.bind(this), extractPath: 'sessions.count', severity: 'low' },
    ];

    // Run comparisons
    for (const comp of comparisons) {
      const parsedValue = parsed[comp.field];
      const extractedValue = this.getNestedValue(extracted, comp.extractPath || comp.field);

      const compResult = comp.compareFn(extractedValue, parsedValue, comp.field);

      results.fieldResults[comp.field] = {
        match: compResult.match,
        extracted: extractedValue,
        parsed: parsedValue,
        normalizedExtracted: compResult.normalizedExtracted,
        normalizedParsed: compResult.normalizedParsed,
        similarity: compResult.similarity,
        severity: comp.severity,
        notes: compResult.notes,
      };

      results.summary.total++;

      if (extractedValue === null || extractedValue === undefined) {
        results.summary.missing++;
      } else if (compResult.match) {
        results.summary.matched++;
      } else {
        results.summary.mismatched++;
        results.overallMatch = false;
        results.discrepancies.push({
          field: comp.field,
          expected: extractedValue,
          actual: parsedValue,
          severity: comp.severity,
          notes: compResult.notes,
        });
      }
    }

    // Calculate match score
    const validFields = results.summary.total - results.summary.missing;
    results.matchScore = validFields > 0
      ? Math.round((results.summary.matched / validFields) * 100)
      : 0;

    return results;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Compare strings with fuzzy matching
   */
  compareStrings(extracted, parsed, fieldName) {
    if (extracted === null || extracted === undefined) {
      return { match: true, similarity: null, notes: 'No extracted value' };
    }

    if (parsed === null || parsed === undefined) {
      return { match: false, similarity: 0, notes: 'Missing parsed value' };
    }

    const normalizedExtracted = this.normalizeString(extracted);
    const normalizedParsed = this.normalizeString(parsed);

    const similarity = this.calculateStringSimilarity(normalizedExtracted, normalizedParsed);
    const match = similarity >= this.tolerances.stringMatch;

    return {
      match,
      similarity,
      normalizedExtracted,
      normalizedParsed,
      notes: match ? null : `Similarity ${Math.round(similarity * 100)}%`,
    };
  }

  /**
   * Compare course IDs (case-insensitive, strip prefixes)
   */
  compareCourseId(extracted, parsed) {
    if (!extracted) return { match: true, similarity: null, notes: 'No extracted value' };
    if (!parsed) return { match: false, similarity: 0, notes: 'Missing parsed value' };

    // Normalize: remove # prefix, spaces, convert to lowercase
    const normalizedExtracted = String(extracted).replace(/^#/, '').trim().toLowerCase();
    const normalizedParsed = String(parsed).replace(/^#/, '').trim().toLowerCase();

    const match = normalizedExtracted === normalizedParsed;

    return {
      match,
      similarity: match ? 1 : 0,
      normalizedExtracted,
      normalizedParsed,
    };
  }

  /**
   * Compare dates with tolerance
   */
  compareDates(extracted, parsed) {
    if (!extracted) return { match: true, similarity: null, notes: 'No extracted date' };
    if (!parsed) return { match: false, similarity: 0, notes: 'Missing parsed date' };

    const extractedDate = this.parseDate(extracted);
    const parsedDate = this.parseDate(parsed);

    if (!extractedDate || !parsedDate) {
      return { match: false, similarity: 0, notes: 'Could not parse dates' };
    }

    const diffDays = Math.abs(extractedDate - parsedDate) / (1000 * 60 * 60 * 24);
    const match = diffDays <= this.tolerances.date;

    return {
      match,
      similarity: match ? 1 : 0,
      normalizedExtracted: extractedDate.toISOString().split('T')[0],
      normalizedParsed: parsedDate.toISOString().split('T')[0],
      notes: match ? null : `${Math.round(diffDays)} days difference`,
    };
  }

  /**
   * Parse various date formats
   */
  parseDate(dateStr) {
    if (dateStr instanceof Date) return dateStr;

    if (typeof dateStr !== 'string') return null;

    // Try various formats
    // YYYY-MM-DD
    let match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    // MM/DD/YY or M/D/YY
    match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (match) {
      let year = parseInt(match[3]);
      if (year < 100) year += year > 50 ? 1900 : 2000;
      return new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
    }

    // Month DD, YYYY
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    match = dateStr.toLowerCase().match(/([a-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
    if (match) {
      const monthIdx = monthNames.findIndex(m => match[1].startsWith(m));
      if (monthIdx >= 0) {
        return new Date(parseInt(match[3]), monthIdx, parseInt(match[2]));
      }
    }

    return null;
  }

  /**
   * Compare times with tolerance
   */
  compareTimes(extracted, parsed) {
    if (!extracted) return { match: true, similarity: null, notes: 'No extracted time' };
    if (!parsed) return { match: false, similarity: 0, notes: 'Missing parsed time' };

    const extractedMins = this.parseTimeToMinutes(extracted);
    const parsedMins = this.parseTimeToMinutes(parsed);

    if (extractedMins === null || parsedMins === null) {
      return { match: false, similarity: 0, notes: 'Could not parse times' };
    }

    const diffMins = Math.abs(extractedMins - parsedMins);
    const match = diffMins <= this.tolerances.time;

    return {
      match,
      similarity: match ? 1 : 0,
      normalizedExtracted: this.formatMinutesToTime(extractedMins),
      normalizedParsed: this.formatMinutesToTime(parsedMins),
      notes: match ? null : `${diffMins} minutes difference`,
    };
  }

  /**
   * Parse time string to minutes since midnight
   */
  parseTimeToMinutes(timeStr) {
    if (typeof timeStr !== 'string') return null;

    const normalized = timeStr.toLowerCase().replace(/\s+/g, '');

    // HH:MM AM/PM
    const match = normalized.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const period = match[3]?.toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      return hours * 60 + minutes;
    }

    return null;
  }

  /**
   * Format minutes to time string
   */
  formatMinutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Compare days of week
   */
  compareDaysOfWeek(extracted, parsed) {
    if (!extracted || !Array.isArray(extracted) || extracted.length === 0) {
      return { match: true, similarity: null, notes: 'No extracted days' };
    }

    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return { match: false, similarity: 0, notes: 'Missing parsed days' };
    }

    const normalizeDay = (d) => d?.toLowerCase().substring(0, 3);
    const extractedNorm = extracted.map(normalizeDay).sort();
    const parsedNorm = parsed.map(normalizeDay).sort();

    const extractedSet = new Set(extractedNorm);
    const parsedSet = new Set(parsedNorm);

    const intersection = [...extractedSet].filter(d => parsedSet.has(d));
    const union = new Set([...extractedSet, ...parsedSet]);

    const similarity = intersection.length / union.size;
    const match = similarity >= 0.8; // 80% overlap required

    return {
      match,
      similarity,
      normalizedExtracted: extractedNorm,
      normalizedParsed: parsedNorm,
      notes: match ? null : `Days mismatch: [${extractedNorm}] vs [${parsedNorm}]`,
    };
  }

  /**
   * Compare costs with tolerance
   */
  compareCost(extracted, parsed) {
    if (extracted === null || extracted === undefined) {
      return { match: true, similarity: null, notes: 'No extracted cost' };
    }

    const extractedNum = typeof extracted === 'string'
      ? parseFloat(extracted.replace(/[$,]/g, ''))
      : extracted;

    const parsedNum = typeof parsed === 'string'
      ? parseFloat(parsed.replace(/[$,]/g, ''))
      : parsed;

    if (isNaN(extractedNum) || isNaN(parsedNum)) {
      return { match: false, similarity: 0, notes: 'Could not parse costs' };
    }

    const diff = Math.abs(extractedNum - parsedNum);
    const match = diff <= this.tolerances.cost || (parsedNum > 0 && diff / parsedNum <= 0.01);

    return {
      match,
      similarity: match ? 1 : 0,
      normalizedExtracted: extractedNum,
      normalizedParsed: parsedNum,
      notes: match ? null : `$${extractedNum.toFixed(2)} vs $${parsedNum.toFixed(2)}`,
    };
  }

  /**
   * Compare numbers exactly
   */
  compareNumbers(extracted, parsed) {
    if (extracted === null || extracted === undefined) {
      return { match: true, similarity: null, notes: 'No extracted value' };
    }

    const extractedNum = parseInt(extracted);
    const parsedNum = parseInt(parsed);

    if (isNaN(extractedNum) || isNaN(parsedNum)) {
      return { match: false, similarity: 0, notes: 'Could not parse numbers' };
    }

    const match = extractedNum === parsedNum;

    return {
      match,
      similarity: match ? 1 : 0,
      normalizedExtracted: extractedNum,
      normalizedParsed: parsedNum,
    };
  }

  /**
   * Compare registration status
   */
  compareStatus(extracted, parsed) {
    if (!extracted) return { match: true, similarity: null, notes: 'No extracted status' };
    if (!parsed) return { match: false, similarity: 0, notes: 'Missing parsed status' };

    const normalize = (s) => {
      const str = String(s).toLowerCase();
      if (str.includes('full') || str.includes('sold out')) return 'full';
      if (str.includes('waitlist')) return 'waitlist';
      if (str.includes('closed') || str.includes('cancelled')) return 'closed';
      if (str.includes('open') || str.includes('available') || str.includes('register')) return 'open';
      return str;
    };

    const extractedNorm = normalize(extracted);
    const parsedNorm = normalize(parsed);

    const match = extractedNorm === parsedNorm;

    return {
      match,
      similarity: match ? 1 : 0,
      normalizedExtracted: extractedNorm,
      normalizedParsed: parsedNorm,
    };
  }

  /**
   * Normalize string for comparison
   */
  normalizeString(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    const longerLength = longer.length;
    if (longerLength === 0) return 1;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longerLength - distance) / longerLength;
  }

  /**
   * Levenshtein distance calculation
   */
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Get severity weight for scoring
   */
  getSeverityWeight(severity) {
    const weights = {
      critical: 3,
      high: 2,
      medium: 1,
      low: 0.5,
    };
    return weights[severity] || 1;
  }

  /**
   * Calculate weighted match score based on severity
   */
  calculateWeightedScore(results) {
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const [field, result] of Object.entries(results.fieldResults)) {
      if (result.extracted === null || result.extracted === undefined) continue;

      const weight = this.getSeverityWeight(result.severity);
      totalWeight += weight;
      if (result.match) {
        matchedWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  }
}

module.exports = DataComparator;
