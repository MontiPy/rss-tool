import { describe, expect, it } from 'vitest';
import { convertProjectUnits, createDefaultProject } from '../projectDefaults';

describe('convertProjectUnits', () => {
  it('converts nominals, tolerances, target and limits', () => {
    const project = createDefaultProject();
    project.directions[0] = {
      ...project.directions[0],
      usl: 1,
      lsl: -0.5,
      targetNominal: 2,
      items: [{ id: 'i', name: 'a', nominal: 10, tolerancePlus: 0.1, toleranceMinus: 0.2, floatFactor: 1 }],
    };
    const converted = convertProjectUnits(project, 'inches', 'mm');
    const dir = converted.directions[0];
    expect(converted.unit).toBe('mm');
    expect(dir.usl).toBe(25.4);
    expect(dir.lsl).toBe(-12.7);
    expect(dir.targetNominal).toBe(50.8);
    expect(dir.items[0].nominal).toBe(254);
    expect(dir.items[0].tolerancePlus).toBe(2.54);
    expect(dir.items[0].toleranceMinus).toBe(5.08);
  });

  it('leaves undefined limits undefined', () => {
    const project = createDefaultProject();
    expect(convertProjectUnits(project, 'mm', 'μm').directions[0].usl).toBeUndefined();
  });
});
