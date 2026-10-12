import {
  ACCENTS,
  AMBIENT_MODES,
  BODY_TYPES,
  SEATINGS,
  CALIPERS,
  FINISHES,
  GRAPHICS,
  GRILLES,
  LAMP_TINTS,
  LIGHT_SIGNATURES,
  LIVERIES,
  LIVERY_COLOURS,
  PACKS,
  QUILTS,
  REGIONS,
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
} from '@/data/options';
import { optionLabel, paintHex, stitchHex } from './labels';
import { baseUSD, paintUSD, spoilerUSD } from './pricing';

export interface LineItem {
  label: string;
  detail: string;
  /** Colour dot for the row, if the choice has one. */
  colour: string | null;
  /** USD price, or null for rows that carry no price (drive side, glass). */
  usd: number | null;
  /** The base vehicle row shows its full price rather than "+…". */
  base?: boolean;
}

export interface LineGroup {
  title: string;
  items: LineItem[];
}

const lower = (s: string) => s.toLowerCase();

/** The itemised specification shown on the reveal. Every option's price appears exactly once. */
export function lineItems(b: Build): LineGroup[] {
  const R = REGIONS[b.region];
  return [
    {
      title: 'Exterior',
      items: [
        {
          label: 'Paint',
          detail: `${optionLabel('paint', b).name}, ${lower(FINISHES[b.finish].n)}`,
          colour: paintHex(b),
          usd: paintUSD(b) + FINISHES[b.finish].p,
        },
        {
          label: 'Livery',
          detail:
            LIVERIES[b.livery].n + (b.livery !== 'none' ? ` in ${lower(LIVERY_COLOURS[b.livCol].n)}` : ''),
          colour: b.livery !== 'none' ? LIVERY_COLOURS[b.livCol].c : null,
          usd: LIVERIES[b.livery].p,
        },
        {
          label: 'Graphics',
          detail:
            b.doorArt === 'none' && b.rearArt === 'none'
              ? 'None'
              : `Doors: ${GRAPHICS[b.doorArt].n.toLowerCase()}${b.doorArt === 'number' ? ` ${b.raceNo}` : ''}; rear: ${GRAPHICS[b.rearArt].n.toLowerCase()}`,
          colour: b.doorArt === 'none' && b.rearArt === 'none' ? null : LIVERY_COLOURS[b.artCol].c,
          usd: GRAPHICS[b.doorArt].p + GRAPHICS[b.rearArt].p,
        },
        {
          label: 'Wheels',
          detail: `${WHEELS[b.wheel].n}, ${b.size} inch, ${lower(WHEEL_FINISHES[b.wfin].n)}`,
          colour: WHEEL_FINISHES[b.wfin].c,
          usd: WHEELS[b.wheel].p + WHEEL_SIZE_USD[`${b.size}`] + WHEEL_FINISHES[b.wfin].p,
        },
        {
          label: 'Brake calipers',
          detail: CALIPERS[b.caliper].n,
          colour: CALIPERS[b.caliper].c,
          usd: CALIPERS[b.caliper].p,
        },
        { label: 'Roof', detail: ROOFS[b.roof].n, colour: null, usd: ROOFS[b.roof].p },
        { label: 'Accent parts', detail: ACCENTS[b.accent].n, colour: null, usd: ACCENTS[b.accent].p },
        { label: 'Rear aero', detail: SPOILERS[b.spoiler].n, colour: null, usd: spoilerUSD(b) },
        { label: 'Grille', detail: GRILLES[b.grille].n, colour: null, usd: GRILLES[b.grille].p },
        {
          label: 'Lights',
          detail: `${LIGHT_SIGNATURES[b.sig].n} signature, ${lower(LAMP_TINTS[b.ltint].n)}`,
          colour: LAMP_TINTS[b.ltint].c,
          usd: LIGHT_SIGNATURES[b.sig].p,
        },
        { label: 'Side glass', detail: `${b.vlt}% light transmission`, colour: null, usd: null },
      ],
    },
    {
      title: 'Interior',
      items: [
        { label: 'Seating', detail: SEATINGS[b.seating].n, colour: null, usd: SEATINGS[b.seating].p },
        {
          label: 'Seats',
          detail: `${SEAT_MATERIALS[b.seatMat].n} in ${lower(SEAT_COLOURS[b.seatCol].n)}`,
          colour: SEAT_COLOURS[b.seatCol].c,
          usd: SEAT_MATERIALS[b.seatMat].p,
        },
        {
          label: 'Quilting',
          detail: `${QUILTS[b.quilt].n}, ${lower(STITCHES[b.stitch].n)} stitching`,
          colour: stitchHex(b),
          usd: QUILTS[b.quilt].p,
        },
        { label: 'Cabin trim', detail: TRIMS[b.trim].n, colour: TRIMS[b.trim].a, usd: TRIMS[b.trim].p },
        {
          label: 'Ambient light',
          detail: `${AMBIENT_MODES[b.ambMode].n}, ${Math.round(b.ambBri * 100)}% brightness`,
          colour: b.amb,
          usd: AMBIENT_MODES[b.ambMode].p,
        },
      ],
    },
    {
      title: R.n,
      items: [
        {
          label: 'Drive side',
          detail: R.drive === 'RHD' ? 'Right-hand drive' : 'Left-hand drive',
          colour: null,
          usd: null,
        },
        ...b.packs.map((k) => ({ label: PACKS[k].n, detail: 'Market pack', colour: null, usd: PACKS[k].p })),
        {
          label: 'Base vehicle',
          detail: `Halden ${BODY_TYPES[b.body].n}`,
          colour: null,
          usd: baseUSD(b),
          base: true,
        },
      ],
    },
  ];
}
