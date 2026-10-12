/**
 * Section curves of the placeholder Vesper GT, in car units (car faces +X, up +Y). The 3D
 * body is extruded from these and the blueprint view draws them, so the two always agree.
 */
import * as THREE from 'three';

export function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.22, 0.36);
  s.lineTo(-1.98, 0.36);
  s.absarc(-1.45, 0.38, 0.53, Math.PI, 0, true);
  s.lineTo(-0.92, 0.36);
  s.lineTo(0.88, 0.36);
  s.absarc(1.41, 0.38, 0.53, Math.PI, 0, true);
  s.lineTo(1.94, 0.36);
  s.lineTo(2.14, 0.38);
  s.quadraticCurveTo(2.32, 0.4, 2.32, 0.58);
  s.quadraticCurveTo(2.3, 0.72, 2.1, 0.77);
  s.quadraticCurveTo(1.35, 0.86, 0.62, 0.88);
  s.lineTo(0.52, 0.6);
  s.lineTo(-1.78, 0.6);
  s.lineTo(-1.86, 0.9);
  s.quadraticCurveTo(-2.08, 0.92, -2.2, 0.8);
  s.quadraticCurveTo(-2.28, 0.62, -2.26, 0.48);
  s.quadraticCurveTo(-2.25, 0.38, -2.22, 0.36);
  return s;
}

export function doorShape() {
  const s = new THREE.Shape();
  s.moveTo(0.5, 0.62);
  s.lineTo(0.6, 0.94);
  s.lineTo(-1.84, 0.97);
  s.lineTo(-1.84, 0.62);
  s.lineTo(0.5, 0.62);
  return s;
}

/** Glasshouse (cabin) outline. */
export function cabinShape() {
  const s = new THREE.Shape();
  s.moveTo(0.56, 0.93);
  s.quadraticCurveTo(0.05, 1.3, -0.38, 1.33);
  s.lineTo(-0.98, 1.32);
  s.quadraticCurveTo(-1.58, 1.28, -1.84, 0.95);
  s.lineTo(0.56, 0.93);
  return s;
}

/** Points along the top of the glasshouse, front to back. */
export function roofLine() {
  return cabinShape()
    .getPoints(28)
    .filter((p) => p.y > 1.2)
    .sort((a, b) => b.x - a.x);
}

/** The roof panel: a thin skin following the top of the glasshouse. */
export function roofShape() {
  const pts = roofLine();
  const s = new THREE.Shape();
  const first = pts[0]!;
  s.moveTo(first.x, first.y + 0.006);
  pts.forEach((p) => s.lineTo(p.x, p.y + 0.006));
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(pts[i]!.x, pts[i]!.y - 0.05);
  return s;
}

/** Car dimensions in metres, for blueprint dimension lines. */
export const DIMENSIONS = {
  length: 4.78,
  width: 1.98,
  height: 1.4,
  wheelbase: 2.86,
  frontAxle: 1.41,
  rearAxle: -1.45,
  wheelY: 0.37,
  tyreRadius: 0.37,
} as const;
