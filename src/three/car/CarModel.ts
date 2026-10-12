/**
 * The car, built from the body style's spec (see body.ts and bodies.ts), first ported from reference/prototype.html. Every customisable part is a
 * named node following the model contract in docs/3D_PIPELINE.md, so a real glTF can replace
 * this class behind the same interface without touching UI code.
 *
 * The model never owns option state: `sync(build, change)` is called with the store's build
 * and plays the transition for each changed key.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import {
  CALIPERS,
  FINISHES,
  AMBIENT_PRESETS,
  DASH_TONES,
  HEADLINERS,
  LAMP_TINTS,
  LIVERIES,
  type ModId,
  type GraphicId,
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
import { graphicCanvas } from '@/lib/graphics';
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
  /** Canvas hood for soft tops. */
  private fabricMat = new THREE.MeshStandardMaterial({
    color: lin('#1b1c1f'),
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    side: THREE.DoubleSide,
  });
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
    const carpetMat = new THREE.MeshStandardMaterial({ color: lin(SEAT_COLOURS[b.carpet].c), roughness: 1 });
    this.carpetMat = carpetMat;

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
    this.buildMods();
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
        const skin = mesh(g.doorGeometry(x0, x1, side), this.bodyMat);
        this.doorSkins.push({ side, mesh: skin, index: i });
        grp.add(skin, new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.0032, 5, true), shut));
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

    if (s.bed) {
      // Pickup bed: a dark liner on the floor of the carved bed.
      const [b0, b1] = s.bed;
      const liner2 = new THREE.MeshStandardMaterial({ color: lin('#16171a'), roughness: 0.9 });
      this.disposables.push(liner2);
      const bw = g.innerHalf((b0 + b1) / 2) * 2 - 0.02;
      this.addPart(
        'bed',
        mesh(boxAt(b0 - b1 - 0.1, 0.02, bw, (b0 + b1) / 2, (s.bedFloor ?? 0.9) + 0.005, 0), liner2),
        [-0.2, 0.25, 0],
      );
    }
    this.disposables.push(this.fabricMat);
    // The roof pivots about its centre so the cabin view can tilt it to show the headliner.
    const roofGeo = g.roofGeometry();
    roofGeo.computeBoundingBox();
    const pivot = roofGeo.boundingBox!.getCenter(new THREE.Vector3()).setZ(0);
    roofGeo.translate(-pivot.x, -pivot.y, 0);
    this.roofMesh = mesh(roofGeo, this.roofBlackMat);
    this.roofMesh.renderOrder = 2;
    this.roofMesh.position.copy(pivot);
    this.buildHeadliner(pivot);
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
    x.fillText('AUTOFORGE', 280, 200);
    this.screenTex.needsUpdate = true;
  }

  /** Door skins, used as projection targets for door graphics. */
  private doorSkins: { side: 1 | -1; mesh: THREE.Mesh; index: number }[] = [];
  private decals: THREE.Mesh[] = [];
  /** User artwork for the 'upload' graphic (kept outside the build; see store/uploads). */
  private art: { door: CanvasImageSource | null; rear: CanvasImageSource | null } = {
    door: null,
    rear: null,
  };

  /** Sets user artwork and redraws graphics that use it. */
  setArtwork(art: { door: CanvasImageSource | null; rear: CanvasImageSource | null }) {
    this.art = art;
    if (this.build.doorArt === 'upload' || this.build.rearArt === 'upload') this.updGraphics(false);
  }

  /**
   * Door and rear graphics as decals projected onto the panels. The door design spans every
   * door on a side and is mirrored on the left so it always starts at the front of the car.
   */
  private updGraphics(animate: boolean) {
    for (const d of this.decals) {
      d.parent?.remove(d);
      d.geometry.dispose();
      const m = d.material as THREE.MeshPhysicalMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.decals = [];
    const b = this.build;
    const g = this.geo;
    const s = g.spec;
    const colour = LIVERY_COLOURS[b.artCol].c;
    this.root.updateMatrixWorld(true);
    const directional: GraphicId[] = ['flames', 'slash', 'sweep', 'tribal', 'checker'];
    const decal = (
      target: THREE.Mesh,
      canvas: HTMLCanvasElement,
      local: THREE.Vector3,
      rotY: number,
      size: THREE.Vector3,
    ) => {
      const world = local.clone().applyMatrix4(target.matrixWorld);
      const geo = new DecalGeometry(target, world, new THREE.Euler(0, rotY, 0), size);
      if (!geo.getAttribute('position')?.count) {
        geo.dispose();
        return;
      }
      geo.applyMatrix4(target.matrixWorld.clone().invert());
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        roughness: 0.32,
        metalness: 0.1,
        clearcoat: 1,
        opacity: animate ? 0 : 1,
      });
      const decalMesh = new THREE.Mesh(geo, mat);
      decalMesh.renderOrder = 3;
      target.add(decalMesh);
      this.decals.push(decalMesh);
      if (animate) gsap.to(mat, { opacity: 1, duration: dur(0.7), ease: 'power2.out' });
    };
    const opts = (place: 'door' | 'rear') => ({ colour, number: b.raceNo, place, image: this.art[place] });

    if (b.doorArt !== 'none' && (b.doorArt !== 'upload' || this.art.door)) {
      // Badges (number, script, own image) sit on the front door; flowing designs span every door.
      const badge = !directional.includes(b.doorArt);
      const x0 = s.doors[0]![0] - 0.04;
      const x1 = (badge ? s.doors[0]![1] : s.doors[s.doors.length - 1]![1]) + 0.04;
      const cx = (x0 + x1) / 2;
      const ylo = g.bottomY(cx) + 0.1;
      const yhi = g.belt(cx) - 0.06;
      const cy = (ylo + yhi) / 2;
      const len = x0 - x1;
      const h = yhi - ylo;
      const W = 1024;
      const H = Math.max(128, Math.round((W * h) / len));
      for (const { side, mesh: skin, index } of this.doorSkins) {
        if (badge && index > 0) continue;
        const mirror = side < 0 && directional.includes(b.doorArt);
        const canvas = graphicCanvas(b.doorArt, W, H, opts('door'), mirror);
        const at = new THREE.Vector3(cx, cy, side * g.sideZ(cx, cy));
        decal(skin, canvas, at, side > 0 ? 0 : Math.PI, new THREE.Vector3(len, h, 0.6));
      }
    }
    if (b.rearArt !== 'none' && (b.rearArt !== 'upload' || this.art.rear)) {
      const body = this.P.body!.o as THREE.Mesh;
      const ylo = s.tailY + 0.07;
      const yhi = Math.min(g.topY(s.rear + 0.15) - 0.04, ylo + 0.34);
      const cy = (ylo + yhi) / 2;
      const xr = g.endX(cy, 0, -1);
      const w = g.sideZ(xr + 0.12, cy) * 1.4;
      const h = Math.max(0.12, yhi - ylo);
      const canvas = graphicCanvas(b.rearArt, 768, Math.max(96, Math.round((768 * h) / w)), opts('rear'));
      decal(body, canvas, new THREE.Vector3(xr, cy, 0), -Math.PI / 2, new THREE.Vector3(w, h, 0.28));
    }
  }

  /** One group per mod, shown or hidden as the build changes. */
  private modGroups: Partial<Record<ModId, THREE.Group>> = {};
  private barSegs: LightSeg[] = [];
  private exhaustGroup = new THREE.Group();
  private exhaustMat!: THREE.MeshStandardMaterial;
  private glow!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  /** Builds every mod for this body once; updMods toggles them. */
  private buildMods() {
    const g = this.geo;
    const s = g.spec;
    const steel = new THREE.MeshStandardMaterial({ color: lin('#2a2d31'), roughness: 0.4, metalness: 0.85 });
    const chrome = new THREE.MeshStandardMaterial({ color: lin('#c9ccd1'), roughness: 0.18, metalness: 1 });
    this.disposables.push(steel, chrome);
    const group = (id: ModId, off: [number, number, number], parent: THREE.Object3D = this.shell) => {
      const grp = new THREE.Group();
      grp.visible = false;
      this.modGroups[id] = grp;
      this.addPart(`mod_${id}`, grp, off, parent);
      return grp;
    };
    const tube = (pts: [number, number, number][], r: number, mat: THREE.Material) =>
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))),
          48,
          r,
          10,
        ),
        mat,
      );

    // Wide-body flares: an arc over each wheel, finished like the accent parts.
    const flares = group('widebody', [0, 0, 0]);
    for (const ax of [s.frontAxle, s.rearAxle])
      for (const side of [1, -1]) {
        const geo = new THREE.TorusGeometry(g.archR + 0.035, 0.055, 10, 40, Math.PI * 0.86);
        geo.scale(1, 1, 0.55);
        geo.rotateZ(Math.PI * 0.07);
        const z = side * (g.halfW(ax) - 0.01);
        geo.translate(ax, s.tyreR, z);
        const m = mesh(geo, this.blackMat);
        this.accentMeshes.push(m);
        flares.add(m);
      }

    // Bonnet scoop: a painted hump on the bonnet.
    const scoop = group('scoop', [0.3, 0.25, 0]);
    {
      const x = s.frontAxle - 0.25;
      const geo = new THREE.SphereGeometry(0.28, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1.3, 0.28, 0.85);
      geo.translate(x, g.topY(x) - 0.01, 0);
      scoop.add(mesh(geo, this.bodyMat));
      scoop.add(mesh(boxAt(0.02, 0.05, 0.32, x + 0.34, g.topY(x) + 0.035, 0), this.trimDarkMat));
    }

    // Roof rack: rails along the roof edges and three crossbars.
    const rack = group('rack', [0, 0.5, 0]);
    {
      const x0 = s.roofRear + 0.05;
      const x1 = s.roofFront - 0.05;
      const zr = g.glassPoint((x0 + x1) / 2, 0.12, 0.02).z;
      for (const side of [1, -1]) {
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= 8; i++) {
          const x = x0 + ((x1 - x0) * i) / 8;
          pts.push([x, g.roofLine(x) + 0.06, side * zr]);
        }
        rack.add(tube(pts, 0.018, steel));
        for (const x of [x0 + 0.05, x1 - 0.05])
          rack.add(mesh(boxAt(0.06, 0.06, 0.04, x, g.roofLine(x) + 0.03, side * zr), steel));
      }
      for (let i = 0; i < 3; i++) {
        const x = x0 + 0.25 + (i * (x1 - x0 - 0.5)) / 2;
        rack.add(mesh(boxAt(0.05, 0.025, zr * 2 + 0.06, x, g.roofLine(x) + 0.09, 0), steel));
      }
    }

    // LED light bar across the top of the windscreen.
    const bar = group('lightbar', [0.2, 0.55, 0]);
    {
      const x = s.roofFront + 0.04;
      const y = g.roofLine(x) + 0.07;
      const w = g.glassPoint(x, 0.2, 0).z * 2;
      bar.add(mesh(boxAt(0.08, 0.07, w, x, y, 0), steel));
      for (let i = 0; i < 12; i++) {
        const z = -w / 2 + 0.06 + (i * (w - 0.12)) / 11;
        const L = this.lightSeg(boxAt(0.01, 0.04, 0.07, x + 0.042, y, z), '#f4f8ff');
        L.sp.position.set(x + 0.08, y, z);
        bar.add(L.m, L.sp);
        this.barSegs.push(L);
      }
    }

    // Bull bar: a tubular guard in front of the grille.
    const bull = group('bullbar', [0.55, 0, 0]);
    {
      const x = s.front + 0.06;
      const y0 = s.noseBottom + 0.02;
      const y1 = s.grilleY + s.grilleH / 2 + 0.12;
      const zw = s.grilleW / 2 + 0.06;
      bull.add(
        tube(
          [
            [x - 0.06, y0, zw],
            [x, y1 - 0.05, zw],
            [x + 0.01, y1, zw * 0.6],
            [x + 0.01, y1, -zw * 0.6],
            [x, y1 - 0.05, -zw],
            [x - 0.06, y0, -zw],
          ],
          0.035,
          steel,
        ),
      );
      bull.add(
        tube(
          [
            [x, y0 + 0.08, zw],
            [x + 0.03, y0 + 0.1, 0],
            [x, y0 + 0.08, -zw],
          ],
          0.028,
          steel,
        ),
      );
    }

    // Snorkel up the right windscreen pillar.
    const snorkel = group('snorkel', [0.1, 0.2, 0.4]);
    {
      const xf = s.aBase + 0.25;
      const z = g.sideZ(xf, g.belt(xf) - 0.1) + 0.05;
      const top = g.roofLine(s.roofFront + 0.15);
      snorkel.add(
        tube(
          [
            [xf, g.belt(xf) - 0.15, z],
            [s.aBase + 0.05, g.belt(s.aBase) + 0.05, z],
            [s.roofFront + 0.2, top - 0.02, z - 0.04],
            [s.roofFront + 0.12, top + 0.05, z - 0.06],
          ],
          0.045,
          steel,
        ),
      );
      snorkel.add(mesh(boxAt(0.12, 0.09, 0.11, s.roofFront + 0.12, top + 0.08, z - 0.06), steel));
    }

    // Spare wheel on the tailgate.
    const spare = group('spare', [-0.5, 0.1, 0]);
    {
      const cy = (s.tailY + g.topY(s.rear + 0.1)) / 2 + 0.05;
      const x = g.endX(cy, 0, -1) - 0.13;
      const tyre = mesh(this.tyreGeometry(s.tyreR * 0.62, s.tyreR * 0.95, 0.22), this.tireMat);
      tyre.rotation.y = Math.PI / 2;
      tyre.position.set(x, cy, 0);
      const hub = mesh(
        new THREE.CylinderGeometry(s.tyreR * 0.62, s.tyreR * 0.62, 0.18, 32).rotateZ(Math.PI / 2),
        this.rimMat,
      );
      hub.position.set(x, cy, 0);
      spare.add(tyre, hub);
    }

    // Pickup bed cover.
    if (s.bed) {
      const cover = group('tonneau', [-0.2, 0.4, 0]);
      const [b0, b1] = s.bed;
      const y = g.belt((b0 + b1) / 2) - 0.01;
      const w = g.innerHalf((b0 + b1) / 2) * 2 + 0.08;
      cover.add(mesh(boxAt(b0 - b1 + 0.04, 0.025, w, (b0 + b1) / 2, y, 0), this.trimDarkMat));
    }

    // Exhaust tips live in their own group, rebuilt per style.
    this.exhaustGroup.name = 'exhaust';
    this.shell.add(this.exhaustGroup);
    this.exhaustMat = chrome;

    // Underglow: a soft coloured pool on the floor under the car.
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(g.length * 1.05, s.halfWidth * 2.6),
      new THREE.MeshBasicMaterial({
        map: this.glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set((s.front + s.rear) / 2, 0.012, 0);
    this.glow.visible = false;
    this.root.add(this.glow);
    this.disposables.push(this.glow.material);
  }

  private buildExhaust() {
    const s = this.geo.spec;
    for (const c of [...this.exhaustGroup.children]) {
      this.exhaustGroup.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    const y = s.tailBottom + 0.02;
    const x = this.geo.endX(y + 0.05, 0, -1) + 0.06;
    const style = this.build.exhaust;
    const zs =
      style === 'twin'
        ? [0.45, -0.45]
        : style === 'quad'
          ? [0.52, 0.38, -0.38, -0.52]
          : style === 'centre'
            ? [0.07, -0.07]
            : [];
    for (const z of zs) {
      const tip = mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 0.16, 24, 1, true).rotateZ(Math.PI / 2),
        this.exhaustMat,
      );
      tip.position.set(x - 0.04, y, z);
      const inner = mesh(new THREE.CircleGeometry(0.04, 20).rotateY(-Math.PI / 2), this.trimDarkMat);
      inner.position.set(x - 0.1, y, z);
      this.exhaustGroup.add(tip, inner);
    }
  }

  /** Total body lift from packs and suspension mods. */
  private rideOffset() {
    const b = this.build;
    const lift = b.mods.includes('lift') ? 0.06 : 0;
    const low = b.mods.includes('lowered') ? 0.03 : 0;
    return (b.packs.includes('monsoon') ? 0.035 : 0) + lift - low;
  }

  private updRide(animate: boolean) {
    gsap.to(this.shell.position, {
      y: this.rideOffset(),
      duration: animate ? dur(1.1) : 0,
      ease: 'elastic.out(1,.6)',
    });
  }

  private updMods(prev: ModId[], animate: boolean) {
    const b = this.build;
    for (const [id, grp] of Object.entries(this.modGroups) as [ModId, THREE.Group][]) {
      const on = b.mods.includes(id);
      const was = prev.includes(id);
      gsap.killTweensOf(grp.scale);
      if (on) {
        grp.visible = true;
        if (animate && !was)
          gsap.fromTo(
            grp.scale,
            { x: 0.001, y: 0.001, z: 0.001 },
            { x: 1, y: 1, z: 1, duration: dur(0.75), ease: 'back.out(1.8)' },
          );
        else grp.scale.set(1, 1, 1);
      } else if (animate && was)
        gsap.to(grp.scale, {
          x: 0.001,
          y: 0.001,
          z: 0.001,
          duration: dur(0.3),
          ease: 'power2.in',
          onComplete: () => void (grp.visible = false),
        });
      else grp.visible = false;
    }
    this.updRide(animate);
    const barOn = this.lightsOn && b.mods.includes('lightbar');
    this.barSegs.forEach((sg) => (sg.mat.emissiveIntensity = barOn ? 3 : 0));
  }

  private updGlow(animate: boolean) {
    const g = this.build.glow;
    const mat = this.glow.material;
    if (g !== 'none') {
      mat.color.copy(lin(AMBIENT_PRESETS[g].c));
      this.glow.visible = true;
    }
    gsap.to(mat, {
      opacity: g === 'none' ? 0 : 0.85,
      duration: animate ? dur(0.8) : 0,
      onComplete: () => void (this.glow.visible = this.build.glow !== 'none'),
    });
  }

  private carpetMat!: THREE.MeshStandardMaterial;
  private headlinerMat = new THREE.MeshStandardMaterial({
    color: 0xc9c6bf,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>[] = [];
  private steerTilt = new THREE.Group();

  /** Headliner under the roof skin, with starlight points that twinkle in two phases. */
  private buildHeadliner(pivot: THREE.Vector3) {
    const g = this.geo;
    const geo = g.roofGeometry(-0.006);
    geo.translate(-pivot.x, -pivot.y, 0);
    const lining = new THREE.Mesh(geo, this.headlinerMat);
    lining.name = 'headliner';
    this.roofMesh.add(lining);
    this.disposables.push(this.headlinerMat);
    const { x0, x1, u0 } = g.roofSpan();
    for (let set = 0; set < 2; set++) {
      const pts: number[] = [];
      for (let i = 0; i < 160; i++) {
        const x = x0 + 0.06 + Math.random() * (x1 - x0 - 0.12);
        const u = u0 + 0.06 + Math.random() * (1 - 2 * u0 - 0.12);
        // Just above the lining, so they read both from inside and from above in the cabin view.
        const p = g.glassPoint(x, u, 0.0);
        pts.push(p.x - pivot.x, p.y - pivot.y, p.z);
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const pm = new THREE.PointsMaterial({
        size: 0.11,
        map: this.glowTex,
        color: 0xffffff,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const points = new THREE.Points(pg, pm);
      points.visible = false;
      points.renderOrder = 6;
      this.roofMesh.add(points);
      this.stars.push(points);
      this.disposables.push(pm, pg);
    }
  }

  private updHeadliner(animate: boolean) {
    const h = this.build.headliner;
    tweenColour(this.headlinerMat.color, HEADLINERS[h].c, animate ? dur(0.6) : 0);
    for (const p of this.stars) p.visible = h === 'starlight';
  }

  /** Steering wheel rim for the chosen style: round, flat-bottomed or yoke. */
  private buildSteeringWheel() {
    const t = this.steerTilt;
    for (const c of [...t.children]) {
      t.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    const R = 0.14;
    const arc = (start: number, len: number) => {
      const geo = new THREE.TorusGeometry(R, 0.019, 12, 48, len);
      geo.rotateZ(start);
      const m = mesh(geo, this.dashMat);
      m.rotation.y = Math.PI / 2;
      return m;
    };
    const bar = (y: number, half: number) => {
      const m = mesh(
        new THREE.CylinderGeometry(0.019, 0.019, half * 2, 12).rotateZ(Math.PI / 2),
        this.dashMat,
      );
      m.rotation.y = Math.PI / 2;
      m.position.y = y;
      return m;
    };
    const style = this.build.steer;
    if (style === 'round') t.add(arc(0, Math.PI * 2));
    else if (style === 'flat') {
      const gap = Math.PI / 7;
      t.add(arc(-Math.PI / 2 + gap, Math.PI * 2 - gap * 2), bar(-R * Math.cos(gap), R * Math.sin(gap)));
    } else {
      const a = 0.95;
      t.add(arc(-a, a * 2), arc(Math.PI - a, a * 2), bar(-R * Math.sin(a), R * Math.cos(a)));
    }
    const hub = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24), this.trimDarkMat);
    hub.rotation.z = Math.PI / 2;
    t.add(hub);
    for (const a of style === 'yoke' ? [Math.PI / 2, -Math.PI / 2] : [0, 2.2, -2.2]) {
      const sp = mesh(new THREE.BoxGeometry(0.012, 0.12, 0.03), this.trimMat);
      sp.position.set(0, Math.cos(a) * 0.065, Math.sin(a) * 0.065);
      sp.rotation.x = a;
      t.add(sp);
    }
  }

  private updSteering(animate: boolean) {
    this.buildSteeringWheel();
    if (animate && !RM())
      gsap.fromTo(this.steerTilt.rotation, { x: -Math.PI * 2 }, { x: 0, duration: 1, ease: 'power3.out' });
  }

  private dashHex() {
    const b = this.build;
    return b.dashTone === 'match' ? SEAT_COLOURS[b.seatCol].c : (DASH_TONES[b.dashTone].c ?? '#1b1c1f');
  }

  /** Seat parts currently in the cabin, rebuilt when the seating layout changes. */
  private seatParts: Part[] = [];

  /** Seats for the build's layout: front buckets, then benches or captain's chairs per row. */
  private buildSeats() {
    const g = this.geo;
    const s = g.spec;
    const floor = g.floorY;
    const inner = g.innerHalf((s.aBase + s.cBase) / 2);
    const sz = inner * 0.46;
    const fs = s.aBase - 0.78;
    const m = this.seatMat;
    const cushion = (x: number, z: number, w: number) => mesh(boxAt(0.5, 0.12, w, x, floor + 0.065, z), m);
    const back = (x: number, z: number, w: number, h = 0.46) =>
      mesh(boxAt(0.12, h, w, x - 0.3, floor + 0.045 + h / 2, z, 0.2), m);
    const head = (x: number, z: number, top: number) =>
      mesh(boxAt(0.09, 0.13, 0.26, x - 0.38, top, z, 0.2), m);
    const bucket = (x: number, z: number) => [
      cushion(x, z, 0.46),
      back(x, z, 0.46),
      head(x, z, floor + 0.545),
    ];
    const recline = this.build.comfort.includes('recline');
    const captain = (x: number, z: number) => [
      ...(recline
        ? [
            cushion(x, z, 0.46),
            mesh(boxAt(0.12, 0.46, 0.46, x - 0.33, floor + 0.23, z, 0.55), m),
            mesh(boxAt(0.09, 0.13, 0.26, x - 0.48, floor + 0.42, z, 0.55), m),
            // Powered leg rest, folded out from the front of the cushion.
            mesh(boxAt(0.3, 0.05, 0.4, x + 0.36, floor + 0.04, z, -0.35), m),
          ]
        : bucket(x, z)),
      mesh(boxAt(0.36, 0.05, 0.05, x - 0.02, floor + 0.2, z + 0.26), m),
      mesh(boxAt(0.36, 0.05, 0.05, x - 0.02, floor + 0.2, z - 0.26), m),
    ];
    const bench = (x: number, w: number, heads: number[], h = 0.46) => [
      cushion(x, 0, w),
      back(x, 0, w, h),
      ...heads.map((z) => head(x, z, floor + 0.045 + h + 0.02)),
    ];
    const add = (name: string, objs: THREE.Object3D[], off: [number, number, number]) => {
      const grp = new THREE.Group();
      objs.forEach((o) => grp.add(o));
      this.seatParts.push(this.addPart(name, grp, off, this.cabin));
    };
    // Rear entertainment: lit screens on the backs of the front seats.
    const screens = this.build.comfort.includes('screens') && this.build.seating !== 'two';
    const screen = (z: number) => {
      const sm = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.14),
        new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }),
      );
      sm.rotation.set(0, -Math.PI / 2, 0);
      sm.rotateX(0.2);
      sm.position.set(fs - 0.385, floor + 0.36, z);
      this.disposables.push(sm.material);
      return sm;
    };
    add('seat_fr', [...bucket(fs, sz), ...(screens ? [screen(sz)] : [])], [0, 0.45, 0]);
    add('seat_fl', [...bucket(fs, -sz), ...(screens ? [screen(-sz)] : [])], [0, 0.45, 0]);
    const rs = fs - 0.9;
    const ts = rs - 0.86;
    const console2 = (x: number) => mesh(boxAt(0.5, 0.2, 0.22, x + 0.05, floor + 0.11, 0), this.dashMat);
    switch (this.build.seating) {
      case 'twoPlusTwo':
        add('seat_rear', bench(fs - 0.82, inner * 1.3, [sz * 0.85, -sz * 0.85], 0.36), [-0.15, 0.36, 0]);
        break;
      case 'five':
        add('seat_rear', bench(rs, inner * 1.5, [sz * 0.92, 0, -sz * 0.92]), [-0.15, 0.36, 0]);
        break;
      case 'lounge':
        add(
          'seat_rear',
          [...captain(rs, sz * 1.05), ...captain(rs, -sz * 1.05), console2(rs)],
          [-0.15, 0.36, 0],
        );
        break;
      case 'six':
        add('seat_rear', [...captain(rs, sz), ...captain(rs, -sz)], [-0.15, 0.36, 0]);
        add('seat_third', [...captain(ts, sz), ...captain(ts, -sz)], [-0.3, 0.3, 0]);
        break;
      case 'seven':
        add('seat_rear', bench(rs, inner * 1.5, [sz * 0.92, 0, -sz * 0.92]), [-0.15, 0.36, 0]);
        add('seat_third', bench(ts, inner * 1.2, [sz * 0.75, -sz * 0.75], 0.4), [-0.3, 0.3, 0]);
        break;
      default:
        break;
    }
  }

  /** Swaps the seats for a new layout; the new ones rise into place. */
  private rebuildSeats(animate: boolean) {
    const e = this.P.body?.e ?? 0;
    for (const p of this.seatParts) {
      this.cabin.remove(p.o);
      p.o.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.parts.splice(this.parts.indexOf(p), 1);
      delete this.P[p.name];
    }
    this.seatParts = [];
    this.buildSeats();
    for (const p of this.seatParts) p.e = e;
    if (!animate) return;
    this.seatParts.forEach((p, i) => {
      p.o.scale.set(1, 0.001, 1);
      gsap.to(p.o.scale, { y: 1, duration: 0.7, delay: i * 0.08, ease: 'back.out(2)' });
    });
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
    const fs = s.aBase - 0.78;
    const sz = inner * 0.46;
    this.buildSeats();
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
    tilt.add(this.steerTilt);
    this.buildSteeringWheel();
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
    if (this.geo.spec.softTop) return this.fabricMat;
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
    this.updGraphics(false);
    this.buildExhaust();
    this.updMods([], false);
    this.updGlow(false);
    this.updHeadliner(false);
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
    const barOn = on && this.build.mods.includes('lightbar');
    gsap.to(
      this.barSegs.map((sg) => sg.mat),
      { emissiveIntensity: barOn ? 3 : 0, duration: dur(0.3), stagger: dur(0.02) },
    );
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
    if (this.build.mods.includes('lightbar'))
      gsap.fromTo(
        this.barSegs.map((sg) => sg.mat),
        { emissiveIntensity: 0 },
        { emissiveIntensity: 3, duration: 0.12, stagger: { each: 0.03, from: 'center' }, delay: 0.3 },
      );
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
    sweepTo(this.dash, { col: this.dashHex(), pat: 0, pc: '#000000' }, animate && !RM(), 1.3);
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
    this.updRide(animate);
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
        case 'seating':
          run.add('seating');
          break;
        case 'mods':
          run.add('mods');
          break;
        case 'steer':
          run.add('steer');
          break;
        case 'dashTone':
          run.add('seats');
          break;
        case 'carpet':
          run.add('carpet');
          break;
        case 'headliner':
          run.add('headliner');
          break;
        case 'comfort':
          run.add('seating');
          break;
        case 'exhaust':
          run.add('exhaust');
          break;
        case 'glow':
          run.add('glow');
          break;
        case 'doorArt':
        case 'rearArt':
        case 'artCol':
        case 'raceNo':
          run.add('graphics');
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
        case 'seating':
          this.rebuildSeats(animate);
          break;
        case 'graphics':
          this.updGraphics(animate);
          break;
        case 'mods':
          this.updMods(prev.mods, animate);
          break;
        case 'steer':
          this.updSteering(animate);
          break;
        case 'carpet':
          tweenColour(this.carpetMat.color, SEAT_COLOURS[this.build.carpet].c, animate ? dur(0.6) : 0);
          break;
        case 'headliner':
          this.updHeadliner(animate);
          break;
        case 'exhaust':
          this.buildExhaust();
          break;
        case 'glow':
          this.updGlow(animate);
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
    const starlight = this.build.headliner === 'starlight';
    // With a starlight headliner the cabin view looks through the roof: the painted skin fades
    // but the starlit ceiling stays, translucent, over the cabin. Otherwise the roof lifts away.
    if (starlight) {
      this.roofMesh.position.y += cut * 0.04;
      roofMat.opacity = (1 - cut) * (1 - this.fx.roofFade);
    } else {
      this.roofMesh.position.y += cut * 1.45;
      this.roofMesh.position.x -= cut * 0.35;
      roofMat.opacity = (1 - cut) * (1 - this.fx.roofFade);
    }
    // A faded skin must not write depth, or it hides the lining and stars beneath it.
    roofMat.visible = roofMat.opacity > 0.01;
    roofMat.depthWrite = roofMat.opacity > 0.98;
    const lining = starlight ? (1 - cut * 0.45) * (1 - this.fx.roofFade) : roofMat.opacity;
    this.headlinerMat.opacity = lining;
    this.headlinerMat.transparent = lining < 1;
    if (starlight)
      this.stars.forEach(
        (p, i) =>
          (p.material.opacity = (0.55 + 0.45 * Math.sin(t * 2.4 + i * Math.PI)) * Math.min(1, lining * 1.6)),
      );
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
    // Roof-mounted kit leaves with the roof in the cabin view.
    for (const id of ['rack', 'lightbar'] as const) {
      const grp = this.modGroups[id];
      if (grp) grp.visible = this.build.mods.includes(id) && cut < 0.25;
    }
    for (const s of this.barSegs) s.sp.material.opacity = clamp(s.mat.emissiveIntensity / 3, 0, 1) * 0.8;
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
