/**
 * The directed camera: spherical coordinates around a target, poses per step, framing offsets
 * via setViewOffset, and an orbit the user can grab at any time (dragging kills tweens).
 */
import gsap from 'gsap';
import type * as THREE from 'three';
import type { StepId } from '@/data/options';
import type { BodyGeometry } from './car/body';
import { clamp, dur, isMobile } from '@/lib/motion';

export interface Pose {
  theta: number;
  phi: number;
  r: number;
  tx: number;
  ty: number;
  tz: number;
}

export const POSES: Record<StepId | 'exploded' | 'cabin' | 'summary' | 'regionScreen', Pose> = {
  shape: { theta: 0.95, phi: 1.32, r: 9.6, tx: 0, ty: 0.6, tz: 0 },
  paint: { theta: 0.85, phi: 1.3, r: 8.6, tx: 0, ty: 0.6, tz: 0 },
  livery: { theta: 0.4, phi: 0.98, r: 9.2, tx: 0, ty: 0.5, tz: 0 },
  graphics: { theta: -0.55, phi: 1.32, r: 9.4, tx: -0.2, ty: 0.6, tz: 0 },
  wheels: { theta: 0.2, phi: 1.42, r: 4.4, tx: 1.2, ty: 0.42, tz: 0.6 },
  body: { theta: -0.85, phi: 1.16, r: 8.4, tx: 0, ty: 0.6, tz: 0 },
  mods: { theta: 0.62, phi: 1.12, r: 9.8, tx: 0, ty: 0.7, tz: 0 },
  lights: { theta: 1.22, phi: 1.36, r: 5.8, tx: 1.6, ty: 0.62, tz: 0 },
  glass: { theta: 0.3, phi: 1.24, r: 7.2, tx: -0.4, ty: 0.9, tz: 0 },
  seats: { theta: 0.55, phi: 0.62, r: 5.4, tx: -0.45, ty: 0.85, tz: 0 },
  trim: { theta: -1.3, phi: 0.74, r: 3.7, tx: 0.15, ty: 0.95, tz: 0 },
  ambient: { theta: 0.95, phi: 0.7, r: 5, tx: -0.3, ty: 0.85, tz: 0 },
  region: { theta: -0.7, phi: 1.3, r: 8.8, tx: 0, ty: 0.6, tz: 0 },
  exploded: { theta: 0.72, phi: 1.06, r: 13.6, tx: 0, ty: 0.85, tz: 0 },
  cabin: { theta: 0.55, phi: 0.62, r: 5.4, tx: -0.45, ty: 0.85, tz: 0 },
  summary: { theta: 0.9, phi: 1.36, r: 9.8, tx: 0, ty: 0.55, tz: 0 },
  regionScreen: { theta: 1.4, phi: 1.34, r: 9.5, tx: 0, ty: 0.55, tz: 0 },
};

/**
 * Poses are authored for the 4.78 m coupe. Scale them to the current body so a longer car pulls
 * the camera back and a taller one raises the target.
 */
export function fitPose(p: Pose, geo: BodyGeometry): Pose {
  const ls = geo.length / 4.78;
  const hs = geo.height / 1.32;
  return {
    ...p,
    r: p.r * Math.max(ls, Math.sqrt(hs)),
    tx: p.tx * ls,
    ty: p.ty * hs,
    tz: p.tz * (geo.spec.halfWidth / 0.97),
  };
}

export type FrameName = 'config' | 'summary' | 'region' | 'none';

export function frameFor(name: FrameName) {
  const m = isMobile();
  if (name === 'config') return m ? { ox: 0, oy: 0.21 } : { ox: -0.11, oy: 0.03 };
  if (name === 'summary') return m ? { ox: 0, oy: 0.25 } : { ox: 0.15, oy: 0 };
  if (name === 'region') return m ? { ox: 0, oy: 0 } : { ox: -0.22, oy: 0 };
  return { ox: 0, oy: 0 };
}

export class CameraRig {
  readonly cam = { theta: 2.6, phi: 1.2, r: 17, tx: 0, ty: 0.55, tz: 0, ox: 0.17, oy: 0 };
  dragging = false;
  idle = 0;
  private vel = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };

  flyTo(p: Pose, duration = 1.5) {
    const c = this.cam;
    let d = p.theta - c.theta;
    d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    gsap.to(c, {
      theta: c.theta + d,
      phi: p.phi,
      r: p.r,
      tx: p.tx,
      ty: p.ty,
      tz: p.tz,
      duration: dur(duration),
      ease: 'power3.inOut',
      overwrite: 'auto',
    });
  }

  setFrame(name: FrameName, duration = 1.2) {
    const f = frameFor(name);
    gsap.to(this.cam, { ox: f.ox, oy: f.oy, duration: dur(duration), ease: 'power3.inOut' });
  }

  spin(turns = 1, duration = 2.4) {
    gsap.to(this.cam, { theta: `+=${Math.PI * 2 * turns}`, duration, ease: 'power2.inOut' });
  }

  nudge(delta: number) {
    gsap.to(this.cam, { theta: `+=${delta}`, duration: 0.6 });
  }

  pointerDown(x: number, y: number) {
    this.dragging = true;
    this.last = { x, y };
    this.vel = { x: 0, y: 0 };
    this.idle = 0;
    gsap.killTweensOf(this.cam, 'theta,phi,r');
  }

  pointerMove(x: number, y: number) {
    if (!this.dragging) return;
    const dx = x - this.last.x;
    const dy = y - this.last.y;
    this.last = { x, y };
    this.vel = { x: dx * 0.006, y: dy * 0.004 };
    this.cam.theta -= this.vel.x;
    this.cam.phi = clamp(this.cam.phi - this.vel.y, 0.3, 1.52);
    this.idle = 0;
  }

  pointerUp() {
    this.dragging = false;
  }

  zoom(deltaY: number) {
    gsap.killTweensOf(this.cam, 'r');
    this.cam.r = clamp(this.cam.r * (1 + deltaY * 0.0012), 3.2, 16);
    this.idle = 0;
  }

  /** Inertia after a drag and the slow idle turntable. */
  step(dt: number, opts: { orbit: boolean; autoSpin: number }) {
    const v = this.vel;
    if (!this.dragging && opts.orbit && (Math.abs(v.x) > 1e-5 || Math.abs(v.y) > 1e-5)) {
      this.cam.theta -= v.x;
      this.cam.phi = clamp(this.cam.phi - v.y, 0.3, 1.52);
      v.x *= 0.92;
      v.y *= 0.92;
    }
    this.idle += dt;
    if (!this.dragging && opts.autoSpin) this.cam.theta += dt * opts.autoSpin;
  }

  apply(camera: THREE.PerspectiveCamera, W: number, H: number) {
    const c = this.cam;
    const rScale = Math.max(1, 1.05 / (W / H));
    const r = c.r * 1.28 * rScale;
    const sp = Math.sin(c.phi);
    camera.position.set(
      c.tx + r * sp * Math.sin(c.theta),
      c.ty + r * Math.cos(c.phi),
      c.tz + r * sp * Math.cos(c.theta),
    );
    camera.lookAt(c.tx, c.ty, c.tz);
    camera.setViewOffset(W, H, -c.ox * W, c.oy * H, W, H);
  }
}
