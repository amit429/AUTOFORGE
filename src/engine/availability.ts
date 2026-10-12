import {
  BODY_TYPES,
  COMFORTS,
  LAMP_TINTS,
  LIVERIES,
  MODS,
  PAINTS,
  REGIONS,
  SEATINGS,
  SEAT_MATERIALS,
  TRIMS,
  type BodyTypeId,
  type SeatingId,
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
 * Whether `value` can be ordered for `key` in `region` on the given body. This is the only place
 * availability is decided; the UI renders its answer and never re-derives it.
 */
export interface BuildContext {
  body?: BodyTypeId;
  seating?: SeatingId;
}

export function availability<K extends OptionKey>(
  key: K,
  value: Build[K],
  region: RegionId,
  ctx: BuildContext = {},
): Availability {
  const { body, seating } = ctx;
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
    case 'seating': {
      const seat = SEATINGS[value as keyof typeof SEATINGS];
      if (!seat) return { ok: false, reason: 'That seating layout is not in the catalogue.' };
      if (body && !BODY_TYPES[body].layouts.includes(value as Build['seating'])) {
        const what = /^\d/.test(seat.n) ? seat.n : seat.n.charAt(0).toLowerCase() + seat.n.slice(1);
        return { ok: false, reason: `The ${BODY_TYPES[body].n} does not take ${what}.` };
      }
      return OK;
    }
    case 'mods': {
      const list = value as Build['mods'];
      const unknown = list.find((m) => !MODS[m]);
      if (unknown) return { ok: false, reason: 'That mod is not in the catalogue.' };
      const misfit = body ? list.find((m) => !MODS[m].bodies.includes(body)) : undefined;
      return misfit
        ? {
            ok: false,
            reason: `The ${MODS[misfit].n.toLowerCase()} does not fit the ${BODY_TYPES[body!].n}.`,
          }
        : OK;
    }
    case 'comfort': {
      const list = value as Build['comfort'];
      if (list.some((c) => !COMFORTS[c]))
        return { ok: false, reason: 'That feature is not in the catalogue.' };
      const blocked = seating
        ? list.find((c) => COMFORTS[c].needs && !COMFORTS[c].needs!.includes(seating))
        : undefined;
      if (!blocked) return OK;
      return {
        ok: false,
        reason:
          blocked === 'recline'
            ? "Reclining rear chairs need captain's chairs: pick the four-seat lounge or six captain's chairs."
            : 'Rear entertainment needs rear seats.',
      };
    }
    case 'packs': {
      const bad = (value as Build['packs']).find((p) => !R.packs.includes(p));
      return bad ? { ok: false, reason: `That pack is only offered in its own market, not in ${R.n}.` } : OK;
    }
    default:
      return OK;
  }
}

export const isAvailable = <K extends OptionKey>(
  key: K,
  value: Build[K],
  region: RegionId,
  ctx?: BuildContext,
) => availability(key, value, region, ctx).ok;
