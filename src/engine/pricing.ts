import {
  ACCENTS,
  AMBIENT_MODES,
  BODY_TYPES,
  CALIPERS,
  CUSTOM_PAINT_USD,
  FINISHES,
  GRILLES,
  LIGHT_SIGNATURES,
  LIVERIES,
  PACKS,
  PAINTS,
  QUILTS,
  REGIONS,
  ROOFS,
  SEAT_MATERIALS,
  SPOILERS,
  TRIMS,
  WHEEL_FINISHES,
  WHEEL_SIZE_USD,
  WHEELS,
  type Build,
  type RegionId,
} from '@/data/options';

export const paintUSD = (b: Build) => (b.paint === 'custom' ? CUSTOM_PAINT_USD : PAINTS[b.paint].p);

/** The Autobahn pack includes the swan-neck wing, so the wing is free while the pack is on. */
export const spoilerUSD = (b: Build) =>
  b.spoiler === 'wing' && b.packs.includes('autobahn') ? 0 : SPOILERS[b.spoiler].p;

/** Sum of every chosen option in USD, before region conversion. */
export function optionsUSD(b: Build): number {
  let p =
    paintUSD(b) +
    FINISHES[b.finish].p +
    LIVERIES[b.livery].p +
    WHEELS[b.wheel].p +
    WHEEL_SIZE_USD[`${b.size}`] +
    WHEEL_FINISHES[b.wfin].p +
    CALIPERS[b.caliper].p +
    ROOFS[b.roof].p +
    ACCENTS[b.accent].p +
    spoilerUSD(b) +
    GRILLES[b.grille].p +
    LIGHT_SIGNATURES[b.sig].p +
    SEAT_MATERIALS[b.seatMat].p +
    QUILTS[b.quilt].p +
    TRIMS[b.trim].p +
    AMBIENT_MODES[b.ambMode].p;
  for (const k of b.packs) p += PACKS[k].p;
  return p;
}

/** Base price of the chosen body style. */
export const baseUSD = (b: Build) => BODY_TYPES[b.body].p;

export const totalUSD = (b: Build) => baseUSD(b) + optionsUSD(b);

/** INR and JPY round to the nearest 1,000; everything else to the nearest 10. */
export const roundingStep = (region: RegionId) => {
  const cur = REGIONS[region].cur;
  return cur === 'JPY' || cur === 'INR' ? 1000 : 10;
};

/** Converts USD to the region's on-road price: (usd × rate × tax), rounded per currency. */
export function toLocal(usd: number, region: RegionId): number {
  const R = REGIONS[region];
  const q = roundingStep(region);
  return Math.round((usd * R.rate * R.tax) / q) * q;
}

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(region: RegionId) {
  const R = REGIONS[region];
  let f = formatters.get(R.cur);
  if (!f) {
    f = new Intl.NumberFormat(R.loc, { style: 'currency', currency: R.cur, maximumFractionDigits: 0 });
    formatters.set(R.cur, f);
  }
  return f;
}

export const formatLocal = (local: number, region: RegionId) => formatter(region).format(local);
export const money = (usd: number, region: RegionId) => formatLocal(toLocal(usd, region), region);

/** "+€1,560" for a paid option, "Included" for a free one. */
export const priceTag = (usd: number, region: RegionId) => (usd ? `+${money(usd, region)}` : 'Included');
