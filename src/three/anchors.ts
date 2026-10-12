/**
 * Points on the car that DOM overlays attach to, in car space (+Z is the car's right side).
 * They are derived from the body geometry, so they follow every body style.
 */
import type { StepId } from '@/data/options';
import type { BodyGeometry } from './car/body';

type V3 = [number, number, number];

export interface Hotspot {
  step: StepId;
  label: string;
  p: V3;
  /** Outward normal; the hotspot hides when facing away from the camera. */
  n: V3;
}

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

/** Hotspot labels, fixed in count and order so the DOM can be rendered once. */
export const HOTSPOT_LABELS: { step: StepId; label: string }[] = [
  { step: 'paint', label: 'Paint and livery' },
  { step: 'wheels', label: 'Wheels and brakes' },
  { step: 'body', label: 'Mirrors and accents' },
  { step: 'lights', label: 'Light signature' },
  { step: 'seats', label: 'Seats' },
  { step: 'body', label: 'Rear aero' },
];

export function hotspotsFor(g: BodyGeometry): Hotspot[] {
  const s = g.spec;
  const door = s.doors[0]!;
  const dx = (door[0] + door[1]) / 2;
  const dy = (g.belt(dx) + g.bottomY(dx)) / 2 + 0.05;
  const mx = s.aBase - 0.06;
  const my = g.belt(mx) + 0.1;
  const fs = s.aBase - 0.78;
  const pts: [V3, V3][] = [
    [
      [dx, dy, g.sideZ(dx, dy) + 0.01],
      [0, 0, 1],
    ],
    [
      [s.frontAxle, s.tyreR, s.track + 0.15],
      [0.2, 0, 1],
    ],
    [
      [mx + 0.02, my, g.sideZ(mx, my - 0.1) + 0.15],
      [0.2, 0.3, 1],
    ],
    [
      [s.front, g.headY, 0.55],
      [1, 0, 0.3],
    ],
    [
      [fs, g.floorY + 0.4, 0.4],
      [0, 1, 0.2],
    ],
    [
      [s.rear + 0.25, g.topY(s.rear + 0.25) + 0.12, 0],
      [-0.6, 1, 0],
    ],
  ];
  return HOTSPOT_LABELS.map((h, i) => ({ ...h, p: pts[i]![0], n: pts[i]![1] }));
}

export const PART_LABEL_TEXT: Omit<PartLabel, 'p'>[] = [
  { title: 'Roof panel', sub: 'Body, black, carbon or glass', part: 'roof', step: 'body' },
  { title: 'Glasshouse', sub: 'Tint within legal limit', part: 'glass', step: 'glass' },
  { title: 'Door skins', sub: 'Paint and livery', part: 'door_r', step: 'paint' },
  {
    title: 'Wheels and brakes',
    sub: '5 designs, 19 to 22 inch',
    part: 'wheel_fr',
    step: 'wheels',
    onRoot: true,
  },
  { title: 'Light signature', sub: 'Blade, quad or arc', part: 'head_r', step: 'lights' },
  { title: 'Grille', sub: 'Honeycomb, slats or sealed', part: 'grille', step: 'body' },
  { title: 'Rear aero', sub: 'Ducktail or swan-neck wing', part: 'spoiler', step: 'body' },
  { title: 'Seating', sub: 'Material, quilting, stitching', part: 'seat_fl', step: 'seats' },
  { title: 'Cabin trim', sub: 'Carbon, wood, metal', part: 'dash', step: 'trim' },
  { title: 'Tail light bar', sub: 'Sequential, full width', part: 'tail', step: 'lights' },
  { title: 'Accent parts', sub: 'Splitter, diffuser, skirts', part: 'splitter', step: 'body' },
];

export function partLabelsFor(g: BodyGeometry): PartLabel[] {
  const s = g.spec;
  const door = s.doors[0]!;
  const dx = (door[0] + door[1]) / 2;
  const mid = (s.roofFront + s.roofRear) / 2;
  const fs = s.aBase - 0.78;
  const pts: V3[] = [
    [mid, s.roofY + 0.04, 0],
    [(s.roofRear + s.cBase) / 2, g.roofLine((s.roofRear + s.cBase) / 2) - 0.12, 0.7],
    [dx, g.belt(dx) - 0.1, g.sideZ(dx, g.belt(dx) - 0.1)],
    [s.frontAxle, s.tyreR, s.track + 0.13],
    [s.front, g.headY, 0.6],
    [s.front + 0.01, s.grilleY, -0.3],
    [s.rear + 0.25, g.topY(s.rear + 0.25) + 0.08, -0.5],
    [fs, g.floorY + 0.35, -0.4],
    [s.aBase - 0.18, g.belt(s.aBase), -0.5],
    [s.rear, s.tailY, 0.6],
    [s.front - 0.05, s.noseBottom - 0.02, 0.8],
  ];
  return PART_LABEL_TEXT.map((l, i) => ({ ...l, p: pts[i]! }));
}
