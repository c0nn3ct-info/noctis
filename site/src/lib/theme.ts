export type Theme = 'light' | 'dark' | 'system';
export type Accent = 'neutral' | 'storm' | 'purple' | 'cyan';

export function applyAccent(accent: Accent): void {
  const root = document.documentElement;
  if (accent === 'neutral') root.removeAttribute('data-accent');
  else root.setAttribute('data-accent', accent);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(dark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
    root.classList.add(theme);
  }
}

let mql: MediaQueryList | null = null;
let mqlListener: ((ev: MediaQueryListEvent) => void) | null = null;

export function watchSystemTheme(theme: Theme): void {
  if (mql && mqlListener) {
    mql.removeEventListener('change', mqlListener);
    mql = null;
    mqlListener = null;
  }
  if (theme !== 'system') return;
  mql = window.matchMedia('(prefers-color-scheme: dark)');
  mqlListener = () => applyTheme('system');
  mql.addEventListener('change', mqlListener);
}
