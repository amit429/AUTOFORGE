'use client';

/**
 * Option controls. Every control renders engine output: availability and reasons come from
 * `evaluate()`, prices from `priceTag()`. Selection markers are shared-layout elements so the
 * ring or pill travels between options instead of reappearing.
 */
import { motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { REGIONS, type Build, type OptionKey, type RegionId } from '@/data/options';
import { KEY_NAMES } from '@/engine';
import { spring } from '@/lib/motion';
import { drawPattern, type PreviewMode } from '@/lib/patterns';
import { useBuild } from '@/store/build';
import { choose, useEm } from './useEngine';
import styles from './controls.module.css';

/** A titled group in the panel, with the current choice and price on the right. */
export function Block({ title, em, children }: { title?: string; em?: OptionKey; children: ReactNode }) {
  return (
    <div className={styles.blk}>
      {(title || em) && (
        <h4>
          <span>{title}</span>
          {em && <EmText k={em} />}
        </h4>
      )}
      {children}
    </div>
  );
}

function EmText({ k }: { k: OptionKey }) {
  const { name, price } = useEm(k);
  return (
    <em>
      {name}
      {price && <span className="muted"> {price}</span>}
    </em>
  );
}

export function Note({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={styles.note} style={style}>
      {children}
    </div>
  );
}

const isOn = (b: Build, k: OptionKey, v: unknown) => String(b[k]) === String(v);

export interface SegOption {
  v: string | number;
  label: string;
  why?: string;
}

/** Segmented control with a sliding pill. */
export function Segmented<K extends OptionKey>({ k, options }: { k: K; options: SegOption[] }) {
  const build = useBuild((s) => s.build);
  return (
    <div className={styles.seg} role="radiogroup" aria-label={KEY_NAMES[k]}>
      {options.map((o) => {
        const on = isOn(build, k, o.v);
        return (
          <button
            key={o.v}
            role="radio"
            aria-checked={on}
            aria-disabled={o.why ? true : undefined}
            title={o.why}
            className={on ? styles.on : undefined}
            onClick={(e) => choose(k, o.v as Build[K], e.currentTarget, o.why)}
          >
            {o.label}
            {on && <motion.span layoutId={`pill-${k}`} className={styles.pill} transition={spring} />}
          </button>
        );
      })}
    </div>
  );
}

export interface SwatchItem {
  v: string;
  n: string;
  c: string;
  usdTag?: string;
  rg?: boolean;
  why?: string;
}

/** Sphere-shaded paint swatches with names, a regional dot and a travelling selection ring. */
export function Swatches<K extends OptionKey>({
  k,
  items,
  label,
}: {
  k: K;
  items: SwatchItem[];
  label?: string;
}) {
  const build = useBuild((s) => s.build);
  return (
    <div className={styles.swGrid} role="radiogroup" aria-label={label ?? KEY_NAMES[k]}>
      {items.map((it) => {
        const on = isOn(build, k, it.v);
        return (
          <button
            key={it.v}
            className={styles.sw}
            role="radio"
            aria-checked={on}
            aria-disabled={it.why ? true : undefined}
            aria-label={`${it.n}${it.usdTag ? `, ${it.usdTag}` : ''}${it.why ? `. ${it.why}` : ''}`}
            style={{ '--c': it.c } as React.CSSProperties}
            onClick={(e) => choose(k, it.v as Build[K], e.currentTarget, it.why)}
          >
            <span className={styles.c} data-disc />
            <span className={styles.nm}>{it.n}</span>
            {it.rg && <span className={styles.rx} title="Regional exclusive" />}
            {on && <motion.span layoutId={`ring-${k}`} className={styles.ring} transition={spring} />}
          </button>
        );
      })}
    </div>
  );
}

function PatternCanvas({
  id,
  a,
  b,
  mode,
  scale,
}: {
  id: number;
  a: string;
  b: string;
  mode: PreviewMode;
  scale: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPattern(ref.current, { id, a, b, mode, scale });
  }, [id, a, b, mode, scale]);
  return <canvas ref={ref} width={150} height={100} aria-hidden="true" />;
}

export interface CardItem {
  v: string;
  n: string;
  sub: string;
  rg?: RegionId;
  why?: string;
  /** Canvas pattern preview, or an SVG icon. */
  pattern?: { id: number; a: string; b: string; mode: PreviewMode; scale?: number };
  icon?: ReactNode;
}

/** Option cards with a live pattern preview (or an icon), used for liveries, quilts, trims and wheels. */
export function Cards<K extends OptionKey>({ k, items }: { k: K; items: CardItem[] }) {
  const build = useBuild((s) => s.build);
  return (
    <div className={styles.cards} role="radiogroup" aria-label={KEY_NAMES[k]}>
      {items.map((it) => {
        const on = isOn(build, k, it.v);
        return (
          <button
            key={it.v}
            className={`${styles.pc} ${on ? styles.on : ''}`}
            role="radio"
            aria-checked={on}
            aria-disabled={it.why ? true : undefined}
            aria-label={`${it.n}, ${it.sub}${it.why ? `. ${it.why}` : ''}`}
            onClick={(e) => choose(k, it.v as Build[K], e.currentTarget, it.why)}
          >
            {it.pattern ? (
              <PatternCanvas {...it.pattern} scale={it.pattern.scale ?? 1} />
            ) : (
              <span className={styles.ic}>{it.icon}</span>
            )}
            {it.rg && <span className={styles.rxTag}>{REGIONS[it.rg].n}</span>}
            <span>{it.n}</span>
            <em>{it.sub}</em>
            {on && <motion.span layoutId={`card-${k}`} className={styles.cardRing} transition={spring} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Range slider. While dragging it updates the build live without history; the release records
 * one history entry. `legalMin` draws the regional limit marker and blocks values below it.
 */
export function Range<K extends 'vlt' | 'livScale' | 'ambBri'>({
  k,
  min,
  max,
  step,
  label,
  legalMin,
  onBlocked,
}: {
  k: K;
  min: number;
  max: number;
  step: number;
  label: string;
  legalMin?: number;
  onBlocked?: () => void;
}) {
  const value = useBuild((s) => s.build[k]);
  const start = useRef<number | null>(null);
  const pct = ((value - min) / (max - min)) * 100;
  const begin = () => {
    if (start.current === null) start.current = useBuild.getState().build[k];
  };
  const end = () => {
    if (start.current === null) return;
    useBuild.getState().commitLive(k, start.current as Build[K]);
    start.current = null;
  };
  return (
    <input
      type="range"
      className={styles.rng}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      style={{ '--p': `${pct}%` } as React.CSSProperties}
      onPointerDown={begin}
      onKeyDown={begin}
      onFocus={begin}
      onChange={(e) => {
        begin();
        let v = Number(e.target.value);
        if (legalMin !== undefined && v < legalMin) {
          v = legalMin;
          onBlocked?.();
        }
        useBuild.getState().setLive(k, v as Build[K]);
      }}
      onPointerUp={end}
      onKeyUp={end}
      onBlur={end}
    />
  );
}

export function Toggle({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button className={styles.tg} role="switch" aria-checked={on} aria-label={label} onClick={onToggle}>
      <motion.i layout transition={{ type: 'spring', stiffness: 500, damping: 26 }} />
    </button>
  );
}

export { styles as controlStyles };
