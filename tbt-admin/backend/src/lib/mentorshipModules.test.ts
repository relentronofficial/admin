import { describe, it, expect } from 'vitest';
import {
  parseModuleList,
  resolveModuleAccess,
  isCourseModuleAllowed,
  validateModuleSelection,
} from './mentorshipModules.js';

const ACTIVE = ['Product', 'Service', 'Coaching'];

describe('parseModuleList', () => {
  it('returns null for null/undefined (never selected)', () => {
    expect(parseModuleList(null)).toBeNull();
    expect(parseModuleList(undefined)).toBeNull();
  });
  it('accepts arrays and JSON strings, trimming and de-duplicating', () => {
    expect(parseModuleList(['Service', ' Service ', 'Coaching'])).toEqual(['Service', 'Coaching']);
    expect(parseModuleList('["Product"]')).toEqual(['Product']);
    expect(parseModuleList([])).toEqual([]);
  });
  it('returns null for malformed input instead of throwing', () => {
    expect(parseModuleList('not json')).toBeNull();
    expect(parseModuleList({ a: 1 })).toBeNull();
  });
});

describe('resolveModuleAccess', () => {
  it('Services-only member sees only Service', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: ['Service'] });
    expect(a.restricted).toBe(true);
    expect(a.effective).toEqual(['Service']);
    expect(a.selectionRequired).toBe(false);
  });

  it('CoachX (Coaching) member sees only Coaching — different users, different selections', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: ['Coaching'] });
    expect(a.effective).toEqual(['Coaching']);
  });

  it('multi-select keeps only the selected modules, in configured order', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: ['Coaching', 'Product'] });
    expect(a.effective).toEqual(['Product', 'Coaching']);
  });

  it('no saved selection keeps legacy behaviour (ceiling only) and asks to choose', () => {
    const unrestricted = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: null });
    expect(unrestricted.restricted).toBe(false);
    expect(unrestricted.selectionRequired).toBe(true);

    const program = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: ['Product', 'Service'], selection: null });
    expect(program.restricted).toBe(true);
    expect(program.effective).toEqual(['Product', 'Service']);
    expect(program.selectable).toEqual(['Product', 'Service']);
  });

  it('selection never widens the program ceiling', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: ['Product'], selection: ['Product', 'Coaching'] });
    expect(a.effective).toEqual(['Product']);
  });

  it('admin override wins over program; [] override means unrestricted ceiling', () => {
    const override = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: ['Service'], programModules: ['Product'], selection: null });
    expect(override.effective).toEqual(['Service']);
    const all = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: [], programModules: ['Product'], selection: ['Coaching'] });
    expect(all.entitled).toBeNull();
    expect(all.effective).toEqual(['Coaching']);
  });

  it('a disabled module drops out without granting anything else', () => {
    const a = resolveModuleAccess({ activeModules: ['Product', 'Coaching'], adminOverride: null, programModules: [], selection: ['Service'] });
    expect(a.restricted).toBe(true);
    expect(a.effective).toEqual([]);
    expect(a.selectionRequired).toBe(true);
    expect(a.selection).toEqual(['Service']); // kept so re-enabling restores it
  });

  it('nothing selectable → restricted to nothing, no prompt', () => {
    const a = resolveModuleAccess({ activeModules: [], adminOverride: null, programModules: [], selection: ['Service'] });
    expect(a.effective).toEqual([]);
    expect(a.selectionRequired).toBe(false);
  });
});

describe('isCourseModuleAllowed', () => {
  const services = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: ['Service'] });
  it('denies courses in unselected modules', () => {
    expect(isCourseModuleAllowed('Coaching', services)).toBe(false);
    expect(isCourseModuleAllowed('Product', services)).toBe(false);
  });
  it('allows the selected module and general (module-less) courses', () => {
    expect(isCourseModuleAllowed('Service', services)).toBe(true);
    expect(isCourseModuleAllowed(null, services)).toBe(true);
  });
  it('allows everything for an unrestricted legacy member', () => {
    const legacy = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: null });
    expect(isCourseModuleAllowed('Coaching', legacy)).toBe(true);
  });
  it('denies everything module-tagged when every selected module was disabled', () => {
    const none = resolveModuleAccess({ activeModules: ['Product'], adminOverride: null, programModules: [], selection: ['Service'] });
    expect(isCourseModuleAllowed('Product', none)).toBe(false);
    expect(isCourseModuleAllowed('Service', none)).toBe(false);
  });
});

describe('validateModuleSelection', () => {
  it('accepts a subset and returns it in configured order', () => {
    expect(validateModuleSelection(['Coaching', 'Service', 'Service'], ACTIVE)).toEqual({ ok: true, modules: ['Service', 'Coaching'] });
  });
  it('rejects empty, non-array, non-string and unknown/unentitled modules', () => {
    expect(validateModuleSelection([], ACTIVE).ok).toBe(false);
    expect(validateModuleSelection('Service', ACTIVE).ok).toBe(false);
    expect(validateModuleSelection([1], ACTIVE).ok).toBe(false);
    expect(validateModuleSelection(['Ecommerce'], ACTIVE).ok).toBe(false);
    expect(validateModuleSelection(['Coaching'], ['Product', 'Service']).ok).toBe(false);
  });
  it('rejects when nothing is selectable', () => {
    expect(validateModuleSelection(['Service'], []).ok).toBe(false);
  });
});
