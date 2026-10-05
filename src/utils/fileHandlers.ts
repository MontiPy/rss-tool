import { saveAs } from 'file-saver';
import {
  AnalysisSettings,
  CalculationMode,
  Direction,
  DistributionType,
  ProjectData,
  ToleranceItem,
  ToleranceUnit,
} from '../types';
import { calculateTolerance, getItemFloatFactor, getStackCenter, isFloatingItem } from './rssCalculator';
import { DEFAULT_ANALYSIS_SETTINGS } from './projectDefaults';

const UNITS: ToleranceUnit[] = ['mm', 'inches', 'μm', 'mils'];
const CALC_MODES: CalculationMode[] = ['rss', 'worstCase', 'monteCarlo'];
const DISTRIBUTIONS: DistributionType[] = ['normal', 'uniform', 'triangular'];

/**
 * Export project data to JSON file
 */
export function exportToJSON(data: ProjectData, filename: string = 'rss-calculation.json'): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  saveAs(blob, filename);
}

/** Finite number or undefined (accepts numeric strings) */
function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function nonNegative(value: unknown): number {
  return Math.max(0, optionalNumber(value) ?? 0);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Normalize a single tolerance item from untrusted JSON
 */
function parseItem(raw: any, index: number, usedIds: Set<string>): ToleranceItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Item ${index + 1} is not an object`);
  }

  let id = typeof raw.id === 'string' && raw.id ? raw.id : `item-${index + 1}`;
  // Duplicate IDs break React keys and diagram links, so make them unique
  while (usedIds.has(id)) id = `${id}-dup`;
  usedIds.add(id);

  const floatFactor =
    optionalNumber(raw.floatFactor) ?? (raw.isFloat ? Math.sqrt(3) : 1.0);

  const item: ToleranceItem = {
    id,
    name: typeof raw.name === 'string' ? raw.name : `Item ${index + 1}`,
    nominal: optionalNumber(raw.nominal) ?? 0,
    tolerancePlus: nonNegative(raw.tolerancePlus),
    toleranceMinus: nonNegative(raw.toleranceMinus ?? raw.tolerancePlus),
    floatFactor: floatFactor > 0 ? floatFactor : 1.0,
    notes: optionalString(raw.notes),
    source: optionalString(raw.source),
    imageUrl: optionalString(raw.imageUrl),
  };
  if (DISTRIBUTIONS.includes(raw.distributionType)) {
    item.distributionType = raw.distributionType;
  }
  return item;
}

function parseDirection(raw: any, index: number, usedIds: Set<string>): Direction {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Stack ${index + 1} is not an object`);
  }
  if (raw.items !== undefined && !Array.isArray(raw.items)) {
    throw new Error(`Stack ${index + 1} has invalid items`);
  }

  let usl = optionalNumber(raw.usl);
  let lsl = optionalNumber(raw.lsl);
  const targetBudget = optionalNumber(raw.targetBudget);

  // Legacy files: convert targetBudget to symmetric USL/LSL
  if (targetBudget !== undefined && targetBudget > 0 && usl === undefined && lsl === undefined) {
    usl = targetBudget;
    lsl = -targetBudget;
  }

  const itemIds = new Set<string>();
  const direction: Direction = {
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : `dir-${index + 1}`,
    name: typeof raw.name === 'string' && raw.name ? raw.name : `Stack ${index + 1}`,
    description: optionalString(raw.description),
    usl,
    lsl,
    targetNominal: optionalNumber(raw.targetNominal),
    items: (raw.items ?? []).map((item: unknown, i: number) => parseItem(item, i, itemIds)),
  };
  while (usedIds.has(direction.id)) direction.id = `${direction.id}-dup`;
  usedIds.add(direction.id);
  return direction;
}

