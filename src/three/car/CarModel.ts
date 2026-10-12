/**
 * The placeholder Vesper GT, ported from reference/prototype.html. Every customisable part is a
 * named node following the model contract in docs/3D_PIPELINE.md, so a real glTF can replace
 * this class behind the same interface without touching UI code.
 *
 * The model never owns option state: `sync(build, change)` is called with the store's build
 * and plays the transition for each changed key.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import {
  CALIPERS,
  FINISHES,
  LAMP_TINTS,
  LIVERIES,
  LIVERY_COLOURS,
  QUILTS,
  REGIONS,
  RIM_RADIUS,
  SEAT_COLOURS,
  SEAT_MATERIALS,
  TRIMS,
  WHEEL_FINISHES,
  type Build,
  type OptionKey,
  type PackId,
  type WheelId,
} from '@/data/options';
import { paintHex, stitchHex } from '@/engine/labels';
import { clamp, dur, prefersReducedMotion } from '@/lib/motion';
import {
  chromaFor,
  lin,
  makePaint,
  paintState,
  sweepTo,
  tweenColour,
  type PaintState,
} from '../materials/paint';
import { bodyGeometry } from './bodies';
import type { BodyGeometry } from './body';

export interface Part {
  name: string;
  o: THREE.Object3D;
  base: THREE.Vector3;
  off: THREE.Vector3;
  /** Explode amount 0..1. */
  e: number;
  /** Extra lift on Y, used by lift-swap-drop transitions. */
  lift: number;
}

interface LightSeg {
  m: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  sp: THREE.Sprite;
}

interface Wheel {
  holder: THREE.Group;
  spin: THREE.Group;
  disc: THREE.Mesh;
  cal: THREE.Mesh;
  tire?: THREE.Mesh;
  barrel?: THREE.Mesh;
  face?: THREE.Group;
}

const RM = prefersReducedMotion;

