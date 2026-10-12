// Typed access to options.json. The JSON is the single source for every option, price,
// region and rule; ids are derived from its keys so a typo is a compile error.
import raw from './options.json';

export type RegionId = keyof typeof raw.regions;
export type BodyTypeId = keyof typeof raw.bodyTypes;
export type SeatingId = keyof typeof raw.seatings;
export type PaintId = keyof typeof raw.paints;
export type FinishId = keyof typeof raw.finishes;
export type LiveryId = keyof typeof raw.liveries;
export type LiveryColourId = keyof typeof raw.liveryColors;
export type GraphicId = keyof typeof raw.graphics;
export type WheelId = keyof typeof raw.wheels;
export type WheelSize = 19 | 20 | 21 | 22;
export type WheelFinishId = keyof typeof raw.wheelFinishes;
export type CaliperId = keyof typeof raw.calipers;
export type RoofId = keyof typeof raw.roof;
export type AccentId = keyof typeof raw.accentParts;
export type SpoilerId = keyof typeof raw.spoilers;
export type GrilleId = keyof typeof raw.grilles;
export type LightSignatureId = keyof typeof raw.lightSignatures;
export type LampTintId = keyof typeof raw.lampTints;
export type SeatMaterialId = keyof typeof raw.seatMaterials;
export type SeatColourId = keyof typeof raw.seatColours;
export type QuiltId = keyof typeof raw.quilting;
export type StitchId = keyof typeof raw.stitching;
export type TrimId = keyof typeof raw.trims;
export type AmbientModeId = keyof typeof raw.ambientModes;
export type PackId = keyof typeof raw.packs;
export type StepId =
  | 'shape'
  | 'paint'
  | 'livery'
  | 'graphics'
  | 'wheels'
  | 'body'
  | 'lights'
  | 'glass'
  | 'seats'
  | 'trim'
  | 'ambient'
  | 'region';

/** Paint selection: a catalogue paint or a hand-matched sample. */
export type PaintChoice = PaintId | 'custom';

export interface Build {
  region: RegionId;
  body: BodyTypeId;
  seating: SeatingId;
  paint: PaintChoice;
  custom: string;
  finish: FinishId;
  livery: LiveryId;
  livCol: LiveryColourId;
  livScale: number;
  doorArt: GraphicId;
  rearArt: GraphicId;
  artCol: LiveryColourId;
  raceNo: number;
  wheel: WheelId;
  size: WheelSize;
  wfin: WheelFinishId;
  caliper: CaliperId;
  roof: RoofId;
  accent: AccentId;
  spoiler: SpoilerId;
  grille: GrilleId;
  sig: LightSignatureId;
  ltint: LampTintId;
  vlt: number;
  seatMat: SeatMaterialId;
  seatCol: SeatColourId;
  quilt: QuiltId;
  stitch: StitchId;
  trim: TrimId;
  amb: string;
  ambMode: AmbientModeId;
  ambBri: number;
  packs: PackId[];
}

export type OptionKey = keyof Build;

export interface Named {
  n: string;
}
export interface Priced extends Named {
  p: number;
}
export interface Regional {
  rg?: RegionId;
}
export interface Paint extends Priced, Regional {
  c: string;
}
export interface Finish extends Priced {
  r: number;
  m: number;
  cc: number;
}
export interface Livery extends Priced, Regional {
  id: number;
}
export interface Swatch extends Named {
  c: string;
}
export interface WheelFinish extends Priced {
  c: string;
  m: number;
  r: number;
}
export interface ShortNamed extends Priced {
  s: string;
}
export interface LampTint extends Swatch {
  only?: RegionId[];
}
export interface SeatMaterial extends Priced, Regional {
  ro: number;
}
export interface Quilt extends Priced {
  id: number;
}
export interface Stitch extends Named {
  c: string | null;
}
export interface Trim extends Priced, Regional {
  id: number;
  a: string;
  b: string;
  ro: number;
  me: number;
  chroma?: string;
}
export interface Pack extends Priced {
  d: string;
}
export interface Region {
  n: string;
  city: string;
  drive: 'LHD' | 'RHD';
  cur: string;
  loc: string;
  rate: number;
  tax: number;
  vlt: number;
  weeks: number;
  lat: number;
  lon: number;
  paints: PaintId[];
  liveries: LiveryId[];
  trims: TrimId[];
  seats: SeatMaterialId[];
  packs: PackId[];
  tints: LampTintId[];
  noSize: Partial<Record<`${WheelSize}`, string>>;
}
export interface Step {
  id: StepId;
  g: 'Exterior' | 'Interior' | 'Regional';
  n: string;
  d: string;
}

