/** Shared motion helpers. Reduced motion is read live so OS changes apply without reload. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Duration multiplier: near-instant when the user asks for reduced motion. */
export const dur = (seconds: number) => (prefersReducedMotion() ? 0.01 : seconds);

export const isMobile = () => typeof window !== 'undefined' && innerWidth <= 900;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Motion (motion/react) springs from the design system. */
export const spring = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const easeArrive = [0.22, 1, 0.36, 1] as const;
