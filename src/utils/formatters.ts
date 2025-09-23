export const formatPrice = (price: number | string | undefined | null): string => {
  if (price === undefined || price === null) return '0.00';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2);
};