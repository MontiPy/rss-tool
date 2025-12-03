import { ToleranceItem, MonteCarloResult, MonteCarloSettings, DistributionType, HistogramBin, PercentileData } from '../types';

/**
 * Generate random sample from normal distribution using Box-Muller transform
 * Returns signed value (can be positive or negative)
 */
function generateNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Generate random sample from uniform distribution
 */
function generateUniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generate random sample from triangular distribution
 * Mode is at center: (min + max) / 2
 */
function generateTriangular(min: number, max: number): number {
  const u = Math.random();
  const mode = (min + max) / 2;
  const fc = (mode - min) / (max - min);

  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

/**
 * Determine distribution type for an item
 * Auto mode: Normal for fixed (floatFactor=1.0), Uniform for floating (floatFactor≈√3)
 */
function getDistributionType(item: ToleranceItem, useAdvanced: boolean): DistributionType {
  if (useAdvanced && item.distributionType) {
    return item.distributionType;
  }

  // Auto mode: Normal for fixed items, Uniform for floating items
  const SQRT3 = Math.sqrt(3);
  const isFloating = Math.abs(item.floatFactor - SQRT3) < 0.01;
  return isFloating ? 'uniform' : 'normal';
}

/**
 * Sample a single tolerance value from its distribution
 * Returns signed value (positive or negative deviation from nominal)
 */
function sampleTolerance(
  item: ToleranceItem,
  distributionType: DistributionType,
  isPlus: boolean
): number {
  const tolerance = isPlus ? item.tolerancePlus : item.toleranceMinus;

  if (tolerance === 0) return 0;

  switch (distributionType) {
    case 'normal':
      // Assume tolerance is 3σ, so σ = tolerance/3
      // Sample from N(0, σ) - can be positive or negative
      const sigma = tolerance / 3;
      return generateNormal(0, sigma);

    case 'uniform':
      // Sample uniformly between -tolerance and +tolerance
      return generateUniform(-tolerance, tolerance);

    case 'triangular':
      // Triangular from -tolerance to +tolerance, mode at 0
      return generateTriangular(-tolerance, tolerance);

    default:
      return tolerance;
  }
}

/**
 * Create histogram bins from samples
 */
function createHistogram(samples: number[], numBins: number): HistogramBin[] {
  if (samples.length === 0) return [];

  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const binWidth = (max - min) / numBins;

  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    binCenter: min + (i + 0.5) * binWidth,
    count: 0,
    frequency: 0,
  }));

  // Count samples in each bin
  samples.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1);
    bins[binIndex].count++;
  });

  // Normalize frequencies
  bins.forEach(bin => {
    bin.frequency = bin.count / samples.length;
  });

  return bins;
}

/**
 * Calculate percentiles from sorted samples
 */
function calculatePercentiles(sortedSamples: number[]): PercentileData {
  const n = sortedSamples.length;
  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * n) - 1;
    return sortedSamples[Math.max(0, Math.min(index, n - 1))];
  };

  const mean = sortedSamples.reduce((sum, x) => sum + x, 0) / n;
  const variance = sortedSamples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    p5: getPercentile(5),
    p50: getPercentile(50),
    p95: getPercentile(95),
    p99: getPercentile(99),
    mean,
    stdDev,
  };
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  items: ToleranceItem[],
  directionId: string,
  directionName: string,
  settings: MonteCarloSettings,
  usl?: number,
  lsl?: number
): MonteCarloResult {
  const { iterations, useAdvancedDistributions } = settings;

  // Storage for results
  const stackSamples: number[] = [];
  const itemSamplesMap = new Map<string, number[]>();

  // Initialize item sample arrays
  items.forEach(item => {
    itemSamplesMap.set(item.id, []);
  });

  // Run simulation iterations
  for (let i = 0; i < iterations; i++) {
    let totalDeviation = 0;

    items.forEach(item => {
      const distributionType = getDistributionType(item, useAdvancedDistributions);

      // Sample tolerance value (signed deviation from nominal)
      const sampledTolerance = sampleTolerance(item, distributionType, true);

      // Store sample for item histogram
      itemSamplesMap.get(item.id)!.push(sampledTolerance);

      // Calculate contribution with float factor (signed sum, not RSS)
      const contribution = sampledTolerance * item.floatFactor;

      // Linear accumulation: deviations add algebraically
      totalDeviation += contribution;
    });

    // Store total deviation (can be positive or negative)
    stackSamples.push(totalDeviation);
  }

  // Sort samples for percentile calculation
  const sortedSamples = [...stackSamples].sort((a, b) => a - b);
  const percentiles = calculatePercentiles(sortedSamples);

  // Create histogram for final stack (50 bins)
  const histogram = createHistogram(stackSamples, 50);

  // Create histograms for individual items (30 bins each)
  const itemHistograms = new Map<string, HistogramBin[]>();
  items.forEach(item => {
    const itemSamples = itemSamplesMap.get(item.id)!;
    itemHistograms.set(item.id, createHistogram(itemSamples, 30));
  });

  // Calculate item contributions (mean and stdDev of each item's samples)
  const itemContributions = items.map(item => {
    const samples = itemSamplesMap.get(item.id)!;
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
    const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    const weightedMean = mean * item.floatFactor;
    const percentContribution = (weightedMean / percentiles.mean) * 100;

    return {
      itemId: item.id,
      itemName: item.name,
      mean: weightedMean,
      stdDev: stdDev * item.floatFactor,
      percentContribution,
    };
  });

  // Risk analysis (if specification limits provided)
  let riskAnalysis;
  if (usl !== undefined || lsl !== undefined) {
    // Count samples exceeding USL (values greater than upper limit)
    const exceedingUSL = usl !== undefined
      ? stackSamples.filter(x => x > usl).length
      : 0;
    const probabilityExceedingUSL = exceedingUSL / iterations;

    // Count samples exceeding LSL (values less than lower limit)
    const exceedingLSL = lsl !== undefined
      ? stackSamples.filter(x => x < lsl).length
      : 0;
    const probabilityExceedingLSL = exceedingLSL / iterations;

    // Total out-of-spec probability (either side)
    const probabilityOutOfSpec = probabilityExceedingUSL + probabilityExceedingLSL;
    const expectedDefectRate = probabilityOutOfSpec * 1_000_000; // PPM

    riskAnalysis = {
      usl: usl !== undefined ? usl : undefined,
      lsl: lsl !== undefined ? lsl : undefined,
      probabilityExceedingUSL,
      probabilityExceedingLSL,
      probabilityOutOfSpec,
      expectedDefectRate,
    };
  }

  return {
    directionId,
    directionName,
    iterations,
    samples: stackSamples,
    percentiles,
    histogram,
    itemHistograms,
    itemContributions,
    riskAnalysis,
  };
}
