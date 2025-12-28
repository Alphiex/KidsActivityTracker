import { PrismaClient, Activity, Vendor } from '../../generated/prisma';
import { RawRow } from './fileParserService';

const prisma = new PrismaClient();

// Field mapping configuration
export interface FieldMapping {
  [activityField: string]: string | null; // Maps activity field to CSV column name
}

// Validation result for a single field
export interface FieldValidationError {
  field: string;
  value: any;
  message: string;
  severity: 'error' | 'warning';
}

// Validation result for a row
export interface RowValidationResult {
  isValid: boolean;
  errors: FieldValidationError[];
  warnings: FieldValidationError[];
}

// Normalized activity data ready for database
export interface NormalizedActivity {
  externalId: string;
  name: string;
  category?: string;
  subcategory?: string;
  description?: string;
  dateStart?: Date;
  dateEnd?: Date;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: string[];
  cost?: number;
  ageMin?: number;
  ageMax?: number;
  locationName?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  instructor?: string;
  spotsAvailable?: number;
  totalSpots?: number;
  registrationUrl?: string;
  registrationStatus?: string;
  prerequisites?: string;
  whatToBring?: string;
}

// Validation rules for each field
const VALIDATION_RULES: Record<string, {
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any, row: RawRow) => string | null;
}> = {
  externalId: {
    required: true,
    type: 'string',
    maxLength: 255,
  },
  name: {
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 500,
  },
  category: {
    type: 'string',
    maxLength: 100,
  },
  subcategory: {
    type: 'string',
    maxLength: 100,
  },
  description: {
    type: 'string',
    maxLength: 5000,
  },
  cost: {
    type: 'number',
    min: 0,
    max: 100000,
  },
  ageMin: {
    type: 'number',
    min: 0,
    max: 99,
  },
  ageMax: {
    type: 'number',
    min: 0,
    max: 99,
    custom: (value, row) => {
      const ageMin = parseFloat(row.ageMin as string) || 0;
      if (value !== null && value < ageMin) {
        return 'Maximum age must be greater than or equal to minimum age';
      }
      return null;
    },
  },
  registrationUrl: {
    type: 'string',
    maxLength: 2000,
  },
  spotsAvailable: {
    type: 'number',
    min: 0,
    max: 10000,
  },
  totalSpots: {
    type: 'number',
    min: 0,
    max: 10000,
  },
  latitude: {
    type: 'number',
    min: -90,
    max: 90,
  },
  longitude: {
    type: 'number',
    min: -180,
    max: 180,
  },
};

export class ActivityImportMapper {
  /**
   * Map raw row data to normalized activity using field mapping
   */
  mapRawToActivity(rawData: RawRow, mapping: FieldMapping): NormalizedActivity {
    const activity: NormalizedActivity = {
      externalId: '',
      name: '',
    };

    // Map each field
    for (const [activityField, columnName] of Object.entries(mapping)) {
      if (columnName && rawData[columnName] !== undefined) {
        const rawValue = rawData[columnName];
        const normalizedValue = this.normalizeValue(activityField, rawValue);

        if (normalizedValue !== null && normalizedValue !== undefined) {
          (activity as any)[activityField] = normalizedValue;
        }
      }
    }

    return activity;
  }

  /**
   * Normalize a single value based on field type
   */
  private normalizeValue(field: string, value: any): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const stringValue = String(value).trim();

