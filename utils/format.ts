
/**
 * Safely format token units by flooring to specified decimal places
 * (Avoids rounding up which causes insufficient balance errors)
 */
export function safeFormatUnits(value: number | string, decimals: number): string {
  const str = value.toString();
  // If scientific notation, expand it (simple approach, or use BigDecimal lib if available)
  if (str.includes('e')) {
    return Number(value).toFixed(decimals); // Fallback for small numbers
  }
  
  const [integer, fraction] = str.split('.');
  if (!fraction) return str;
  if (fraction.length <= decimals) return str;
  return `${integer}.${fraction.slice(0, decimals)}`;
}

export function floorToFixed(num: number, decimals: number): string {
    const multiplier = Math.pow(10, decimals);
    return (Math.floor(num * multiplier) / multiplier).toFixed(decimals);
}
