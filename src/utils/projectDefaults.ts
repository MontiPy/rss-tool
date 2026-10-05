import { AnalysisSettings, ProjectData, ToleranceItem, ToleranceUnit } from '../types';
import { FLOAT_FACTORS, UNIT_TO_MM } from './rssCalculator';

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  calculationMode: 'rss',
  showMultiUnit: false,
  contributionThreshold: 40,
  sensitivityIncrement: 0.1,
  enableMonteCarlo: false,
  monteCarloSettings: {
    iterations: 50000,
    useAdvancedDistributions: false,
  },
};

/**
 * Unique-enough ID for items and stacks (timestamp + random suffix)
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultItem(index: number): ToleranceItem {
  return {
    id: generateId('item'),
    name: `Item ${index}`,
    nominal: 0,
    tolerancePlus: 0.5,
    toleranceMinus: 0.5,
    floatFactor: FLOAT_FACTORS.FIXED,
  };
}

export function createDefaultProject(): ProjectData {
  const now = new Date().toISOString();
  return {
    toleranceMode: 'symmetric',
    unit: 'mm',
    directions: [{ id: generateId('dir'), name: 'Stack 1', items: [] }],
    metadata: { createdDate: now, modifiedDate: now },
    analysisSettings: {
      ...DEFAULT_ANALYSIS_SETTINGS,
      monteCarloSettings: { ...DEFAULT_ANALYSIS_SETTINGS.monteCarloSettings! },
    },
  };
}

/**
 * Convert every dimensional value in a project (nominals, tolerances, target, limits)
 * from one unit to another.
 */
export function convertProjectUnits(data: ProjectData, from: ToleranceUnit, to: ToleranceUnit): ProjectData {
  if (from === to) return data;
  const factor = UNIT_TO_MM[from] / UNIT_TO_MM[to];
  // Round off binary noise (e.g. 25.4 × 0.1 = 2.5400000000000005)
  const conv = (v: number) => Number((v * factor).toPrecision(12));
  const convOpt = (v: number | undefined) => (v === undefined ? undefined : conv(v));

  return {
    ...data,
    unit: to,
    directions: data.directions.map((dir) => ({
      ...dir,
      usl: convOpt(dir.usl),
      lsl: convOpt(dir.lsl),
      targetNominal: convOpt(dir.targetNominal),
      items: dir.items.map((item) => ({
        ...item,
        nominal: conv(item.nominal || 0),
        tolerancePlus: conv(item.tolerancePlus),
        toleranceMinus: conv(item.toleranceMinus),
      })),
    })),
  };
}
