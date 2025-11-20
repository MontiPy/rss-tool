import { ToleranceItem, RSSResult, CalculationMode } from '../types';

/**
 * Common float factors
 */
export const FLOAT_FACTORS = {
  FIXED: 1.0,
  SQRT2: Math.sqrt(2), // ≈ 1.414
  SQRT3: Math.sqrt(3), // ≈ 1.732
} as const;

// Backward compatibility
const FLOAT_FACTOR = FLOAT_FACTORS.SQRT3;

/**
 * Get the float factor for an item (with backward compatibility)
 */
function getItemFloatFactor(item: ToleranceItem): number {
  // Use new floatFactor if available
  if (item.floatFactor !== undefined) {
    return item.floatFactor;
  }
  // Backward compatibility: convert isFloat boolean to floatFactor
  if (item.isFloat !== undefined) {
    return item.isFloat ? FLOAT_FACTOR : 1;
  }
  // Default to fixed (1.0)
  return 1;
}

/**
 * Calculate tolerances using specified mode (RSS or Worst-Case)
 *
 * RSS Formula: √(Σ((tolerance × float_factor)²))
 * Worst-Case Formula: Σ(tolerance × float_factor)
 *
 * @param items - Array of tolerance items
 * @param directionId - ID of the direction being calculated
 * @param directionName - Name of the direction being calculated
 * @param mode - Calculation mode: 'rss' (default) or 'worstCase'
 * @returns RSSResult with total tolerances and individual contributions
 */
export function calculateTolerance(
  items: ToleranceItem[],
  directionId: string,
  directionName: string,
  mode: CalculationMode = 'rss'
): RSSResult {
  let sumOfSquaresPlus = 0;
  let sumOfSquaresMinus = 0;
  let worstCasePlus = 0;
  let worstCaseMinus = 0;
  const itemContributions: RSSResult['itemContributions'] = [];

  items.forEach((item) => {
    // Determine float factor (supports both new and old format)
    const floatFactor = getItemFloatFactor(item);

    // Calculate contribution for this item (tolerance × float_factor)
    const contributionPlus = item.tolerancePlus * floatFactor;
    const contributionMinus = item.toleranceMinus * floatFactor;

    // Add to sums for both calculation modes
    sumOfSquaresPlus += contributionPlus ** 2;
    sumOfSquaresMinus += contributionMinus ** 2;
    worstCasePlus += contributionPlus;
    worstCaseMinus += contributionMinus;

    // Store individual contributions for display
    itemContributions.push({
      itemId: item.id,
      itemName: item.name,
      contributionPlus,
      contributionMinus,
    });
  });

  // Calculate based on mode
  const totalPlus = mode === 'rss' ? Math.sqrt(sumOfSquaresPlus) : worstCasePlus;
  const totalMinus = mode === 'rss' ? Math.sqrt(sumOfSquaresMinus) : worstCaseMinus;

  return {
    directionId,
    directionName,
    totalPlus,
    totalMinus,
    worstCasePlus,
    worstCaseMinus,
    itemContributions,
  };
}

/**
 * Calculate RSS (Root Sum Square) - backward compatibility wrapper
 * @deprecated Use calculateTolerance() instead
 */
export function calculateRSS(
  items: ToleranceItem[],
  directionId: string,
  directionName: string
): RSSResult {
  return calculateTolerance(items, directionId, directionName, 'rss');
}

/**
 * Get the float factor constant (√3)
 * @deprecated Use FLOAT_FACTORS.SQRT3 instead
 */
export function getFloatFactor(): number {
  return FLOAT_FACTOR;
}

/**
 * Convert value from one unit to another
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  // Conversion factors to mm
  const toMm: Record<string, number> = {
    'mm': 1,
    'inches': 25.4,
    'μm': 0.001,
    'mils': 0.0254,
  };

  // Convert to mm first, then to target unit
  const valueInMm = value * (toMm[fromUnit] || 1);
  return valueInMm / (toMm[toUnit] || 1);
}

/**
 * Format value with unit conversion for multi-unit display
 */
export function formatWithMultiUnit(
  value: number,
  primaryUnit: string,
  secondaryUnit: string,
  decimals: number = 4
): string {
  const primaryValue = value.toFixed(decimals);
  const secondaryValue = convertUnit(value, primaryUnit, secondaryUnit).toFixed(decimals);
  return `${primaryValue} ${primaryUnit} (${secondaryValue} ${secondaryUnit})`;
}
