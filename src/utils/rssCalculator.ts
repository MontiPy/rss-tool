import {
  ToleranceItem,
  RSSResult,
  CalculationMode,
  CapabilityAnalysis,
  SpecLimitStatus,
  ToleranceUnit,
} from '../types';

/**
 * Common float factors
 */
export const FLOAT_FACTORS = {
  FIXED: 1.0,
  SQRT2: Math.sqrt(2), // ≈ 1.414
  SQRT3: Math.sqrt(3), // ≈ 1.732
} as const;

/**
 * Conversion factors to millimetres
 */
export const UNIT_TO_MM: Record<ToleranceUnit, number> = {
  mm: 1,
  inches: 25.4,
  μm: 0.001,
  mils: 0.0254,
};

/**
 * Utilization thresholds (percent of available margin) for spec limit status
 */
export const SPEC_WARNING_THRESHOLD = 90;
export const SPEC_FAIL_THRESHOLD = 100;

/**
 * Get the float factor for an item (with backward compatibility for legacy `isFloat`)
 */
export function getItemFloatFactor(item: ToleranceItem): number {
  if (item.floatFactor !== undefined && Number.isFinite(item.floatFactor)) {
    return item.floatFactor;
  }
  if (item.isFloat !== undefined) {
    return item.isFloat ? FLOAT_FACTORS.SQRT3 : FLOAT_FACTORS.FIXED;
  }
  return FLOAT_FACTORS.FIXED;
}

/**
 * Whether an item uses a floating (> 1.0) float factor
 */
export function isFloatingItem(item: ToleranceItem): boolean {
  return getItemFloatFactor(item) > 1.5;
}

/**
 * Sum of item nominal values (the predicted nominal of the stack)
 */
export function getStackNominal(items: ToleranceItem[]): number {
  return items.reduce((sum, item) => sum + (item.nominal || 0), 0);
}

/**
 * The value the stack distribution is centered on.
 * Uses the user-defined target nominal when set, otherwise the sum of item nominals
 * (which is 0 for stacks without nominals, matching the classic ±deviation usage).
 */
export function getStackCenter(items: ToleranceItem[], targetNominal?: number): number {
  return targetNominal !== undefined && Number.isFinite(targetNominal)
    ? targetNominal
    : getStackNominal(items);
}

/**
 * Calculate tolerances using specified mode (RSS or Worst-Case)
 *
 * RSS Formula: √(Σ((tolerance × float_factor)²))
 * Worst-Case Formula: Σ(tolerance × float_factor)
 *
 * Percent contributions are variance shares (c² / Σc²) in RSS mode and linear shares
 * (c / Σc) in Worst-Case mode, so they always add up to 100%.
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

  const raw = items.map((item) => {
    const floatFactor = getItemFloatFactor(item);
    const contributionPlus = item.tolerancePlus * floatFactor;
    const contributionMinus = item.toleranceMinus * floatFactor;

    sumOfSquaresPlus += contributionPlus ** 2;
    sumOfSquaresMinus += contributionMinus ** 2;
    worstCasePlus += contributionPlus;
    worstCaseMinus += contributionMinus;

    return { itemId: item.id, itemName: item.name, contributionPlus, contributionMinus };
  });

  const useVariance = mode !== 'worstCase';
  const share = (value: number, sum: number, sumSq: number) => {
    if (useVariance) return sumSq > 0 ? (value ** 2 / sumSq) * 100 : 0;
    return sum > 0 ? (value / sum) * 100 : 0;
  };

  const itemContributions = raw.map((c) => ({
    ...c,
    percentPlus: share(c.contributionPlus, worstCasePlus, sumOfSquaresPlus),
    percentMinus: share(c.contributionMinus, worstCaseMinus, sumOfSquaresMinus),
  }));

  const totalPlus = mode === 'worstCase' ? worstCasePlus : Math.sqrt(sumOfSquaresPlus);
  const totalMinus = mode === 'worstCase' ? worstCaseMinus : Math.sqrt(sumOfSquaresMinus);

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
 * Convert value from one unit to another
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  const from = UNIT_TO_MM[fromUnit as ToleranceUnit] ?? 1;
  const to = UNIT_TO_MM[toUnit as ToleranceUnit] ?? 1;
  return (value * from) / to;
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
 * Evaluate one side of the stack against a specification limit.
 *
 * margin      = distance from the stack center to the limit
 * utilization = total / margin × 100
 *
 * With the center at 0 this reduces to total / |limit|, the classic ±budget check.
 */
export function evaluateSpecLimit(
  side: 'upper' | 'lower',
  limit: number,
  center: number,
  total: number
): SpecLimitStatus {
  const margin = side === 'upper' ? limit - center : center - limit;
  const extreme = side === 'upper' ? center + total : center - total;
  const exceedsBy = Math.max(0, total - margin);

  let utilization: number;
  if (margin > 0) {
    utilization = (total / margin) * 100;
  } else {
    utilization = total === 0 && margin === 0 ? 100 : Infinity;
  }

  let status: SpecLimitStatus['status'] = 'pass';
  if (utilization > SPEC_FAIL_THRESHOLD) status = 'fail';
  else if (utilization >= SPEC_WARNING_THRESHOLD) status = 'warning';

  return { limit, margin, extreme, utilization, exceedsBy, status };
}

/**
 * Complementary error function.
 * Chebyshev approximation (Numerical Recipes `erfcc`) with fractional error < 1.2e-7
 * everywhere, so tail probabilities (PPM) stay accurate far from the mean.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

/**
 * Standard normal cumulative distribution function, P(Z ≤ z)
 */
