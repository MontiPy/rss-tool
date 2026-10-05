import { describe, expect, it } from 'vitest';
import example from '../../../example-calculation.json';
import { buildProjectCSV, escapeCsv, parseProjectData, parseProjectJSON } from '../fileHandlers';

const minimal = {
  toleranceMode: 'symmetric',
  directions: [{ id: 'd1', name: 'B', items: [{ id: 'i1', name: 'A', tolerancePlus: 0.5, toleranceMinus: 0.5 }] }],
};

describe('parseProjectData', () => {
  it('fills defaults for older files', () => {
    const data = parseProjectData(minimal);
    expect(data.unit).toBe('mm');
    expect(data.analysisSettings!.calculationMode).toBe('rss');
    expect(data.directions[0].items[0].nominal).toBe(0);
    expect(data.directions[0].items[0].floatFactor).toBe(1);
  });

  it('keeps USL/LSL of zero', () => {
    const data = parseProjectData({ ...minimal, directions: [{ ...minimal.directions[0], usl: 0, lsl: -1 }] });
    expect(data.directions[0].usl).toBe(0);
    expect(data.directions[0].lsl).toBe(-1);
  });

  it('migrates targetBudget and isFloat', () => {
    const data = parseProjectData({
      toleranceMode: 'symmetric',
      directions: [{ id: 'd', name: 'x', targetBudget: 2, items: [{ id: 'i', name: 'a', tolerancePlus: 1, toleranceMinus: 1, isFloat: true }] }],
    });
    expect(data.directions[0].usl).toBe(2);
    expect(data.directions[0].lsl).toBe(-2);
    expect(data.directions[0].items[0].floatFactor).toBeCloseTo(Math.sqrt(3), 10);
  });

  it('clamps negative tolerances and de-duplicates IDs', () => {
    const data = parseProjectData({
      toleranceMode: 'symmetric',
      directions: [{ id: 'd', name: 'x', items: [
        { id: 'i', name: 'a', tolerancePlus: -1, toleranceMinus: 0.2 },
        { id: 'i', name: 'b', tolerancePlus: 0.1, toleranceMinus: 0.1 },
      ] }],
    });
    expect(data.directions[0].items[0].tolerancePlus).toBe(0);
    expect(new Set(data.directions[0].items.map((i) => i.id)).size).toBe(2);
  });

  it('rejects invalid structures', () => {
    expect(() => parseProjectData(null)).toThrow();
    expect(() => parseProjectData({ directions: 'nope' })).toThrow();
    expect(() => parseProjectData({ directions: [] })).toThrow();
    expect(() => parseProjectJSON('{oops')).toThrow(/valid JSON/);
  });

  it('does not allow Monte Carlo mode while the feature is disabled', () => {
    const data = parseProjectData({ ...minimal, analysisSettings: { calculationMode: 'monteCarlo' } });
    expect(data.analysisSettings!.calculationMode).toBe('rss');
  });
});

describe('CSV export', () => {
  it('escapes special characters', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv(undefined)).toBe('');
  });

  it('uses floatFactor (not the legacy isFloat flag) for contributions', () => {
    const data = parseProjectData({
      toleranceMode: 'symmetric',
      directions: [{ id: 'd', name: 'x', items: [{ id: 'i', name: 'a', tolerancePlus: 1, toleranceMinus: 1, floatFactor: Math.sqrt(3) }] }],
    });
    const csv = buildProjectCSV(data);
    expect(csv).toContain('1.732 (float)');
    expect(csv).toContain('1.7321');
  });
});

describe('example project', () => {
  it('loads the bundled example file', () => {
    const data = parseProjectData(example);
    expect(data.directions.length).toBeGreaterThan(0);
  });
});
