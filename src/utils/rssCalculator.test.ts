import { describe, it, expect } from 'vitest';
import {
  calculateTolerance,
  FLOAT_FACTORS,
  convertUnit,
  formatWithMultiUnit,
} from './rssCalculator';
import { ToleranceItem } from '../types';

describe('rssCalculator', () => {
  describe('calculateTolerance', () => {
    it('should calculate RSS correctly for simple symmetric tolerances', () => {
      const items: ToleranceItem[] = [
        {
          id: '1',
          name: 'Item 1',
          nominal: 10,
          tolerancePlus: 0.5,
          toleranceMinus: 0.5,
          floatFactor: FLOAT_FACTORS.FIXED,
        },
        {
          id: '2',
          name: 'Item 2',
          nominal: 20,
          tolerancePlus: 0.5,
          toleranceMinus: 0.5,
          floatFactor: FLOAT_FACTORS.FIXED,
        },
      ];

      const result = calculateTolerance(items, 'dir-1', 'Test Direction', 'rss');

      // RSS = sqrt(0.5^2 + 0.5^2) = sqrt(0.25 + 0.25) = sqrt(0.5) ≈ 0.7071
      expect(result.totalPlus).toBeCloseTo(0.7071, 4);
      expect(result.totalMinus).toBeCloseTo(0.7071, 4);
    });

    it('should handle float factors correctly', () => {
      const items: ToleranceItem[] = [
        {
          id: '1',
          name: 'Floating Item',
          nominal: 10,
          tolerancePlus: 0.5,
          toleranceMinus: 0.5,
          floatFactor: FLOAT_FACTORS.SQRT3,
        },
      ];

      const result = calculateTolerance(items, 'dir-1', 'Test Direction', 'rss');

      // Contribution = 0.5 * sqrt(3) ≈ 0.8660
      // RSS = sqrt((0.5 * sqrt(3))^2) = 0.5 * sqrt(3) ≈ 0.8660
      expect(result.totalPlus).toBeCloseTo(0.5 * Math.sqrt(3), 4);
    });

    it('should calculate Worst-Case correctly', () => {
      const items: ToleranceItem[] = [
        {
          id: '1',
          name: 'Item 1',
          nominal: 10,
          tolerancePlus: 0.5,
          toleranceMinus: 0.3,
          floatFactor: FLOAT_FACTORS.FIXED,
        },
        {
          id: '2',
          name: 'Item 2',
          nominal: 20,
          tolerancePlus: 0.2,
          toleranceMinus: 0.4,
          floatFactor: FLOAT_FACTORS.FIXED,
        },
      ];

      const result = calculateTolerance(items, 'dir-1', 'Test Direction', 'worstCase');

      // WC+ = 0.5 + 0.2 = 0.7
      // WC- = 0.3 + 0.4 = 0.7
      expect(result.worstCasePlus).toBeCloseTo(0.7, 4);
      expect(result.worstCaseMinus).toBeCloseTo(0.7, 4);

      // In worstCase mode, totalPlus/Minus should also be the arithmetic sum
      expect(result.totalPlus).toBeCloseTo(0.7, 4);
      expect(result.totalMinus).toBeCloseTo(0.7, 4);
    });
  });

  describe('convertUnit', () => {
    it('should convert mm to inches correctly', () => {
      expect(convertUnit(25.4, 'mm', 'inches')).toBeCloseTo(1, 4);
    });

    it('should convert inches to mm correctly', () => {
      expect(convertUnit(1, 'inches', 'mm')).toBeCloseTo(25.4, 4);
    });
  });

  describe('formatWithMultiUnit', () => {
    it('should format multi-unit string correctly', () => {
      const result = formatWithMultiUnit(25.4, 'mm', 'inches', 4);
      expect(result).toBe('25.4000 mm (1.0000 inches)');
    });
  });
});
