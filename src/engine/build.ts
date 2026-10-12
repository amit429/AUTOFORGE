import {
  ACCENTS,
  BODY_TYPES,
  AMBIENT_MODES,
  CALIPERS,
  DEFAULT_BUILD,
  FINISHES,
  GRILLES,
  LAMP_TINTS,
  LIGHT_SIGNATURES,
  LIVERIES,
  LIVERY_COLOURS,
  PACKS,
  PAINTS,
  QUILTS,
  REGIONS,
  ROOFS,
  SEAT_COLOURS,
  SEAT_MATERIALS,
  SPOILERS,
  STITCHES,
  TRIMS,
  WHEEL_FINISHES,
  WHEEL_SIZES,
  WHEELS,
  type Build,
  type OptionKey,
} from '@/data/options';
import { availability } from './availability';

/** A partial build holding only the keys a change touched. */
export type Patch = Partial<Build>;

export type SetResult =
  | { ok: false; reason: string }
  | { ok: true; changed: false; build: Build }
  | { ok: true; changed: true; build: Build; prev: Patch; next: Patch };

export const RANGES = {
  vlt: { min: 15, max: 90, step: 1 },
  livScale: { min: 0.6, max: 1.8, step: 0.05 },
  ambBri: { min: 0.15, max: 1, step: 0.01 },
} as const;

/** Keys in canonical order; serialisation and commission numbers depend on it. */
export const BUILD_KEYS = Object.keys(DEFAULT_BUILD) as OptionKey[];

export const cloneBuild = (b: Build): Build => ({ ...b, packs: [...b.packs] });

export const sameValue = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : a === b;

const HEX = /^#[0-9a-f]{6}$/i;
const CATALOGUE: Partial<Record<OptionKey, Record<string, unknown>>> = {
  body: BODY_TYPES,
  finish: FINISHES,
  livery: LIVERIES,
  livCol: LIVERY_COLOURS,
  wheel: WHEELS,
  wfin: WHEEL_FINISHES,
  caliper: CALIPERS,
  roof: ROOFS,
  accent: ACCENTS,
  spoiler: SPOILERS,
  grille: GRILLES,
  sig: LIGHT_SIGNATURES,
  ltint: LAMP_TINTS,
  seatMat: SEAT_MATERIALS,
  seatCol: SEAT_COLOURS,
  quilt: QUILTS,
  stitch: STITCHES,
  trim: TRIMS,
  ambMode: AMBIENT_MODES,
};

const clampRange = (key: keyof typeof RANGES, v: number) => {
  const r = RANGES[key];
  const stepped = Math.round(v / r.step) * r.step;
  return Math.min(r.max, Math.max(r.min, Number(stepped.toFixed(4))));
};

/**
 * Coerces an untrusted value for `key` into a well-formed one (right type, in the catalogue,
 * within range), or returns undefined. It does not check region availability.
 */
export function coerce<K extends OptionKey>(key: K, value: unknown): Build[K] | undefined {
  const out = (v: unknown) => v as Build[K];
  switch (key) {
    case 'region':
      return typeof value === 'string' && value in REGIONS ? out(value) : undefined;
    case 'paint':
      return value === 'custom' || (typeof value === 'string' && value in PAINTS) ? out(value) : undefined;
    case 'custom':
    case 'amb':
      return typeof value === 'string' && HEX.test(value) ? out(value.toLowerCase()) : undefined;
    case 'size': {
      const n = Number(value);
      return (WHEEL_SIZES as readonly number[]).includes(n) ? out(n) : undefined;
    }
    case 'vlt':
      return Number.isFinite(Number(value)) ? out(Math.round(clampRange('vlt', Number(value)))) : undefined;
    case 'livScale':
    case 'ambBri':
      return Number.isFinite(Number(value)) ? out(clampRange(key, Number(value))) : undefined;
    case 'packs':
      return Array.isArray(value) && value.every((p) => typeof p === 'string' && p in PACKS)
        ? out([...new Set(value)])
        : undefined;
    default: {
      const cat = CATALOGUE[key];
      return cat && typeof value === 'string' && value in cat ? out(value) : undefined;
    }
  }
}

/**
 * Sets one option. Returns the reason when the value is locked in the build's region.
 * Adding the Autobahn pack also fits its wing, as part of the same change.
 */
export function setOption<K extends OptionKey>(b: Build, key: K, raw: Build[K]): SetResult {
  const value = coerce(key, raw);
  if (value === undefined) return { ok: false, reason: 'That option is not available.' };
  if (key === 'region') return { ok: false, reason: 'Use applyRegion to change region.' };
  const av = availability(key, value, b.region);
  if (!av.ok) return { ok: false, reason: av.reason ?? 'That option is not available.' };
  if (sameValue(b[key], value)) return { ok: true, changed: false, build: b };

  const prev: Patch = { [key]: b[key] };
  const next: Patch = { [key]: value };
  const build = cloneBuild(b);
  build[key] = value;

  if (key === 'packs') {
    const added = (value as Build['packs']).filter((p) => !b.packs.includes(p));
    if (added.includes('autobahn') && b.spoiler !== 'wing') {
      prev.spoiler = b.spoiler;
      next.spoiler = 'wing';
      build.spoiler = 'wing';
    }
  }
  return { ok: true, changed: true, build, prev, next };
}

/** Writes a patch over a build, skipping values that are malformed. */
export function applyPatch(b: Build, patch: Patch): Build {
  const build = cloneBuild(b);
  for (const key of Object.keys(patch) as OptionKey[]) {
    const v = coerce(key, patch[key]);
    if (v !== undefined) (build as Record<OptionKey, unknown>)[key] = v;
  }
  return build;
}

/**
 * Applies several options as one change (moods, "inspire me", start over). Region is never
 * part of a snapshot, and options locked in the current region are skipped.
 */
export function applySnapshot(b: Build, target: Patch): { build: Build; prev: Patch; next: Patch } {
  const prev: Patch = {};
  const next: Patch = {};
  let build = b;
  for (const key of BUILD_KEYS) {
    if (key === 'region' || !(key in target)) continue;
    const r = setOption(build, key, target[key] as Build[typeof key]);
    if (r.ok && r.changed) {
      Object.assign(next, r.next);
      for (const k of Object.keys(r.prev) as OptionKey[])
        if (!(k in prev)) Object.assign(prev, { [k]: r.prev[k] });
      build = r.build;
    }
  }
  return { build, prev, next };
}

/** Turns untrusted input (URL, storage) into a complete, well-formed build. */
export function normalize(input: unknown): Build {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const build = cloneBuild(DEFAULT_BUILD);
  for (const key of BUILD_KEYS) {
    const v = coerce(key, src[key]);
    if (v !== undefined) (build as Record<OptionKey, unknown>)[key] = v;
  }
  return build;
}
