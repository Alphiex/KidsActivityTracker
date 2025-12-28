export const formatPrice = (price: number | string | undefined | null): string => {
  if (price === undefined || price === null) return '0.00';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2);
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