function radialTexture(inner: string, outer: string, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, rz?: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

export class CarModel {
  readonly root = new THREE.Group();
  readonly shell = new THREE.Group();
  readonly cabin = new THREE.Group();
  readonly parts: Part[] = [];
  readonly P: Record<string, Part> = {};
  /** Cabin cutaway amount, roof fade (glass roof) and glass opacity. */
  readonly fx = { cut: 0, glassOp: 0.5, roofFade: 0 };
  lightsOn = false;

  private build: Build;
  /** Profiles and placement helpers for this car's body style. */
  readonly geo: BodyGeometry;
  /** Steering wheel offset from the centre line (sign set by drive side). */
  private steerZ = 0.4;
  private onLights: (on: boolean) => void;
  private disposables: { dispose(): void }[] = [];

  // paint states
  private body: PaintState;
  private carbon: PaintState;
  private grille: PaintState;
  private seat: PaintState;
  private dash: PaintState;
  private trimS: PaintState;

  // materials
  private bodyMat: THREE.MeshPhysicalMaterial;
  private roofBodyMat: THREE.MeshPhysicalMaterial;
  private carbonMat: THREE.MeshPhysicalMaterial;
  private roofCarbonMat: THREE.MeshPhysicalMaterial;
  private blackMat: THREE.MeshPhysicalMaterial;
  private roofBlackMat: THREE.MeshPhysicalMaterial;
  private glassMat: THREE.MeshPhysicalMaterial;
  private trimDarkMat: THREE.MeshStandardMaterial;
  private tireMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;
  private caliperMat: THREE.MeshStandardMaterial;
  private discMat: THREE.MeshStandardMaterial;
  private seatMat: THREE.MeshPhysicalMaterial;
  private dashMat: THREE.MeshPhysicalMaterial;
  private trimMat: THREE.MeshPhysicalMaterial;
  private ambMats: THREE.MeshBasicMaterial[] = [];
  /** Window frames: pillars and seals, faded out with the glass in the cabin view. */
  private frameMat!: THREE.MeshStandardMaterial;

  // nodes
  private roofMesh!: THREE.Mesh;
  private accentMeshes: THREE.Mesh[] = [];
  private mirrors: THREE.Group[] = [];
  private spoilerRise = new THREE.Group();
  private spoilerV: Record<'duck' | 'wing', THREE.Group> = {
    duck: new THREE.Group(),
    wing: new THREE.Group(),
  };
  private headGroups: THREE.Group[] = [];
  private headSegs: LightSeg[] = [];
  private tailSegs: LightSeg[] = [];
  private fog = new THREE.Group();
  private fogSegs: LightSeg[] = [];
  private hitch = new THREE.Group();
  private wheels: Wheel[] = [];
  private cabinLight: THREE.PointLight;
  private glowTex: THREE.CanvasTexture;
  private screenCanvas: HTMLCanvasElement;
  private screenTex: THREE.CanvasTexture;
  private wheelTl: gsap.core.Timeline | null = null;
  private ambC = new THREE.Color();
  private ambH = { h: 0, s: 0, l: 0 };
  /** Draw a different paint on the body without touching the build (previews). */
  private previewing = false;

  constructor(build: Build, onLights: (on: boolean) => void) {
    this.build = { ...build, packs: [...build.packs] };
    this.geo = bodyGeometry(build.body);
    this.onLights = onLights;
    this.root.name = 'car';
    this.root.add(this.shell);
    this.shell.add(this.cabin);
    this.glowTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 128);
    this.disposables.push(this.glowTex);

    const b = this.build;
    this.body = paintState({ color: paintHex(b) });
    this.bodyMat = makePaint(this.body, { r: 0.3, m: 0.62, cc: 1 });
    this.roofBodyMat = makePaint(this.body, { r: 0.3, m: 0.62, cc: 1, transparent: true });
    this.carbon = paintState({ color: '#121418', pat: 11, pc: '#4a515c', scale: 1 });
    this.carbonMat = makePaint(this.carbon, { r: 0.28, m: 0.3, cc: 1 });
    this.roofCarbonMat = makePaint(this.carbon, { r: 0.28, m: 0.3, cc: 1, transparent: true });
    this.blackMat = new THREE.MeshPhysicalMaterial({
      color: lin('#0c0d0f'),
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
    this.roofBlackMat = this.blackMat.clone();
    this.roofBlackMat.transparent = true;
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: lin('#0b0e12'),
      roughness: 0.04,
      metalness: 0.15,
      transparent: true,
      opacity: 0.5,
      envMapIntensity: 1.8,
      depthWrite: false,
      clearcoat: 1,
    });
    this.trimDarkMat = new THREE.MeshStandardMaterial({
      color: lin('#0e0f11'),
      roughness: 0.55,
      metalness: 0.2,
    });
    this.tireMat = new THREE.MeshStandardMaterial({ color: lin('#141518'), roughness: 0.9, metalness: 0 });
    const W = WHEEL_FINISHES[b.wfin];
    this.rimMat = new THREE.MeshStandardMaterial({
      color: lin(W.c),
      roughness: W.r,
      metalness: W.m,
      envMapIntensity: 1.3,
    });
    this.caliperMat = new THREE.MeshStandardMaterial({
      color: lin(CALIPERS[b.caliper].c),
      roughness: 0.35,
      metalness: 0.15,
    });
    this.discMat = new THREE.MeshStandardMaterial({ color: lin('#6a6d72'), roughness: 0.42, metalness: 0.9 });
    this.grille = paintState({ color: '#0c0d0f', pat: 3, pc: '#33373e', scale: 1 });
    const grilleMat = makePaint(this.grille, { r: 0.35, m: 0.4, cc: 0.6 });
    this.seat = paintState({
      color: SEAT_COLOURS[b.seatCol].c,
      pat: QUILTS[b.quilt].id,
      pc: stitchHex(b),
      min: -2.1,
      max: 0.9,
    });
    this.seatMat = makePaint(this.seat, { r: 0.5, m: 0, cc: 0, env: 0.6 });
    this.dash = paintState({ color: SEAT_COLOURS[b.seatCol].c, min: -1.2, max: 1.2 });
    this.dashMat = makePaint(this.dash, { r: 0.55, m: 0, cc: 0, env: 0.5 });
    const T = TRIMS[b.trim];
    this.trimS = paintState({ color: T.a, pat: T.id, pc: T.b, min: -0.7, max: 0.8 });
    this.trimMat = makePaint(this.trimS, { r: T.ro, m: T.me, cc: 0.8 });
    const carpetMat = new THREE.MeshStandardMaterial({ color: lin('#18191c'), roughness: 1 });

    this.disposables.push(
      this.bodyMat,
      this.roofBodyMat,
      this.carbonMat,
      this.roofCarbonMat,
      this.blackMat,
      this.roofBlackMat,
      this.glassMat,
      this.trimDarkMat,
      this.tireMat,
      this.rimMat,
      this.caliperMat,
      this.discMat,
      grilleMat,
      this.seatMat,
      this.dashMat,
      this.trimMat,
      carpetMat,
    );

    this.buildBody(grilleMat);
    this.buildLights();
    this.buildExtras();
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 240;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(this.screenTex);
    this.buildInterior(carpetMat);
    this.buildWheels();
    this.cabinLight = new THREE.PointLight(lin(b.amb), 0, 3.4, 2);
    this.cabinLight.position.set(-0.3, 1.12, 0);
    this.shell.add(this.cabinLight);

    this.shell.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material === this.glassMat) o.castShadow = false;
    });
    this.applyInitial();
  }

  /* --------------------------------------------------------------- build */

  private addPart(name: string, o: THREE.Object3D, off: [number, number, number], parent?: THREE.Object3D) {
    o.name = name;
    (parent ?? this.shell).add(o);
    const p: Part = { name, o, base: o.position.clone(), off: new THREE.Vector3(...off), e: 0, lift: 0 };
    this.parts.push(p);
    this.P[name] = p;
    return p;
  }

  private buildBody(grilleMat: THREE.Material) {
    const g = this.geo;
    const s = g.spec;
    for (const m of [this.roofBodyMat, this.roofCarbonMat, this.roofBlackMat, this.glassMat])
      m.side = THREE.DoubleSide;

    const body = mesh(g.bodyGeometry(), this.bodyMat);
    this.addPart('body', body, [0, 0, 0]);

    // Dark liners inside each wheel arch give the openings depth.
    const liner = new THREE.MeshStandardMaterial({
      color: lin('#0a0b0d'),
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    this.disposables.push(liner);
    for (const ax of [s.frontAxle, s.rearAxle]) {
      const geo = new THREE.CylinderGeometry(
        g.archR - 0.004,
        g.archR - 0.004,
        s.halfWidth * 2 - 0.08,
        40,
        1,
        true,
        Math.PI / 2,
        Math.PI,
      );
      geo.rotateX(Math.PI / 2);
      geo.translate(ax, s.tyreR, 0);
      body.add(new THREE.Mesh(geo, liner));
    }

    // Doors: a skin over the body side plus dark shut lines round its edge. +Z is the right side.
    const shut = new THREE.MeshBasicMaterial({ color: lin('#07080a') });
    this.disposables.push(shut);
    s.doors.forEach(([x0, x1], i) => {
      for (const side of [1, -1] as const) {
        const grp = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3(g.doorOutline(x0, x1, side), true, 'catmullrom', 0.02);
        grp.add(
          mesh(g.doorGeometry(x0, x1, side), this.bodyMat),
          new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.0032, 5, true), shut),
        );
        const name = (i === 0 ? 'door_' : 'door_r') + (side > 0 ? 'r' : 'l');
        this.addPart(name, grp, [i === 0 ? 0 : -0.08, 0, side * 0.6]);
      }
    });

    // Glasshouse, with dark pillars where the doors meet.
    const glassGroup = new THREE.Group();
    const glassMesh = mesh(g.glassGeometry(), this.glassMat, false);
    glassMesh.renderOrder = 1;
    glassGroup.add(glassMesh);
    this.frameMat = this.trimDarkMat.clone();
    this.frameMat.transparent = true;
    this.disposables.push(this.frameMat);
    const pillars = s.doors.map((d) => d[1]).filter((x) => x > s.cBase + 0.12 && x < s.aBase - 0.3);
    for (const x of pillars)
      for (const [u0, u1] of [
        [0.005, 0.3],
        [0.7, 0.995],
      ] as const)
        glassGroup.add(mesh(g.glassPatch(x - 0.035, x + 0.035, u0, u1, 0.004), this.frameMat, false));
    // Dark seals where the glass meets the body read as window frames.
    for (const u of [0.004, 0.996]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++)
        pts.push(g.glassPoint(s.cBase + ((s.aBase - s.cBase) * i) / 40, u, 0.006));
      glassGroup.add(
        new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.011, 6), this.frameMat),
      );
    }
    this.addPart('glass', glassGroup, [0, 0.55, 0]);

    this.roofMesh = mesh(g.roofGeometry(), this.roofBlackMat);
    this.roofMesh.renderOrder = 2;
    this.addPart('roof', this.roofMesh, [0, 0.95, 0]);

    const grilleGeo = g.endPatch(
      1,
      -s.grilleW / 2,
      s.grilleW / 2,
      s.grilleY - s.grilleH / 2,
      s.grilleY + s.grilleH / 2,
      0.004,
    );
    this.addPart('grille', mesh(grilleGeo, grilleMat), [0.55, -0.05, 0]);

    const accent = (name: string, geo: THREE.BufferGeometry, off: [number, number, number]) => {
      const m = mesh(geo, this.blackMat);
      this.accentMeshes.push(m);
      return this.addPart(name, m, off);
    };
    const sx = g.endX(s.noseBottom + 0.05, 0, 1);
    accent(
      'splitter',
      boxAt(0.2, 0.025, g.halfW(sx - 0.2) * 1.7, sx - 0.12, s.noseBottom - 0.01, 0),
      [0.5, -0.15, 0],
    );
    const dx = g.endX(s.tailBottom + 0.05, 0, -1);
    const dw = g.halfW(dx + 0.2) * 1.45;
    const diff = new THREE.Group();
    const base = mesh(boxAt(0.3, 0.05, dw, dx + 0.1, s.tailBottom - 0.01, 0), this.blackMat);
    this.accentMeshes.push(base);
    diff.add(base);
    for (let i = 0; i < 5; i++) {
      const f = mesh(
        boxAt(0.26, 0.07, 0.014, dx + 0.1, s.tailBottom + 0.04, -dw * 0.36 + (i * dw * 0.72) / 4),
        this.blackMat,
      );
      this.accentMeshes.push(f);
      diff.add(f);
    }
    this.addPart('diffuser', diff, [-0.5, -0.12, 0]);
    const k0 = s.rearAxle + g.archR + 0.06;
    const k1 = s.frontAxle - g.archR - 0.06;
    const kz = g.sideZ((k0 + k1) / 2, s.sill + 0.04) + 0.012;
    accent('skirt_r', boxAt(k1 - k0, 0.05, 0.05, (k0 + k1) / 2, s.sill + 0.015, kz), [0, -0.1, 0.4]);
    accent('skirt_l', boxAt(k1 - k0, 0.05, 0.05, (k0 + k1) / 2, s.sill + 0.015, -kz), [0, -0.1, -0.4]);

    const mirrorGlass = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 1, roughness: 0.05 });
    this.disposables.push(mirrorGlass);
    const mx = s.aBase - 0.06;
    const my = g.belt(mx) + 0.02;
    const mz = g.sideZ(mx, my - 0.03) - 0.03;
    for (const side of [1, -1]) {
      const piv = new THREE.Group();
      piv.position.set(mx, my, side * mz);
      const stalk = mesh(boxAt(0.08, 0.03, 0.12, 0, 0.02, side * 0.05), this.blackMat);
      // Mirror shell: a flattened half-ellipsoid, rounded at the front, glass facing back.
      const shell = new THREE.SphereGeometry(0.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      shell.rotateZ(-Math.PI / 2);
      shell.scale(0.9, 0.55, 1);
      shell.translate(0.03, 0.07, side * 0.17);
      const head = mesh(shell, this.blackMat);
      this.accentMeshes.push(stalk, head);
      const glassGeo = new THREE.CircleGeometry(0.09, 24).rotateY(-Math.PI / 2);
      glassGeo.scale(1, 0.52, 0.98);
      glassGeo.translate(0.028, 0.07, side * 0.17);
      piv.add(stalk, head, mesh(glassGeo, mirrorGlass, false));
      piv.userData.side = side;
      this.mirrors.push(piv);
      this.addPart(side > 0 ? 'mirror_r' : 'mirror_l', piv, [0.1, 0.2, side * 0.5]);
    }

    const spoilerRoot = new THREE.Group();
    spoilerRoot.add(this.spoilerRise);
    this.addPart('spoiler', spoilerRoot, [-0.3, 0.7, 0]);
    // SUVs carry their aero at the top of the tailgate; cars on the boot deck.
    const roofAero = s.cBase < s.rear + 0.3;
    const ax = roofAero ? s.roofRear - 0.02 : s.rear + 0.26;
    const ay = roofAero ? g.roofLine(ax) + 0.01 : g.topY(ax);
    const aw = (roofAero ? g.glassPoint(ax, 0).z : g.halfW(ax)) * 1.84;
    const duck = this.spoilerV.duck;
    duck.name = 'duck';
    const d = mesh(boxAt(0.32, 0.04, aw, ax - 0.04, ay + 0.03, 0, -0.2), this.blackMat);
    this.accentMeshes.push(d);
    duck.add(d);
    const wing = this.spoilerV.wing;
    wing.name = 'wing';
    for (const z of [aw * 0.27, -aw * 0.27]) {
      const post = mesh(boxAt(0.06, 0.27, 0.04, ax + 0.08, ay + 0.1, z, -0.25), this.blackMat);
      this.accentMeshes.push(post);
      wing.add(post);
    }
    const blade = mesh(boxAt(0.38, 0.035, aw + 0.04, ax, ay + 0.25, 0, -0.08), this.blackMat);
    this.accentMeshes.push(blade);
    wing.add(blade);
    for (const z of [aw / 2 + 0.02, -aw / 2 - 0.02]) {
      const ep = mesh(boxAt(0.3, 0.12, 0.02, ax, ay + 0.23, z), this.blackMat);
      this.accentMeshes.push(ep);
      wing.add(ep);
    }
    this.spoilerRise.add(duck, wing);
    duck.visible = false;
    wing.visible = false;
  }

  private lightSeg(geo: THREE.BufferGeometry, col: string): LightSeg {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      emissive: lin(col),
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    const m = new THREE.Mesh(geo, mat);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: lin(col),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sp.scale.set(0.17, 0.17, 1);
    return { m, mat, sp };
  }

  /** Where the head lamps sit: lens centre z on the right side. */
  private headZ() {
    const s = this.geo.spec;
    return Math.min(this.geo.sideZ(s.front - 0.35, this.geo.headY) - s.headW / 2 - 0.08, 0.66);
  }

  private buildLights() {
    const g = this.geo;
    const s = g.spec;
    const lens = new THREE.MeshPhysicalMaterial({
      color: 0x0c0d10,
      roughness: 0.05,
      metalness: 0.6,
      clearcoat: 1,
    });
    this.disposables.push(lens);
    const hz = this.headZ();
    for (const side of [1, -1] as const) {
      // Lens follows the nose surface; LED segments are placed on it in buildHeadlights.
      const grp = new THREE.Group();
      const z0 = side > 0 ? hz - s.headW / 2 : -hz - s.headW / 2;
      grp.add(mesh(g.endPatch(1, z0, z0 + s.headW, g.headY - 0.045, g.headY + 0.045, 0.004), lens));
      grp.userData.s = side;
      this.headGroups.push(grp);
      this.addPart(side > 0 ? 'head_r' : 'head_l', grp, [0.45, 0.05, side * 0.05]);
    }
    const tl = Math.max(0.6, g.sideZ(s.rear + 0.25, s.tailY) * 2 - 0.22);
    const tg = new THREE.Group();
    const tailLens = new THREE.MeshPhysicalMaterial({
      color: 0x120406,
      roughness: 0.06,
      metalness: 0.3,
      clearcoat: 1,
    });
    this.disposables.push(tailLens);
    tg.add(mesh(g.endPatch(-1, -tl / 2, tl / 2, s.tailY - 0.032, s.tailY + 0.032, 0.003), tailLens));
    for (let i = 0; i < 16; i++) {
      const z = -tl / 2 + 0.06 + i * ((tl - 0.12) / 15);
      const x = g.endX(s.tailY, z, -1) - 0.012;
      const L = this.lightSeg(boxAt(0.012, 0.028, 0.085, x, s.tailY, z), '#ff1a26');
      L.sp.position.set(x - 0.05, s.tailY, z);
      L.sp.scale.set(0.15, 0.15, 1);
      L.m.name = `seg_${i}`;
      tg.add(L.m, L.sp);
      this.tailSegs.push(L);
    }
    this.addPart('tail', tg, [-0.45, 0.05, 0]);
  }

  private buildHeadlights() {
    this.headSegs.length = 0;
    const geo = this.geo;
    const spec = geo.spec;
    const sig = this.build.sig;
    const col = LAMP_TINTS[this.build.ltint].c;
    const w = spec.headW / 0.46;
    const hz = this.headZ();
    for (const g of this.headGroups) {
      for (const c of g.children.slice(1)) {
        g.remove(c);
        if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        const mat = (c as THREE.Mesh).material as THREE.Material | undefined;
        mat?.dispose();
      }
      const s = g.userData.s as number;
      const arr: [number, number, number, number][] = [];
      if (sig === 'blade')
        for (let i = 0; i < 5; i++) arr.push([0, 0.018, 0.075 * w, (-0.17 + i * 0.085) * w]);
      else if (sig === 'quad')
        for (let i = 0; i < 4; i++) arr.push([0, 0.05, 0.05 * w, (-0.15 + i * 0.1) * w]);
      else
        for (let i = 0; i < 7; i++) {
          const t = i / 6;
          arr.push([Math.sin(t * Math.PI) * 0.028 - 0.01, 0.022, 0.05 * w, (-0.18 + t * 0.36) * w]);
        }
      arr.forEach(([dy, h, wd, dz], i) => {
        const y = geo.headY + dy;
        const z = s * (hz + dz);
        const x = geo.endX(y, z, 1) + 0.01;
        const L = this.lightSeg(boxAt(0.012, h, wd, x, y, z), col);
        L.m.name = `seg_${i}`;
        g.add(L.m);
        L.sp.position.set(x + 0.04, y, z);
        g.add(L.sp);
        this.headSegs.push(L);
      });
    }
  }

  private buildExtras() {
    const g = this.geo;
    const s = g.spec;
    const fy = s.noseBottom + 0.12;
    const fz = g.halfW(s.front - 0.3) - 0.28;
    const fx = g.endX(fy, fz, 1);
    for (const side of [1, -1]) {
      const L = this.lightSeg(
        new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24).rotateZ(Math.PI / 2).translate(fx, fy, side * fz),
        '#fff1c8',
      );
      L.sp.position.set(fx + 0.06, fy, side * fz);
      this.fog.add(L.m, L.sp);
      this.fogSegs.push(L);
    }
    this.fog.name = 'fog';
    this.fog.visible = false;
    this.shell.add(this.fog);
    this.hitch.name = 'hitch';
    this.hitch.position.set(g.endX(s.tailBottom + 0.04, 0, -1) - 0.03, s.tailBottom - 0.04, 0);
    this.hitch.add(mesh(boxAt(0.14, 0.06, 0.08, 0, 0, 0), this.trimDarkMat));
    this.hitch.add(mesh(new THREE.SphereGeometry(0.036, 20, 14).translate(-0.09, 0.05, 0), this.discMat));
    this.hitch.scale.setScalar(0.001);
    this.hitch.visible = false;
    this.shell.add(this.hitch);
  }

  private drawScreen() {
    const x = this.screenCanvas.getContext('2d');
    if (!x) return;
    const g = x.createLinearGradient(0, 0, 512, 240);
    g.addColorStop(0, '#0c1220');
    g.addColorStop(1, '#141a2a');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 240);
    x.strokeStyle = 'rgba(140,170,255,.25)';
    x.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.moveTo(260, 30 + i * 22);
      x.bezierCurveTo(330, 10 + i * 24, 400, 60 + i * 20, 500, 40 + i * 22);
      x.stroke();
    }
    x.strokeStyle = this.build.amb;
    x.lineWidth = 6;
    x.beginPath();
    x.arc(120, 128, 70, Math.PI * 0.8, Math.PI * 2.2);
    x.stroke();
    const body = getComputedStyle(document.documentElement).getPropertyValue('--font-b') || 'Arial';
    const disp = getComputedStyle(document.documentElement).getPropertyValue('--font-d') || 'Arial';
    x.fillStyle = '#e8ecf4';
    x.font = `600 44px ${body}`;
    x.textAlign = 'center';
    x.fillText('0', 120, 140);
    x.font = `14px ${body}`;
    x.fillStyle = '#8a93a6';
    x.fillText('km/h', 120, 165);
    x.textAlign = 'left';
    x.fillStyle = '#e8ecf4';
    x.font = `18px ${disp}`;
    x.fillText('HALDEN', 280, 200);
    this.screenTex.needsUpdate = true;
  }

  /** Interior fitted to the body: seats, dash, console, carpet, door cards and steering wheel. */
  private buildInterior(carpetMat: THREE.Material) {
    const g = this.geo;
    const s = g.spec;
    const floor = g.floorY;
    const beltA = g.belt(s.aBase);
    const mid = (s.aBase + s.cBase) / 2;
    const inner = g.innerHalf(mid);
    const cabinPart = (name: string, objs: THREE.Object3D[], off: [number, number, number]) => {
      const grp = new THREE.Group();
      objs.forEach((o) => grp.add(o));
      return this.addPart(name, grp, off, this.cabin);
    };
    const seat = (x: number, z: number, w: number) => [
      mesh(boxAt(0.5, 0.12, w, x, floor + 0.065, z), this.seatMat),
      mesh(boxAt(0.12, 0.46, w, x - 0.3, floor + 0.275, z, 0.2), this.seatMat),
    ];
    const fs = s.aBase - 0.78;
    const sz = inner * 0.46;
    for (const z of [sz, -sz]) {
      cabinPart(
        z > 0 ? 'seat_fr' : 'seat_fl',
        [...seat(fs, z, 0.46), mesh(boxAt(0.09, 0.13, 0.26, fs - 0.38, floor + 0.545, z, 0.2), this.seatMat)],
        [0, 0.45, 0],
      );
    }
    const rs = fs - 0.9;
    if (rs - 0.4 > s.cBase - 0.35) {
      cabinPart(
        'seat_rear',
        [
          ...seat(rs, 0, inner * 1.5),
          mesh(boxAt(0.08, 0.11, 0.26, rs - 0.38, floor + 0.465, sz * 0.92, 0.22), this.seatMat),
          mesh(boxAt(0.08, 0.11, 0.26, rs - 0.38, floor + 0.465, -sz * 0.92, 0.22), this.seatMat),
        ],
        [-0.15, 0.36, 0],
      );
    }
    const ambDash = new THREE.MeshBasicMaterial({ color: lin(this.build.amb), toneMapped: false });
    const ambDoor = new THREE.MeshBasicMaterial({ color: lin(this.build.amb), toneMapped: false });
    this.ambMats.push(ambDash, ambDoor);
    this.disposables.push(ambDash, ambDoor);
    this.drawScreen();
    const screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false });
    this.disposables.push(screenMat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.17), screenMat);
    screen.name = 'screen';
    const dashX = s.aBase - 0.24;
    const dashIn = g.innerHalf(dashX) - 0.01;
    screen.position.set(dashX - 0.15, beltA + 0.07, 0);
    screen.rotation.set(0, -Math.PI / 2, 0);
    screen.rotateX(-0.25);
    const dw = dashIn * 2;
    const dashTrim = mesh(boxAt(0.022, 0.06, dw * 0.96, dashX - 0.155, beltA - 0.06, 0), this.trimMat);
    dashTrim.name = 'dash_trim';
    const ambStrip = new THREE.Mesh(boxAt(0.012, 0.012, dw * 0.96, dashX - 0.163, beltA - 0.105, 0), ambDash);
    ambStrip.name = 'amb_dash';
    cabinPart(
      'dash',
      [mesh(boxAt(0.3, 0.24, dw, dashX, beltA - 0.14, 0), this.dashMat), dashTrim, ambStrip, screen],
      [0.2, 0.32, 0],
    );
    cabinPart(
      'console',
      [
        mesh(boxAt(0.9, 0.14, 0.2, fs + 0.13, floor + 0.095, 0), this.dashMat),
        mesh(boxAt(0.5, 0.012, 0.16, fs + 0.23, floor + 0.168, 0), this.trimMat),
      ],
      [0, 0.26, 0],
    );
    const cl = s.aBase - s.cBase - 0.2;
    cabinPart('carpet', [mesh(boxAt(cl, 0.01, inner * 2, mid, floor, 0), carpetMat, false)], [0, 0.1, 0]);
    for (const side of [1, -1]) {
      const strip = new THREE.Mesh(
        boxAt(cl * 0.8, 0.012, 0.012, mid, floor + 0.23, side * (inner - 0.015)),
        ambDoor,
      );
      strip.name = side > 0 ? 'amb_door_r' : 'amb_door_l';
      cabinPart(
        side > 0 ? 'card_r' : 'card_l',
        [
          mesh(boxAt(cl * 0.96, 0.24, 0.025, mid, floor + 0.105, side * (inner - 0.002)), this.seatMat),
          strip,
        ],
        [0, 0.1, side * 0.45],
      );
    }
    const steer = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.z = 0.42;
    steer.add(tilt);
    const rim = mesh(new THREE.TorusGeometry(0.14, 0.019, 12, 48), this.dashMat);
    rim.rotation.y = Math.PI / 2;
    tilt.add(rim);
    const hub = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24), this.trimDarkMat);
    hub.rotation.z = Math.PI / 2;
    tilt.add(hub);
    for (const a of [0, 2.2, -2.2]) {
      const sp = mesh(new THREE.BoxGeometry(0.012, 0.12, 0.03), this.trimMat);
      sp.position.set(0, Math.cos(a) * 0.065, Math.sin(a) * 0.065);
      sp.rotation.x = a;
      tilt.add(sp);
    }
    const col = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12), this.trimDarkMat);
    col.rotation.z = Math.PI / 2 + 0.42;
    col.position.set(0.1, -0.04, 0);
    steer.add(col);
    this.steerZ = sz;
    steer.position.set(dashX - 0.2, beltA - 0.02, sz);
    this.addPart('steering', steer, [0.05, 0.55, 0], this.cabin);
  }

  private wheelFace(design: WheelId, R: number) {
    const g = new THREE.Group();
    g.name = `face_${design}`;
    const z = 0.085;
    const rim = this.rimMat;
    g.add(
      mesh(
        new THREE.CylinderGeometry(R * 0.2, R * 0.22, 0.05, 28)
          .rotateX(Math.PI / 2)
          .translate(0, 0, z + 0.005),
        rim,
      ),
    );
    g.add(
      mesh(
        new THREE.CylinderGeometry(R * 0.1, R * 0.1, 0.012, 24)
          .rotateX(Math.PI / 2)
          .translate(0, 0, z + 0.033),
        this.trimDarkMat,
      ),
    );
    g.add(mesh(new THREE.TorusGeometry(R * 0.985, 0.012, 8, 72).translate(0, 0, z), rim));
    const spoke = (w: number, d: number, rx: number, rot: number, inner = 0.18) => {
      const sh = new THREE.Shape();
      sh.moveTo(R * inner, -w);
      sh.lineTo(R * 0.96, -w * 0.6);
      sh.lineTo(R * 0.96, w * 0.6);
      sh.lineTo(R * inner, w);
      sh.lineTo(R * inner, -w);
      const ge = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
      ge.translate(0, 0, -d / 2);
      const m = mesh(ge, rim);
      m.rotation.order = 'ZYX';
      m.rotation.x = rx;
      m.rotation.z = rot;
      m.position.z = z;
      return m;
    };
    if (design === 'five')
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(spoke(0.034, 0.04, 0, a - 0.09), spoke(0.034, 0.04, 0, a + 0.09));
      }
    else if (design === 'ten')
      for (let i = 0; i < 10; i++) g.add(spoke(0.02, 0.035, 0, (i / 10) * Math.PI * 2));
    else if (design === 'turbine')
      for (let i = 0; i < 14; i++) g.add(spoke(0.03, 0.012, 0.75, (i / 14) * Math.PI * 2));
    else if (design === 'mesh')
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        for (const t of [-0.42, 0.42]) {
          const ge = new THREE.BoxGeometry(R * 0.8, 0.016, 0.03);
          ge.rotateZ(t);
          ge.translate(R * 0.56, 0, z);
          const m = mesh(ge, rim);
          m.rotation.z = a;
          g.add(m);
        }
      }
    else {
      g.add(
        mesh(
          new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.03, 56).rotateX(Math.PI / 2).translate(0, 0, z),
          rim,
        ),
      );
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const sl = mesh(boxAt(0.035, 0.13, 0.02, 0, 0, 0), this.trimDarkMat);
        sl.position.set(Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68, z + 0.016);
        sl.rotation.z = a;
        g.add(sl);
      }
    }
    return g;
  }

  /** A tyre with sidewalls, rounded shoulders and a flat tread, lathed round the wheel axis. */
  private tyreGeometry(R: number, T: number, w: number) {
    const h = w / 2;
    const pts = [
      [R, -h * 0.84],
      [R + (T - R) * 0.3, -h],
      [T - 0.028, -h * 0.98],
      [T - 0.008, -h * 0.9],
      [T, -h * 0.74],
      [T, h * 0.74],
      [T - 0.008, h * 0.9],
      [T - 0.028, h * 0.98],
      [R + (T - R) * 0.3, h],
      [R, h * 0.84],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 72).rotateX(Math.PI / 2);
  }

  private buildWheel(w: Wheel) {
    const T = this.geo.spec.tyreR;
    const R = RIM_RADIUS[`${this.build.size}`] * (T / 0.37);
    const width = 0.25 * (T / 0.37);
    for (const o of [w.tire, w.barrel, w.face]) {
      if (!o) continue;
      w.spin.remove(o);
      o.traverse((c) => (c as THREE.Mesh).geometry?.dispose());
    }
    const tire = mesh(this.tyreGeometry(R, T, width), this.tireMat);
    tire.name = 'tyre';
    const barrel = mesh(
      new THREE.CylinderGeometry(R, R, width * 0.88, 48, 1, true).rotateX(Math.PI / 2),
      this.rimMat,
    );
    barrel.name = 'barrel';
    const face = this.wheelFace(this.build.wheel, R);
    w.spin.add(tire, barrel, face);
    Object.assign(w, { tire, barrel, face });
    w.disc.scale.setScalar(R / 0.25);
    w.cal.position.set(-R * 0.62, R * 0.32, 0.035);
  }

  private buildWheels() {
    const s = this.geo.spec;
    const spec: [string, number, number][] = [
      ['wheel_fr', s.frontAxle, 1],
      ['wheel_fl', s.frontAxle, -1],
      ['wheel_rr', s.rearAxle, 1],
      ['wheel_rl', s.rearAxle, -1],
    ];
    for (const [name, x, side] of spec) {
      const holder = new THREE.Group();
      holder.position.set(x, s.tyreR, side * s.track);
      if (side < 0) holder.rotation.y = Math.PI;
      const spin = new THREE.Group();
      spin.name = 'spin';
      holder.add(spin);
      const disc = mesh(
        new THREE.CylinderGeometry(0.205, 0.205, 0.024, 40).rotateX(Math.PI / 2),
        this.discMat,
      );
      disc.name = 'disc';
      holder.add(disc);
      const cal = mesh(new THREE.BoxGeometry(0.09, 0.13, 0.06), this.caliperMat);
      cal.name = 'caliper';
      cal.rotation.z = 0.5;
      holder.add(cal);
      const w: Wheel = { holder, spin, disc, cal };
      this.buildWheel(w);
      this.wheels.push(w);
      this.addPart(name, holder, [0, 0, side * 0.75], this.root);
    }
  }

  /* ------------------------------------------------------------ updaters */

  private roofMatFor(k: Build['roof']) {
    return k === 'body' ? this.roofBodyMat : k === 'carbon' ? this.roofCarbonMat : this.roofBlackMat;
  }
  private accentMat() {
    const a = this.build.accent;
    return a === 'body' ? this.bodyMat : a === 'carbon' ? this.carbonMat : this.blackMat;
  }

  private applyInitial() {
    const b = this.build;
    this.updPaint(false);
    this.roofMesh.material = this.roofMatFor(b.roof);
    this.roofMesh.visible = b.roof !== 'glass';
    this.fx.roofFade = b.roof === 'glass' ? 1 : 0;
    this.accentMeshes.forEach((m) => (m.material = this.accentMat()));
    for (const [k, g] of Object.entries(this.spoilerV)) g.visible = k === b.spoiler;
    this.spoilerRise.position.y = b.spoiler === 'none' ? -0.35 : 0;
    this.updGrille(false);
    this.buildHeadlights();
    this.fx.glassOp = this.glassOpacity();
    this.updGlass(false);
    this.updSeats(false);
    this.updTrim(false);
    this.P.steering!.base.z = REGIONS[b.region].drive === 'RHD' ? this.steerZ : -this.steerZ;
    this.updPacks([], false);
  }

  private updPaint(animate: boolean) {
    const b = this.build;
    const hex = paintHex(b);
    const L = LIVERIES[b.livery];
    const F = FINISHES[b.finish];
    if (this.previewing) this.previewing = false;
    sweepTo(this.body, { col: hex, pat: L.id, pc: LIVERY_COLOURS[b.livCol].c }, animate);
    this.body.u.uScale.value = b.livScale;
    gsap.to([this.bodyMat, this.roofBodyMat], {
      roughness: F.r,
      metalness: F.m,
      clearcoat: F.cc,
      duration: animate ? dur(1.2) : 0,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
    this.body.u.uChromaCol.value.copy(chromaFor(hex));
    gsap.to(this.body.u.uChroma, {
      value: b.finish === 'chroma' ? 1 : 0,
      duration: animate ? dur(1.2) : 0,
      overwrite: 'auto',
    });
  }

  private updWheelDesign(animate: boolean) {
    if (this.wheelTl) {
      this.wheelTl.progress(1);
      this.wheelTl = null;
    }
    if (!animate || RM()) {
      this.wheels.forEach((w) => this.buildWheel(w));
      return;
    }
    const sc = this.wheels.map((w) => w.holder.scale);
    this.wheelTl = gsap
      .timeline({ onComplete: () => void (this.wheelTl = null) })
      .to(
        this.wheels.map((w) => w.spin.rotation),
        { z: `-=${Math.PI * 6}`, duration: 1.4, ease: 'power2.inOut' },
        0,
      )
      .to(sc, { x: 0.86, y: 0.86, z: 0.86, duration: 0.4, ease: 'power2.in' }, 0.12)
      .add(() => this.wheels.forEach((w) => this.buildWheel(w)), 0.6)
      .to(sc, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1,.5)' }, 0.62);
  }

  private updWheelFinish(animate: boolean) {
    const W = WHEEL_FINISHES[this.build.wfin];
    tweenColour(this.rimMat.color, W.c, animate ? dur(0.9) : 0);
    gsap.to(this.rimMat, { metalness: W.m, roughness: W.r, duration: animate ? dur(0.9) : 0 });
    if (animate && !RM())
      gsap.to(
        this.wheels.map((w) => w.spin.rotation),
        { z: `-=${Math.PI}`, duration: 1.1, ease: 'power3.out' },
      );
  }

  private updCaliper(animate: boolean) {
    const c = CALIPERS[this.build.caliper].c;
    tweenColour(this.caliperMat.color, c, animate ? dur(0.6) : 0);
    this.caliperMat.emissive.copy(lin(c));
    if (animate)
      gsap.fromTo(
        this.caliperMat,
        { emissiveIntensity: 1.4 },
        { emissiveIntensity: 0, duration: dur(1.2), ease: 'power2.out' },
      );
    else this.caliperMat.emissiveIntensity = 0;
  }

  private updRoof(animate: boolean) {
    const p = this.P.roof!;
    const glass = this.build.roof === 'glass';
    const mat = this.roofMatFor(this.build.roof);
    if (!animate || RM()) {
      this.roofMesh.visible = !glass;
      if (!glass) this.roofMesh.material = mat;
      this.fx.roofFade = glass ? 1 : 0;
      return;
    }
    gsap
      .timeline()
      .to(p, { lift: 0.42, duration: 0.45, ease: 'power2.out' })
      .add(() => {
        if (!glass) {
          this.roofMesh.visible = true;
          this.roofMesh.material = mat;
        }
      })
      .to(this.fx, { roofFade: glass ? 1 : 0, duration: 0.35 })
      .add(() => void (this.roofMesh.visible = !glass))
      .to(p, { lift: 0, duration: 0.8, ease: 'bounce.out' });
  }

  private updAccent(animate: boolean) {
    const m = this.accentMat();
    if (!animate || RM()) {
      this.accentMeshes.forEach((x) => (x.material = m));
      return;
    }
    const ps = ['splitter', 'diffuser', 'skirt_l', 'skirt_r', 'mirror_l', 'mirror_r', 'spoiler'].map(
      (n) => this.P[n]!,
    );
    gsap
      .timeline()
      .to(ps, { lift: 0.1, duration: 0.28, ease: 'power2.out', stagger: 0.04 })
      .add(() => this.accentMeshes.forEach((x) => (x.material = m)))
      .to(ps, { lift: 0, duration: 0.7, ease: 'back.out(2.4)', stagger: 0.04 });
  }

  private updSpoiler(animate: boolean) {
    const show = this.build.spoiler;
    const setV = () => {
      for (const [k, g] of Object.entries(this.spoilerV)) g.visible = k === show;
    };
    gsap.killTweensOf(this.spoilerRise.position);
    if (!animate || RM()) {
      setV();
      this.spoilerRise.position.y = show === 'none' ? -0.35 : 0;
      return;
    }
    const tl = gsap.timeline();
    tl.to(this.spoilerRise.position, { y: -0.35, duration: 0.32, ease: 'power2.in' }).add(setV);
    if (show !== 'none') tl.to(this.spoilerRise.position, { y: 0, duration: 0.85, ease: 'back.out(1.8)' });
  }

  private updGrille(animate: boolean) {
    const g = this.build.grille;
    sweepTo(
      this.grille,
      {
        col: g === 'sealed' ? '#101114' : '#0c0d0f',
        pat: g === 'honey' ? 3 : g === 'slats' ? 16 : 0,
        pc: '#3a3f47',
      },
      false,
    );
    this.grille.u.uScale.value = g === 'slats' ? 1.5 : 1;
    if (animate && !RM())
      gsap
        .timeline()
        .to(this.P.grille!, { lift: 0.05, duration: 0.2 })
        .to(this.P.grille!, { lift: 0, duration: 0.6, ease: 'back.out(3)' });
  }

  setLights(on: boolean) {
    this.lightsOn = on;
    this.onLights(on);
    const hs = this.headSegs.map((s) => s.mat);
    const ts = this.tailSegs.map((s) => s.mat);
    gsap.killTweensOf([...hs, ...ts]);
    if (on) {
      gsap.to(hs, { emissiveIntensity: 3.2, duration: dur(0.25), stagger: dur(0.06) });
      gsap.to(ts, {
        emissiveIntensity: 2.6,
        duration: dur(0.2),
        stagger: { each: dur(0.04), from: 'center' },
      });
    } else gsap.to([...hs, ...ts], { emissiveIntensity: 0, duration: dur(0.4) });
    const fogOn = on && this.build.packs.includes('arctic');
    this.fogSegs.forEach((f) => gsap.to(f.mat, { emissiveIntensity: fogOn ? 2.6 : 0, duration: 0.4 }));
  }

  /** The welcome sequence: headlamps flash in order, the tail bar fills from the centre. */
  welcome() {
    const hs = this.headSegs.map((s) => s.mat);
    const ts = this.tailSegs.map((s) => s.mat);
    gsap.killTweensOf([...hs, ...ts]);
    this.lightsOn = true;
    this.onLights(true);
    const fog = this.build.packs.includes('arctic') ? 2.6 : 0;
    if (RM()) {
      hs.forEach((m) => (m.emissiveIntensity = 3.2));
      ts.forEach((m) => (m.emissiveIntensity = 2.6));
      this.fogSegs.forEach((f) => (f.mat.emissiveIntensity = fog));
      return;
    }
    gsap
      .timeline()
      .set([...hs, ...ts], { emissiveIntensity: 0 })
      .to(hs, { emissiveIntensity: 6, duration: 0.1, stagger: 0.065 })
      .to(hs, { emissiveIntensity: 0.5, duration: 0.3, stagger: 0.065 }, 0.25)
      .to(ts, { emissiveIntensity: 5, duration: 0.08, stagger: { each: 0.045, from: 'center' } }, 0.1)
      .to(ts, { emissiveIntensity: 2.6, duration: 0.4 }, '>')
      .to(hs, { emissiveIntensity: 3.2, duration: 0.5, stagger: 0.02 }, '>-0.2');
    this.fogSegs.forEach((f) => gsap.to(f.mat, { emissiveIntensity: fog, duration: 0.4, delay: 0.6 }));
  }

  private updSignature(animate: boolean) {
    this.buildHeadlights();
    if (!animate) {
      if (this.lightsOn) this.headSegs.forEach((s) => (s.mat.emissiveIntensity = 3.2));
      return;
    }
    this.headSegs.forEach((s, i) => {
      s.m.scale.set(1, 0.001, 0.001);
      gsap.to(s.m.scale, { y: 1, z: 1, duration: dur(0.5), delay: i * dur(0.03), ease: 'back.out(2)' });
    });
    this.welcome();
  }

  private updTint(animate: boolean) {
    const c = lin(LAMP_TINTS[this.build.ltint].c);
    this.headSegs.forEach((s) => {
      s.mat.emissive.copy(c);
      s.sp.material.color.copy(c);
    });
    if (animate) this.welcome();
  }

  private glassOpacity() {
    return 0.42 + (1 - this.build.vlt / 100) * 0.55;
  }

  private updGlass(animate: boolean) {
    const packs = this.build.packs;
    let col = '#0b0e12';
    let met = 0.15;
    if (packs.includes('thermal')) {
      col = '#3d2e0c';
      met = 0.8;
    } else if (packs.includes('heatshield')) col = '#0a1824';
    const d = animate ? dur(0.8) : 0;
    tweenColour(this.glassMat.color, col, d);
    gsap.to(this.glassMat, { metalness: met, duration: d });
    gsap.to(this.fx, { glassOp: this.glassOpacity(), duration: animate ? dur(0.6) : 0, overwrite: 'auto' });
  }

  private updSeats(animate: boolean) {
    const b = this.build;
    const col = SEAT_COLOURS[b.seatCol].c;
    sweepTo(this.seat, { col, pat: QUILTS[b.quilt].id, pc: stitchHex(b) }, animate && !RM(), 1.3);
    sweepTo(this.dash, { col, pat: 0, pc: '#000000' }, animate && !RM(), 1.3);
    gsap.to([this.seatMat, this.dashMat], {
      roughness: SEAT_MATERIALS[b.seatMat].ro,
      duration: animate ? dur(0.8) : 0,
    });
  }

  private updTrim(animate: boolean) {
    const T = TRIMS[this.build.trim];
    sweepTo(this.trimS, { col: T.a, pat: T.id, pc: T.b }, animate && !RM(), 1.1);
    gsap.to(this.trimMat, { roughness: T.ro, metalness: T.me, duration: animate ? dur(0.8) : 0 });
    this.trimS.u.uChromaCol.value.copy(lin(T.chroma ?? '#000000'));
    gsap.to(this.trimS.u.uChroma, { value: T.chroma ? 0.75 : 0, duration: animate ? dur(0.8) : 0 });
  }

  private updDrive(animate: boolean) {
    gsap.to(this.P.steering!.base, {
      z: REGIONS[this.build.region].drive === 'RHD' ? this.steerZ : -this.steerZ,
      duration: animate ? dur(1.3) : 0,
      ease: 'power3.inOut',
    });
  }

  private updPacks(prev: PackId[], animate: boolean) {
    const has = (k: PackId) => this.build.packs.includes(k);
    const added = (k: PackId) => has(k) && !prev.includes(k);
    const d = (s: number) => (animate ? dur(s) : 0);
    gsap.to(this.shell.position, {
      y: has('monsoon') ? 0.035 : 0,
      duration: d(1.1),
      ease: 'elastic.out(1,.6)',
    });
    this.updGlass(animate);
    gsap.killTweensOf(this.hitch.scale);
    if (has('tow')) {
      this.hitch.visible = true;
      gsap.to(this.hitch.scale, { x: 1, y: 1, z: 1, duration: d(0.7), ease: 'back.out(2)' });
    } else
      gsap.to(this.hitch.scale, {
        x: 0.001,
        y: 0.001,
        z: 0.001,
        duration: d(0.3),
        onComplete: () => void (this.hitch.visible = has('tow')),
      });
    if (added('fold') && animate && !RM())
      this.mirrors.forEach((m) => {
        const s = m.userData.side as number;
        gsap
          .timeline()
          .to(m.rotation, { y: -s * 1.2, duration: 0.9, ease: 'power3.inOut' })
          .to(m.rotation, { y: 0, duration: 0.9, ease: 'power3.inOut' }, '+=1.1');
      });
    this.fog.visible = has('arctic');
    if (added('arctic') && animate)
      this.fogSegs.forEach((f) =>
        gsap.fromTo(
          f.mat,
          { emissiveIntensity: 0 },
          {
            emissiveIntensity: 2.6,
            duration: 0.5,
            yoyo: !this.lightsOn,
            repeat: this.lightsOn ? 0 : 1,
            repeatDelay: 1,
          },
        ),
      );
  }

  /**
   * Brings the car in line with a new build, playing each changed part's transition.
   * Keys that share an updater (all paint keys, all seat keys) run it once.
   */
  sync(build: Build, keys: OptionKey[], animate: boolean) {
    const prev = this.build;
    this.build = { ...build, packs: [...build.packs] };
    const run = new Set<string>();
    for (const k of keys) {
      switch (k) {
        case 'paint':
        case 'finish':
        case 'livery':
        case 'livCol':
          run.add('paint');
          break;
        case 'custom':
          if (build.paint === 'custom') run.add('paint');
          break;
        case 'livScale':
          if (animate) run.add('paint');
          else this.body.u.uScale.value = build.livScale;
          break;
        case 'wheel':
        case 'size':
          run.add('wheel');
          break;
        case 'seatMat':
        case 'seatCol':
        case 'quilt':
        case 'stitch':
          run.add('seats');
          break;
        case 'amb':
          run.add('screen');
          break;
        case 'ambMode':
        case 'ambBri':
          break;
        default:
          run.add(k);
      }
    }
    for (const u of run) {
      switch (u) {
        case 'paint':
          this.updPaint(animate);
          break;
        case 'wheel':
          this.updWheelDesign(animate);
          break;
        case 'wfin':
          this.updWheelFinish(animate);
          break;
        case 'caliper':
          this.updCaliper(animate);
          break;
        case 'roof':
          this.updRoof(animate);
          break;
        case 'accent':
          this.updAccent(animate);
          break;
        case 'spoiler':
          this.updSpoiler(animate);
          break;
        case 'grille':
          this.updGrille(animate);
          break;
        case 'sig':
          this.updSignature(animate);
          break;
        case 'ltint':
          this.updTint(animate);
          break;
        case 'vlt':
          this.updGlass(animate);
          break;
        case 'seats':
          this.updSeats(animate);
          break;
        case 'trim':
          this.updTrim(animate);
          break;
        case 'screen':
          this.drawScreen();
          break;
        case 'region':
          this.updDrive(animate);
          break;
        case 'packs':
          this.updPacks(prev.packs, animate);
          break;
      }
    }
  }

  /** Repaints the body with a preview (region picker, landing story) without a build change. */
  previewPaint(col: string, pat: number, pc: string, duration = 1.4) {
    this.previewing = true;
    sweepTo(this.body, { col, pat, pc }, !RM(), duration);
  }

  restorePaint(animate = true) {
    if (!this.previewing) return;
    this.updPaint(animate && !RM());
  }

  /** Per-frame work: explode offsets, cutaway, ambient light and lamp glow sprites. */
  tick(t: number) {
    for (const p of this.parts) {
      p.o.position.copy(p.base).addScaledVector(p.off, p.e);
      p.o.position.y += p.lift;
    }
    const cut = this.fx.cut;
    const roofMat = this.roofMesh.material as THREE.Material;
    this.roofMesh.position.y += cut * 1.45;
    this.roofMesh.position.x -= cut * 0.35;
    roofMat.opacity = (1 - cut) * (1 - this.fx.roofFade);
    this.glassMat.opacity = this.fx.glassOp * (1 - cut * 0.88);
    this.frameMat.opacity = 1 - cut * 0.9;

    const b = this.build;
    const ambC = this.ambC.set(b.amb);
    let k = b.ambBri;
    if (b.ambMode === 'breathe') k *= 0.5 + 0.5 * Math.sin(t * 1.8);
    if (b.ambMode === 'flow') {
      ambC.getHSL(this.ambH, THREE.SRGBColorSpace);
      ambC.setHSL((this.ambH.h + t * 0.08) % 1, this.ambH.s, this.ambH.l, THREE.SRGBColorSpace);
    }
    ambC.multiplyScalar(0.35 + k * 1.7);
    for (const m of this.ambMats) m.color.copy(ambC);
    this.cabinLight.color.copy(ambC);
    this.cabinLight.intensity = (0.25 + cut * 1.5) * k * Math.PI;
    for (const s of this.headSegs) s.sp.material.opacity = clamp(s.mat.emissiveIntensity / 3.2, 0, 1) * 0.85;
    for (const s of this.tailSegs) s.sp.material.opacity = clamp(s.mat.emissiveIntensity / 2.6, 0, 1) * 0.7;
    for (const s of this.fogSegs) s.sp.material.opacity = clamp(s.mat.emissiveIntensity / 2.6, 0, 1) * 0.8;
  }

  dispose() {
    gsap.killTweensOf([...this.parts, this.fx]);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      if (o instanceof THREE.Sprite) o.material.dispose();
    });
    this.headSegs.concat(this.tailSegs, this.fogSegs).forEach((s) => s.mat.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
