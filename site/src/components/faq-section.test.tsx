import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FAQ_KEYS, FaqList, FaqSection } from './faq-section';
import { setLocale, t } from '../i18n';
import en from '../i18n/en.json';

afterEach(() => setLocale('en'));

describe('FaqList', () => {
  it('boxes the rows by default, the way the home page has always shown them', () => {
    const { container } = render(<FaqList />);

    const list = container.firstElementChild as HTMLElement;
    expect(list).toHaveClass('border', 'border-outline-variant', 'bg-surface-container-low');
    expect(container.querySelectorAll('details')).toHaveLength(FAQ_KEYS.length);
  });

  it('drops the box for a page that frames the rows itself', () => {
    const { container } = render(<FaqList variant="flush" />);

    const list = container.firstElementChild as HTMLElement;
    expect(list).toHaveClass('divide-y');
    expect(list).not.toHaveClass('border-outline-variant');
    // Hover only: the press and focus fills linger on a bare background and
    // read as a selected band.
    expect(container.querySelector('summary')).toHaveClass('m3-hover-layer');
    expect(container.querySelector('summary')).not.toHaveClass('m3-state-layer');
    // Without the state layer's focus fill the row would fall back to the
    // browser's own blue outline, which is the one focus ring on the page that
    // is not the site's.
    expect(container.querySelector('summary')).toHaveClass('focus-visible:ring-ring');
  });

  it('leaves every row closed unless asked to open the first', () => {
    const closed = render(<FaqList />).container.querySelectorAll('details');
    for (const d of closed) expect(d.open).toBe(false);

    const opened = render(<FaqList openFirst />).container.querySelectorAll('details');
    expect(opened[0].open).toBe(true);
    for (const d of Array.from(opened).slice(1)) expect(d.open).toBe(false);
  });
});

describe('FaqSection', () => {
  it('renders one collapsed <details> per FAQ entry', () => {
    const { container } = render(<FaqSection />);
    expect(screen.getByRole('heading', { name: en['home.faq.h2'], level: 2 })).toBeInTheDocument();

    const items = container.querySelectorAll('details');
    expect(items).toHaveLength(10);
    for (const item of items) expect(item.open).toBe(false);

    expect(screen.getByText(en['home.faq.what.q'])).toBeInTheDocument();
    expect(screen.getByText(en['home.faq.cost.a'])).toBeInTheDocument();
  });

  it('is anchored for in-page links', () => {
    const { container } = render(<FaqSection />);
    expect(container.querySelector('section')).toHaveAttribute('id', 'faq');
  });

  it('follows the active locale', () => {
    setLocale('ru');
    render(<FaqSection />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(t('home.faq.h2'));
  });
});

describe('FaqList motion', () => {
  const summaries = (c: HTMLElement) => [...c.querySelectorAll('summary')] as HTMLElement[];
  const click = (el: HTMLElement) =>
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // @ts-expect-error jsdom has no Web Animations; tests add and remove it
    delete Element.prototype.animate;
    // @ts-expect-error see above
    delete Element.prototype.getAnimations;
  });

  function withAnimations() {
    const made: { keyframes: Keyframe[]; opts: KeyframeAnimationOptions; anim: { onfinish: null | (() => void); cancel: ReturnType<typeof vi.fn> } }[] = [];
    const running = { cancel: vi.fn() };
    Element.prototype.animate = function (keyframes: Keyframe[], opts: KeyframeAnimationOptions) {
      const anim = { onfinish: null as null | (() => void), cancel: vi.fn() };
      made.push({ keyframes, opts, anim });
      return anim as unknown as Animation;
    } as typeof Element.prototype.animate;
    Element.prototype.getAnimations = () => [running as unknown as Animation];
    return { made, running };
  }

  it('leaves the toggle to the browser where CSS can animate it', () => {
    vi.spyOn(CSS, 'supports').mockReturnValue(true);
    withAnimations();
    const { container } = render(<FaqList />);
    expect(click(summaries(container)[1])).toBe(true);
  });

  it('leaves it native under reduced motion, and without Web Animations', () => {
    const { container } = render(<FaqList />);
    // jsdom: no Element.animate
    expect(click(summaries(container)[1])).toBe(true);

    withAnimations();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    expect(click(summaries(container)[1])).toBe(true);
  });

  it('opens an answer from nothing, and folds it before it closes', () => {
    const { made, running } = withAnimations();
    const { container } = render(<FaqList />);
    const details = container.querySelectorAll('details')[1];

    expect(click(summaries(container)[1])).toBe(false);
    expect(running.cancel).toHaveBeenCalled();
    expect(details.open).toBe(true);
    expect(details).toHaveAttribute('data-expanded');
    expect(made[0].keyframes[0]).toMatchObject({ height: '0px', paddingBottom: '0px' });

    click(summaries(container)[1]);
    expect(details).toHaveAttribute('data-closing');
    expect(details).not.toHaveAttribute('data-expanded');
    // Still open while it folds, so the answer is visible going away.
    expect(details.open).toBe(true);
    expect(made[1].keyframes[1]).toMatchObject({ height: '0px' });

    made[1].anim.onfinish!();
    expect(details.open).toBe(false);
    expect(details).not.toHaveAttribute('data-closing');
    expect(made[1].anim.cancel).toHaveBeenCalled();
  });

  it('reopens a folding answer from where it is', () => {
    const { made } = withAnimations();
    const { container } = render(<FaqList openFirst />);
    const details = container.querySelectorAll('details')[0];

    click(summaries(container)[0]);
    expect(details).toHaveAttribute('data-closing');
    click(summaries(container)[0]);
    expect(details).not.toHaveAttribute('data-closing');
    expect(details).toHaveAttribute('data-expanded');
    // From the panel's own height and padding, not from nothing.
    expect(made[1].keyframes[0].paddingBottom).not.toBe('0px');
  });

  it('keeps the chevron on the native toggle, unless a fold owns it', () => {
    const { container } = render(<FaqList />);
    const details = container.querySelectorAll('details')[2];

    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    expect(details).toHaveAttribute('data-expanded');

    details.setAttribute('data-closing', '');
    details.open = false;
    details.dispatchEvent(new Event('toggle'));
    expect(details).toHaveAttribute('data-expanded');
  });
});
