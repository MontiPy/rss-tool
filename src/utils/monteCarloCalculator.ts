import {
  ToleranceItem,
  MonteCarloResult,
  MonteCarloSettings,
  DistributionType,
  HistogramBin,
  PercentileData,
} from '../types';
import { getItemFloatFactor, FLOAT_FACTORS } from './rssCalculator';

/** Random number generator returning values in [0, 1) */
export type RandomFn = () => number;

/**
 * Small, fast seeded PRNG (mulberry32). Same seed → same sequence.
 */
export function createSeededRandom(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal sample via Box-Muller transform
 */
function standardNormal(rng: RandomFn): number {
  const u1 = 1 - rng(); // (0, 1] so log() is finite
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Symmetric triangular sample on [-1, 1] with mode 0
 */
function standardTriangular(rng: RandomFn): number {
  return rng() + rng() - 1;
}

/**
 * Determine distribution type for an item.
 * Auto mode: Uniform for floating items (floatFactor ≈ √3), Normal otherwise.
 */
export function getDistributionType(item: ToleranceItem, useAdvanced: boolean): DistributionType {
  if (useAdvanced && item.distributionType) {
    return item.distributionType;
  }
  const isFloating = Math.abs(getItemFloatFactor(item) - FLOAT_FACTORS.SQRT3) < 0.01;
  return isFloating ? 'uniform' : 'normal';
}

/**
 * How an item is sampled: deviation = shift + scale × standard sample.
 *
 * Asymmetric tolerances (+a / −b) are modelled as a mean shift of (a − b) / 2 with a
 * symmetric half-width of (a + b) / 2, so samples stay within [−b, +a].
 *
 * In auto mode the float factor is honoured so the simulated σ matches RSS:
 *  - floating (√3) items are uniform on ±t, whose σ = t/√3 = (√3·t)/3, exactly RSS's
 *    floating contribution treated as 3σ, so no extra factor is applied;
 *  - other items are normal with 3σ = t × floatFactor.
 * In advanced mode the chosen distribution replaces the float factor.
 */
interface ItemSampler {
  item: ToleranceItem;
  distribution: DistributionType;
  shift: number;
  scale: number;
  min: number; // Histogram range
  max: number;
}

function buildSampler(item: ToleranceItem, useAdvanced: boolean): ItemSampler {
  const distribution = getDistributionType(item, useAdvanced);
  const plus = Math.max(0, item.tolerancePlus || 0);
  const minus = Math.max(0, item.toleranceMinus || 0);
  const shift = (plus - minus) / 2;
  let halfWidth = (plus + minus) / 2;

  if (!useAdvanced && distribution === 'normal') {
    halfWidth *= getItemFloatFactor(item);
  }

  const scale = distribution === 'normal' ? halfWidth / 3 : halfWidth;
  const extent = distribution === 'normal' ? 4 * scale : halfWidth;

  return { item, distribution, shift, scale, min: shift - extent, max: shift + extent };
}

function sample(sampler: ItemSampler, rng: RandomFn): number {
  if (sampler.scale === 0) return sampler.shift;
  switch (sampler.distribution) {
    case 'uniform':
      return sampler.shift + sampler.scale * (2 * rng() - 1);
    case 'triangular':
      return sampler.shift + sampler.scale * standardTriangular(rng);
    case 'normal':
    default:
      return sampler.shift + sampler.scale * standardNormal(rng);
  }
}

function emptyBins(min: number, max: number, numBins: number): HistogramBin[] {
  // Degenerate range (all samples identical): give it a tiny width so the bar is visible
  if (!(max > min)) {
    const pad = Math.abs(min) * 1e-3 || 1e-3;
    min -= pad;
    max += pad;
  }
  const width = (max - min) / numBins;
  return Array.from({ length: numBins }, (_, i) => ({
    binStart: min + i * width,
    binEnd: min + (i + 1) * width,
    binCenter: min + (i + 0.5) * width,
    count: 0,
    frequency: 0,
  }));
}

function addToBins(bins: HistogramBin[], value: number) {
  const min = bins[0].binStart;
  const width = bins[0].binEnd - bins[0].binStart;
  const index = Math.floor((value - min) / width);
  bins[Math.max(0, Math.min(bins.length - 1, index))].count++;
}

function normalizeBins(bins: HistogramBin[], total: number) {
  bins.forEach((bin) => {
    bin.frequency = total > 0 ? bin.count / total : 0;
  });
}

/**
 * Create histogram bins from samples (single pass for min/max; safe for very large arrays)
 */
export function createHistogram(samples: ArrayLike<number>, numBins: number): HistogramBin[] {
  if (samples.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < min) min = samples[i];
    if (samples[i] > max) max = samples[i];
  }
  const bins = emptyBins(min, max, numBins);
  for (let i = 0; i < samples.length; i++) addToBins(bins, samples[i]);
  normalizeBins(bins, samples.length);
  return bins;
}

/**
 * Calculate percentiles from sorted samples
 */
export function calculatePercentiles(sortedSamples: ArrayLike<number>): PercentileData {
  const n = sortedSamples.length;
  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * n) - 1;
    return sortedSamples[Math.max(0, Math.min(index, n - 1))];
  };

  let sum = 0;
  for (let i = 0; i < n; i++) sum += sortedSamples[i];
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) sq += (sortedSamples[i] - mean) ** 2;
  const stdDev = Math.sqrt(sq / n);

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
 * Run Monte Carlo simulation.
 *
 * Each iteration samples every item's deviation and sums them linearly; the stack value is
 * `center + Σ deviations`, so results are in the same coordinates as USL/LSL.
 */
