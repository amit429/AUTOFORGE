import {
  LAMP_TINTS,
  LIVERIES,
  PAINTS,
  REGIONS,
  SEAT_MATERIALS,
  TRIMS,
  type Build,
  type OptionKey,
  type RegionId,
  type Regional,
} from '@/data/options';

export interface Availability {
  ok: boolean;
  /** One plain sentence explaining why an option is locked. */
  reason?: string;
}

const OK: Availability = { ok: true };

const listJoin = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

function exclusive(option: (Regional & { n: string }) | undefined, region: RegionId): Availability {
  if (!option) return { ok: false, reason: 'This option is not in the catalogue.' };
  if (option.rg && option.rg !== region)
    return { ok: false, reason: `${option.n} is exclusive to ${REGIONS[option.rg].n}.` };
  return OK;
}

/**
 * Whether `value` can be ordered for `key` in `region`. This is the only place availability
 * is decided; the UI renders its answer and never re-derives it.
 */
export function availability<K extends OptionKey>(key: K, value: Build[K], region: RegionId): Availability {
  const R = REGIONS[region];
  switch (key) {
    case 'paint':
      return value === 'custom' ? OK : exclusive(PAINTS[value as keyof typeof PAINTS], region);
    case 'livery':
      return exclusive(LIVERIES[value as keyof typeof LIVERIES], region);
    case 'trim':
      return exclusive(TRIMS[value as keyof typeof TRIMS], region);
    case 'seatMat':
      return exclusive(SEAT_MATERIALS[value as keyof typeof SEAT_MATERIALS], region);
    case 'ltint': {
      const tint = LAMP_TINTS[value as keyof typeof LAMP_TINTS];
      if (tint?.only && !tint.only.includes(region)) {
        const where = listJoin(tint.only.map((r) => REGIONS[r].n));
        return { ok: false, reason: `${tint.n} is offered only where it is road-legal: ${where}.` };
      }
      return OK;
    }
    case 'size': {
      const why = R.noSize[String(value) as keyof typeof R.noSize];
      return why ? { ok: false, reason: why } : OK;
    }
    case 'vlt':
      return (value as number) < R.vlt
        ? { ok: false, reason: `In ${R.n}, side glass must let through at least ${R.vlt}% of light.` }
        : OK;
    case 'packs': {
      const bad = (value as Build['packs']).find((p) => !R.packs.includes(p));
      return bad ? { ok: false, reason: `That pack is only offered in its own market, not in ${R.n}.` } : OK;
    }
    default:
      return OK;
  }
}

export const isAvailable = <K extends OptionKey>(key: K, value: Build[K], region: RegionId) =>
  availability(key, value, region).ok;