function parseAnalysisSettings(raw: any): AnalysisSettings {
  const s = raw && typeof raw === 'object' ? raw : {};
  const mc = s.monteCarloSettings && typeof s.monteCarloSettings === 'object' ? s.monteCarloSettings : {};
  const iterations = optionalNumber(mc.iterations);
  const seed = optionalNumber(mc.seed);

  const settings: AnalysisSettings = {
    calculationMode: oneOf(s.calculationMode, CALC_MODES, DEFAULT_ANALYSIS_SETTINGS.calculationMode),
    showMultiUnit: Boolean(s.showMultiUnit),
    secondaryUnit: UNITS.includes(s.secondaryUnit) ? s.secondaryUnit : undefined,
    contributionThreshold: optionalNumber(s.contributionThreshold) ?? DEFAULT_ANALYSIS_SETTINGS.contributionThreshold,
    sensitivityIncrement:
      optionalNumber(s.sensitivityIncrement) && s.sensitivityIncrement > 0
        ? Number(s.sensitivityIncrement)
        : DEFAULT_ANALYSIS_SETTINGS.sensitivityIncrement,
    enableMonteCarlo: Boolean(s.enableMonteCarlo),
    monteCarloSettings: {
      iterations:
        iterations !== undefined
          ? Math.min(1_000_000, Math.max(1000, Math.round(iterations)))
          : DEFAULT_ANALYSIS_SETTINGS.monteCarloSettings!.iterations,
      useAdvancedDistributions: Boolean(mc.useAdvancedDistributions),
      ...(seed !== undefined ? { seed: Math.round(seed) } : {}),
    },
  };

  // Monte Carlo mode is only reachable when the feature is enabled
  if (settings.calculationMode === 'monteCarlo' && !settings.enableMonteCarlo) {
    settings.calculationMode = 'rss';
  }
  return settings;
}

/**
 * Validate and normalize project data from untrusted JSON.
 * Fills defaults for fields missing in older files and migrates legacy fields
 * (`isFloat` → `floatFactor`, `targetBudget` → `usl`/`lsl`).
 */
export function parseProjectData(input: unknown): ProjectData {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid project data format');
  }
  const data = input as any;
  if (!Array.isArray(data.directions)) {
    throw new Error('Invalid project data format: missing "directions" array');
  }
  if (data.directions.length === 0) {
    throw new Error('Project must contain at least one tolerance stack');
  }

  const now = new Date().toISOString();
  const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  const directionIds = new Set<string>();

  return {
    toleranceMode: data.toleranceMode === 'asymmetric' ? 'asymmetric' : 'symmetric',
    unit: oneOf<ToleranceUnit>(data.unit, UNITS, 'mm'),
    metadata: {
      ...metadata,
      createdDate: optionalString(metadata.createdDate) ?? now,
      modifiedDate: optionalString(metadata.modifiedDate) ?? now,
    },
    analysisSettings: parseAnalysisSettings(data.analysisSettings),
    directions: data.directions.map((dir: unknown, i: number) => parseDirection(dir, i, directionIds)),
  };
}

/**
 * Parse project JSON text
 */
export function parseProjectJSON(text: string): ProjectData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error('File is not valid JSON: ' + (error as Error).message);
  }
  return parseProjectData(parsed);
}

/**
 * Import project data from JSON file
 */
