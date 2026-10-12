'use client';

import { AnimatePresence, motion } from 'motion/react';
import { REGIONS } from '@/data/options';
import { spring } from '@/lib/motion';
import { useGo } from '@/components/shell/useGo';
import { Icon } from '@/components/ui/Icon';
import { useBuild } from '@/store/build';
import { useUi, type Screen } from '@/store/ui';
import { ThemeToggle } from './ThemeToggle';
import styles from './Header.module.css';

const NAV: { to: Screen; label: string }[] = [
  { to: 'landing', label: 'Home' },
  { to: 'config', label: 'Build' },
  { to: 'doc', label: 'Blueprint' },
];

/** Which nav item a screen belongs to. */
const navOf = (s: Screen): Screen => (s === 'region' || s === 'summary' ? 'config' : s);

export function Header() {
  const go = useGo();
  const screen = useUi((s) => s.screen);
  const regionChosen = useBuild((s) => s.regionChosen);
  const region = useBuild((s) => s.build.region);
  const active = navOf(screen);

  return (
    <header className={styles.top} data-header>
      <button className={styles.brand} aria-label="AutoForge home" onClick={() => go('landing')}>
        <svg viewBox="0 0 34 22" aria-hidden="true">
          <path d="M3 20 L13 3 L23 20 M7.5 13 H18.5" />
          <path d="M22 9 H32 M24 14.5 H31" />
        </svg>
        <span className={styles.word}>AUTOFORGE</span>
      </button>
      <nav className={styles.nav} aria-label="Sections">
        {NAV.map((n) => (
          <button
            key={n.to}
            className={active === n.to ? styles.on : undefined}
            aria-current={active === n.to ? 'page' : undefined}
            onClick={() => go(n.to)}
          >
            {n.label}
            {active === n.to && (
              <motion.span layoutId="nav-pill" className={styles.pill} transition={spring} />
            )}
          </button>
        ))}
      </nav>
      <div className={styles.right}>
        <AnimatePresence>
          {regionChosen && (
            <motion.button
              key="region"
              className={styles.chip}
              data-cursor="Change"
              aria-label={`Region: ${REGIONS[region].n}. Change region`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => go('region')}
            >
              <Icon name="pin" />
              <span className={styles.regionLabel}>{REGIONS[region].n}</span>
            </motion.button>
          )}
        </AnimatePresence>
        <ThemeToggle />
      </div>
    </header>
  );
}
