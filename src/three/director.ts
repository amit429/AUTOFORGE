/**
 * The stage director: owns the studio, car and camera rig, and turns store and screen changes
 * into camera moves, explode/cutaway tweens and part transitions. Plain TypeScript so the
 * prototype's GSAP choreography ports one to one; React only creates, ticks and disposes it.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { STEPS } from '@/data/options';
import { on } from '@/lib/bus';
import { dur, isMobile, prefersReducedMotion } from '@/lib/motion';
import { effectiveTheme } from '@/lib/theme';
import { isCabinStep, useBuild, type View } from '@/store/build';
import { useUi, type Screen } from '@/store/ui';
import { HOTSPOTS, PART_LABELS } from './anchors';
import { CameraRig, POSES, type FrameName } from './camera';
import { CarModel } from './car/CarModel';
import { PAINT_DEMO, storyAt } from './story';
import { LIGHTS, buildStudio, studioEnvironment, themeStudio, type Studio } from './studio';

export interface OverlayElements {
  hotspots: (HTMLButtonElement | null)[];
  labels: (HTMLButtonElement | null)[];
  lines: (SVGLineElement | null)[];
  dots: (SVGCircleElement | null)[];
  /** Shows or hides the exploded-view labels with their entrance animation. */
  setLabelsOn: (on: boolean) => void;
}

export const orbitAllowed = (screen: Screen, view: View) =>
  (screen === 'config' && view !== 'blueprint') || screen === 'summary';

const frameOf = (s: Screen): FrameName =>
  s === 'config' ? 'config' : s === 'summary' ? 'summary' : s === 'region' ? 'region' : 'none';

const stepId = () => STEPS[useBuild.getState().step]?.id ?? 'paint';

export class StageDirector {
  readonly rig = new CameraRig();
  readonly studio: Studio;
  readonly car: CarModel;
  private env: THREE.Texture;
  private story = { p: 0, intro: 0, demoOn: false, demoI: 0, demoCall: null as gsap.core.Tween | null };
  private cleanups: (() => void)[] = [];
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();
  private centre = new THREE.Vector3(0, 0.7, 0);

  constructor(
    private gl: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private overlays: OverlayElements,
  ) {
    this.studio = buildStudio(isMobile());
    this.car = new CarModel(useBuild.getState().build, (lightsOn) => useUi.setState({ lightsOn }));
    this.env = studioEnvironment();
    scene.environment = this.env;
    scene.add(this.studio.group, this.car.root);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;

    this.watchTheme();
    this.watchInput();
    this.watchStores();
    this.watchBus();
    this.enter(useUi.getState().screen, null);
    if (useUi.getState().introStarted) this.story.intro = 1;
  }

  /* ------------------------------------------------------------- wiring */

  private watchTheme() {
    const apply = () => {
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      themeStudio(this.studio, this.gl, effectiveTheme() === 'dark', ink);
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    window.addEventListener('halden:theme', apply);
    this.cleanups.push(() => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('halden:theme', apply);
    });
  }

