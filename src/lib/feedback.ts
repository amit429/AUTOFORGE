/** Small physical feedback effects for selections: ripple + particle burst, and the locked shake. */
import gsap from 'gsap';
import { prefersReducedMotion } from './motion';

export function shake(el: Element | null) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(el, { x: 0 }, { keyframes: { x: [-7, 7, -5, 5, -2, 0] }, duration: 0.45, ease: 'none' });
}

/** A ripple on the swatch disc and ten particles in the swatch colour. */
export function burst(button: HTMLElement, colour?: string) {
  if (prefersReducedMotion()) return;
  const disc = button.querySelector<HTMLElement>('[data-disc]');
  const col =
    colour ||
    getComputedStyle(button).getPropertyValue('--c').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--clay').trim();
  if (disc) {
    const r = document.createElement('span');
    r.style.cssText = `position:absolute;left:50%;top:27px;width:46px;height:46px;margin:-23px;border-radius:50%;border:2px solid ${col};pointer-events:none`;
    button.appendChild(r);
    gsap.fromTo(
      r,
      { scale: 1, opacity: 0.9 },
      { scale: 2, opacity: 0, duration: 0.7, ease: 'expo.out', onComplete: () => r.remove() },
    );
  }
  const rc = (disc ?? button).getBoundingClientRect();
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('i');
    p.style.cssText = `position:fixed;left:${rc.left + rc.width / 2 - 2.5}px;top:${rc.top + rc.height / 2 - 2.5}px;width:5px;height:5px;border-radius:50%;background:${col};z-index:120;pointer-events:none`;
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2;
    const d = 26 + Math.random() * 34;
    gsap.to(p, {
      x: Math.cos(a) * d,
      y: Math.sin(a) * d,
      opacity: 0,
      scale: 0.3,
      duration: 0.7 + Math.random() * 0.4,
      ease: 'expo.out',
      onComplete: () => p.remove(),
    });
  }
}
