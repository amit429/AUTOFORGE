'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import gsap from 'gsap';
import { useState } from 'react';
import { STEPS } from '@/data/options';
import { dur } from '@/lib/motion';
import { useBuild } from '@/store/build';
import { useUi } from '@/store/ui';
import { HOTSPOT_LABELS, PART_LABEL_TEXT } from '@/three/anchors';
import { useGo } from '@/components/shell/useGo';
import { BlueprintView } from './BlueprintView';
import { orbitAllowed, type OverlayElements } from '@/three/director';
import { Scene } from './Scene';
import styles from './Stage.module.css';

const stepIndex = (id: string) => STEPS.findIndex((s) => s.id === id);

/** DOM nodes the director positions every frame. The stage is mounted once, so one registry. */
const overlays: OverlayElements = {
  hotspots: [],
  labels: [],
  lines: [],
  dots: [],
  setLabelsOn(on) {
    PART_LABEL_TEXT.forEach((_, i) => {
      const el = overlays.labels[i];
      const ln = overlays.lines[i];
      const dot = overlays.dots[i];
      if (!el || !ln || !dot) return;
      gsap.killTweensOf([el, ln, dot]);
      el.style.pointerEvents = on ? 'auto' : 'none';
      el.tabIndex = on ? 0 : -1;
      if (on) {
        gsap.to([ln, dot], { opacity: 1, duration: dur(0.4), delay: i * dur(0.05) });
        gsap.fromTo(
          el,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: dur(0.5), delay: 0.1 + i * dur(0.05), ease: 'expo.out' },
        );
      } else gsap.to([el, ln, dot], { opacity: 0, duration: dur(0.2) });
    });
  },
};

/** The 3D studio shared by every screen. It stays mounted across routes and pauses on /blueprint. */
export function Stage() {
  const screen = useUi((s) => s.screen);
  const view = useBuild((s) => s.view);
  const orbit = orbitAllowed(screen, view);
  const go = useGo();
  // Pixel ratio starts capped at 2 and drops when the frame rate cannot hold.
  const [dpr, setDpr] = useState(2);

  return (
    <div
      className={`${styles.stage} ${orbit ? styles.grab : ''}`}
      data-cursor={orbit ? 'Drag' : undefined}
      style={{ visibility: screen === 'doc' ? 'hidden' : 'visible' }}
    >
      <Canvas
        className={styles.gl}
        frameloop={screen === 'doc' ? 'never' : 'always'}
        dpr={[1, dpr]}
        shadows="percentage"
        camera={{ fov: 30, near: 0.1, far: 120, position: [0, 3, 18] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        role="img"
        aria-label="3D view of your car. Drag to rotate, scroll to zoom, or use the arrow keys."
      >
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(2)}
          flipflops={3}
          onFallback={() => setDpr(1)}
        />
        <Scene overlays={overlays} />
      </Canvas>
      <svg className={styles.leaders} aria-hidden="true">
        {PART_LABEL_TEXT.map((l, i) => (
          <g key={l.title}>
            <line ref={(el) => void (overlays.lines[i] = el)} style={{ opacity: 0 }} />
            <circle ref={(el) => void (overlays.dots[i] = el)} r={3} style={{ opacity: 0 }} />
          </g>
        ))}
      </svg>
      <div className={styles.labels}>
        {PART_LABEL_TEXT.map((l, i) => (
          <button
            key={l.title}
            ref={(el) => void (overlays.labels[i] = el)}
            className={styles.lbl}
            style={{ opacity: 0, pointerEvents: 'none' }}
            tabIndex={-1}
            onClick={() => {
              useBuild.getState().setView('studio');
              useBuild.getState().goStep(stepIndex(l.step));
              // From the reveal, a label takes you back into the configurator at that part.
              if (useUi.getState().screen === 'summary') void go('config');
            }}
          >
            <span className={styles.card}>
              <b>{l.title}</b>
              <small>{l.sub}</small>
            </span>
          </button>
        ))}
      </div>
      <div className={styles.hotspots}>
        {HOTSPOT_LABELS.map((h, i) => (
          <button
            key={h.label}
            ref={(el) => void (overlays.hotspots[i] = el)}
            className={styles.hs}
            aria-label={h.label}
            tabIndex={-1}
            onClick={() => useBuild.getState().goStep(stepIndex(h.step))}
          >
            <span>{h.label}</span>
          </button>
        ))}
      </div>
      <BlueprintView />
    </div>
  );
}
