// The hero's WebGL figure. The React side is deliberately thin: a canvas in
// the tree, so the prerendered markup and the first client render agree, and
// an effect that pulls the three.js scene in as its own chunk and boots it.
// Everything that paints lives in `hero-planet.ts`.
import { useEffect, useRef } from 'react';
import type { HeroSceneHandle } from './hero-planet';
import { cn } from '@/lib/utils';

/**
 * Whether the scene can run here at all. Without WebGL the hero keeps its copy
 * and its buttons and simply has no figure behind them.
 */
export function canRunScene(): boolean {
  return typeof WebGLRenderingContext !== 'undefined';
}

interface Props {
  /**
   * What the figure shows. It carries the page's claim rather than decorating
   * a paragraph, so it is announced as an image instead of hidden.
   */
  'aria-label': string;
  className?: string;
}

export function HeroScene({ 'aria-label': label, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canRunScene()) return;
    let alive = true;
    let handle: HeroSceneHandle | undefined;
    let observer: MutationObserver | undefined;
    import('./hero-planet')
      .then((m) => {
        // Unmounted while the chunk was loading: never boot into a dead node.
        if (!alive) return;
        const boot = () => {
          handle?.dispose();
          handle = m.bootHeroScene(host.current!, canvas.current!);
        };
        boot();
        // The stage is read at boot. A live theme flip — the OS switching
        // while the tab is open, or the site's own switcher — is rare enough
        // that rebooting the scene is simpler and safer than threading a
        // recolour through every material and the baked instance buffers.
        //
        // The accent is not watched, and that is on purpose: the land is a
        // ten-step scale of tone rather than an accent, and the site's four
        // accents have no ten-step scale to offer. They reach the copy, the
        // buttons and the chips instead.
        let last = m.isDark();
        observer = new MutationObserver(() => {
          const now = m.isDark();
          if (now === last) return;
          last = now;
          boot();
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class'],
        });
      })
      // A chunk that fails to load (offline, a blocker) costs the figure, not
      // the page.
      .catch(() => undefined);
    return () => {
      alive = false;
      observer?.disconnect();
      handle?.dispose();
    };
  }, []);

  return (
    <div
      ref={host}
      role="img"
      aria-label={label}
      className={cn('relative h-full w-full', className)}
    >
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}
