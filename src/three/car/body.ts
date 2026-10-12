/**
 * Parametric car bodies. A body is described by a handful of profiles (the shoulder/bonnet line
 * seen from the side, the width seen from above, the glasshouse) and lofted into a smooth mesh
 * from cross-sections along its length. Sections are superellipses, so a body can be anything
 * from round (coupe) to boxy (SUV), with tumblehome narrowing it towards the top. Wheel arches
 * are cut by raising the underside around each axle, and the cabin is carved open as a tub so
 * the interior shows when the roof lifts away.
 *
 * Every number the rest of the car needs (where the lamps sit, how wide the dash is, where the
 * mirrors go) is derived from the same profiles, so one spec describes a whole car. Car faces
 * +X, up is +Y, the car's right side is +Z, ground at y = 0.
 */
import * as THREE from 'three';
import type { BodyTypeId } from '@/data/options';

export interface BodySpec {
  id: BodyTypeId;
  /** x of the nose and tail. */
  front: number;
  rear: number;
  halfWidth: number;
  frontAxle: number;
  rearAxle: number;
  /** Wheel centre distance from the centre line. */
  track: number;
  tyreR: number;
  /** Height of the body underside between the wheels. */
  sill: number;
  noseBottom: number;
  tailBottom: number;
  /** Shoulder line from nose to tail: [x, y], x descending. Bonnet, belt and boot deck. */
  top: [number, number][];
  /** Glasshouse: windscreen base, roof front, roof rear, rear-glass base, roof height. */
  aBase: number;
  roofFront: number;
  roofRear: number;
  cBase: number;
  roofY: number;
  /** Section shape: 2 is elliptical, 6 nearly square. */
  squareness: number;
  /** How much a section narrows towards its top (0..0.25). */
  tumble: number;
  /** Width of the glasshouse at the roof relative to its base. */
  glassTop: number;
  /** Length over which the nose and tail round off in plan view. */
  noseRound: number;
  tailRound: number;
  /** Extra width over the wheels (fender flare). */
  flare: number;
  /** Door openings, front to rear: [xFront, xRear]. */
  doors: [number, number][];
  headY: number;
  headW: number;
  tailY: number;
  grilleY: number;
  grilleH: number;
  grilleW: number;
  /** Seat rows: 1 (two seats), 2 or 3. */
  rows: 1 | 2 | 3;
  /** Open load bed (pickup): [xFront, xRear] and its floor height. */
  bed?: [number, number];
  bedFloor?: number;
  /** Fabric roof (convertible) instead of a hard roof skin. */
  softTop?: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Centripetal-ish Catmull-Rom through [x, y] points sorted by x; flat beyond the ends. */
function profile(points: [number, number][]) {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  return (x: number) => {
    if (x <= pts[0]![0]) return pts[0]![1];
    if (x >= pts[pts.length - 1]![0]) return pts[pts.length - 1]![1];
    let i = 0;
    while (x > pts[i + 1]![0]) i++;
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const t = (x - p1[0]) / (p2[0] - p1[0]);
    // Tangents scaled by segment lengths keep the curve from overshooting on uneven spacing.
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * (p2[0] - p1[0]);
    const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * (p2[0] - p1[0]);
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2
    );
  };
}

const sgnPow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

export class BodyGeometry {
  readonly spec: BodySpec;
  readonly topY: (x: number) => number;
  readonly archR: number;
  readonly floorY: number;
  /** Inner wall thickness of the cabin tub. */
  readonly wall = 0.085;

  constructor(spec: BodySpec) {
    this.spec = spec;
    this.topY = profile(spec.top);
    this.archR = spec.tyreR + 0.05;
    this.floorY = spec.sill + 0.16;
  }

  get length() {
    return this.spec.front - this.spec.rear;
  }
  get height() {
    return this.spec.roofY;
  }
  /** Belt line under the glasshouse. */
  belt(x: number) {
    return this.topY(x);
  }

  /** Arch height at x, or 0 away from the wheels. */
  private arch(x: number) {
    let y = 0;
    for (const ax of [this.spec.frontAxle, this.spec.rearAxle]) {
      const dx = x - ax;
      if (Math.abs(dx) < this.archR) y = Math.max(y, this.spec.tyreR + Math.sqrt(this.archR ** 2 - dx * dx));
    }
    return y;
  }

  bottomY(x: number) {
    const s = this.spec;
    let y = s.sill;
    y = Math.max(y, s.sill + (s.noseBottom - s.sill) * smooth(s.frontAxle + this.archR * 0.6, s.front, x));
    y = Math.max(y, s.sill + (s.tailBottom - s.sill) * smooth(s.rearAxle - this.archR * 0.6, s.rear, x));
    y = Math.max(y, this.arch(x));
    return Math.min(y, this.topY(x) - 0.08);
  }

