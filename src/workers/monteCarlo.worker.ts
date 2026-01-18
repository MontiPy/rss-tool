/**
 * Web Worker for Monte Carlo Simulation
 *
 * This worker runs Monte Carlo simulations off the main thread
 * to prevent UI blocking during heavy calculations.
 *
 * Usage:
 * ```ts
 * const worker = new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' });
 * worker.postMessage({ items, directionId, directionName, settings, usl, lsl });
 * worker.onmessage = (e) => setResult(e.data);
 * ```
 */

import { ToleranceItem, MonteCarloSettings, MonteCarloResult, DistributionType, HistogramBin, PercentileData } from '../types';

// ============================================================================
// Distribution Generators (copied from monteCarloCalculator.ts to avoid import issues)
// ============================================================================

function generateNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

function generateUniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

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

function getDistributionType(item: ToleranceItem, useAdvanced: boolean): DistributionType {
  if (useAdvanced && item.distributionType) {
    return item.distributionType;
  }

  const SQRT3 = Math.sqrt(3);
  const isFloating = Math.abs(item.floatFactor - SQRT3) < 0.01;
  return isFloating ? 'uniform' : 'normal';
}

function sampleTolerance(
  item: ToleranceItem,
  distributionType: DistributionType,
  isPlus: boolean
): number {
  const tolerance = isPlus ? item.tolerancePlus : item.toleranceMinus;

  if (tolerance === 0) return 0;

  switch (distributionType) {
    case 'normal':
      const sigma = tolerance / 3;
      return generateNormal(0, sigma);

    case 'uniform':
      return generateUniform(-tolerance, tolerance);

    case 'triangular':
      return generateTriangular(-tolerance, tolerance);

    default:
      return tolerance;
  }
}

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

  samples.forEach((value) => {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1);
    bins[binIndex].count++;
  });

  bins.forEach((bin) => {
    bin.frequency = bin.count / samples.length;
  });

  return bins;
}

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

// ============================================================================
// Main Simulation Function
// ============================================================================

function runMonteCarloSimulation(
  items: ToleranceItem[],
  directionId: string,
  directionName: string,
  settings: MonteCarloSettings,
  usl?: number,
  lsl?: number,
  onProgress?: (progress: number) => void
): MonteCarloResult {
  const { iterations, useAdvancedDistributions } = settings;

  const stackSamples: number[] = [];
  const itemSamplesMap = new Map<string, number[]>();

  items.forEach((item) => {
    itemSamplesMap.set(item.id, []);
  });

  // Progress reporting interval
  const progressInterval = Math.floor(iterations / 10);

  for (let i = 0; i < iterations; i++) {
    let totalDeviation = 0;

    items.forEach((item) => {
      const distributionType = getDistributionType(item, useAdvancedDistributions);
      const sampledTolerance = sampleTolerance(item, distributionType, true);
      itemSamplesMap.get(item.id)!.push(sampledTolerance);
      const contribution = sampledTolerance * item.floatFactor;
      totalDeviation += contribution;
    });

    stackSamples.push(totalDeviation);

    // Report progress
    if (onProgress && i % progressInterval === 0) {
      onProgress(i / iterations);
    }
  }

  const sortedSamples = [...stackSamples].sort((a, b) => a - b);
  const percentiles = calculatePercentiles(sortedSamples);
  const histogram = createHistogram(stackSamples, 50);

  const itemHistograms = new Map<string, HistogramBin[]>();
  items.forEach((item) => {
    const itemSamples = itemSamplesMap.get(item.id)!;
    itemHistograms.set(item.id, createHistogram(itemSamples, 30));
  });

  const itemContributions = items.map((item) => {
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

  let riskAnalysis;
  if (usl !== undefined || lsl !== undefined) {
    const exceedingUSL =
      usl !== undefined ? stackSamples.filter((x) => x > usl).length : 0;
    const probabilityExceedingUSL = exceedingUSL / iterations;

    const exceedingLSL =
      lsl !== undefined ? stackSamples.filter((x) => x < lsl).length : 0;
    const probabilityExceedingLSL = exceedingLSL / iterations;

    const probabilityOutOfSpec = probabilityExceedingUSL + probabilityExceedingLSL;
    const expectedDefectRate = probabilityOutOfSpec * 1_000_000;

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

// ============================================================================
// Worker Message Handler
// ============================================================================

interface WorkerMessage {
  items: ToleranceItem[];
  directionId: string;
  directionName: string;
  settings: MonteCarloSettings;
  usl?: number;
  lsl?: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { items, directionId, directionName, settings, usl, lsl } = e.data;

  try {
    const result = runMonteCarloSimulation(
      items,
      directionId,
      directionName,
      settings,
      usl,
      lsl,
      (progress) => {
        // Post progress updates
        self.postMessage({ type: 'progress', progress });
      }
    );

    // Convert Map to array for serialization (Maps can't be transferred via postMessage)
    const serializedResult = {
      ...result,
      itemHistograms: Array.from(result.itemHistograms.entries()),
    };

    self.postMessage({ type: 'result', result: serializedResult });
  } catch (error) {
    self.postMessage({ type: 'error', error: (error as Error).message });
  }
};
