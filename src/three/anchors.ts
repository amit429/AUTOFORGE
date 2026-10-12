/** Points on the car that DOM overlays attach to, in car space (+Z is the car's right side). */
import type { StepId } from '@/data/options';

type V3 = [number, number, number];

export interface Hotspot {
  step: StepId;
  label: string;
  p: V3;
  /** Outward normal; the hotspot hides when facing away from the camera. */
  n: V3;
}

export const HOTSPOTS: Hotspot[] = [
  { step: 'paint', label: 'Paint and livery', p: [-0.7, 0.78, 1.0], n: [0, 0, 1] },
  { step: 'wheels', label: 'Wheels and brakes', p: [1.41, 0.37, 0.99], n: [0.2, 0, 1] },
  { step: 'body', label: 'Mirrors and accents', p: [0.52, 1.1, 1.16], n: [0.2, 0.3, 1] },
  { step: 'lights', label: 'Light signature', p: [2.44, 0.66, 0.6], n: [1, 0, 0.3] },
  { step: 'seats', label: 'Seats', p: [-0.3, 1.12, 0.4], n: [0, 1, 0.2] },
  { step: 'body', label: 'Rear aero', p: [-2.12, 1.06, 0], n: [-0.6, 1, 0] },
];

export interface PartLabel {
  title: string;
  sub: string;
  p: V3;
  /** Model-contract node the label follows as it explodes. */
  part: string;
  step: StepId;
  /** True for parts parented to the car root rather than the (ride-height) shell. */
  onRoot?: boolean;
}

export const PART_LABELS: PartLabel[] = [
  {
    title: 'Roof panel',
    sub: 'Body, black, carbon or glass',
    p: [-0.6, 1.38, 0],
    part: 'roof',
    step: 'body',
  },
  {
    title: 'Glasshouse',
    sub: 'Tint within legal limit',
    p: [-1.45, 1.15, 0.7],
    part: 'glass',
    step: 'glass',
  },
  { title: 'Door skins', sub: 'Paint and livery', p: [-0.7, 0.8, 0.99], part: 'door_r', step: 'paint' },
  {
    title: 'Wheels and brakes',
    sub: '5 designs, 19 to 22 inch',
    p: [1.41, 0.37, 0.97],
    part: 'wheel_fr',
    step: 'wheels',
    onRoot: true,
  },
  {
    title: 'Light signature',
    sub: 'Blade, quad or arc',
    p: [2.42, 0.66, 0.6],
    part: 'head_r',
    step: 'lights',
  },
  { title: 'Grille', sub: 'Honeycomb, slats or sealed', p: [2.43, 0.47, -0.3], part: 'grille', step: 'body' },
  {
    title: 'Rear aero',
    sub: 'Ducktail or swan-neck wing',
    p: [-2.08, 1.0, -0.5],
    part: 'spoiler',
    step: 'body',
  },
  {
    title: 'Seating',
    sub: 'Material, quilting, stitching',
    p: [-0.35, 1.05, -0.4],
    part: 'seat_fl',
    step: 'seats',
  },
  { title: 'Cabin trim', sub: 'Carbon, wood, metal', p: [0.32, 0.9, -0.5], part: 'dash', step: 'trim' },
  {
    title: 'Tail light bar',
    sub: 'Sequential, full width',
    p: [-2.35, 0.79, 0.6],
    part: 'tail',
    step: 'lights',
  },
  {
    title: 'Accent parts',
    sub: 'Splitter, diffuser, skirts',
    p: [2.36, 0.27, 0.8],
    part: 'splitter',
    step: 'body',
  },
];
