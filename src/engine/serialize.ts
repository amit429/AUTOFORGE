import type { Build } from '@/data/options';
import { BUILD_KEYS, normalize } from './build';
import { applyRegion } from './regions';

/** Plain object with keys in canonical order. */
export function canonical(b: Build): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of BUILD_KEYS) o[k] = b[k];
  return o;
}

const toB64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** Compact, URL-safe build code used for `?b=` deep links and copied build codes. */
export const encodeBuild = (b: Build) => toB64Url(JSON.stringify(canonical(b)));

/**
 * Parses a build code. Malformed values fall back to defaults and anything not orderable in
 * the build's region is swapped, so the result is always valid. Returns null if unreadable.
 */
export function decodeBuild(code: string | null | undefined): Build | null {
  if (!code) return null;
  try {
    const b = normalize(JSON.parse(fromB64Url(code.trim())));
    return applyRegion(b, b.region).build;
  } catch {
    return null;
  }
}

/** Design ID, e.g. AF-IN-48213: FNV-1a over the canonical build. */
export function designId(b: Build): string {
  const s = JSON.stringify(canonical(b));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `AF-${b.region.toUpperCase()}-${(Math.abs(h) % 90000) + 10000}`;
}
