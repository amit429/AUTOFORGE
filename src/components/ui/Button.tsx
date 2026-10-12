'use client';

import gsap from 'gsap';
import { forwardRef, useImperativeHandle, useRef, type ButtonHTMLAttributes } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { Icon } from './Icon';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  magnetic?: boolean;
  arrow?: boolean;
  back?: boolean;
  cursor?: string;
  size?: 'md' | 'sm';
}

/** Pill button. Primary fills with clay from below on hover; magnetic ones lean towards the pointer. */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', magnetic, arrow, back, cursor, size = 'md', className, children, ...rest },
  ref,
) {
  const el = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => el.current as HTMLButtonElement);
  const move = (e: React.PointerEvent) => {
    if (!magnetic || prefersReducedMotion() || !el.current) return;
    const r = el.current.getBoundingClientRect();
    gsap.to(el.current, {
      x: (e.clientX - r.left - r.width / 2) * 0.22,
      y: (e.clientY - r.top - r.height / 2) * 0.32,
      duration: 0.4,
      ease: 'power3.out',
    });
  };
  const leave = () => {
    if (magnetic && el.current) gsap.to(el.current, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,.4)' });
  };
  return (
    <button
      ref={el}
      className={`${styles.btn} ${styles[variant]} ${size === 'sm' ? styles.sm : ''} ${className ?? ''}`}
      data-cursor={cursor}
      onPointerMove={move}
      onPointerLeave={leave}
      {...rest}
    >
      {back && <Icon name="back" className={styles.arr} />}
      {children}
      {arrow && <Icon name="arr" className={styles.arr} />}
    </button>
  );
});