  private watchInput() {
    const el = this.gl.domElement;
    const rig = this.rig;
    const ok = () => orbitAllowed(useUi.getState().screen, useBuild.getState().view);
    const down = (e: PointerEvent) => {
      if (!ok()) return;
      rig.pointerDown(e.clientX, e.clientY);
      el.setPointerCapture(e.pointerId);
      document.documentElement.classList.add('grabbing');
    };
    const move = (e: PointerEvent) => rig.pointerMove(e.clientX, e.clientY);
    const up = () => {
      rig.pointerUp();
      document.documentElement.classList.remove('grabbing');
    };
    const wheel = (e: WheelEvent) => {
      if (!ok()) return;
      e.preventDefault();
      rig.zoom(e.deltaY);
    };
    const key = (e: KeyboardEvent) => {
      if (useUi.getState().screen !== 'config') return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'button' || tag === 'textarea') return;
      if (e.key === 'ArrowLeft') rig.nudge(0.35);
      if (e.key === 'ArrowRight') rig.nudge(-0.35);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    this.cleanups.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
    });
  }

  private watchStores() {
    const unUi = useUi.subscribe((s, p) => {
      if (s.screen !== p.screen) this.enter(s.screen, p.screen);
      if (s.introStarted && !p.introStarted)
        gsap.to(this.story, { intro: 1, duration: dur(2.6), ease: 'power3.out' });
    });
    const unBuild = useBuild.subscribe((s, p) => {
      if (s.change.seq !== p.change.seq && s.change.keys.length)
        this.car.sync(s.build, s.change.keys, s.change.animate && !prefersReducedMotion());
      if (useUi.getState().screen !== 'config') return;
      if (s.step !== p.step) {
        this.applyView(s.view, false);
        this.rig.flyTo(POSES[STEPS[s.step]?.id ?? 'paint']);
      } else if (s.view !== p.view) this.applyView(s.view, true);
    });
    this.cleanups.push(unUi, unBuild);
  }

  private watchBus() {
    const car = this.car;
    this.cleanups.push(
      on('welcome', () => car.welcome()),
      on('lights', (onOff) => (onOff ? car.welcome() : car.setLights(false))),
      on('spin', (turns) => void (!prefersReducedMotion() && this.rig.spin(turns))),
      on('resetCamera', () => {
        const pose = useBuild.getState().view === 'exploded' ? POSES.exploded : POSES[stepId()];
        this.rig.flyTo(pose, 1.2);
      }),
      on('previewPaint', (pp) => car.previewPaint(pp.colour, pp.pattern, pp.patternColour, pp.duration)),
      on('restorePaint', () => car.restorePaint(true)),
    );
  }

  /* ---------------------------------------------------------- direction */

  private startDemo() {
    const st = this.story;
    st.demoOn = true;
    const next = () => {
      if (!st.demoOn) return;
      const d = PAINT_DEMO[st.demoI++ % PAINT_DEMO.length]!;
      this.car.previewPaint(d[0], d[1], d[2], 1.4);
      st.demoCall = gsap.delayedCall(2.3, next);
    };
    next();
  }

  private stopDemo(restore: boolean) {
    const st = this.story;
    if (!st.demoOn) return;
    st.demoOn = false;
    st.demoCall?.kill();
    if (restore) this.car.restorePaint(true);
  }

  private applyView(v: View, fly: boolean) {
    const parts = this.car.parts;
    const exT = v === 'exploded' ? 1 : 0;
    if (parts.some((p) => p.e !== exT))
      gsap.to(parts, {
        e: exT,
        duration: dur(1.35),
        ease: 'power3.inOut',
        stagger: { each: dur(0.022), from: exT ? 'random' : 'end' },
        overwrite: 'auto',
      });
    gsap.to(this.car.fx, {
      cut: v === 'cabin' ? 1 : 0,
      duration: dur(1.2),
      ease: 'power3.inOut',
      overwrite: 'auto',
    });
    if (v === 'exploded')
      gsap.delayedCall(
        dur(1.1),
        () => useBuild.getState().view === 'exploded' && this.overlays.setLabelsOn(true),
      );
    else this.overlays.setLabelsOn(false);
    gsap.to(this.gl.domElement, { opacity: v === 'blueprint' ? 0 : 1, duration: dur(0.5) });
    if (!fly) return;
    const id = stepId();
    const cab = isCabinStep(useBuild.getState().step);
    if (v === 'exploded') this.rig.flyTo(POSES.exploded, 1.6);
    else if (v === 'cabin') this.rig.flyTo(cab ? POSES[id] : POSES.cabin);
    else if (v === 'studio') this.rig.flyTo(cab ? POSES.paint : POSES[id]);
  }

  private enter(to: Screen, from: Screen | null) {
    const car = this.car;
    const rig = this.rig;
    if (from === 'landing') {
      this.stopDemo(false);
      gsap.to(car.parts, { e: 0, duration: dur(0.9), ease: 'power3.inOut', overwrite: 'auto' });
      gsap.to(car.fx, { cut: 0, duration: dur(0.9), ease: 'power3.inOut', overwrite: 'auto' });
    }
    if (from === 'config' && to !== 'config') {
      this.overlays.setLabelsOn(false);
      gsap.to(this.gl.domElement, { opacity: 1, duration: dur(0.4) });
      if (useBuild.getState().view !== 'studio') {
        gsap.killTweensOf(car.parts);
        gsap.killTweensOf(car.fx, 'cut');
        for (const p of car.parts) p.e = 0;
        car.fx.cut = 0;
        useBuild.setState({ view: 'studio' });
      }
    }
    if (to === 'landing') {
      this.story.p = useUi.getState().storyT;
      car.restorePaint(false);
    }
    if (to === 'region') {
      rig.flyTo(POSES.regionScreen, 1.6);
      rig.setFrame('region');
    }
    if (to === 'config') {
      car.restorePaint(true);
      rig.setFrame('config');
      rig.flyTo(POSES[stepId()], 1.7);
      rig.idle = 0;
      const { view, step } = useBuild.getState();
      const v: View = isCabinStep(step) && view === 'studio' ? 'cabin' : view;
      this.applyView(v, false);
      if (v !== view) useBuild.setState({ view: v });
    }
    if (to === 'summary') {
      car.restorePaint(false);
      rig.setFrame('summary');
      rig.flyTo(POSES.summary, 2);
      if (!prefersReducedMotion()) {
        const { key, hemi } = this.studio;
        gsap.fromTo(
          key,
          { intensity: LIGHTS.key * 0.07 },
          { intensity: LIGHTS.key, duration: 2.6, ease: 'power2.inOut' },
        );
        gsap.fromTo(
          hemi,
          { intensity: LIGHTS.hemi * 0.11 },
          { intensity: LIGHTS.hemi, duration: 2.6, ease: 'power2.inOut' },
        );
      }
      gsap.delayedCall(dur(1.1), () => car.welcome());
    }
  }

  resize() {
    const s = useUi.getState().screen;
    if (s !== 'landing') this.rig.setFrame(frameOf(s), 0);
  }

  /* -------------------------------------------------------------- frame */

  frame(delta: number, t: number, W: number, H: number) {
    const dt = Math.min(delta, 0.05);
    const { screen, storyT } = useUi.getState();
    const { view } = useBuild.getState();
    const { car, rig, story: st } = this;

    if (screen === 'landing') {
      st.p += (storyT - st.p) * Math.min(1, dt * 4.5);
      const k = storyAt(st.p, st.intro, isMobile());
      Object.assign(rig.cam, {
        theta: k.theta,
        phi: k.phi,
        r: k.r,
        ty: k.ty,
        tx: k.tx,
        tz: 0,
        ox: k.ox,
        oy: k.oy,
      });
      for (const p of car.parts) p.e = k.explode;
      car.fx.cut = k.cut;
      const near = Math.abs(st.p - 1) < 0.45 && st.intro > 0.5;
      if (near && !st.demoOn) this.startDemo();
      else if (!near && st.demoOn) this.stopDemo(true);
    }

    const auto =
      prefersReducedMotion() || rig.dragging
        ? 0
        : screen === 'summary'
          ? 0.14
          : screen === 'config' && view === 'studio' && rig.idle > 8
            ? 0.05
            : 0;
    rig.step(dt, { orbit: orbitAllowed(screen, view), autoSpin: auto });
    car.tick(t);
    this.studio.turntable.rotation.y += dt * 0.03;
    rig.apply(this.camera, W, H);
    this.camera.updateMatrixWorld();
    this.updateOverlays(screen, view, W, H);
  }

  private project(p: THREE.Vector3, W: number, H: number) {
    this.v.copy(p).project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * W, y: (-this.v.y * 0.5 + 0.5) * H, z: this.v.z };
  }

  private updateOverlays(screen: Screen, view: View, W: number, H: number) {
    const { car, overlays } = this;
    const show = screen === 'config' && view === 'studio' && car.fx.cut < 0.05;
    const cp = this.camera.position;
    const shellY = car.shell.position.y;
    HOTSPOTS.forEach((h, i) => {
      const el = overlays.hotspots[i];
      if (!el) return;
      const w = this.w.set(h.p[0], h.p[1] + shellY, h.p[2]);
      const facing = h.n[0] * (cp.x - w.x) + h.n[1] * (cp.y - w.y) + h.n[2] * (cp.z - w.z) > 0;
      const s = this.project(w, W, H);
      const vis = show && facing && s.z < 1;
      el.style.transform = `translate(${s.x}px,${s.y}px)`;
      el.style.opacity = vis ? '1' : '0';
      el.style.pointerEvents = vis ? 'auto' : 'none';
      el.tabIndex = vis ? 0 : -1;
    });
    if (view !== 'exploded' || screen !== 'config') return;
    const c = this.project(this.centre, W, H);
    const mob = isMobile();
    PART_LABELS.forEach((l, i) => {
      const el = overlays.labels[i];
      const ln = overlays.lines[i];
      const dot = overlays.dots[i];
      const part = car.P[l.part];
      if (!el || !ln || !dot || !part) return;
      const w = this.w.set(...l.p).addScaledVector(part.off, part.e);
      w.y += part.lift + (l.onRoot ? 0 : shellY);
      const a = this.project(w, W, H);
      const dx = a.x - c.x;
      const dy = a.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      const ex = a.x + (dx / len) * (mob ? 40 : 80);
      const ey = a.y + (dy / len) * (mob ? 30 : 46);
      el.style.transform = `translate(${ex}px,${ey}px) translate(${dx >= 0 ? '4px' : 'calc(-100% - 4px)'},-50%)`;
      ln.setAttribute('x1', String(a.x));
      ln.setAttribute('y1', String(a.y));
      ln.setAttribute('x2', String(ex));
      ln.setAttribute('y2', String(ey));
      dot.setAttribute('cx', String(a.x));
      dot.setAttribute('cy', String(a.y));
    });
  }

  dispose() {
    this.stopDemo(false);
    this.cleanups.forEach((f) => f());
    gsap.killTweensOf([this.rig.cam, this.story, this.studio.key, this.studio.hemi, this.gl.domElement]);
    this.scene.remove(this.studio.group, this.car.root);
    this.scene.environment = null;
    this.env.dispose();
    this.car.dispose();
    this.studio.dispose();
  }
}
