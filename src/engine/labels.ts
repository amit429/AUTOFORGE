import {
  ACCENTS,
  AMBIENT_MODES,
  BODY_TYPES,
  SEATINGS,
  CALIPERS,
  CUSTOM_PAINT_USD,
  FINISHES,
  GRAPHICS,
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
  WHEEL_SIZE_USD,
  WHEELS,
  type Build,
  type OptionKey,
} from '@/data/options';
import { spoilerUSD } from './pricing';

/** Human names for each option key, used in history chips and toasts. */
export const KEY_NAMES: Record<OptionKey, string> = {
  region: 'Region',
  body: 'Body style',
  seating: 'Seating',
  paint: 'Paint',
  finish: 'Finish',
  livery: 'Livery',
  livCol: 'Livery colour',
  livScale: 'Livery scale',
  doorArt: 'Door graphics',
  rearArt: 'Rear graphics',
  artCol: 'Graphic colour',
  raceNo: 'Race number',
  wheel: 'Wheels',
  size: 'Wheel size',
  wfin: 'Wheel finish',
  caliper: 'Calipers',
  roof: 'Roof',
  accent: 'Accents',
  spoiler: 'Rear aero',
  grille: 'Grille',
  sig: 'Light signature',
  ltint: 'Lamp tint',
  vlt: 'Glass',
  seatMat: 'Seats',
  seatCol: 'Seat colour',
  quilt: 'Quilting',
  stitch: 'Stitching',
  trim: 'Trim',
  amb: 'Ambient',
  ambMode: 'Ambient mode',
  ambBri: 'Brightness',
  custom: 'Custom paint',
  packs: 'Packs',
};

export interface OptionLabel {
  name: string;
  /** USD price of the current choice, or null when the key carries no price of its own. */
  usd: number | null;
}

/** Display name and price of the current value for `key`. */
export function optionLabel(key: OptionKey, b: Build): OptionLabel {
  switch (key) {
    case 'paint':
      return b.paint === 'custom'
        ? { name: 'Paint to sample', usd: CUSTOM_PAINT_USD }
        : { name: PAINTS[b.paint].n, usd: PAINTS[b.paint].p };
    case 'finish':
      return { name: FINISHES[b.finish].n, usd: FINISHES[b.finish].p };
    case 'livery':
      return { name: LIVERIES[b.livery].n, usd: LIVERIES[b.livery].p };
    case 'livCol':
      return { name: LIVERY_COLOURS[b.livCol].n, usd: null };
    case 'livScale':
      return { name: `${Math.round(b.livScale * 100)}%`, usd: null };
    case 'doorArt':
      return { name: GRAPHICS[b.doorArt].n, usd: GRAPHICS[b.doorArt].p };
    case 'rearArt':
      return { name: GRAPHICS[b.rearArt].n, usd: GRAPHICS[b.rearArt].p };
    case 'artCol':
      return { name: LIVERY_COLOURS[b.artCol].n, usd: null };
    case 'raceNo':
      return { name: String(b.raceNo), usd: null };
    case 'wheel':
      return { name: WHEELS[b.wheel].n, usd: WHEELS[b.wheel].p };
    case 'size':
      return { name: `${b.size} inch`, usd: WHEEL_SIZE_USD[`${b.size}`] };
    case 'wfin':
      return { name: WHEEL_FINISHES[b.wfin].n, usd: WHEEL_FINISHES[b.wfin].p };
    case 'caliper':
      return { name: CALIPERS[b.caliper].n, usd: CALIPERS[b.caliper].p };
    case 'roof':
      return { name: ROOFS[b.roof].n, usd: ROOFS[b.roof].p };
    case 'accent':
      return { name: ACCENTS[b.accent].n, usd: ACCENTS[b.accent].p };
    case 'spoiler':
      return { name: SPOILERS[b.spoiler].n, usd: spoilerUSD(b) };
    case 'grille':
      return { name: GRILLES[b.grille].n, usd: GRILLES[b.grille].p };
    case 'sig':
      return { name: LIGHT_SIGNATURES[b.sig].n, usd: LIGHT_SIGNATURES[b.sig].p };
    case 'ltint':
      return { name: LAMP_TINTS[b.ltint].n, usd: null };
    case 'vlt':
      return { name: `${b.vlt}% light`, usd: null };
    case 'seatMat':
      return { name: SEAT_MATERIALS[b.seatMat].n, usd: SEAT_MATERIALS[b.seatMat].p };
    case 'seatCol':
      return { name: SEAT_COLOURS[b.seatCol].n, usd: null };
    case 'quilt':
      return { name: QUILTS[b.quilt].n, usd: QUILTS[b.quilt].p };
    case 'stitch':
      return { name: STITCHES[b.stitch].n, usd: null };
    case 'trim':
      return { name: TRIMS[b.trim].n, usd: TRIMS[b.trim].p };
    case 'amb':
      return { name: b.amb.toUpperCase(), usd: null };
    case 'ambMode':
      return { name: AMBIENT_MODES[b.ambMode].n, usd: AMBIENT_MODES[b.ambMode].p };
    case 'ambBri':
      return { name: `${Math.round(b.ambBri * 100)}%`, usd: null };
    case 'custom':
      return { name: 'Custom colour', usd: null };
    case 'packs':
      return { name: b.packs.length ? b.packs.map((k) => PACKS[k].n).join(', ') : 'No packs', usd: null };
    case 'region':
      return { name: b.region, usd: null };
    case 'seating':
      return { name: SEATINGS[b.seating].n, usd: SEATINGS[b.seating].p };
    case 'body':
      // The body sets the base price; it is not an add-on, so it carries no "+" price here.
      return { name: BODY_TYPES[b.body].n, usd: null };
  }
}

export const paintHex = (b: Build) => (b.paint === 'custom' ? b.custom : PAINTS[b.paint].c);

const toHex = (n: number) =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');

/** Scales an sRGB hex colour by `k` per channel. */
export function scaleHex(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  return `#${toHex(((n >> 16) & 255) * k)}${toHex(((n >> 8) & 255) * k)}${toHex((n & 255) * k)}`;
}

/** "Matched" stitching is the seat colour darkened to 55%. */
export const stitchHex = (b: Build) => STITCHES[b.stitch].c ?? scaleHex(SEAT_COLOURS[b.seatCol].c, 0.55);

/** Colour dot shown on a history chip for a change to `key`. */
export function chipColour(key: OptionKey | '*', b: Build): string | null {
  switch (key) {
    case '*':
    case 'paint':
      return paintHex(b);
    case 'custom':
      return b.custom;
    case 'livery':
    case 'livCol':
      return LIVERY_COLOURS[b.livCol].c;
    case 'doorArt':
    case 'rearArt':
    case 'artCol':
      return LIVERY_COLOURS[b.artCol].c;
    case 'wheel':
    case 'wfin':
      return WHEEL_FINISHES[b.wfin].c;
    case 'caliper':
      return CALIPERS[b.caliper].c;
    case 'ltint':
      return LAMP_TINTS[b.ltint].c;
    case 'seatCol':
    case 'seatMat':
      return SEAT_COLOURS[b.seatCol].c;
    case 'stitch':
      return stitchHex(b);
    case 'trim':
      return TRIMS[b.trim].a;
    case 'amb':
      return b.amb;
    default:
      return null;
  }
}
