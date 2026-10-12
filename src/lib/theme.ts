export type Theme = 'light' | 'dark';

const KEY = 'autoforge-theme';

/** Inline script that applies a saved theme before first paint, so there is no flash. */
export const themeBootScript = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function effectiveTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(next: Theme, animate: boolean) {
  const apply = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
    window.dispatchEvent(new CustomEvent('autoforge:theme', { detail: next }));
  };
  if (animate && 'startViewTransition' in document) document.startViewTransition(apply);
  else apply();
}