    switch (field) {
      case 'externalId':
      case 'name':
      case 'category':
      case 'subcategory':
      case 'description':
      case 'locationName':
      case 'fullAddress':
      case 'instructor':
      case 'registrationUrl':
      case 'registrationStatus':
      case 'prerequisites':
      case 'whatToBring':
        return stringValue;

      case 'cost':
        return this.parseCost(stringValue);

      case 'ageMin':
      case 'ageMax':
        return this.parseAge(stringValue);

      case 'spotsAvailable':
      case 'totalSpots':
        return this.parseInteger(stringValue);

      case 'latitude':
      case 'longitude':
        return this.parseFloat(stringValue);

      case 'dateStart':
      case 'dateEnd':
        return this.parseDate(stringValue);

      case 'startTime':
      case 'endTime':
        return this.parseTime(stringValue);

      case 'dayOfWeek':
        return this.parseDaysOfWeek(stringValue);

      default:
        return stringValue;
    }
  }

  /**
   * Parse cost string to number
   */
  private parseCost(value: string): number | null {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$€£,]/g, '').trim();

    // Handle "free" or "no cost"
    if (cleaned.toLowerCase() === 'free' || cleaned === '0' || cleaned === '') {
      return 0;
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse age string to number
   */
  private parseAge(value: string): number | null {
    // Handle ranges like "5-10" - take the first number
    const match = value.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Parse integer string
   */
  private parseInteger(value: string): number | null {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse float string
   */
  private parseFloat(value: string): number | null {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse date string
   */
  private parseDate(value: string): Date | null {
    // Try common date formats
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // ISO: 2024-01-15
      /^\d{2}\/\d{2}\/\d{4}$/, // US: 01/15/2024
      /^\d{2}-\d{2}-\d{4}$/, // EU: 15-01-2024
      /^[A-Za-z]+ \d{1,2}, \d{4}$/, // Long: January 15, 2024
    ];

    // Try native Date parsing
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try parsing MM/DD/YYYY
    const usMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (usMatch) {
      return new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    }

    // Try parsing DD-MM-YYYY
    const euMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (euMatch) {
      return new Date(parseInt(euMatch[3]), parseInt(euMatch[2]) - 1, parseInt(euMatch[1]));
    }

    return null;
  }

  /**
   * Parse time string
   */
  private parseTime(value: string): string | null {
    // Already in HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      return value;
    }

    // Handle 12-hour format with AM/PM
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3]?.toLowerCase();

      if (period === 'pm' && hours < 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }

      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    return value; // Return as-is if can't parse
  }

  /**
   * Parse days of week string
   */
  private parseDaysOfWeek(value: string): string[] {
    const dayMappings: Record<string, string> = {
      'monday': 'Mon',
      'mon': 'Mon',
      'm': 'Mon',
      'tuesday': 'Tue',
      'tues': 'Tue',
      'tue': 'Tue',
      't': 'Tue',
      'wednesday': 'Wed',
      'wed': 'Wed',
      'w': 'Wed',
      'thursday': 'Thu',
      'thurs': 'Thu',
      'thu': 'Thu',
      'friday': 'Fri',
      'fri': 'Fri',
      'f': 'Fri',
      'saturday': 'Sat',
      'sat': 'Sat',
      's': 'Sat',
      'sunday': 'Sun',
      'sun': 'Sun',
    };

    // Split by common separators
    const parts = value.split(/[,;\/\-&]+/).map(p => p.trim().toLowerCase());
    const days: string[] = [];

    for (const part of parts) {
      if (dayMappings[part]) {
        days.push(dayMappings[part]);
      }
    }

    return days;
  }

  /**
   * Validate a normalized activity
   */
  validateActivity(activity: NormalizedActivity): RowValidationResult {
    const errors: FieldValidationError[] = [];
    const warnings: FieldValidationError[] = [];

    for (const [field, rules] of Object.entries(VALIDATION_RULES)) {
      const value = (activity as any)[field];

      // Required check
      if (rules.required && (value === null || value === undefined || value === '')) {
        errors.push({
          field,
          value,
          message: `${field} is required`,
          severity: 'error',
        });
        continue;
      }

      if (value === null || value === undefined) {
        continue; // Skip other validations for null values
      }

      // Type check
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push({
          field,
          value,
          message: `${field} must be a number`,
          severity: 'error',
        });
        continue;
      }

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({
          field,
          value,
          message: `${field} must be a string`,
          severity: 'error',
        });
        continue;
      }

      // Length checks
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push({
          field,
          value,
          message: `${field} must be at least ${rules.minLength} characters`,
          severity: 'error',
        });
      }

      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        warnings.push({
          field,
          value: value.substring(0, 50) + '...',
          message: `${field} exceeds maximum length of ${rules.maxLength}, will be truncated`,
          severity: 'warning',
        });
      }

      // Range checks
      if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
        errors.push({
          field,
          value,
          message: `${field} must be at least ${rules.min}`,
          severity: 'error',
        });
      }

      if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
        errors.push({
          field,
          value,
          message: `${field} must be at most ${rules.max}`,
          severity: 'error',
        });
      }

      // Pattern check
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push({
          field,
          value,
          message: `${field} has invalid format`,
          severity: 'error',
        });
      }

      // Custom validation
      if (rules.custom) {
        const customError = rules.custom(value, activity as any);
        if (customError) {
          errors.push({
            field,
            value,
            message: customError,
            severity: 'error',
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Find existing activity by vendor and external ID
   */
  async findExistingActivity(
    vendorId: string,
    externalId: string
  ): Promise<Activity | null> {
    // First, get the vendor to find the linked provider
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { providerId: true },
    });

    if (!vendor?.providerId) {
      return null;
    }

    return prisma.activity.findUnique({
      where: {
        providerId_externalId: {
          providerId: vendor.providerId,
          externalId,
        },
      },
    });
  }

  /**
   * Create or update activity from normalized data
   */
  async createOrUpdateActivity(
    activity: NormalizedActivity,
    vendorId: string,
    importBatchId: string
  ): Promise<{ activity: Activity; action: 'created' | 'updated' }> {
    // Get vendor with provider
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { provider: true },
    });

    if (!vendor || !vendor.providerId) {
      throw new Error('Vendor not found or not verified');
    }

    // Check for existing activity
    const existing = await this.findExistingActivity(vendorId, activity.externalId);

    // Build activity data
    const activityData = {
      name: activity.name,
      category: activity.category || 'Uncategorized',
      subcategory: activity.subcategory,
      description: activity.description,
      dateStart: activity.dateStart,
      dateEnd: activity.dateEnd,
      startTime: activity.startTime,
      endTime: activity.endTime,
      dayOfWeek: activity.dayOfWeek || [],
      cost: activity.cost || 0,
      ageMin: activity.ageMin,
      ageMax: activity.ageMax,
      locationName: activity.locationName,
      fullAddress: activity.fullAddress,
      latitude: activity.latitude,
      longitude: activity.longitude,
      instructor: activity.instructor,
      spotsAvailable: activity.spotsAvailable,
      totalSpots: activity.totalSpots,
      registrationUrl: activity.registrationUrl,
      registrationStatus: activity.registrationStatus || 'Unknown',
      prerequisites: activity.prerequisites,
      whatToBring: activity.whatToBring,
      isActive: true,
      lastSeenAt: new Date(),
      lastImportedAt: new Date(),
      importBatchId,

      // Apply featured settings if vendor has them
      ...(vendor.defaultFeaturedTier && {
        isFeatured: true,
        featuredTier: vendor.defaultFeaturedTier,
        featuredStartDate: vendor.featuredStartDate,
        featuredEndDate: vendor.featuredEndDate,
      }),
    };

    if (existing) {
      // Update existing activity
      const updated = await prisma.activity.update({
        where: { id: existing.id },
        data: {
          ...activityData,
          isUpdated: true,
        },
      });

      return { activity: updated, action: 'updated' };
    } else {
      // Create new activity
      const created = await prisma.activity.create({
        data: {
          externalId: activity.externalId,
          providerId: vendor.providerId,
          vendorId,
          importedAt: new Date(),
          ...activityData,
        },
      });

      return { activity: created, action: 'created' };
    }
  }

  /**
   * Get default field mapping based on detected headers
   */
  getDefaultMapping(): FieldMapping {
    return {
      externalId: null,
      name: null,
      category: null,
      subcategory: null,
      description: null,
      dateStart: null,
      dateEnd: null,
      startTime: null,
      endTime: null,
      dayOfWeek: null,
      cost: null,
      ageMin: null,
      ageMax: null,
      locationName: null,
      fullAddress: null,
      latitude: null,
      longitude: null,
      instructor: null,
      spotsAvailable: null,
      totalSpots: null,
      registrationUrl: null,
      registrationStatus: null,
      prerequisites: null,
      whatToBring: null,
    };
  }
}

// Export singleton instance
export const activityImportMapper = new ActivityImportMapper();
