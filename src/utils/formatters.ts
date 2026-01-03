export const formatPrice = (price: number | string | undefined | null): string => {
  if (price === undefined || price === null) return '0.00';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2);
};

/**
 * Format price for display on activity cards
 * Returns "Free" for $0 activities, otherwise formatted price with $ prefix
 */
export const formatActivityPrice = (price: number | string | undefined | null): string => {
  if (price === undefined || price === null) return 'Free';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice) || numPrice === 0) return 'Free';
  return `$${numPrice.toFixed(2)}`;
};

/**
 * Format time string (e.g., "14:30" or "2:30 PM") to a readable format
 */
export const formatTime = (time: string | undefined | null): string => {
  if (!time) return '';

  // If already has AM/PM, return as-is
  if (/[AaPp][Mm]/.test(time)) {
    return time.replace(/\s+/g, ' ').trim();
  }

  // Parse 24h format "HH:mm" or "HH:mm:ss"
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'pm' : 'am';

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  return `${hours}:${minutes} ${ampm}`;
};

/**
 * Clean activity name by removing test/mock prefixes
 */
export const cleanActivityName = (name: string | undefined | null): string => {
  if (!name) return '';
  // Remove [MOCK SPONSOR], [TEST], [DEMO] and similar prefixes
  return name
    .replace(/^\[MOCK SPONSOR\]\s*/i, '')
    .replace(/^\[MOCK\]\s*/i, '')
    .replace(/^\[TEST\]\s*/i, '')
    .replace(/^\[DEMO\]\s*/i, '')
    .replace(/^\[SPONSOR\]\s*/i, '')
    .trim();
};