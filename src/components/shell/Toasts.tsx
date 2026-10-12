'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToasts, type Toast } from '@/store/toasts';
import styles from './Shell.module.css';

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  const life = t.kind === 'warn' ? 4.6 : 3.2;
  useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), life * 1000);
    return () => clearTimeout(id);
  }, [t.id, life, dismiss]);
  return (
    <motion.div
      layout
      className={`${styles.toast} ${t.kind === 'warn' ? styles.warn : ''}`}
      initial={{ y: 24, opacity: 0, scale: 0.92 }}
      animate={{ y: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 26 } }}
      exit={{ y: -8, opacity: 0, transition: { duration: 0.3 } }}
      role={t.kind === 'warn' ? 'alert' : 'status'}
    >
      <i>{t.kind === 'warn' ? <b>!</b> : <Icon name="check" />}</i>
      <span>{t.msg}</span>
      <span className={styles.tl} style={{ animationDuration: `${life}s` }} />
    </motion.div>
  );
}

/** Bottom-centre toasts: at most three, each with a draining progress line. */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className={styles.toasts} aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