export function normalCDF(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/**
 * Standard normal survival function, P(Z > z).
 * Prefer this over 1 - normalCDF(z) for upper tails to avoid cancellation.
 */
export function normalSF(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

/**
 * Probability of falling outside each specification limit for a normal distribution
 */
export function normalTailRisk(mean: number, sigma: number, usl?: number, lsl?: number) {
  const outside = (beyond: boolean) => (beyond ? 1 : 0);
  let probabilityExceedingUSL = 0;
  let probabilityExceedingLSL = 0;

  if (usl !== undefined) {
    probabilityExceedingUSL = sigma > 0 ? normalSF((usl - mean) / sigma) : outside(mean > usl);
  }
  if (lsl !== undefined) {
    probabilityExceedingLSL = sigma > 0 ? normalCDF((lsl - mean) / sigma) : outside(mean < lsl);
  }

  const probabilityOutOfSpec = Math.min(1, probabilityExceedingUSL + probabilityExceedingLSL);
  return {
    usl,
    lsl,
    probabilityExceedingUSL,
    probabilityExceedingLSL,
    probabilityOutOfSpec,
    expectedDefectRate: probabilityOutOfSpec * 1_000_000,
  };
}

/**
 * Process capability for a stack whose total represents ±3σ.
 *
 * Cpu = (USL − μ) / 3σ, Cpl = (μ − LSL) / 3σ, Cpk = min(Cpu, Cpl), Cp = (USL − LSL) / 6σ.
 * Returns undefined when neither limit is set.
 */
export function calculateCapability(
  total3Sigma: number,
  center: number,
  usl?: number,
  lsl?: number
): CapabilityAnalysis | undefined {
  if (usl === undefined && lsl === undefined) return undefined;

  const sigma = total3Sigma / 3;
  const safeDiv = (num: number, den: number) => (den > 0 ? num / den : num >= 0 ? Infinity : -Infinity);

  const cpu = usl !== undefined ? safeDiv(usl - center, 3 * sigma) : undefined;
  const cpl = lsl !== undefined ? safeDiv(center - lsl, 3 * sigma) : undefined;
  const cp = usl !== undefined && lsl !== undefined ? safeDiv(usl - lsl, 6 * sigma) : undefined;
  const currentCpk = Math.min(cpu ?? Infinity, cpl ?? Infinity);

  const risk = normalTailRisk(center, sigma, usl, lsl);

  // Cpk = d / 3σ  →  required 3σ = d / Cpk, where d is the distance to the nearest limit
  const nearest = Math.min(
    usl !== undefined ? usl - center : Infinity,
    lsl !== undefined ? center - lsl : Infinity
  );
  const required = (cpk: number) => Math.max(0, nearest / cpk);

  return {
    mean: center,
    sigma,
    current3Sigma: total3Sigma,
    cp,
    cpu,
    cpl,
    currentCpk,
    currentYield: (1 - risk.probabilityOutOfSpec) * 100,
    ppm: risk.expectedDefectRate,
    required3SigmaFor1_33Cpk: required(1.33),
    required3SigmaFor1_66Cpk: required(1.66),
  };
}

/**
 * Calculate statistical analysis for a symmetric ±budget centered at 0
 * @deprecated Use calculateCapability() instead
 */
export function calculateStatisticalAnalysis(rssValue: number, targetBudget: number) {
  return calculateCapability(rssValue, 0, targetBudget, -targetBudget)!;
}

/**
 * Normal probability density function (PDF)
 */
export function normalPdf(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

/**
 * Generate theoretical RSS distribution curve data
 * Assumes RSS total represents ±3σ of a normal distribution centered on `center`
 */
export function generateRSSDistribution(
  rssTotal: number,
  center: number = 0,
  usl?: number,
  lsl?: number,
  numPoints: number = 500,
  customMinX?: number,
  customMaxX?: number
) {
  const mean = center;
  const stdDev = rssTotal / 3;

  let minX: number;
  let maxX: number;
  if (customMinX !== undefined && customMaxX !== undefined && customMaxX > customMinX) {
    minX = customMinX;
    maxX = customMaxX;
  } else {
    const range = 4 * (stdDev || 1);
    minX = mean - range;
    maxX = mean + range;
  }

  const step = (maxX - minX) / numPoints;
  const curveData = [];
  if (stdDev > 0) {
    for (let i = 0; i <= numPoints; i++) {
      const x = minX + i * step;
      curveData.push({ x, pdf: normalPdf(x, mean, stdDev) });
    }
  }

  const riskAnalysis =
    usl !== undefined || lsl !== undefined ? normalTailRisk(mean, stdDev, usl, lsl) : undefined;

  return { mean, stdDev, curveData, riskAnalysis, minX, maxX };
}

/**
 * "Nice" axis tick values between min and max, at most ~maxTicks of them.
 * When `increment` is given it is used unless it would produce too many ticks.
 */
export function generateTicks(min: number, max: number, increment?: number, maxTicks: number = 12): number[] {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return [];

  let step = increment && increment > 0 ? increment : 0;
  if (!step || range / step > maxTicks * 4) {
    const raw = range / 8;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const normalized = raw / magnitude;
    const nice = normalized < 1.5 ? 1 : normalized < 3 ? 2.5 : normalized < 7 ? 5 : 10;
    step = nice * magnitude;
  }

  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 3);
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let i = 0; ; i++) {
    const value = start + i * step;
    if (value > max + step * 1e-9) break;
    ticks.push(Number(value.toFixed(decimals)));
  }
  return ticks;
}
