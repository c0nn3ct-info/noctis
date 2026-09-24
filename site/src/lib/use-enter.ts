// Section entrances, driven by where the section is rather than by a clock.
//
// The measurement that settled the approach: a fixed-duration entrance has no
// relationship to the scroll, so at an ordinary wheel speed every element began
// well below the fold and finished above the top of the screen, and whatever the
// reader caught was an arbitrary phase of it that then snapped to done. A
// `view()` timeline makes progress a function of position instead, so the
// element is always in the state its place on screen calls for.
//
// This module is the fallback for browsers without those timelines, playing the
// same two gestures off a timer. Both paths test the same way, so nothing can
// animate twice. The stylesheet's half lives in `globals.css` under
// "band entrances".
import { useEffect } from 'react';

export function scrollDriven(): boolean {
  // The method, not just the object: jsdom defines `CSS` without `supports`,
  // and `typeof CSS !== 'undefined'` alone let the call through and threw.
  return typeof CSS?.supports === 'function' && CSS.supports('animation-timeline', 'view()');
}

/**
 * The curve, read from the stylesheet so the keyframe rule and the keyframe
 * objects below cannot drift apart. Material's emphasized decelerate is what
 * the site already uses for something arriving; a fifth curve in a four-curve
 * system would be a consolidation finding, not a preference.
 */
function enterEase(): string {
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue('--ease-emph-decel')
    .trim();
  // A stylesheet that has not loaded yet still has to animate on something,
  // and the browser's own ease-out is the nearest weak relative of the token.
  return token || 'ease-out';
}

/**
 * The lead is zero. A positive bottom margin looks like the way to keep the
 * jump to the first keyframe off screen, but a band one viewport down would
 * then intersect at load and spend its arrival before the reader had moved.
 * Zero works because every band pads its own top by 48 to 96px, so the observer
 * fires as the band's first pixel crosses the fold and the first marked element
 * is still below it.
 */
const LEAD = '0px';

/** Under the 300ms an entrance can take before it reads as waiting. */
const DUR = 280;
const STEP = 45;
/**
 * Five steps of lead is a fifth of a second before the last item starts. Past
 * that a list reads as waiting rather than arriving.
 */
const MAX_DELAY = STEP * 5;

/**
 * The same gestures the stylesheet declares, kept in step by hand because a
 * keyframe rule and a keyframe object cannot share one definition. All of them
 * stay off the layout: the two clip gestures move nothing at all, and `soft`
 * moves a transform, which is composited.
 */
function keyframes(gesture: string, rtl: boolean): Keyframe[] {
  // The reworked landing page's gesture, borrowed from the aria2t site: a rise
  // under a hair of scale, with no edge for the eye to catch.
  if (gesture === 'soft') {
    return [
      { opacity: 0, transform: 'translateY(32px) scale(0.96)' },
      { opacity: 1, transform: 'none' },
    ];
  }
  // A sequence arrives along the line it is read on.
  if (gesture === 'fade') {
    return [{ opacity: 0 }, { opacity: 1 }];
  }
  if (gesture === 'wipe') {
    return [
      { opacity: 0, clipPath: rtl ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' },
      { opacity: 1, clipPath: 'inset(0 0 0 0)' },
    ];
  }
  // A block is printed rather than moved: the clip opens down the page. No
  // transform anywhere, so nothing arrives from a place it never occupied.
  return [
    { opacity: 0, clipPath: 'inset(0 0 45% 0)' },
    { opacity: 1, clipPath: 'inset(0 0 0 0)' },
  ];
}

/**
 * Everything in this band that arrives, in reading order, paired with the
 * gesture it arrives by. A container marked to stagger contributes its own
 * children rather than itself.
 */
function arrivals(section: Element): [Element, string][] {
  const out: [Element, string][] = [];
  for (const el of section.querySelectorAll('[data-enter], [data-enter-stagger]')) {
    const stagger = el.getAttribute('data-enter-stagger');
    if (stagger === null) {
      out.push([el, el.getAttribute('data-enter') || 'rise']);
      continue;
    }
    for (const child of el.children) out.push([child, stagger || 'rise']);
  }
  return out;
}

/**
 * Each band arrives once, when it first comes up, and never again.
 *
 * Transient keyframes through the Web Animations API rather than a class that
 * holds a hidden state. That matters three times over: the resting DOM is
 * always the finished one, so a script that never runs hides nothing; the
 * prerenderer captures the page mid-session and would otherwise serialize
 * whatever was still invisible; and a reader scrolling back up finds the page
 * where they left it rather than replaying it.
 */
export function useSectionEntrance(): void {
  useEffect(() => {
    if (scrollDriven()) return;
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    const sections = [...document.querySelectorAll('[data-enter-section]')];
    if (!sections.length) return;
    const rtl = document.documentElement.dir === 'rtl';
    const easing = enterEase();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          arrivals(e.target).forEach(([el, gesture], i) => {
            el.animate(keyframes(gesture, rtl), {
              duration: DUR,
              delay: Math.min(i * STEP, MAX_DELAY),
              easing,
              // Held at the first keyframe through its delay; without it a
              // staggered item shows, vanishes, then arrives.
              fill: 'backwards',
            });
          });
        }
      },
      { rootMargin: LEAD },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, []);
}
