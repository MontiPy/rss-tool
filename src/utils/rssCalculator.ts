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

/**
 * Calculate statistical analysis for tolerance results
 * Note: Input tolerances are assumed to represent 3σ values (industry standard)
 *
 * @param rssValue - The RSS total value (3σ)
 * @param targetBudget - Target tolerance budget
 * @returns Statistical analysis data showing current Cpk and required 3σ for capability targets
 */
export function calculateStatisticalAnalysis(
  rssValue: number,
  targetBudget: number
) {
  // RSS result is 3σ (since input tolerances are 3σ)
  const current3Sigma = rssValue;

  // Convert to 1σ for Cpk calculation
  const oneSigma = current3Sigma / 3;

  // Current Process Capability Index (Cpk)
  // Cpk = (USL - mean) / (3 * sigma)
  // For centered process: Cpk = USL / (3 * sigma)
  const currentCpk = targetBudget / (3 * oneSigma);

  // Estimated yield using normal distribution approximation
  // Z-score = (targetBudget - 0) / oneSigma
  const zScore = targetBudget / oneSigma;
  const currentYield = normalCDF(zScore) * 100;

  // Calculate required 3σ values for target Cpk levels
  // Rearranging Cpk = USL / (3 * sigma), we get: sigma = USL / (3 * Cpk)
  // So 3σ = USL / Cpk
  const required3SigmaFor1_33Cpk = targetBudget / 1.33;
  const required3SigmaFor1_66Cpk = targetBudget / 1.66;

  return {
    current3Sigma,
    currentCpk,
    currentYield,
    required3SigmaFor1_33Cpk,
    required3SigmaFor1_66Cpk,
  };
}

/**
 * Approximate normal cumulative distribution function
 * Uses the error function approximation
 *
 * @param z - The z-score
 * @returns Probability (0 to 1)
 */
export function normalCDF(z: number): number {
  // Approximation using error function
  // CDF(z) ≈ 0.5 * (1 + erf(z / sqrt(2)))

  // For positive z-scores, use approximation
  if (z >= 0) {
    const t = 1 / (1 + 0.2316419 * z);
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const prob = 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return prob;
  } else {
    // For negative z-scores, use symmetry
    return 1 - normalCDF(-z);
  }
}

/**
 * Normal probability density function (PDF)
 * Used to generate smooth distribution curves for visualization
 *
 * @param x - The value at which to evaluate the PDF
 * @param mean - The mean (μ) of the distribution
 * @param std - The standard deviation (σ) of the distribution
 * @returns The probability density at x
 */
export function normalPdf(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

/**
 * Generate theoretical RSS distribution curve data
 * Assumes RSS total represents ±3σ of a normal distribution
 *
 * @param rssTotal - The RSS total tolerance (represents ±3σ)
 * @param usl - Upper Specification Limit (optional)
 * @param lsl - Lower Specification Limit (optional)
 * @param numPoints - Number of points to generate for the curve (default: 500)
 * @param customMinX - Custom minimum x value for range (optional)
 * @param customMaxX - Custom maximum x value for range (optional)
 * @returns Object with curve data and risk analysis
 */
export function generateRSSDistribution(
  rssTotal: number,
  usl?: number,
  lsl?: number,
  numPoints: number = 500,
  customMinX?: number,
  customMaxX?: number
) {
  // Assume RSS total is 3σ (99.7% confidence interval)
  const mean = 0;
  const stdDev = rssTotal / 3;

  // Calculate the range to display
  let minX: number;
  let maxX: number;

  if (customMinX !== undefined && customMaxX !== undefined) {
    // Use custom range if provided
    minX = customMinX;
    maxX = customMaxX;
  } else {
    // Default: ±4σ for better visualization
    const range = 4 * stdDev;
    minX = mean - range;
    maxX = mean + range;
  }

  const step = (maxX - minX) / numPoints;

  // Generate curve data points
  const curveData = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = minX + i * step;
    const pdf = normalPdf(x, mean, stdDev);
    curveData.push({ x, pdf });
  }

  // Calculate probabilities of exceeding specification limits
  let riskAnalysis;
  if (usl !== undefined || lsl !== undefined) {
    const probExceedingUSL = usl !== undefined ? 1 - normalCDF((usl - mean) / stdDev) : 0;
    const probExceedingLSL = lsl !== undefined ? normalCDF((lsl - mean) / stdDev) : 0;
    const probOutOfSpec = probExceedingUSL + probExceedingLSL;
    const expectedDefectRate = probOutOfSpec * 1_000_000; // PPM

    riskAnalysis = {
      usl,
      lsl,
      probabilityExceedingUSL: probExceedingUSL,
      probabilityExceedingLSL: probExceedingLSL,
      probabilityOutOfSpec: probOutOfSpec,
      expectedDefectRate: expectedDefectRate,
    };
  }

  return {
    mean,
    stdDev,
    curveData,
    riskAnalysis,
    minX,
    maxX,
  };
}
