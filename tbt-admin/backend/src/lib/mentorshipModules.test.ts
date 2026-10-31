import { describe, it, expect } from 'vitest';
import {
  modulesForProductServiceType,
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

describe('resolveModuleAccess — business type derivation', () => {
  it('derives effective from businessType when selection is null and type is selectable', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: null, businessType: 'Service' });
    expect(a.effective).toEqual(['Service']);
    expect(a.restricted).toBe(true);
    expect(a.businessTypeDerived).toBe(true);
    expect(a.selectionRequired).toBe(false);
    expect(a.selection).toBeNull();
  });

  it('derives correctly for all three module values', () => {
    for (const bt of ['Product', 'Service', 'Coaching'] as const) {
      const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: null, businessType: bt });
      expect(a.effective).toEqual([bt]);
      expect(a.businessTypeDerived).toBe(true);
    }
  });

  it('explicit selection wins over businessType', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: ['Service'], businessType: 'Product' });
    expect(a.effective).toEqual(['Service']);
    expect(a.businessTypeDerived).toBe(false);
  });

  it('businessType outside program ceiling falls back to showing all ceiling modules', () => {
    // Program allows Service + Coaching; businessType is Product (not in ceiling)
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: ['Service', 'Coaching'], selection: null, businessType: 'Product' });
    expect(a.businessTypeDerived).toBe(false);
    expect(a.effective).toEqual(['Service', 'Coaching']);
    expect(a.restricted).toBe(true);
  });

  it('admin override wins even with a businessType set', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: ['Coaching'], programModules: [], selection: null, businessType: 'Product' });
    // Admin ceiling is Coaching only; Product is not in selectable
    expect(a.businessTypeDerived).toBe(false);
    expect(a.effective).toEqual(['Coaching']);
  });

  it('businessType that matches admin ceiling is still derived', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: ['Service'], programModules: [], selection: null, businessType: 'Service' });
    expect(a.businessTypeDerived).toBe(true);
    expect(a.effective).toEqual(['Service']);
  });

  it('null businessType keeps legacy behaviour (no derivation)', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: null, businessType: null });
    expect(a.businessTypeDerived).toBe(false);
    expect(a.restricted).toBe(false);
    expect(a.selectionRequired).toBe(true);
  });

  it('unknown businessType (not an active module) falls back gracefully', () => {
    const a = resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: null, businessType: 'Other' });
    expect(a.businessTypeDerived).toBe(false);
    expect(a.restricted).toBe(false);
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

describe('modulesForProductServiceType (onboarding "Business Type")', () => {
  it('maps the onboarding options, ignoring case, spaces and hyphens', () => {
    expect(modulesForProductServiceType('Product-based')).toEqual(['Product']);
    expect(modulesForProductServiceType('product based')).toEqual(['Product']);
    expect(modulesForProductServiceType('Service-based')).toEqual(['Service', 'Coaching']);
    expect(modulesForProductServiceType('SERVICE-BASED')).toEqual(['Service', 'Coaching']);
    expect(modulesForProductServiceType('Coaching')).toEqual(['Coaching']);
    expect(modulesForProductServiceType('coaching')).toEqual(['Coaching']);
    // Legacy values from before signup dropped Both/Other keep their mapping.
    expect(modulesForProductServiceType('Both')).toEqual(['Product', 'Service', 'Coaching']);
    expect(modulesForProductServiceType('Other')).toEqual([]);
    expect(modulesForProductServiceType(null)).toEqual([]);
    expect(modulesForProductServiceType(undefined)).toEqual([]);
  });

  it('derived modules are limited to active, entitled modules, in module order', () => {
    const base = { activeModules: ['Introduction', 'Product', 'Service', 'Coaching'], adminOverride: null, programModules: [], selection: null };
    expect(resolveModuleAccess({ ...base, businessTypeModules: ['Coaching', 'Service'] }).effective).toEqual(['Service', 'Coaching']);
    // Coaching withdrawn by the admin (module_config.is_active = false)
    expect(resolveModuleAccess({ ...base, activeModules: ['Introduction', 'Product', 'Service'], businessTypeModules: ['Service', 'Coaching'] }).effective).toEqual(['Service']);
    const r = resolveModuleAccess({ ...base, businessTypeModules: ['Service', 'Coaching'] });
    expect(r.restricted).toBe(true);
    expect(r.businessTypeDerived).toBe(true);
  });
});
