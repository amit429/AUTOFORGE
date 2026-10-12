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
import { bodyShape, cabinShape, doorShape, roofShape } from './shapes';

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
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape(), {
      depth: 1.7,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.1,
      bevelSegments: 7,
      curveSegments: 30,
    });
    bodyGeo.translate(0, 0, -0.85);
    bodyGeo.computeVertexNormals();
    this.addPart('body', mesh(bodyGeo, this.bodyMat), [0, 0, 0]);

    const doorGeo = (side: number) => {
      const g = new THREE.ExtrudeGeometry(doorShape(), {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 4,
        curveSegments: 4,
      });
      g.translate(0, 0, side > 0 ? 0.85 : -0.95);
      return g;
    };
    // +Z is the car's right side.
    this.addPart('door_r', mesh(doorGeo(1), this.bodyMat), [0, 0, 0.6]);
    this.addPart('door_l', mesh(doorGeo(-1), this.bodyMat), [0, 0, -0.6]);

    const cabGeo = new THREE.ExtrudeGeometry(cabinShape(), {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 5,
      curveSegments: 28,
    });
    cabGeo.translate(0, 0, -0.75);
    const glassGroup = new THREE.Group();
    const glassMesh = mesh(cabGeo, this.glassMat, false);
    glassMesh.renderOrder = 1;
    glassGroup.add(glassMesh);
    for (const s of [1, -1])
      glassGroup.add(mesh(boxAt(0.07, 0.36, 0.02, -0.42, 1.1, s * 0.85), this.trimDarkMat, false));
    this.addPart('glass', glassGroup, [0, 0.55, 0]);

    const roofGeo = new THREE.ExtrudeGeometry(roofShape(), {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.086,
      bevelSize: 0.066,
      bevelSegments: 5,
      curveSegments: 8,
    });
    roofGeo.translate(0, 0, -0.75);
    this.roofMesh = mesh(roofGeo, this.roofBlackMat);
    this.roofMesh.renderOrder = 2;
    this.addPart('roof', this.roofMesh, [0, 0.95, 0]);

    this.addPart('grille', mesh(boxAt(0.05, 0.17, 1.0, 2.405, 0.47, 0), grilleMat), [0.55, -0.05, 0]);
    const accent = (name: string, geo: THREE.BufferGeometry, off: [number, number, number]) => {
      const m = mesh(geo, this.blackMat);
      this.accentMeshes.push(m);
      return this.addPart(name, m, off);
    };
    accent('splitter', boxAt(0.28, 0.03, 1.86, 2.33, 0.27, 0), [0.5, -0.15, 0]);
    const diff = new THREE.Group();
    const base = mesh(boxAt(0.3, 0.05, 1.42, -2.27, 0.3, 0), this.blackMat);
    this.accentMeshes.push(base);
    diff.add(base);
    for (let i = 0; i < 5; i++) {
      const f = mesh(boxAt(0.26, 0.07, 0.014, -2.27, 0.35, -0.5 + i * 0.25), this.blackMat);
      this.accentMeshes.push(f);
      diff.add(f);
    }
    this.addPart('diffuser', diff, [-0.5, -0.12, 0]);
    accent('skirt_r', boxAt(1.8, 0.05, 0.05, -0.02, 0.29, 1.0), [0, -0.1, 0.4]);
    accent('skirt_l', boxAt(1.8, 0.05, 0.05, -0.02, 0.29, -1.0), [0, -0.1, -0.4]);

    const mirrorGlass = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 1, roughness: 0.05 });
    this.disposables.push(mirrorGlass);
    for (const s of [1, -1]) {
      const piv = new THREE.Group();
      piv.position.set(0.5, 0.98, s * 0.98);
      const stalk = mesh(boxAt(0.08, 0.03, 0.12, 0, 0.02, s * 0.05), this.blackMat);
      const head = mesh(boxAt(0.16, 0.1, 0.19, 0.02, 0.07, s * 0.17), this.blackMat);
      this.accentMeshes.push(stalk, head);
      piv.add(stalk, head, mesh(boxAt(0.005, 0.075, 0.15, -0.062, 0.07, s * 0.17), mirrorGlass, false));
      piv.userData.side = s;
      this.mirrors.push(piv);
      this.addPart(s > 0 ? 'mirror_r' : 'mirror_l', piv, [0.1, 0.2, s * 0.5]);
    }

    const spoilerRoot = new THREE.Group();
    spoilerRoot.add(this.spoilerRise);
    this.addPart('spoiler', spoilerRoot, [-0.3, 0.7, 0]);
    const duck = this.spoilerV.duck;
    duck.name = 'duck';
    const d = mesh(boxAt(0.32, 0.04, 1.76, -2.12, 1.0, 0, -0.2), this.blackMat);
    this.accentMeshes.push(d);
    duck.add(d);
    const wing = this.spoilerV.wing;
    wing.name = 'wing';
    for (const z of [0.5, -0.5]) {
      const post = mesh(boxAt(0.06, 0.27, 0.04, -2.02, 1.08, z, -0.25), this.blackMat);
      this.accentMeshes.push(post);
      wing.add(post);
    }
    const blade = mesh(boxAt(0.38, 0.035, 1.82, -2.1, 1.25, 0, -0.08), this.blackMat);
    this.accentMeshes.push(blade);
    wing.add(blade);
    for (const z of [0.92, -0.92]) {
      const ep = mesh(boxAt(0.3, 0.12, 0.02, -2.1, 1.23, z), this.blackMat);
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

  private buildLights() {
    const housing = new THREE.MeshPhysicalMaterial({
      color: 0x0c0d10,
      roughness: 0.05,
      metalness: 0.6,
      clearcoat: 1,
    });
    this.disposables.push(housing);
    for (const s of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(2.39, 0.655, s * 0.6);
      g.add(mesh(boxAt(0.06, 0.1, 0.46, 0, 0, 0), housing));
      g.userData.s = s;
      this.headGroups.push(g);
      this.addPart(s > 0 ? 'head_r' : 'head_l', g, [0.45, 0.05, s * 0.05]);
    }
    const tg = new THREE.Group();
    tg.position.set(-2.33, 0.79, 0);
    const tailLens = new THREE.MeshPhysicalMaterial({
      color: 0x120406,
      roughness: 0.06,
      metalness: 0.3,
      clearcoat: 1,
    });
    this.disposables.push(tailLens);
    tg.add(mesh(boxAt(0.04, 0.06, 1.72, 0, 0, 0), tailLens));
    for (let i = 0; i < 16; i++) {
      const z = -0.8 + i * (1.6 / 15);
      const L = this.lightSeg(boxAt(0.02, 0.028, 0.085, -0.022, 0, z), '#ff1a26');
      L.sp.position.set(-0.06, 0, z);
      L.sp.scale.set(0.15, 0.15, 1);
      L.m.name = `seg_${i}`;
      tg.add(L.m, L.sp);
      this.tailSegs.push(L);
    }
    this.addPart('tail', tg, [-0.45, 0.05, 0]);
  }

  private buildHeadlights() {
    this.headSegs.length = 0;
    const sig = this.build.sig;
    const col = LAMP_TINTS[this.build.ltint].c;
    for (const g of this.headGroups) {
      for (const c of g.children.slice(1)) {
        g.remove(c);
        if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        const mat = (c as THREE.Mesh).material as THREE.Material | undefined;
        mat?.dispose();
      }
      const s = g.userData.s as number;
      const arr: [number, number, number, number][] = [];
      if (sig === 'blade') for (let i = 0; i < 5; i++) arr.push([0, 0.018, 0.075, -0.17 + i * 0.085]);
      else if (sig === 'quad') for (let i = 0; i < 4; i++) arr.push([0, 0.05, 0.05, -0.15 + i * 0.1]);
      else
        for (let i = 0; i < 7; i++) {
          const t = i / 6;
          arr.push([Math.sin(t * Math.PI) * 0.028 - 0.01, 0.022, 0.05, -0.18 + t * 0.36]);
        }
      arr.forEach(([y, h, w, z], i) => {
        const L = this.lightSeg(boxAt(0.02, h, w, 0.032, y, z * s), col);
        L.m.name = `seg_${i}`;
        g.add(L.m);
        L.sp.position.set(0.06, y, z * s);
        g.add(L.sp);
        this.headSegs.push(L);
      });
    }
  }

  private buildExtras() {
    for (const s of [1, -1]) {
      const L = this.lightSeg(
        new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24)
          .rotateZ(Math.PI / 2)
          .translate(2.41, 0.42, s * 0.72),
        '#fff1c8',
      );
      L.sp.position.set(2.47, 0.42, s * 0.72);
      this.fog.add(L.m, L.sp);
      this.fogSegs.push(L);
    }
    this.fog.name = 'fog';
    this.fog.visible = false;
    this.shell.add(this.fog);
    this.hitch.name = 'hitch';
    this.hitch.position.set(-2.36, 0.3, 0);
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

  private buildInterior(carpetMat: THREE.Material) {
    const cabinPart = (name: string, objs: THREE.Object3D[], off: [number, number, number]) => {
      const g = new THREE.Group();
      objs.forEach((o) => g.add(o));
      return this.addPart(name, g, off, this.cabin);
    };
    const seatGeos = (x: number, z: number, w: number) => [
      boxAt(0.5, 0.12, w, x, 0.77, z),
      boxAt(0.12, 0.46, w, x - 0.3, 0.98, z, 0.2),
    ];
    for (const z of [0.4, -0.4]) {
      const [a, b] = seatGeos(-0.28, z, 0.46);
      cabinPart(
        z > 0 ? 'seat_fr' : 'seat_fl',
        [
          mesh(a!, this.seatMat),
          mesh(b!, this.seatMat),
          mesh(boxAt(0.09, 0.13, 0.26, -0.66, 1.25, z, 0.2), this.seatMat),
        ],
        [0, 0.45, 0],
      );
    }
    {
      const [a, b] = seatGeos(-1.18, 0, 1.3);
      cabinPart(
        'seat_rear',
        [
          mesh(a!, this.seatMat),
          mesh(b!, this.seatMat),
          mesh(boxAt(0.08, 0.11, 0.26, -1.56, 1.17, 0.38, 0.22), this.seatMat),
          mesh(boxAt(0.08, 0.11, 0.26, -1.56, 1.17, -0.38, 0.22), this.seatMat),
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
    screen.position.set(0.335, 1.06, 0);
    screen.rotation.set(0, -Math.PI / 2, 0);
    screen.rotateX(-0.25);
    const dashTrim = mesh(boxAt(0.022, 0.06, 1.5, 0.315, 0.9, 0), this.trimMat);
    dashTrim.name = 'dash_trim';
    const ambStrip = new THREE.Mesh(boxAt(0.012, 0.012, 1.5, 0.307, 0.855, 0), ambDash);
    ambStrip.name = 'amb_dash';
    cabinPart(
      'dash',
      [mesh(boxAt(0.3, 0.24, 1.56, 0.47, 0.88, 0), this.dashMat), dashTrim, ambStrip, screen],
      [0.2, 0.32, 0],
    );
    cabinPart(
      'console',
      [
        mesh(boxAt(0.9, 0.14, 0.2, -0.15, 0.8, 0), this.dashMat),
        mesh(boxAt(0.5, 0.012, 0.16, -0.05, 0.873, 0), this.trimMat),
      ],
      [0, 0.26, 0],
    );
    cabinPart('carpet', [mesh(boxAt(2.4, 0.01, 1.6, -0.55, 0.705, 0), carpetMat, false)], [0, 0.1, 0]);
    for (const s of [1, -1]) {
      const strip = new THREE.Mesh(boxAt(1.9, 0.012, 0.012, -0.5, 0.935, s * 0.775), ambDoor);
      strip.name = s > 0 ? 'amb_door_r' : 'amb_door_l';
      cabinPart(
        s > 0 ? 'card_r' : 'card_l',
        [mesh(boxAt(2.3, 0.24, 0.025, -0.6, 0.81, s * 0.79), this.seatMat), strip],
        [0, 0.1, s * 0.45],
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
    steer.position.set(0.22, 0.97, 0.4);
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

  private buildWheel(w: Wheel) {
    const R = RIM_RADIUS[`${this.build.size}`];
    const tube = (0.37 - R) / 2;
    for (const o of [w.tire, w.barrel, w.face]) {
      if (!o) continue;
      w.spin.remove(o);
      o.traverse((c) => (c as THREE.Mesh).geometry?.dispose());
    }
    const tire = mesh(new THREE.TorusGeometry(R + tube, tube, 18, 64), this.tireMat);
    tire.name = 'tyre';
    tire.scale.z = 0.25 / (2 * tube);
    const barrel = mesh(
      new THREE.CylinderGeometry(R, R, 0.22, 48, 1, true).rotateX(Math.PI / 2),
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
    const spec: [string, number, number][] = [
      ['wheel_fr', 1.41, 1],
      ['wheel_fl', 1.41, -1],
      ['wheel_rr', -1.45, 1],
      ['wheel_rl', -1.45, -1],
    ];
    for (const [name, x, s] of spec) {
      const holder = new THREE.Group();
      holder.position.set(x, 0.37, s * 0.84);
      if (s < 0) holder.rotation.y = Math.PI;
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
      this.addPart(name, holder, [0, 0, s * 0.75], this.root);
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
    this.P.steering!.base.z = REGIONS[b.region].drive === 'RHD' ? 0.4 : -0.4;
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
    return 0.3 + (1 - this.build.vlt / 100) * 0.66;
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
      z: REGIONS[this.build.region].drive === 'RHD' ? 0.4 : -0.4,
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
