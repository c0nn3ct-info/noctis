// Band entrances. Where the browser has a `view()` timeline the stylesheet owns
// them and the hook does nothing; where it does not, the hook plays the same two
// gestures off a timer. These pin that only one of the two ever runs, that a
// band arrives once, and that reduced motion means no arrival at all.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { scrollDriven, useSectionEntrance } from './use-enter';

type IoCallback = (entries: { isIntersecting: boolean; target: Element }[]) => void;

interface FakeObserver {
  fire: (els: Element[], isIntersecting?: boolean) => void;
  unobserved: Element[];
  dead: boolean;
}

const observers: FakeObserver[] = [];

function installIo(): void {
  class FakeIo {
    targets: Element[] = [];
    unobserved: Element[] = [];
    dead = false;
    constructor(private cb: IoCallback) {
      observers.push(this as unknown as FakeObserver);
    }
    observe(el: Element) {
      this.targets.push(el);
    }
    unobserve(el: Element) {
      this.unobserved.push(el);
    }
    disconnect() {
      this.dead = true;
    }
    fire(els: Element[], isIntersecting = true) {
      this.cb(els.map((target) => ({ isIntersecting, target })));
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIo);
}

/** Every `animate` call the hook made, in the order it made them. */
const played: { el: Element; frames: Keyframe[]; opts: KeyframeAnimationOptions }[] = [];

function Page() {
  useSectionEntrance();
  return (
    <>
      <section data-enter-section data-testid="band">
        <h2 data-enter>heading</h2>
        <ul data-enter-stagger="wipe">
          <li>one</li>
          <li>two</li>
        </ul>
        {/* An empty value is a stagger with no gesture named, which is the
            default one. */}
        <ol data-enter-stagger="">
          {Array.from({ length: 9 }, (_, i) => (
            <li key={i}>{i}</li>
          ))}
        </ol>
        <div data-enter="">plain</div>
      </section>
      <section data-testid="unmarked" />
    </>
  );
}

beforeEach(() => {
  observers.length = 0;
  played.length = 0;
  installIo();
  Element.prototype.animate = function (
    this: Element,
    frames: Keyframe[],
    opts: KeyframeAnimationOptions,
  ) {
    played.push({ el: this, frames, opts });
    return { finished: Promise.resolve() } as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
  // jsdom has no `view()` timeline, so the hook is the path under test. The
  // setup's matchMedia answers every query false, which would read as "the
  // reader asked for less motion"; this one answers the question asked.
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) => ({ matches: q.includes('no-preference'), media: q }) as MediaQueryList,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.dir = '';
});

describe('scrollDriven', () => {
  it('needs the method, not just the object', () => {
    // jsdom defines `CSS` without `supports`; asking only whether `CSS` exists
    // let the call through and threw.
    expect(scrollDriven()).toBe(false);
    vi.stubGlobal('CSS', { supports: (p: string, v: string) => `${p}${v}`.includes('view()') });
    expect(scrollDriven()).toBe(true);
    vi.stubGlobal('CSS', { supports: () => false });
    expect(scrollDriven()).toBe(false);
  });
});

describe('useSectionEntrance', () => {
  it('does nothing where the stylesheet drives the entrances', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    render(<Page />);
    expect(observers).toHaveLength(0);
  });

  it('does nothing when the reader asked for less motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) => ({ matches: false, media: q }) as MediaQueryList,
    );
    render(<Page />);
    expect(observers).toHaveLength(0);
  });

  it('does nothing on a page with no bands', () => {
    function Bare() {
      useSectionEntrance();
      return <div />;
    }
    render(<Bare />);
    expect(observers).toHaveLength(0);
  });

  it('plays each marked element once the band comes up, in reading order', () => {
    const { getByTestId } = render(<Page />);
    const band = getByTestId('band');
    expect(observers).toHaveLength(1);
    const io = observers[0];

    // An entry that is not on screen yet is skipped.
    io.fire([band], false);
    expect(played).toHaveLength(0);

    io.fire([band]);
    // heading + 2 wipe children + 9 rise children + the plain block
    expect(played).toHaveLength(13);
    expect(io.unobserved).toEqual([band]);

    // The marked container contributes its children, never itself.
    // prettier-ignore
    expect(played.map((p) => p.el.tagName)).toEqual([
      'H2', 'LI', 'LI', 'LI', 'LI', 'LI', 'LI', 'LI', 'LI', 'LI', 'LI', 'LI', 'DIV',
    ]);

    // A sequence is wiped along its line; a block is printed down the page.
    expect(played[0].frames[0].clipPath).toBe('inset(0 0 45% 0)');
    expect(played[1].frames[0].clipPath).toBe('inset(0 100% 0 0)');
    expect(played[12].frames[0].clipPath).toBe('inset(0 0 45% 0)');
    // Nothing moves: an element that arrived by sliding would have to start
    // somewhere it never occupied.
    for (const p of played) {
      expect(p.frames[1]).toEqual({ opacity: 1, clipPath: 'inset(0 0 0 0)' });
      expect(p.frames[0].transform).toBeUndefined();
    }

    // Five steps of lead, then no more: past that a list reads as waiting.
    // prettier-ignore
    expect(played.map((p) => p.opts.delay)).toEqual([
      0, 45, 90, 135, 180, 225, 225, 225, 225, 225, 225, 225, 225,
    ]);
    expect(played[0].opts.duration).toBe(280);
    expect(played[0].opts.fill).toBe('backwards');
    expect(played[0].opts.easing).toBeTruthy();
  });

  it('rises an element marked with the landing page’s gentler gesture', () => {
    function SoftPage() {
      useSectionEntrance();
      return (
        <div data-enter-section data-testid="soft-band">
          <p data-enter="soft">block</p>
          <ul data-enter-stagger="soft">
            <li>one</li>
            <li>two</li>
          </ul>
        </div>
      );
    }
    const { getByTestId } = render(<SoftPage />);
    observers[0].fire([getByTestId('soft-band')]);

    // `soft` moves a transform and clips nothing: the clip reveal opens a hard
    // edge across the element, which is what read as a block snapping in.
    expect(played).toHaveLength(3);
    for (const p of played) {
      expect(p.frames[0]).toEqual({ opacity: 0, transform: 'translateY(32px) scale(0.96)' });
      expect(p.frames[1]).toEqual({ opacity: 1, transform: 'none' });
      expect(p.frames[0].clipPath).toBeUndefined();
    }
  });

  it('fades the parts of a framed block in by opacity alone', () => {
    function FramedPage() {
      useSectionEntrance();
      return (
        <div data-enter-section data-testid="framed-band">
          <div data-enter="soft">
            <ul data-enter-stagger="fade">
              <li>one</li>
              <li>two</li>
            </ul>
          </div>
        </div>
      );
    }
    const { getByTestId } = render(<FramedPage />);
    observers[0].fire([getByTestId('framed-band')]);

    // The frame rises; its rows only fade, so the two movements do not add.
    expect(played).toHaveLength(3);
    expect(played[0].frames[0].transform).toBe('translateY(32px) scale(0.96)');
    for (const p of played.slice(1)) {
      expect(p.frames).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    }
  });

  it('mirrors the line a sequence arrives along on a right-to-left page', () => {
    document.documentElement.dir = 'rtl';
    const { getByTestId } = render(<Page />);
    observers[0].fire([getByTestId('band')]);
    expect(played[1].frames[0].clipPath).toBe('inset(0 0 0 100%)');
  });

  it('falls back to the browser ease when the token has not loaded', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);
    const { getByTestId } = render(<Page />);
    observers[0].fire([getByTestId('band')]);
    expect(played[0].opts.easing).toBe('ease-out');
  });

  it('lets go of the observer when the page goes', () => {
    const { unmount } = render(<Page />);
    unmount();
    expect(observers[0].dead).toBe(true);
  });
});
