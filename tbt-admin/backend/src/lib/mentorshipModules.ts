// Pure resolution of which mentorship modules (courses.module values —
// 'Product' / 'Service' / 'Coaching', admin-managed in module_config) a member
// sees and may access. No I/O, so every consumer — the catalog, the course
// detail / playback / progress guards, and the selection endpoints — routes
// through the same verdict and it can be unit-tested without a database.
//
// Three layers (highest to lowest priority):
//   1. Entitlement ceiling (admin/program-controlled, unchanged from CP-11):
//      member_module_settings.allowed_modules (admin override; [] = explicitly unrestricted)
//      → programs.allowed_modules (via batch; [] = unrestricted) → unrestricted.
//   2. The member's own selection (member_module_settings.mentorship_modules), made during
//      onboarding. It can only narrow the ceiling, never widen it.
//   3. Business-type derivation: when the member has no explicit selection,
//      the modules their onboarding answers point to are the default
//      effective modules (those within the selectable set):
//        • members.product_service_type — the required onboarding "Business
//          Type" (Product-based → Product (E-commerce); Service-based →
//          Service + Coaching; Both → all three; Other → none), see
//          modulesForProductServiceType;
//        • members.business_type — the optional onboarding "Course Track"
//          (mapped to one module through module_config.business_type_keys).
//      The stored selection (mentorship_modules) always wins if non-null.
//
// A member with no saved selection AND no business type keeps the legacy
// CP-11 behaviour — the ceiling alone — so existing members are not cut off.

export interface ModuleAccessInput {
  /** module_config rows with is_active = true, in sort order. */
  activeModules: string[];
  /** member_module_settings.allowed_modules — null = no admin override; [] = explicit "all". */
  adminOverride: string[] | null;
  /** programs.allowed_modules of the member's batch program; [] = unrestricted. */
  programModules: string[];
  /** member_module_settings.mentorship_modules — null = never selected. */
  selection: string[] | null;
  /** members.business_type — used as default effective when selection is null. */
  businessType?: string | null;
  /** Modules derived from members.product_service_type (modulesForProductServiceType). */
  businessTypeModules?: string[];
}

/**
 * Modules the required onboarding "Business Type" answer
 * (members.product_service_type: Product-based / Service-based / Both / Other)
 * points to. Matching ignores case, spaces and hyphens. Anything else → [].
 */
export function modulesForProductServiceType(value: string | null | undefined): string[] {
  const key = (value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  switch (key) {
    case 'productbased': return ['Product'];
    case 'servicebased': return ['Service', 'Coaching'];
    case 'both': return ['Product', 'Service', 'Coaching'];
    default: return [];
  }
}

export interface ModuleAccess {
  /** Admin/program ceiling; null = unrestricted. */
  entitled: string[] | null;
  /** Modules the member may pick from: active ∩ entitled, in active order. */
  selectable: string[];
  /** The stored selection, sanitised (null = never selected). */
  selection: string[] | null;
  /** Modules the member sees and may access when `restricted` is true. */
  effective: string[];
  /** When false, no module filter applies (legacy unrestricted member). */
  restricted: boolean;
  /** True when the member has nothing usable selected but could choose. */
  selectionRequired: boolean;
  /** True when effective was derived from business_type (no explicit selection). */
  businessTypeDerived: boolean;
}

/** Normalise a JSONB module list (array, JSON string, or null) into string[] | null. */
export function parseModuleList(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function resolveModuleAccess(input: ModuleAccessInput): ModuleAccess {
  const { activeModules, adminOverride, programModules, selection, businessType, businessTypeModules } = input;

  const entitled: string[] | null =
    adminOverride !== null
      ? (adminOverride.length > 0 ? adminOverride : null)
      : (programModules.length > 0 ? programModules : null);

  const selectable = activeModules.filter((m) => entitled === null || entitled.includes(m));

  if (selection === null) {
    // No explicit selection: the modules the member's business type points to
    // (course track + onboarding business type) are the default effective
    // modules, when they are currently selectable. Kept in active order.
    const wanted = new Set([...(businessType ? [businessType] : []), ...(businessTypeModules ?? [])]);
    const derived = selectable.filter((m) => wanted.has(m));
    if (derived.length > 0) {
      return {
        entitled,
        selectable,
        selection: null,
        effective: derived,
        restricted: true,
        selectionRequired: false,
        businessTypeDerived: true,
      };
    }
    return {
      entitled,
      selectable,
      selection: null,
      effective: entitled ?? [],
      restricted: entitled !== null,
      selectionRequired: selectable.length > 0,
      businessTypeDerived: false,
    };
  }

  // Selected modules that were since disabled, removed, or fall outside the
  // ceiling simply drop out. The stored selection is kept as-is so re-enabling
  // a module restores it without the member having to choose again.
  const effective = selectable.filter((m) => selection.includes(m));
  return {
    entitled,
    selectable,
    selection,
    effective,
    restricted: true,
    selectionRequired: effective.length === 0 && selectable.length > 0,
    businessTypeDerived: false,
  };
}

/**
 * Whether a course with the given `courses.module` is within the member's
 * modules. Courses with no module are general content and stay visible.
 */
export function isCourseModuleAllowed(courseModule: string | null | undefined, access: ModuleAccess): boolean {
  if (!access.restricted) return true;
  if (!courseModule) return true;
  return access.effective.includes(courseModule);
}

export type SelectionValidation =
  | { ok: true; modules: string[] }
  | { ok: false; error: string };

/** Validate a member-submitted selection against the modules they may pick. */
export function validateModuleSelection(input: unknown, selectable: string[]): SelectionValidation {
  if (selectable.length === 0) return { ok: false, error: 'No mentorship modules are currently available' };
  if (!Array.isArray(input)) return { ok: false, error: 'modules must be an array of module names' };
  if (input.some((v) => typeof v !== 'string')) return { ok: false, error: 'modules must be an array of module names' };
  const requested = (input as string[]).map((v) => v.trim()).filter(Boolean);
  if (requested.length === 0) return { ok: false, error: 'Select at least one mentorship module' };
  const unknown = requested.filter((m) => !selectable.includes(m));
  if (unknown.length > 0) return { ok: false, error: `Module not available: ${unknown.join(', ')}` };
  return { ok: true, modules: selectable.filter((m) => requested.includes(m)) };
}
