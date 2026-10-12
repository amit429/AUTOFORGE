'use client';

import { useEffect, useRef, useState } from 'react';
import { CUSTOM_PAINT_USD } from '@/data/options';
import { priceTag } from '@/engine';
import { hexToHsl, hslToHex } from '@/lib/color';
import { burst } from '@/lib/feedback';
import { useBuild } from '@/store/build';
import { Button } from '@/components/ui/Button';
import styles from './ColourRing.module.css';
import ctl from './controls.module.css';

/**
 * Hue ring + lightness slider. For ambient light the cabin updates live while dragging and the
 * release is one history entry; for paint to sample the colour is applied with a button.
 */
export function ColourRing({ kind }: { kind: 'custom' | 'amb' }) {
  const isAmb = kind === 'amb';
  const sat = isAmb ? 0.95 : 0.6;
  const startHex = useBuild((s) => (isAmb ? s.build.amb : s.build.custom));
  const region = useBuild((s) => s.build.region);
  const fromHex = (x: string) => {
    const { h, l } = hexToHsl(x);
    return { h, l: Math.min(isAmb ? 0.8 : 0.88, Math.max(isAmb ? 0.35 : 0.12, l)) };
  };
  // Paint to sample previews locally until applied; ambient light is live, so it follows the store.
  const [local, setLocal] = useState(() => fromHex(startHex));
  const hsl = isAmb ? fromHex(startHex) : local;
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const dragStart = useRef<string | null>(null);
  const hex = hslToHex(hsl.h, sat, hsl.l);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    for (let a = 0; a < 360; a++) {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${a},${isAmb ? 95 : 70}%,${isAmb ? 58 : 50}%)`;
      ctx.lineWidth = 30;
      ctx.arc(132, 132, 116, ((a - 1) * Math.PI) / 180, ((a + 1) * Math.PI) / 180);
      ctx.stroke();
    }
  }, [isAmb]);

  const live = (next: { h: number; l: number }) => {
    if (!isAmb) setLocal(next);
    else {
      if (dragStart.current === null) dragStart.current = useBuild.getState().build.amb;
      useBuild.getState().setLive('amb', hslToHex(next.h, sat, next.l));
    }
  };
  const commit = () => {
    if (isAmb && dragStart.current !== null) useBuild.getState().commitLive('amb', dragStart.current);
    dragStart.current = null;
  };

  const hueFrom = (e: React.PointerEvent) => {
    const rc = box.current!.getBoundingClientRect();
    return (
      (Math.atan2(e.clientY - rc.top - rc.height / 2, e.clientX - rc.left - rc.width / 2) / (Math.PI * 2) +
        1) %
      1
    );
  };

  const size = 132;
  const a = hsl.h * Math.PI * 2;
  const r = size * 0.44;

  return (
    <div className={styles.wrap}>
      <div
        ref={box}
        className={styles.hue}
        role="slider"
        tabIndex={0}
        aria-label={isAmb ? 'Ambient light hue' : 'Paint to sample hue'}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsl.h * 360)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          live({ ...hsl, h: hueFrom(e) });
        }}
        onPointerMove={(e) =>
          e.currentTarget.hasPointerCapture(e.pointerId) && live({ ...hsl, h: hueFrom(e) })
        }
        onPointerUp={commit}
        onKeyDown={(e) => {
          const d =
            e.key === 'ArrowRight' || e.key === 'ArrowUp'
              ? 1 / 72
              : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
                ? -1 / 72
                : 0;
          if (d) {
            e.preventDefault();
            live({ ...hsl, h: (hsl.h + d + 1) % 1 });
          }
        }}
        onKeyUp={commit}
      >
        <canvas ref={canvas} width={264} height={264} />
        <div className={styles.core}>
          <div>
            <i style={{ background: hex }} />
            <span>{isAmb ? 'Drag' : 'Preview'}</span>
          </div>
        </div>
        <div
          className={styles.hd}
          style={{
            transform: `translate(${size / 2 + Math.cos(a) * r}px,${size / 2 + Math.sin(a) * r}px)`,
            background: hslToHex(hsl.h, sat, 0.5),
          }}
        />
      </div>
      <div className={styles.side}>
        <label className="muted" style={{ fontSize: 12.5 }} htmlFor={`hl-${kind}`}>
          Lightness
        </label>
        <input
          id={`hl-${kind}`}
          type="range"
          className={ctl.rng}
          min={isAmb ? 35 : 12}
          max={isAmb ? 80 : 88}
          value={Math.round(hsl.l * 100)}
          style={
            {
              '--p': `${((hsl.l * 100 - (isAmb ? 35 : 12)) / (isAmb ? 45 : 76)) * 100}%`,
            } as React.CSSProperties
          }
          onChange={(e) => live({ ...hsl, l: Number(e.target.value) / 100 })}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
        {isAmb ? (
          <small className="muted">Drag around the ring. The cabin updates as you go.</small>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={ctl.wide}
              onClick={(e) => {
                const el = e.currentTarget;
                const { build, set, snapshot } = useBuild.getState();
                if (build.paint === 'custom') set('custom', hex);
                else snapshot({ custom: hex, paint: 'custom' }, 'Paint to sample');
                burst(el, hex);
              }}
            >
              Use this colour
            </Button>
            <small className="muted">{priceTag(CUSTOM_PAINT_USD, region)}, mixed to your sample</small>
          </>
        )}
      </div>
    </div>
  );
}