export function importFromJSON(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        resolve(parseProjectJSON(event.target?.result as string));
      } catch (error) {
        reject(new Error('Failed to load project: ' + (error as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Escape a value for a CSV cell
 */
export function escapeCsv(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const MODE_LABELS: Record<CalculationMode, string> = {
  rss: 'RSS',
  worstCase: 'Worst-Case',
  monteCarlo: 'RSS', // Exported CSV uses deterministic RSS in place of a simulation
};

/**
 * Build CSV text with all tolerance stacks and their results
 */
export function buildProjectCSV(data: ProjectData): string {
  const unit = data.unit || 'mm';
  const mode = data.analysisSettings?.calculationMode || 'rss';
  const calcMode: CalculationMode = mode === 'worstCase' ? 'worstCase' : 'rss';
  const symmetric = data.toleranceMode === 'symmetric';
  const rows: (string | number | undefined)[][] = [];
  const meta = data.metadata || {};

  rows.push(['Project Name:', meta.projectName || 'N/A']);
  rows.push(['Description:', meta.description || 'N/A']);
  rows.push(['Author:', meta.author || 'N/A']);
  rows.push(['Drawing Number:', meta.drawingNumber || 'N/A']);
  rows.push(['Revision:', meta.revision || 'N/A']);
  rows.push(['Created:', meta.createdDate ? new Date(meta.createdDate).toLocaleString() : 'N/A']);
  rows.push(['Modified:', meta.modifiedDate ? new Date(meta.modifiedDate).toLocaleString() : 'N/A']);
  rows.push(['Units:', unit]);
  rows.push(['Tolerance Mode:', symmetric ? 'Symmetric (±)' : 'Asymmetric (+/-)']);
  rows.push(['Calculation Mode:', MODE_LABELS[mode]]);
  rows.push([]);

  data.directions.forEach((direction, dirIndex) => {
    if (dirIndex > 0) rows.push([]);
    rows.push(['Tolerance Stack:', direction.name]);
    if (direction.description) rows.push(['Description:', direction.description]);
    if (direction.targetNominal !== undefined) rows.push(['Target Nominal:', direction.targetNominal]);
    if (direction.usl !== undefined) rows.push(['USL:', direction.usl]);
    if (direction.lsl !== undefined) rows.push(['LSL:', direction.lsl]);
    rows.push([]);

    const result = direction.items.length > 0
      ? calculateTolerance(direction.items, direction.id, direction.name, calcMode)
      : null;

    rows.push(
      symmetric
        ? ['Item Name', 'Nominal', 'Tolerance (±)', 'Float Factor', 'Contribution', '% of Total', 'Source', 'Notes']
        : ['Item Name', 'Nominal', 'Tolerance (+)', 'Tolerance (-)', 'Float Factor', 'Contribution (+)', 'Contribution (-)', '% of Total', 'Source', 'Notes']
    );

    direction.items.forEach((item, i) => {
      const c = result!.itemContributions[i];
      const ff = getItemFloatFactor(item);
      const ffLabel = isFloatingItem(item) ? `${ff.toFixed(3)} (float)` : ff.toFixed(3);
      rows.push(
        symmetric
          ? [item.name, item.nominal, item.tolerancePlus, ffLabel, c.contributionPlus.toFixed(4), c.percentPlus.toFixed(1), item.source, item.notes]
          : [item.name, item.nominal, item.tolerancePlus, item.toleranceMinus, ffLabel, c.contributionPlus.toFixed(4), c.contributionMinus.toFixed(4), c.percentPlus.toFixed(1), item.source, item.notes]
      );
    });

    if (result) {
      const label = MODE_LABELS[calcMode];
      const center = getStackCenter(direction.items, direction.targetNominal);
      rows.push([]);
      if (symmetric) {
        rows.push([`${label} Result (±):`, `${result.totalPlus.toFixed(4)} ${unit}`]);
      } else {
        rows.push([`${label} Result (+):`, `${result.totalPlus.toFixed(4)} ${unit}`]);
        rows.push([`${label} Result (-):`, `${result.totalMinus.toFixed(4)} ${unit}`]);
      }
      rows.push(['Stack Center:', `${center.toFixed(4)} ${unit}`]);
      rows.push(['Predicted Range:', `${(center - result.totalMinus).toFixed(4)} to ${(center + result.totalPlus).toFixed(4)} ${unit}`]);
    }
  });

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n') + '\n';
}

/**
 * Export project data to CSV file
 */
export function exportToCSV(data: ProjectData, filename: string = 'rss-calculation.csv'): void {
  // BOM so Excel reads ± and √ correctly
  const blob = new Blob(['﻿' + buildProjectCSV(data)], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
}
