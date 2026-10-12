import {
  ACCENTS,
  BODY_TYPES,
  SEATINGS,
  AMBIENT_MODES,
  CALIPERS,
  FINISHES,
  GRILLES,
  LAMP_TINTS,
  LIGHT_SIGNATURES,
  LIVERIES,
  LIVERY_COLOURS,
  PACKS,
  PAINTS,
  QUILTS,
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
import { availability, type Availability } from './availability';
import { formatLocal, toLocal, totalUSD } from './pricing';
import { lineItems, type LineGroup } from './summary';

/** Every discrete option value per key, as strings. */
export const OPTION_VALUES: Partial<Record<OptionKey, string[]>> = {
  body: Object.keys(BODY_TYPES),
  seating: Object.keys(SEATINGS),
  paint: [...Object.keys(PAINTS), 'custom'],
  finish: Object.keys(FINISHES),
  livery: Object.keys(LIVERIES),
  livCol: Object.keys(LIVERY_COLOURS),
  wheel: Object.keys(WHEELS),
  size: WHEEL_SIZES.map(String),
  wfin: Object.keys(WHEEL_FINISHES),
  caliper: Object.keys(CALIPERS),
  roof: Object.keys(ROOFS),
  accent: Object.keys(ACCENTS),
  spoiler: Object.keys(SPOILERS),
  grille: Object.keys(GRILLES),
  sig: Object.keys(LIGHT_SIGNATURES),
  ltint: Object.keys(LAMP_TINTS),
  seatMat: Object.keys(SEAT_MATERIALS),
  seatCol: Object.keys(SEAT_COLOURS),
  quilt: Object.keys(QUILTS),
  stitch: Object.keys(STITCHES),
  trim: Object.keys(TRIMS),
  ambMode: Object.keys(AMBIENT_MODES),
};

export interface Evaluation {
  /** available[key][value] for every discrete option, plus `packs[packId]`. */
  available: Partial<Record<OptionKey, Record<string, Availability>>>;
  totalUSD: number;
  /** On-road price in the region's currency, rounded. */
  total: number;
  formatted: string;
  lineItems: LineGroup[];
}

/** The whole engine answer for one build: availability with reasons, price and line items. */
export function evaluate(b: Build): Evaluation {
  const available: Evaluation['available'] = {};
  for (const [key, values] of Object.entries(OPTION_VALUES) as [OptionKey, string[]][]) {
    const row: Record<string, Availability> = {};
    for (const v of values) {
      const value = key === 'size' ? Number(v) : v;
      row[v] = availability(key, value as Build[typeof key], b.region, b.body);
    }
    available[key] = row;
  }
  available.packs = Object.fromEntries(
    Object.keys(PACKS).map((p) => [p, availability('packs', [p] as Build['packs'], b.region)]),
  );
  const usd = totalUSD(b);
  const total = toLocal(usd, b.region);
  return {
    available,
    totalUSD: usd,
    total,
    formatted: formatLocal(total, b.region),
    lineItems: lineItems(b),
  };
}
