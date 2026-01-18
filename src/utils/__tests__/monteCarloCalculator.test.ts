import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation } from '../monteCarloCalculator';
import { ToleranceItem, MonteCarloSettings } from '../../types';
import { FLOAT_FACTORS } from '../rssCalculator';

describe('monteCarloCalculator', () => {
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

  const defaultSettings: MonteCarloSettings = {
    iterations: 10000, // Use fewer iterations for faster tests
    useAdvancedDistributions: false,
  };

  describe('runMonteCarloSimulation', () => {
    it('should return correct number of samples', () => {
      const items = [createItem(0.5)];
      const result = runMonteCarloSimulation(items, 'dir-1', 'Test', defaultSettings);
      expect(result.samples.length).toBe(defaultSettings.iterations);
    });

    it('should calculate percentiles', () => {
      const items = [createItem(0.5)];
      const result = runMonteCarloSimulation(items, 'dir-1', 'Test', defaultSettings);

      expect(result.percentiles.p5).toBeDefined();
      expect(result.percentiles.p50).toBeDefined();
      expect(result.percentiles.p95).toBeDefined();
      expect(result.percentiles.p99).toBeDefined();
      expect(result.percentiles.mean).toBeDefined();
      expect(result.percentiles.stdDev).toBeDefined();
    });

    it('should have p5 < p50 < p95 < p99', () => {
      const items = [createItem(0.5)];
      const result = runMonteCarloSimulation(items, 'dir-1', 'Test', defaultSettings);

      expect(result.percentiles.p5).toBeLessThan(result.percentiles.p50);
      expect(result.percentiles.p50).toBeLessThan(result.percentiles.p95);
      expect(result.percentiles.p95).toBeLessThan(result.percentiles.p99);
    });

    it('should generate histogram with 50 bins', () => {
      const items = [createItem(0.5)];
      const result = runMonteCarloSimulation(items, 'dir-1', 'Test', defaultSettings);
      expect(result.histogram.length).toBe(50);
    });

    it('should generate item histograms with 30 bins', () => {
      const items = [createItem(0.5, 0.5, 1.0, '1'), createItem(0.3, 0.3, 1.0, '2')];
      const result = runMonteCarloSimulation(items, 'dir-1', 'Test', defaultSettings);

      expect(result.itemHistograms.get('1')?.length).toBe(30);
      expect(result.itemHistograms.get('2')?.length).toBe(30);
    });

    it('should calculate item contributions', () => {
      const items = [createItem(0.5, 0.5, 1.0, '1'), createItem(0.3, 0.3, 1.0, '2')];
      const result = runMonteCarloSimulation(items, 'dir-1', 'Test', defaultSettings);

      expect(result.itemContributions.length).toBe(2);
      expect(result.itemContributions[0].itemId).toBe('1');
      expect(result.itemContributions[1].itemId).toBe('2');
    });

    it('should have mean close to zero for symmetric tolerances', () => {
      const items = [createItem(0.5)];
      const result = runMonteCarloSimulation(items, 'dir-1', 'Test', {
        ...defaultSettings,
        iterations: 50000, // More iterations for better accuracy
      });

      // Mean should be close to 0 for symmetric tolerances
      expect(Math.abs(result.percentiles.mean)).toBeLessThan(0.05);
    });

    it('should scale standard deviation with float factor', () => {
      const fixedItems = [createItem(0.5, 0.5, 1.0)];
      const floatItems = [createItem(0.5, 0.5, FLOAT_FACTORS.SQRT3)];

      const fixedResult = runMonteCarloSimulation(
        fixedItems,
        'dir-1',
        'Test',
        defaultSettings
      );
      const floatResult = runMonteCarloSimulation(
        floatItems,
        'dir-1',
        'Test',
        defaultSettings
      );

      // Float factor should increase the spread
      expect(floatResult.percentiles.stdDev).toBeGreaterThan(
        fixedResult.percentiles.stdDev
      );
    });

    describe('risk analysis', () => {
      it('should include risk analysis when USL provided', () => {
        const items = [createItem(0.5)];
        const result = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          defaultSettings,
          1.0 // USL
        );

        expect(result.riskAnalysis).toBeDefined();
        expect(result.riskAnalysis?.usl).toBe(1.0);
        expect(result.riskAnalysis?.probabilityExceedingUSL).toBeGreaterThanOrEqual(0);
        expect(result.riskAnalysis?.probabilityExceedingUSL).toBeLessThanOrEqual(1);
      });

      it('should include risk analysis when LSL provided', () => {
        const items = [createItem(0.5)];
        const result = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          defaultSettings,
          undefined,
          -1.0 // LSL
        );

        expect(result.riskAnalysis).toBeDefined();
        expect(result.riskAnalysis?.lsl).toBe(-1.0);
        expect(result.riskAnalysis?.probabilityExceedingLSL).toBeGreaterThanOrEqual(0);
        expect(result.riskAnalysis?.probabilityExceedingLSL).toBeLessThanOrEqual(1);
      });

      it('should calculate total out-of-spec probability', () => {
        const items = [createItem(0.5)];
        const result = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          defaultSettings,
          1.0, // USL
          -1.0 // LSL
        );

        expect(result.riskAnalysis?.probabilityOutOfSpec).toBe(
          result.riskAnalysis!.probabilityExceedingUSL +
            result.riskAnalysis!.probabilityExceedingLSL
        );
      });

      it('should calculate expected defect rate in PPM', () => {
        const items = [createItem(0.5)];
        const result = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          defaultSettings,
          1.0,
          -1.0
        );

        expect(result.riskAnalysis?.expectedDefectRate).toBe(
          result.riskAnalysis!.probabilityOutOfSpec * 1_000_000
        );
      });

      it('should have higher probability of exceeding tight limits', () => {
        const items = [createItem(0.5)];

        const tightResult = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          defaultSettings,
          0.3, // Tight USL
          -0.3 // Tight LSL
        );

        const looseResult = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          defaultSettings,
          2.0, // Loose USL
          -2.0 // Loose LSL
        );

        expect(tightResult.riskAnalysis?.probabilityOutOfSpec).toBeGreaterThan(
          looseResult.riskAnalysis?.probabilityOutOfSpec || 0
        );
      });
    });

    describe('distribution types', () => {
      it('should use normal distribution for fixed items by default', () => {
        const items = [createItem(0.5, 0.5, 1.0)];
        const result = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          { ...defaultSettings, iterations: 50000 }
        );

        // For normal distribution, ~99.7% should be within ±3σ
        // With tolerance = 3σ assumption, σ = 0.5/3 ≈ 0.167
        // Most values should be within [-0.5, 0.5]
        const within3sigma = result.samples.filter(
          (s) => s >= -0.5 && s <= 0.5
        ).length;
        const proportion = within3sigma / result.samples.length;

        // Should be close to 99.7% but with some tolerance for randomness
        expect(proportion).toBeGreaterThan(0.95);
      });

      it('should use uniform distribution for floating items by default', () => {
        const items = [createItem(0.5, 0.5, FLOAT_FACTORS.SQRT3)];
        const result = runMonteCarloSimulation(
          items,
          'dir-1',
          'Test',
          { ...defaultSettings, iterations: 50000 }
        );

        // For uniform distribution, values should be evenly spread
        // All samples should be within the range scaled by float factor
        const maxExpected = 0.5 * FLOAT_FACTORS.SQRT3 * 1.1; // Add small margin
        const allWithinRange = result.samples.every(
          (s) => Math.abs(s) <= maxExpected
        );

        expect(allWithinRange).toBe(true);
      });
    });

    describe('with advanced distributions', () => {
      it('should respect item-specific distribution type', () => {
        const items: ToleranceItem[] = [
          {
            id: '1',
            name: 'Normal Item',
            nominal: 0,
            tolerancePlus: 0.5,
            toleranceMinus: 0.5,
            floatFactor: 1.0,
            distributionType: 'normal',
          },
          {
            id: '2',
            name: 'Uniform Item',
            nominal: 0,
            tolerancePlus: 0.5,
            toleranceMinus: 0.5,
            floatFactor: 1.0,
            distributionType: 'uniform',
          },
        ];

        const result = runMonteCarloSimulation(items, 'dir-1', 'Test', {
          ...defaultSettings,
          useAdvancedDistributions: true,
        });

        // Should complete without errors
        expect(result.samples.length).toBe(defaultSettings.iterations);
        expect(result.itemHistograms.size).toBe(2);
      });
    });
  });
});
