import { StrictMode, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { applyTheme, watchSystemTheme } from '@/lib/theme';

// Counting a page view is not part of showing it. Importing the SDK lazily keeps
// it out of the chunk the first paint waits on, and starting it on idle means a
// slow connection renders the page before it fetches the counter.
function startAnalyticsWhenIdle(): void {
  const start = () => {
    void import('@/lib/analytics').then((m) => m.initAmplitude());
  };
  const idle = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback;
  if (typeof idle === 'function') idle(start, { timeout: 3000 });
  else window.setTimeout(start, 1200);
}

export function mountPage(page: ReactNode): void {
  applyTheme('system');
  watchSystemTheme('system');

  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root');
  const tree = <StrictMode>{page}</StrictMode>;
  if (root.hasChildNodes()) {
    hydrateRoot(root, tree);
  } else {
    createRoot(root).render(tree);
  }

  startAnalyticsWhenIdle();
}
