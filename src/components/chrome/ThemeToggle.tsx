'use client';

import { useEffect, useState } from 'react';
import { effectiveTheme, setTheme, type Theme } from '@/lib/theme';
import { prefersReducedMotion } from '@/lib/motion';
import { Icon } from '@/components/ui/Icon';
import styles from './Header.module.css';

export function ThemeToggle() {
  const [theme, setLocal] = useState<Theme | null>(null);

  useEffect(() => {
    const sync = () => setLocal(effectiveTheme());
    sync();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    window.addEventListener('halden:theme', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('halden:theme', sync);
    };
  }, []);

  const dark = theme === 'dark';
  return (
    <button
      className={`${styles.chip} ${styles.theme}`}
      aria-label={dark ? 'Switch to daylight studio' : 'Switch to night studio'}
      onClick={() => setTheme(dark ? 'light' : 'dark', !prefersReducedMotion())}
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}
