import { describe, expect, it } from 'vitest';
import {
  calculateCapability,
  calculateTolerance,
  evaluateSpecLimit,
  FLOAT_FACTORS,
  generateRSSDistribution,
  generateTicks,
  getStackCenter,
  normalCDF,
  normalSF,
  convertUnit,
} from '../rssCalculator';
import { ToleranceItem } from '../../types';

const item = (id: string, plus: number, minus = plus, floatFactor = 1, nominal = 0): ToleranceItem => ({
  id,
  name: id,
  nominal,
  tolerancePlus: plus,
  toleranceMinus: minus,
  floatFactor,
});

describe('calculateTolerance', () => {
  it('computes RSS and worst-case totals', () => {
    const result = calculateTolerance([item('a', 0.3), item('b', 0.4)], 'd', 'D', 'rss');
    expect(result.totalPlus).toBeCloseTo(0.5, 10);
    expect(result.worstCasePlus).toBeCloseTo(0.7, 10);

    const wc = calculateTolerance([item('a', 0.3), item('b', 0.4)], 'd', 'D', 'worstCase');
    expect(wc.totalPlus).toBeCloseTo(0.7, 10);
  });

  it('applies the float factor before squaring', () => {
    const result = calculateTolerance([item('a', 1, 1, FLOAT_FACTORS.SQRT3)], 'd', 'D');
    expect(result.totalPlus).toBeCloseTo(Math.sqrt(3), 10);
  });

  it('keeps plus and minus separate for asymmetric items', () => {
    const result = calculateTolerance([item('a', 0.3, 0.1), item('b', 0.4, 0.2)], 'd', 'D');
    expect(result.totalPlus).toBeCloseTo(0.5, 10);
    expect(result.totalMinus).toBeCloseTo(Math.sqrt(0.05), 10);
  });

  it('uses variance shares for RSS contributions and linear shares for worst-case', () => {
    const rss = calculateTolerance([item('a', 0.3), item('b', 0.4)], 'd', 'D', 'rss');
    expect(rss.itemContributions[0].percentPlus).toBeCloseTo(36, 6);
    expect(rss.itemContributions[1].percentPlus).toBeCloseTo(64, 6);

    const wc = calculateTolerance([item('a', 0.3), item('b', 0.4)], 'd', 'D', 'worstCase');
    expect(wc.itemContributions[0].percentPlus).toBeCloseTo((0.3 / 0.7) * 100, 6);
  });

  it('handles all-zero tolerances without NaN', () => {
    const result = calculateTolerance([item('a', 0)], 'd', 'D');
    expect(result.totalPlus).toBe(0);
    expect(result.itemContributions[0].percentPlus).toBe(0);
  });

  it('falls back to legacy isFloat', () => {
    const legacy = { ...item('a', 1), floatFactor: undefined as unknown as number, isFloat: true };
    expect(calculateTolerance([legacy], 'd', 'D').totalPlus).toBeCloseTo(Math.sqrt(3), 10);
  });
});

describe('normal distribution helpers', () => {
  it('matches known CDF values', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 7);
    expect(normalCDF(1.96)).toBeCloseTo(0.975002, 5);
    expect(normalCDF(-3)).toBeCloseTo(0.0013499, 6);
  });

  it('is accurate in the far tail (relative error)', () => {
    // P(Z > 6) = 9.8659e-10
    expect(normalSF(6) / 9.8659e-10).toBeCloseTo(1, 3);
    // P(Z > 4.5) = 3.3977e-6
    expect(normalSF(4.5) / 3.3977e-6).toBeCloseTo(1, 3);
  });
});

describe('getStackCenter', () => {
  it('prefers the target nominal, falling back to Σ nominals', () => {
    const items = [item('a', 0.1, 0.1, 1, 10), item('b', 0.1, 0.1, 1, -4)];
    expect(getStackCenter(items, 5)).toBe(5);
    expect(getStackCenter(items, undefined)).toBe(6);
    expect(getStackCenter([], undefined)).toBe(0);
  });
});

describe('evaluateSpecLimit', () => {
  it('reduces to total / |limit| when centered at zero', () => {
    const upper = evaluateSpecLimit('upper', 2, 0, 1);
    expect(upper.utilization).toBeCloseTo(50, 10);
    expect(upper.status).toBe('pass');

    const lower = evaluateSpecLimit('lower', -2, 0, 1.9);
    expect(lower.utilization).toBeCloseTo(95, 10);
    expect(lower.status).toBe('warning');
  });

  it('measures against the stack center for absolute limits', () => {
    const upper = evaluateSpecLimit('upper', 10.5, 10, 0.6);
    expect(upper.margin).toBeCloseTo(0.5, 10);
    expect(upper.status).toBe('fail');
    expect(upper.exceedsBy).toBeCloseTo(0.1, 10);
    expect(upper.extreme).toBeCloseTo(10.6, 10);
  });

  it('fails when the center is already beyond the limit', () => {
    const upper = evaluateSpecLimit('upper', 1, 2, 0.1);
    expect(upper.utilization).toBe(Infinity);
    expect(upper.status).toBe('fail');
  });
});

describe('calculateCapability', () => {
  it('computes Cp/Cpk for a centered process', () => {
    // 3σ = 1, limits ±1.33 → Cpk = 1.33
    const cap = calculateCapability(1, 0, 1.33, -1.33)!;
    expect(cap.cp).toBeCloseTo(1.33, 6);
    expect(cap.currentCpk).toBeCloseTo(1.33, 6);
    expect(cap.required3SigmaFor1_33Cpk).toBeCloseTo(1, 6);
  });

  it('accounts for an off-center mean', () => {
    const cap = calculateCapability(1, 0.5, 2, -2)!;
    expect(cap.cpu).toBeCloseTo(1.5, 6);
    expect(cap.cpl).toBeCloseTo(2.5, 6);
    expect(cap.currentCpk).toBeCloseTo(1.5, 6);
  });

  it('yield at ±3σ limits is 99.73%', () => {
    const cap = calculateCapability(1, 0, 1, -1)!;
    expect(cap.currentYield).toBeCloseTo(99.73, 2);
    expect(cap.ppm).toBeCloseTo(2700, -1);
  });

  it('supports a single limit and returns undefined without limits', () => {
    expect(calculateCapability(1, 0, 1, undefined)!.cp).toBeUndefined();
    expect(calculateCapability(1, 0)).toBeUndefined();
  });
});

describe('generateRSSDistribution', () => {
  it('centers on the provided center and computes risk', () => {
    const dist = generateRSSDistribution(0.3, 10, 10.3, 9.7);
    expect(dist.mean).toBe(10);
    expect(dist.stdDev).toBeCloseTo(0.1, 10);
    expect(dist.riskAnalysis!.expectedDefectRate).toBeCloseTo(2700, -1);
  });
});

describe('generateTicks', () => {
  it('produces ticks for tiny ranges', () => {
    const ticks = generateTicks(-0.004, 0.004);
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.length).toBeLessThanOrEqual(12);
  });

  it('ignores an increment that would create too many ticks', () => {
    expect(generateTicks(0, 10000, 0.01).length).toBeLessThan(20);
  });
});

describe('convertUnit', () => {
  it('converts between units', () => {
    expect(convertUnit(1, 'inches', 'mm')).toBeCloseTo(25.4, 10);
    expect(convertUnit(1, 'mils', 'μm')).toBeCloseTo(25.4, 10);
  });
});
