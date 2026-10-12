/** Curated presentation content that is not option data: moods for the paint step. */
import type { Patch } from '@/engine';

export interface Mood {
  n: string;
  d: string;
  swatches: string[];
  patch: Patch;
}

export const MOODS: Mood[] = [
  {
    n: 'Noir',
    d: 'Black on black, red calipers',
    swatches: ['#101114', '#141518', '#c2272d'],
    patch: {
      paint: 'onyx',
      finish: 'gloss',
      livery: 'none',
      wfin: 'black',
      caliper: 'red',
      accent: 'black',
      roof: 'black',
      seatCol: 'oxblood',
      stitch: 'red',
      amb: '#ff4040',
    },
  },
  {
    n: 'Riviera',
    d: 'Ultramarine with white stripes',
    swatches: ['#22339f', '#eceef0', '#c7cad0'],
    patch: {
      paint: 'ultra',
      finish: 'metallic',
      livery: 'stripes',
      livCol: 'white',
      wfin: 'silver',
      caliper: 'graphite',
      accent: 'body',
      roof: 'body',
      seatCol: 'bone',
      stitch: 'blue',
      amb: '#9fd4ff',
    },
  },
  {
    n: 'Studio clay',
    d: 'Satin clay, bronze and walnut',
    swatches: ['#a8835a', '#8a6a3a', '#3b2516'],
    patch: {
      paint: 'clay',
      finish: 'satin',
      livery: 'none',
      wfin: 'bronze',
      caliper: 'brass',
      accent: 'black',
      roof: 'black',
      seatCol: 'cognac',
      stitch: 'bone',
      trim: 'walnut',
      amb: '#e0a65a',
    },
  },
];