  /** Half width at x in plan view, with rounded nose and tail and a flare over each wheel. */
  halfW(x: number) {
    const s = this.spec;
    const nose = smooth(s.front - s.noseRound, s.front, x);
    const tail = smooth(s.rear + s.tailRound, s.rear, x);
    let w = s.halfWidth * (1 - 0.16 * nose * nose - 0.12 * tail * tail);
    for (const ax of [s.frontAxle, s.rearAxle])
      w += s.flare * Math.exp(-(((x - ax) / (this.archR * 1.2)) ** 2));
    return w;
  }

  /** Rounds the very ends so the loft closes to a point instead of a flat cap. */
  private endScale(x: number) {
    const s = this.spec;
    const e = 0.12;
    const df = (s.front - x) / e;
    const dr = (x - s.rear) / e;
    const f = (d: number) => (d >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - d) ** 2)));
    return Math.min(f(df), f(dr));
  }

  /** Carved openings: the cabin tub, plus the load bed on a pickup. Returns blend and floor height. */
  private opening(x: number): { o: number; floor: number } {
    const s = this.spec;
    const cabin = smooth(s.cBase - 0.02, s.cBase + 0.18, x) * smooth(s.aBase - 0.12, s.aBase - 0.3, x);
    if (s.bed) {
      const [b0, b1] = s.bed;
      const bed = smooth(b0 + 0.02, b0 - 0.12, x) * smooth(b1 - 0.02, b1 + 0.12, x);
      if (bed > cabin) return { o: bed, floor: s.bedFloor ?? this.floorY + 0.2 };
    }
    return { o: cabin, floor: this.floorY };
  }

  /**
   * A point on the lower-body section at x. `t` runs 0..1 round the section starting at the
   * bottom centre, up the right side (+Z), over the top and down the left side.
   */
  sectionPoint(x: number, t: number, carve = true): THREE.Vector3 {
    const s = this.spec;
    const yb = this.bottomY(x);
    const yt = this.topY(x);
    const k = this.endScale(x);
    const cy = (yb + yt) / 2;
    const hh = ((yt - yb) / 2) * k;
    const hw = this.halfW(x) * k;
    const th = -Math.PI / 2 + t * Math.PI * 2;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const e = 2 / s.squareness;
    let z = hw * sgnPow(c, e) * (1 - s.tumble * Math.max(0, sn) ** 1.5);
    let y = cy + hh * sgnPow(sn, e);
    if (carve) {
      const { o, floor } = this.opening(x);
      if (o > 0 && sn > 0) {
        // Points on the top surface inside the side walls drop to the floor, forming the tub.
        const inner = this.innerHalf(x);
        const m = smooth(inner + 0.02, inner - 0.02, Math.abs(z)) * o;
        y = y - m * (y - (floor - 0.01));
      }
    }
    return new THREE.Vector3(x, y, z);
  }

  /** Roof line above the belt, from windscreen base (aBase) to rear-glass base (cBase). */
  roofLine(x: number) {
    const s = this.spec;
    const belt = this.belt(x);
    if (x >= s.roofFront) {
      const t = clamp((s.aBase - x) / (s.aBase - s.roofFront), 0, 1);
      return belt + (s.roofY - belt) * Math.sin((t * Math.PI) / 2) ** 0.85;
    }
    if (x <= s.roofRear) {
      const t = clamp((x - s.cBase) / (s.roofRear - s.cBase), 0, 1);
      return belt + (s.roofY - belt) * Math.sin((t * Math.PI) / 2) ** 0.7;
    }
    const mid = (s.roofFront + s.roofRear) / 2;
    const half = (s.roofFront - s.roofRear) / 2;
    return s.roofY + 0.012 - 0.024 * ((x - mid) / half) ** 2;
  }

  /** Lamp height, kept below the bonnet surface near the nose so lenses always land on paint. */
  get headY() {
    const s = this.spec;
    return Math.min(s.headY, this.topY(s.front - 0.18) - 0.08);
  }

  /** Half width of the cabin tub at x: the body's top edge less the wall thickness. */
  innerHalf(x: number) {
    return Math.max(0.2, this.sideZ(x, this.belt(x) - 0.035) - this.wall);
  }

  /** Half width where the glass meets the body: just inside the body's top edge. */
  glassBase(x: number) {
    return Math.max(0.2, this.sideZ(x, this.belt(x) - 0.035) - 0.03);
  }

  /** Glasshouse arch at x: u 0..1 from the right base over the roof to the left base. */
  glassPoint(x: number, u: number, grow = 0): THREE.Vector3 {
    const s = this.spec;
    const belt = this.belt(x) - 0.015;
    const top = this.roofLine(x) + grow;
    const base = this.glassBase(x) + grow;
    const phi = u * Math.PI;
    const c = Math.cos(phi);
    const sn = Math.sin(phi);
    const e = 2 / Math.max(2.4, s.squareness - 0.6);
    const lift = sgnPow(sn, e);
    const z = base * sgnPow(c, e) * (1 - (1 - s.glassTop) * lift);
    return new THREE.Vector3(x, belt + (top - belt) * lift, z);
  }

  /* ----------------------------------------------------------- meshes */

  private grid(
    nx: number,
    nt: number,
    x0: number,
    x1: number,
    point: (x: number, t: number) => THREE.Vector3,
    closed: boolean,
    flip = false,
  ) {
    const pos: number[] = [];
    const idx: number[] = [];
    const cols = closed ? nt : nt + 1;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      for (let j = 0; j < cols; j++) {
        const p = point(x, j / nt);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < (closed ? nt : nt); j++) {
        const a = i * cols + j;
        const b = i * cols + ((j + 1) % cols);
        const c = (i + 1) * cols + j;
        const d = (i + 1) * cols + ((j + 1) % cols);
        if (flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** The painted lower body: one closed, smooth loft with arches and an open cabin tub. */
  bodyGeometry() {
    const s = this.spec;
    return this.grid(150, 72, s.rear, s.front, (x, t) => this.sectionPoint(x, t), true);
  }

  /** Glasshouse surface (open underneath), drawn double-sided. */
  glassGeometry() {
    const s = this.spec;
    return this.grid(70, 40, s.cBase, s.aBase, (x, u) => this.glassPoint(x, u), false);
  }

  /** Extent of the roof skin: [x0, x1] and how far down the sides it wraps (arch u range). */
  roofSpan(): { x0: number; x1: number; u0: number } {
    const s = this.spec;
    if (s.softTop) return { x0: s.cBase + 0.03, x1: s.roofFront + (s.aBase - s.roofFront) * 0.12, u0: 0.06 };
    return {
      x0: s.roofRear - (s.roofRear - s.cBase) * 0.28,
      x1: s.roofFront + (s.aBase - s.roofFront) * 0.18,
      u0: 0.16,
    };
  }

  /** Roof skin over the top of the glasshouse (a fabric hood that wraps lower on a soft top). */
  roofGeometry(grow = 0.012) {
    const { x0, x1, u0 } = this.roofSpan();
    return this.grid(50, 24, x0, x1, (x, u) => this.glassPoint(x, u0 + u * (1 - 2 * u0), grow), false);
  }

  /** Section parameter range covering a door on one side (from the sill up to the shoulder). */
  private doorRange(side: 1 | -1): [number, number] {
    return side > 0 ? [0.09, 0.45] : [0.55, 0.91];
  }

  /** A point on a door skin: u runs across the door's height, offset outwards by `out`. */
  private doorPoint(x: number, u: number, side: 1 | -1, out: number) {
    const [tLo, tHi] = this.doorRange(side);
    const p = this.sectionPoint(x, tLo + (tHi - tLo) * u, false);
    const y = Math.max(Math.min(p.y, this.belt(x) - 0.012), this.bottomY(x) + 0.05);
    return new THREE.Vector3(p.x, y, p.z + Math.sign(p.z) * out);
  }

  /** A strip of the glasshouse between two stations and arch positions, grown outwards. */
  glassPatch(x0: number, x1: number, u0: number, u1: number, grow: number) {
    return this.grid(4, 16, x0, x1, (x, u) => this.glassPoint(x, u0 + (u1 - u0) * u, grow), false);
  }

  /** A door skin: the patch of body side between two x positions, offset slightly outwards. */
  doorGeometry(x0: number, x1: number, side: 1 | -1) {
    return this.grid(24, 18, x1, x0, (x, u) => this.doorPoint(x, u, side, 0.006), false);
  }

  /** Closed outline of a door on the body side, used for its shut lines. */
  doorOutline(x0: number, x1: number, side: 1 | -1): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    const lo = side > 0 ? 0 : 1;
    const hi = 1 - lo;
    for (let i = 0; i <= 14; i++) pts.push(this.doorPoint(x1 + ((x0 - x1) * i) / 14, lo, side, 0.009));
    for (let i = 1; i <= 8; i++) pts.push(this.doorPoint(x0, lo + ((hi - lo) * i) / 8, side, 0.009));
    for (let i = 1; i <= 14; i++) pts.push(this.doorPoint(x0 - ((x0 - x1) * i) / 14, hi, side, 0.009));
    for (let i = 1; i < 8; i++) pts.push(this.doorPoint(x1, hi + ((lo - hi) * i) / 8, side, 0.009));
    return pts;
  }

  /** Outer z of the body side at height y and station x (right side). Bisects the section. */
  sideZ(x: number, y: number) {
    // Up the right side (t 0..0.5) height rises monotonically, so bisect on t.
    let lo = 0;
    let hi = 0.5;
    if (y <= this.sectionPoint(x, 0, false).y) return 0.05;
    if (y >= this.sectionPoint(x, 0.5, false).y) return 0.05;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (this.sectionPoint(x, mid, false).y < y) lo = mid;
      else hi = mid;
    }
    return Math.max(0.05, this.sectionPoint(x, (lo + hi) / 2, false).z);
  }

  /** Whether (y, z) lies inside the lower-body section at station x. */
  private inside(x: number, y: number, z: number) {
    return y > this.bottomY(x) && y < this.topY(x) && Math.abs(z) < this.sideZ(x, y);
  }

  /** x of the body surface at the nose (dir 1) or tail (dir -1) at height y, centre line offset z. */
  endX(y: number, z: number, dir: 1 | -1) {
    const s = this.spec;
    const start = dir > 0 ? s.front : s.rear;
    // Step in coarsely until inside the body, then bisect the boundary.
    let outX = start;
    let inX = start - dir * 0.9;
    for (let i = 1; i <= 30; i++) {
      const x = start - dir * i * 0.03;
      if (this.inside(x, y, z)) {
        inX = x;
        break;
      }
      outX = x;
    }
    for (let i = 0; i < 16; i++) {
      const mid = (outX + inX) / 2;
      if (this.inside(mid, y, z)) inX = mid;
      else outX = mid;
    }
    return (outX + inX) / 2;
  }

  /**
   * A patch of the nose (dir 1) or tail (dir -1) surface spanning z0..z1 and y0..y1, lifted off
   * the paint by `out`. Used for lamp lenses and the grille so they follow the body's curve.
   */
  endPatch(dir: 1 | -1, z0: number, z1: number, y0: number, y1: number, out: number) {
    const nz = 14;
    const ny = 5;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nz; i++) {
        const z = z0 + ((z1 - z0) * i) / nz;
        const y = y0 + ((y1 - y0) * j) / ny;
        pos.push(this.endX(y, z, dir) + dir * out, y, z);
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nz; i++) {
        const a = j * (nz + 1) + i;
        const b = a + 1;
        const c = a + nz + 1;
        const d = c + 1;
        // Wind so the face points away from the car (forward at the nose, back at the tail).
        if (dir > 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ---------------------------------------------------- 2D outlines */

  /** Side silhouette of the lower body, as one closed outline. */
  sideOutline(): { x: number; y: number }[] {
    const s = this.spec;
    const top: { x: number; y: number }[] = [];
    const bot: { x: number; y: number }[] = [];
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const x = s.rear + ((s.front - s.rear) * i) / n;
      const k = this.endScale(x);
      const cy = (this.bottomY(x) + this.topY(x)) / 2;
      top.push({ x, y: cy + (this.topY(x) - cy) * k });
      bot.push({ x, y: cy + (this.bottomY(x) - cy) * k });
    }
    return [...top, ...bot.reverse()];
  }

  /** Side outline of the glasshouse. */
  cabinOutline(): { x: number; y: number }[] {
    const s = this.spec;
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const x = s.cBase + ((s.aBase - s.cBase) * i) / 60;
      out.push({ x, y: this.roofLine(x) });
    }
    for (let i = 60; i >= 0; i--) {
      const x = s.cBase + ((s.aBase - s.cBase) * i) / 60;
      out.push({ x, y: this.belt(x) });
    }
    return out;
  }

  /** Side outline of the roof skin. */
  roofOutline(): { x: number; y: number }[] {
    const { x0, x1 } = this.roofSpan();
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = x0 + ((x1 - x0) * i) / 40;
      out.push({ x, y: this.roofLine(x) + 0.012 });
    }
    for (let i = 40; i >= 0; i--) {
      const x = x0 + ((x1 - x0) * i) / 40;
      out.push({ x, y: this.roofLine(x) - 0.04 });
    }
    return out;
  }

  /** Door outline in side view. */
  doorSideOutline(x0: number, x1: number): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= 16; i++) {
      const x = x0 + ((x1 - x0) * i) / 16;
      out.push({ x, y: this.belt(x) - 0.012 });
    }
    for (let i = 16; i >= 0; i--) {
      const x = x0 + ((x1 - x0) * i) / 16;
      out.push({ x, y: this.bottomY(x) + 0.05 });
    }
    return out;
  }

  /** Plan-view outline (half widths mirrored). */
  planOutline(): { x: number; z: number }[] {
    const s = this.spec;
    const right: { x: number; z: number }[] = [];
    for (let i = 0; i <= 100; i++) {
      const x = s.rear + ((s.front - s.rear) * i) / 100;
      right.push({ x, z: this.halfW(x) * this.endScale(x) });
    }
    const left = right
      .slice()
      .reverse()
      .map((p) => ({ x: p.x, z: -p.z }));
    return [...right, ...left];
  }
}
