import { describe, it, expect } from 'vitest';
import {
  calculateTolerance,
  calculateRSS,
  FLOAT_FACTORS,
  convertUnit,
  formatWithMultiUnit,
  calculateStatisticalAnalysis,
  normalCDF,
  normalPdf,
  generateRSSDistribution,
} from '../rssCalculator';
import { ToleranceItem } from '../../types';

describe('rssCalculator', () => {
  // Helper to create test items
  const createItem = (
    tolerancePlus: number,
    toleranceMinus: number = tolerancePlus,
    floatFactor: number = 1.0,
    id: string = 'test-1'
  ): ToleranceItem => ({
    id,
    name: `Test Item ${id}`,
    nominal: 0,
    tolerancePlus,
    toleranceMinus,
    floatFactor,
  });

  describe('FLOAT_FACTORS', () => {
    it('should have correct fixed value', () => {
      expect(FLOAT_FACTORS.FIXED).toBe(1.0);
    });

    it('should have correct SQRT2 value', () => {
      expect(FLOAT_FACTORS.SQRT2).toBeCloseTo(1.414, 2);
    });

    it('should have correct SQRT3 value', () => {
      expect(FLOAT_FACTORS.SQRT3).toBeCloseTo(1.732, 2);
    });
  });

  describe('calculateTolerance - RSS mode', () => {
    it('should return zero for empty items', () => {
      const result = calculateTolerance([], 'dir-1', 'Test', 'rss');
      expect(result.totalPlus).toBe(0);
      expect(result.totalMinus).toBe(0);
    });

    it('should calculate RSS correctly for single item', () => {
      const items = [createItem(0.5)];
      const result = calculateTolerance(items, 'dir-1', 'Test', 'rss');
      expect(result.totalPlus).toBeCloseTo(0.5, 4);
    });

    it('should calculate RSS correctly for multiple items', () => {
      const items = [
        createItem(0.5, 0.5, 1.0, '1'),
        createItem(0.3, 0.3, 1.0, '2'),
        createItem(0.4, 0.4, 1.0, '3'),
      ];
      // RSS = sqrt(0.5² + 0.3² + 0.4²) = sqrt(0.25 + 0.09 + 0.16) = sqrt(0.5) ≈ 0.707
      const result = calculateTolerance(items, 'dir-1', 'Test', 'rss');
      expect(result.totalPlus).toBeCloseTo(0.707, 2);
    });

    it('should apply float factor correctly', () => {
      const items = [createItem(0.5, 0.5, FLOAT_FACTORS.SQRT3)];
      // Contribution = 0.5 * √3 ≈ 0.866
      const result = calculateTolerance(items, 'dir-1', 'Test', 'rss');
      expect(result.totalPlus).toBeCloseTo(0.866, 2);
    });

    it('should calculate RSS with mixed float factors', () => {
      const items = [
        createItem(0.5, 0.5, 1.0, '1'), // contribution: 0.5
        createItem(0.3, 0.3, FLOAT_FACTORS.SQRT3, '2'), // contribution: 0.3 * 1.732 ≈ 0.520
      ];
      // RSS = sqrt(0.5² + 0.520²) = sqrt(0.25 + 0.27) = sqrt(0.52) ≈ 0.721
      const result = calculateTolerance(items, 'dir-1', 'Test', 'rss');
      expect(result.totalPlus).toBeCloseTo(0.721, 2);
    });

    it('should handle asymmetric tolerances', () => {
      const items = [createItem(0.5, 0.3, 1.0)];
      const result = calculateTolerance(items, 'dir-1', 'Test', 'rss');
      expect(result.totalPlus).toBeCloseTo(0.5, 4);
      expect(result.totalMinus).toBeCloseTo(0.3, 4);
    });

    it('should include item contributions in result', () => {
      const items = [
        createItem(0.5, 0.5, 1.0, '1'),
        createItem(0.3, 0.3, FLOAT_FACTORS.SQRT3, '2'),
      ];
      const result = calculateTolerance(items, 'dir-1', 'Test', 'rss');

      expect(result.itemContributions).toHaveLength(2);
      expect(result.itemContributions[0].contributionPlus).toBeCloseTo(0.5, 4);
      expect(result.itemContributions[1].contributionPlus).toBeCloseTo(0.52, 2);
    });
  });

  describe('calculateTolerance - Worst-Case mode', () => {
    it('should calculate worst-case as arithmetic sum', () => {
      const items = [
        createItem(0.5, 0.5, 1.0, '1'),
        createItem(0.3, 0.3, 1.0, '2'),
        createItem(0.4, 0.4, 1.0, '3'),
      ];
      // WC = 0.5 + 0.3 + 0.4 = 1.2
      const result = calculateTolerance(items, 'dir-1', 'Test', 'worstCase');
      expect(result.totalPlus).toBeCloseTo(1.2, 4);
    });

    it('should apply float factor in worst-case', () => {
      const items = [
        createItem(0.5, 0.5, 1.0, '1'),
        createItem(0.3, 0.3, FLOAT_FACTORS.SQRT3, '2'),
      ];
      // WC = 0.5 + (0.3 * √3) = 0.5 + 0.52 ≈ 1.02
      const result = calculateTolerance(items, 'dir-1', 'Test', 'worstCase');
      expect(result.totalPlus).toBeCloseTo(1.02, 2);
    });
  });

  describe('calculateRSS (deprecated wrapper)', () => {
    it('should call calculateTolerance with rss mode', () => {
      const items = [createItem(0.5)];
      const result = calculateRSS(items, 'dir-1', 'Test');
      expect(result.totalPlus).toBeCloseTo(0.5, 4);
    });
  });

  describe('convertUnit', () => {
    it('should convert mm to inches', () => {
      expect(convertUnit(25.4, 'mm', 'inches')).toBeCloseTo(1.0, 4);
    });

    it('should convert inches to mm', () => {
      expect(convertUnit(1.0, 'inches', 'mm')).toBeCloseTo(25.4, 4);
    });

    it('should convert mm to μm', () => {
      expect(convertUnit(1.0, 'mm', 'μm')).toBeCloseTo(1000, 4);
    });

    it('should convert μm to mm', () => {
      expect(convertUnit(1000, 'μm', 'mm')).toBeCloseTo(1.0, 4);
    });

    it('should convert inches to mils', () => {
      expect(convertUnit(0.001, 'inches', 'mils')).toBeCloseTo(1.0, 4);
    });

    it('should return same value for same unit', () => {
      expect(convertUnit(5.5, 'mm', 'mm')).toBe(5.5);
    });
  });

  describe('formatWithMultiUnit', () => {
    it('should format with primary and secondary units', () => {
      const result = formatWithMultiUnit(25.4, 'mm', 'inches', 4);
      expect(result).toBe('25.4000 mm (1.0000 inches)');
    });

    it('should respect decimal places', () => {
      const result = formatWithMultiUnit(1.5, 'mm', 'inches', 2);
      expect(result).toContain('1.50 mm');
    });
  });

  describe('normalCDF', () => {
    it('should return 0.5 for z=0', () => {
      expect(normalCDF(0)).toBeCloseTo(0.5, 2);
    });

    it('should return ~0.8413 for z=1', () => {
      expect(normalCDF(1)).toBeCloseTo(0.8413, 2);
    });

    it('should return ~0.9772 for z=2', () => {
      expect(normalCDF(2)).toBeCloseTo(0.9772, 2);
    });

    it('should return ~0.9987 for z=3', () => {
      expect(normalCDF(3)).toBeCloseTo(0.9987, 2);
    });

    it('should handle negative z-scores', () => {
      expect(normalCDF(-1)).toBeCloseTo(0.1587, 2);
      expect(normalCDF(-2)).toBeCloseTo(0.0228, 2);
    });

    it('should satisfy symmetry: CDF(z) + CDF(-z) = 1', () => {
      expect(normalCDF(1.5) + normalCDF(-1.5)).toBeCloseTo(1.0, 4);
    });
  });

  describe('normalPdf', () => {
    it('should return maximum at mean', () => {
      const atMean = normalPdf(0, 0, 1);
      const offset = normalPdf(1, 0, 1);
      expect(atMean).toBeGreaterThan(offset);
    });

    it('should be symmetric around mean', () => {
      const left = normalPdf(-1, 0, 1);
      const right = normalPdf(1, 0, 1);
      expect(left).toBeCloseTo(right, 6);
    });

    it('should scale with standard deviation', () => {
      const narrow = normalPdf(0, 0, 0.5);
      const wide = normalPdf(0, 0, 2);
      expect(narrow).toBeGreaterThan(wide);
    });
  });

  describe('calculateStatisticalAnalysis', () => {
    it('should calculate Cpk correctly', () => {
      // RSS = 3.0, Target = 3.0
      // Cpk = Target / (3 * sigma) = 3.0 / (3 * 1.0) = 1.0
      const result = calculateStatisticalAnalysis(3.0, 3.0);
      expect(result.currentCpk).toBeCloseTo(1.0, 2);
    });

    it('should calculate Cpk > 1.33 for capable process', () => {
      // RSS = 2.25, Target = 3.0
      // sigma = 2.25 / 3 = 0.75
      // Cpk = 3.0 / (3 * 0.75) = 1.33
      const result = calculateStatisticalAnalysis(2.25, 3.0);
      expect(result.currentCpk).toBeCloseTo(1.33, 2);
    });

    it('should calculate required 3σ for Cpk = 1.33', () => {
      const result = calculateStatisticalAnalysis(3.0, 4.0);
      // Required 3σ = Target / 1.33 = 4.0 / 1.33 ≈ 3.01
      expect(result.required3SigmaFor1_33Cpk).toBeCloseTo(3.01, 1);
    });

    it('should calculate required 3σ for Cpk = 1.66', () => {
      const result = calculateStatisticalAnalysis(3.0, 5.0);
      // Required 3σ = Target / 1.66 = 5.0 / 1.66 ≈ 3.01
      expect(result.required3SigmaFor1_66Cpk).toBeCloseTo(3.01, 1);
    });
  });

  describe('generateRSSDistribution', () => {
    it('should generate curve data', () => {
      const result = generateRSSDistribution(3.0, 0, 5, -5);
      expect(result.curveData.length).toBeGreaterThan(0);
    });

    it('should center on target nominal', () => {
      const result = generateRSSDistribution(3.0, 10);
      expect(result.mean).toBe(10);
    });

    it('should calculate standard deviation from RSS', () => {
      // RSS = 3σ, so σ = RSS / 3
      const result = generateRSSDistribution(3.0);
      expect(result.stdDev).toBe(1.0);
    });

    it('should include risk analysis when limits provided', () => {
      const result = generateRSSDistribution(3.0, 0, 5, -5);
      expect(result.riskAnalysis).toBeDefined();
      expect(result.riskAnalysis?.usl).toBe(5);
      expect(result.riskAnalysis?.lsl).toBe(-5);
    });

    it('should calculate probability of exceeding limits', () => {
      // With σ = 1 and limits at ±3σ, probability out of spec should be ~0.27%
      const result = generateRSSDistribution(3.0, 0, 3, -3);
      expect(result.riskAnalysis?.probabilityOutOfSpec).toBeLessThan(0.01);
    });
  });
});
