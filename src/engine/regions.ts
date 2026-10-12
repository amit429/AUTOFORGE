import { REGIONS, type Build, type OptionKey, type RegionId } from '@/data/options';
import { isAvailable } from './availability';
import { cloneBuild } from './build';
import { optionLabel } from './labels';

/** Suggests a region from an IANA time zone. Falls back to India, the launch market. */
export function guessRegion(timeZone?: string): RegionId {
  let tz = timeZone;
  if (tz === undefined) {
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      tz = '';
    }
  }
  if (/Kolkata|Calcutta/.test(tz)) return 'in';
  if (/Tokyo/.test(tz)) return 'jp';
  if (/Dubai|Riyadh|Qatar|Bahrain|Kuwait|Muscat/.test(tz)) return 'me';
  if (/Oslo|Stockholm|Copenhagen|Helsinki|Reykjavik/.test(tz)) return 'nd';
  if (/^Europe\//.test(tz)) return 'eu';
  if (/^America\//.test(tz)) return 'us';
  return 'in';
}

export interface RegionChange {
  build: Build;
  /** Human-readable substitutions, e.g. "Saffron Dusk replaced with Vesper Black". */
  swaps: string[];
  /** Keys whose value was replaced, so 3D can transition just those parts. */
  swappedKeys: OptionKey[];
  driveChanged: boolean;
}

/** Fallbacks used when a choice stops being orderable in the new region. */
const FALLBACKS = [
  ['paint', 'vesper'],
  ['livery', 'none'],
  ['trim', 'carbon'],
  ['seatMat', 'nappa'],
  ['ltint', 'ice'],
  ['size', 20],
] as const satisfies readonly (readonly [OptionKey, unknown])[];

/**
 * Moves a build to a new region: re-checks every rule, replaces anything that is no longer
 * orderable with a default, and explains each swap in a sentence.
 */
export function applyRegion(b: Build, region: RegionId): RegionChange {
  const R = REGIONS[region];
  const build = cloneBuild(b);
  build.region = region;
  const swaps: string[] = [];
  const swappedKeys: OptionKey[] = [];

  for (const [key, fallback] of FALLBACKS) {
    if (isAvailable(key, build[key], region)) continue;
    const old = optionLabel(key, build).name;
    (build as Record<OptionKey, unknown>)[key] = fallback;
    swaps.push(`${old} replaced with ${optionLabel(key, build).name}`);
    swappedKeys.push(key);
  }
  if (build.vlt < R.vlt) {
    build.vlt = R.vlt;
    swaps.push(`Glass lightened to ${R.vlt}% to meet local law`);
    swappedKeys.push('vlt');
  }
  const kept = build.packs.filter((k) => R.packs.includes(k));
  if (kept.length !== build.packs.length) {
    build.packs = kept;
    swaps.push('Packs from your previous region removed');
    swappedKeys.push('packs');
  }
  return { build, swaps, swappedKeys, driveChanged: REGIONS[b.region].drive !== R.drive };
}
