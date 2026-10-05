import { describe, expect, it } from 'vitest';
import { createHistogram, createSeededRandom, runMonteCarloSimulation } from '../monteCarloCalculator';
import { calculateTolerance, FLOAT_FACTORS } from '../rssCalculator';
import { ToleranceItem } from '../../types';

const item = (id: string, plus: number, minus = plus, floatFactor = 1): ToleranceItem => ({
  id,
  name: id,
  nominal: 0,
  tolerancePlus: plus,
  toleranceMinus: minus,
  floatFactor,
});

const settings = { iterations: 100_000, useAdvancedDistributions: false, seed: 42 };

describe('createSeededRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('runMonteCarloSimulation', () => {
  it('agrees with RSS (3σ) for fixed and floating items in auto mode', () => {
    const items = [item('a', 0.3), item('b', 0.2, 0.2, FLOAT_FACTORS.SQRT3), item('c', 0.1)];
    const rss = calculateTolerance(items, 'd', 'D', 'rss').totalPlus;
    const mc = runMonteCarloSimulation(items, 'd', 'D', settings);
    expect(3 * mc.percentiles.stdDev).toBeCloseTo(rss, 2);
    expect(mc.percentiles.mean).toBeCloseTo(0, 2);
  });

  it('is reproducible with a seed', () => {
    const items = [item('a', 0.3), item('b', 0.2)];
    const r1 = runMonteCarloSimulation(items, 'd', 'D', settings);
    const r2 = runMonteCarloSimulation(items, 'd', 'D', settings);
    expect(r1.percentiles).toEqual(r2.percentiles);
    expect(r1.seed).toBe(42);
  });

  it('keeps asymmetric samples within [-minus, +plus] and shifts the mean', () => {
    const mc = runMonteCarloSimulation([item('a', 0.4, 0, FLOAT_FACTORS.SQRT3)], 'd', 'D', settings);
    const bins = mc.histogram;
    expect(bins[0].binStart).toBeGreaterThanOrEqual(-1e-9);
    expect(bins[bins.length - 1].binEnd).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(mc.percentiles.mean).toBeCloseTo(0.2, 2);
  });

  it('offsets samples by the stack center and evaluates risk in the same coordinates', () => {
    // σ = 0.1, limits at center ± 3σ → ~2700 PPM
    const mc = runMonteCarloSimulation([item('a', 0.3)], 'd', 'D', settings, 10.3, 9.7, 10);
    expect(mc.percentiles.mean).toBeCloseTo(10, 2);
    expect(mc.riskAnalysis!.expectedDefectRate).toBeGreaterThan(2000);
    expect(mc.riskAnalysis!.expectedDefectRate).toBeLessThan(3500);
  });

  it('reports variance-based contributions that sum to 100%', () => {
    const mc = runMonteCarloSimulation([item('a', 0.3), item('b', 0.4)], 'd', 'D', settings);
    const total = mc.itemContributions.reduce((s, c) => s + c.percentContribution, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(mc.itemContributions[1].percentContribution).toBeCloseTo(64, 0);
  });

  it('handles zero tolerances without NaN', () => {
    const mc = runMonteCarloSimulation([item('a', 0)], 'd', 'D', { ...settings, iterations: 1000 });
    expect(mc.percentiles.stdDev).toBe(0);
    expect(mc.histogram.every((b) => Number.isFinite(b.binCenter))).toBe(true);
  });
});

describe('createHistogram', () => {
  it('handles very large inputs without spreading into Math.min', () => {
    const big = new Float64Array(1_000_000).map((_, i) => i);
    const bins = createHistogram(big, 10);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(1_000_000);
  });
});