export function runMonteCarloSimulation(
  items: ToleranceItem[],
  directionId: string,
  directionName: string,
  settings: MonteCarloSettings,
  usl?: number,
  lsl?: number,
  center: number = 0
): MonteCarloResult {
  const iterations = Math.max(1, Math.floor(settings.iterations || 1));
  const seed = settings.seed ?? Math.floor(Math.random() * 2 ** 32);
  const rng = createSeededRandom(seed);

  const samplers = items.map((item) => buildSampler(item, settings.useAdvancedDistributions));
  const itemBins = samplers.map((s) => emptyBins(s.min, s.max, 30));
  const itemSum = new Float64Array(items.length);
  const itemSumSq = new Float64Array(items.length);
  const stackSamples = new Float64Array(iterations);

  for (let i = 0; i < iterations; i++) {
    let total = center;
    for (let j = 0; j < samplers.length; j++) {
      const deviation = sample(samplers[j], rng);
      itemSum[j] += deviation;
      itemSumSq[j] += deviation * deviation;
      addToBins(itemBins[j], deviation);
      total += deviation;
    }
    stackSamples[i] = total;
  }

  const histogram = createHistogram(stackSamples, 50);
  const sorted = stackSamples.slice().sort();
  const percentiles = calculatePercentiles(sorted);

  const itemHistograms = new Map<string, HistogramBin[]>();
  const stats = items.map((item, j) => {
    normalizeBins(itemBins[j], iterations);
    itemHistograms.set(item.id, itemBins[j]);
    const mean = itemSum[j] / iterations;
    const variance = Math.max(0, itemSumSq[j] / iterations - mean * mean);
    return { item, mean, variance };
  });
  const totalVariance = stats.reduce((sum, s) => sum + s.variance, 0);

  const itemContributions = stats.map(({ item, mean, variance }) => ({
    itemId: item.id,
    itemName: item.name,
    mean,
    stdDev: Math.sqrt(variance),
    percentContribution: totalVariance > 0 ? (variance / totalVariance) * 100 : 0,
  }));

  let riskAnalysis: MonteCarloResult['riskAnalysis'];
  if (usl !== undefined || lsl !== undefined) {
    let above = 0;
    let below = 0;
    for (let i = 0; i < iterations; i++) {
      if (usl !== undefined && stackSamples[i] > usl) above++;
      else if (lsl !== undefined && stackSamples[i] < lsl) below++;
    }
    const probabilityExceedingUSL = above / iterations;
    const probabilityExceedingLSL = below / iterations;
    const probabilityOutOfSpec = probabilityExceedingUSL + probabilityExceedingLSL;
    riskAnalysis = {
      usl,
      lsl,
      probabilityExceedingUSL,
      probabilityExceedingLSL,
      probabilityOutOfSpec,
      expectedDefectRate: probabilityOutOfSpec * 1_000_000,
    };
  }

  return {
    directionId,
    directionName,
    iterations,
    seed,
    center,
    percentiles,
    histogram,
    itemHistograms,
    itemContributions,
    riskAnalysis,
  };
}
