import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

// Raw row from CSV/XLSX
export interface RawRow {
  [key: string]: string | number | boolean | null;
}

// Parse options
export interface ParseOptions {
  delimiter?: string;
  hasHeaders?: boolean;
  skipEmptyRows?: boolean;
  trimValues?: boolean;
}

// Field mapping suggestion
export interface FieldMappingSuggestion {
  [activityField: string]: {
    suggestedColumn: string | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
    alternatives: string[];
  };
}

// Default column name mappings (case-insensitive matching)
const DEFAULT_COLUMN_MAPPINGS: Record<string, string[]> = {
  externalId: ['course id', 'external id', 'id', 'activity id', 'program id', 'course_id', 'external_id'],
  name: ['activity name', 'name', 'title', 'course name', 'program name', 'activity', 'course'],
  category: ['category', 'type', 'activity type', 'program type'],
  subcategory: ['subcategory', 'sub category', 'subtype', 'sub type'],
  description: ['description', 'summary', 'about', 'details', 'overview'],
  dateStart: ['start date', 'begin date', 'from', 'date start', 'starts', 'start'],
  dateEnd: ['end date', 'finish date', 'to', 'date end', 'ends', 'end'],
  startTime: ['start time', 'begin time', 'time start', 'from time'],
  endTime: ['end time', 'finish time', 'time end', 'to time'],
  dayOfWeek: ['days', 'day of week', 'days of week', 'schedule days', 'weekdays'],
  cost: ['price', 'cost', 'fee', 'amount', 'rate', 'tuition'],
  ageMin: ['minimum age', 'age min', 'from age', 'min age', 'age from', 'age minimum'],
  ageMax: ['maximum age', 'age max', 'to age', 'max age', 'age to', 'age maximum'],
  locationName: ['location', 'venue', 'facility', 'site', 'place', 'address'],
  instructor: ['instructor', 'teacher', 'coach', 'leader', 'staff'],
  spotsAvailable: ['spots available', 'availability', 'spots', 'openings', 'seats available'],
  totalSpots: ['total spots', 'capacity', 'max spots', 'total capacity', 'max participants'],
  registrationUrl: ['registration url', 'registration link', 'sign up url', 'register url', 'url'],
  registrationStatus: ['registration status', 'status', 'availability status'],
  prerequisites: ['prerequisites', 'requirements', 'prereqs', 'required'],
  whatToBring: ['what to bring', 'items needed', 'bring', 'required items', 'equipment'],
  fullAddress: ['full address', 'street address', 'address', 'location address'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon'],
};

export class FileParserService {
  /**
   * Parse CSV buffer to array of row objects
   */
  parseCSV(buffer: Buffer, options: ParseOptions = {}): RawRow[] {
    const {
      delimiter = ',',
      hasHeaders = true,
      skipEmptyRows = true,
      trimValues = true,
    } = options;

    try {
      const content = buffer.toString('utf-8');

      // Detect delimiter if comma doesn't work well
      const detectedDelimiter = delimiter || this.detectDelimiter(content);

      const records = parse(content, {
        columns: hasHeaders,
        skip_empty_lines: skipEmptyRows,
        trim: trimValues,
        delimiter: detectedDelimiter,
        relax_column_count: true,
        skip_records_with_error: true,
      });

      return records as RawRow[];
    } catch (error: any) {
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
  }

  /**
   * Parse XLSX buffer to array of row objects
   */
  parseXLSX(buffer: Buffer, sheetName?: string): RawRow[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Get sheet name (first sheet if not specified)
      const targetSheet = sheetName || workbook.SheetNames[0];

      if (!workbook.SheetNames.includes(targetSheet)) {
        throw new Error(`Sheet "${targetSheet}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
      }

      const worksheet = workbook.Sheets[targetSheet];

      // Convert to JSON with headers
      const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
        raw: false, // Convert all values to strings for consistent handling
        defval: null,
      });

      return rows;
    } catch (error: any) {
      throw new Error(`Failed to parse XLSX: ${error.message}`);
    }
  }

  /**
   * Get available sheet names from XLSX
   */
  getXLSXSheetNames(buffer: Buffer): string[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames;
  }

  /**
   * Detect delimiter from CSV content sample
   */
  detectDelimiter(sample: string): string {
    const lines = sample.split('\n').slice(0, 5); // Check first 5 lines
    const delimiters = [',', ';', '\t', '|'];

    const counts: Record<string, number[]> = {};

    delimiters.forEach(d => {
      counts[d] = lines.map(line => (line.match(new RegExp(`\\${d}`, 'g')) || []).length);
    });

    // Find delimiter with most consistent count across lines
    let bestDelimiter = ',';
    let bestScore = 0;

    delimiters.forEach(d => {
      const avg = counts[d].reduce((a, b) => a + b, 0) / counts[d].length;
      const variance = counts[d].reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts[d].length;

      // Score based on count (higher is better) and consistency (lower variance is better)
      const score = avg / (1 + variance);

      if (score > bestScore && avg > 0) {
        bestScore = score;
        bestDelimiter = d;
      }
    });

    return bestDelimiter;
  }

  /**
   * Detect headers from first row of data
   */
  detectHeaders(rows: RawRow[]): string[] {
    if (rows.length === 0) {
      return [];
    }

    return Object.keys(rows[0]);
  }

  /**
   * Suggest field mappings based on column headers
   */
  suggestFieldMappings(headers: string[]): FieldMappingSuggestion {
    const suggestions: FieldMappingSuggestion = {};
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    for (const [activityField, columnNames] of Object.entries(DEFAULT_COLUMN_MAPPINGS)) {
      let suggestedColumn: string | null = null;
      let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
      const alternatives: string[] = [];

      // Look for exact matches first
      for (const columnName of columnNames) {
        const index = normalizedHeaders.findIndex(h => h === columnName);
        if (index !== -1) {
          suggestedColumn = headers[index];
          confidence = 'high';
          break;
        }
      }

      // If no exact match, look for partial matches
      if (!suggestedColumn) {
        for (const columnName of columnNames) {
          for (let i = 0; i < normalizedHeaders.length; i++) {
            if (normalizedHeaders[i].includes(columnName) || columnName.includes(normalizedHeaders[i])) {
              if (!suggestedColumn) {
                suggestedColumn = headers[i];
                confidence = 'medium';
              } else if (!alternatives.includes(headers[i])) {
                alternatives.push(headers[i]);
              }
            }
          }
        }
      }

      // If still no match, check for similar words
      if (!suggestedColumn) {
        for (const columnName of columnNames) {
          const words = columnName.split(' ');
          for (let i = 0; i < normalizedHeaders.length; i++) {
            if (words.some(word => normalizedHeaders[i].includes(word))) {
              if (!suggestedColumn) {
                suggestedColumn = headers[i];
                confidence = 'low';
              } else if (!alternatives.includes(headers[i])) {
                alternatives.push(headers[i]);
              }
            }
          }
        }
      }

      suggestions[activityField] = {
        suggestedColumn,
        confidence,
        alternatives: alternatives.slice(0, 3), // Limit to 3 alternatives
      };
    }

    return suggestions;
  }

  /**
   * Validate file type
   */
  validateFileType(fileName: string, mimeType: string): 'csv' | 'xlsx' | null {
    const extension = fileName.toLowerCase().split('.').pop();

    if (extension === 'csv' || mimeType === 'text/csv' || mimeType === 'application/csv') {
      return 'csv';
    }

    if (
      extension === 'xlsx' ||
      extension === 'xls' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return 'xlsx';
    }

    return null;
  }

  /**
   * Parse file based on type
   */
  parseFile(buffer: Buffer, fileType: 'csv' | 'xlsx', options?: ParseOptions): RawRow[] {
    if (fileType === 'csv') {
      return this.parseCSV(buffer, options);
    } else {
      return this.parseXLSX(buffer);
    }
  }

  /**
   * Get file statistics
   */
  getFileStats(rows: RawRow[]): {
    totalRows: number;
    columns: string[];
    sampleData: RawRow[];
    emptyRows: number;
  } {
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    let emptyRows = 0;
    rows.forEach(row => {
      const values = Object.values(row);
      if (values.every(v => v === null || v === '' || v === undefined)) {
        emptyRows++;
      }
    });

    return {
      totalRows: rows.length,
      columns,
      sampleData: rows.slice(0, 5), // First 5 rows as sample
      emptyRows,
    };
  }
}

// Export singleton instance
export const fileParserService = new FileParserService();