export const META = raw.meta;
export const BASE_PRICE_USD: number = raw.meta.basePriceUSD;
export const CUSTOM_PAINT_USD: number = raw.meta.customPaintPriceUSD;

export interface BodyType extends Priced {
  d: string;
  /** Seat layouts this body can take, and its default. */
  layouts: SeatingId[];
  seating: SeatingId;
}

export interface Seating extends Priced {
  d: string;
}

/** Body styles. `p` is the full base price of the car in USD for that body. */
export const BODY_TYPES = raw.bodyTypes as Record<BodyTypeId, BodyType>;
export const SEATINGS = raw.seatings as Record<SeatingId, Seating>;
export const PAINTS = raw.paints as Record<PaintId, Paint>;
export const FINISHES = raw.finishes as Record<FinishId, Finish>;
export const LIVERIES = raw.liveries as Record<LiveryId, Livery>;
export const LIVERY_COLOURS = raw.liveryColors as Record<LiveryColourId, Swatch>;
/** Door and rear graphics; the same designs are offered for both positions. */
export const GRAPHICS = raw.graphics as Record<GraphicId, Priced>;
export const WHEELS = raw.wheels as Record<WheelId, Priced>;
export const WHEEL_SIZES = [19, 20, 21, 22] as const satisfies readonly WheelSize[];
export const WHEEL_SIZE_USD = raw.wheelSizesUSD as Record<`${WheelSize}`, number>;
export const RIM_RADIUS = raw.rimRadiusBySize as Record<`${WheelSize}`, number>;
export const WHEEL_FINISHES = raw.wheelFinishes as Record<WheelFinishId, WheelFinish>;
export const CALIPERS = raw.calipers as Record<CaliperId, Priced & { c: string }>;
export const ROOFS = raw.roof as Record<RoofId, ShortNamed>;
export const ACCENTS = raw.accentParts as Record<AccentId, ShortNamed>;
export const SPOILERS = raw.spoilers as Record<SpoilerId, ShortNamed>;
export const GRILLES = raw.grilles as Record<GrilleId, ShortNamed>;
export const LIGHT_SIGNATURES = raw.lightSignatures as Record<LightSignatureId, Priced>;
export const LAMP_TINTS = raw.lampTints as Record<LampTintId, LampTint>;
export const SEAT_MATERIALS = raw.seatMaterials as Record<SeatMaterialId, SeatMaterial>;
export const SEAT_COLOURS = raw.seatColours as Record<SeatColourId, Swatch>;
export const QUILTS = raw.quilting as Record<QuiltId, Quilt>;
export const STITCHES = raw.stitching as Record<StitchId, Stitch>;
export const TRIMS = raw.trims as Record<TrimId, Trim>;
export const AMBIENT_PRESETS = raw.ambientPresets as Record<keyof typeof raw.ambientPresets, Swatch>;
export const AMBIENT_MODES = raw.ambientModes as Record<AmbientModeId, Priced>;
export const PACKS = raw.packs as Record<PackId, Pack>;
export const REGIONS = raw.regions as Record<RegionId, Region>;
export const STEPS = raw.steps as Step[];
export const CABIN_STEPS = raw.cabinSteps as StepId[];
export const DEFAULT_BUILD = raw.defaultBuild as Build;

export const REGION_IDS = Object.keys(REGIONS) as RegionId[];
export const keysOf = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];
