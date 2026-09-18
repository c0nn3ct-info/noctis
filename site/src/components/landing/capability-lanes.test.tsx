import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CAPABILITY_LANES, CapabilityLanes } from './capability-lanes';
import { t } from '@/i18n';

const cards = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-card]')) as HTMLElement[];
const lanes = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-lane]')) as HTMLElement[];

describe('CAPABILITY_LANES', () => {
  it('splits nine capabilities into three named lanes of three', () => {
    expect(CAPABILITY_LANES.map((l) => l.group)).toEqual(['routing', 'setup', 'scope']);
    expect(CAPABILITY_LANES.flatMap((l) => l.keys)).toHaveLength(9);
    for (const lane of CAPABILITY_LANES) expect(lane.keys).toHaveLength(3);
  });
});

describe('CapabilityLanes', () => {

  it('stops being a lane on a phone, the way it stops for reduced motion', () => {
    const { container } = render(<CapabilityLanes />);

    // A phone is narrower than one 300px card, so a drifting lane never shows
    // a whole one: every card is cut at both edges and the sentence you are
    // reading slides off the screen.
    const lane = container.querySelector('[data-lane]') as HTMLElement;
    expect(lane).toHaveClass('max-sm:w-auto', 'max-sm:animate-none', 'max-sm:flex-wrap');
    expect(container.firstElementChild).toHaveClass('max-sm:overflow-visible');
    const clone = container.querySelectorAll('[data-card]')[3];
    expect(clone).toHaveClass('max-sm:hidden', 'motion-reduce:hidden');
  });
  it('drifts each lane at its own pace, the middle one against the others', () => {
    const { container } = render(<CapabilityLanes />);

    expect(lanes(container).map((l) => l.style.getPropertyValue('--lane-dur'))).toEqual([
      '26s',
      '32s',
      '29s',
    ]);
    expect(lanes(container).map((l) => l.style.animationDirection)).toEqual([
      'normal',
      'reverse',
      'normal',
    ]);
  });

  it('holds each lane three times over, so the loop has no seam', () => {
    const { container } = render(<CapabilityLanes />);

    expect(cards(container)).toHaveLength(27);
  });

  it('reads each capability out exactly once', () => {
    const { container } = render(<CapabilityLanes />);

    const spoken = cards(container).filter((c) => c.getAttribute('aria-hidden') !== 'true');
    expect(spoken).toHaveLength(9);
    expect(screen.getAllByText(t('home.caps.profiles.title'))).toHaveLength(3);
    expect(spoken.map((c) => c.textContent)).toContain(
      `${t('home.caps.profiles.title')}${t('home.caps.profiles.body')}`,
    );
  });

  it('drops the duplicate cards and wraps the lane when motion is unwelcome', () => {
    const { container } = render(<CapabilityLanes />);

    const clones = cards(container).filter((c) => c.getAttribute('aria-hidden') === 'true');
    expect(clones).toHaveLength(18);
    for (const clone of clones) expect(clone).toHaveClass('motion-reduce:hidden');
    for (const lane of lanes(container)) expect(lane).toHaveClass('motion-reduce:flex-wrap');
  });

  it('alternates the resting corner of every card along a lane', () => {
    const { container } = render(<CapabilityLanes />);
    const first = cards(container).slice(0, 3);

    // On the shape scale now, not arbitrary: `xl` is 36px and `lg` is 28px.
    expect(first.map((c) => c.classList.contains('rounded-xl'))).toEqual([true, false, true]);
    expect(first.map((c) => c.classList.contains('rounded-lg'))).toEqual([false, true, false]);
  });

  it('runs without a stop, short of reduced motion', () => {
    const { container } = render(<CapabilityLanes />);

    expect(container.querySelector('button')).toBeNull();
    for (const lane of lanes(container)) {
      expect(lane.className).not.toContain('animation-play-state');
      expect(lane).toHaveClass('animate-lane-drift');
    }
  });

  it('carries the icon beside the title, not stacked over it in a badge', () => {
    const { container } = render(<CapabilityLanes />);
    const card = cards(container)[0];

    // A rounded icon container above a heading is the interchangeable feature
    // block; aria2t's ClaimList already dropped it for a muted icon at the
    // title's size, and these cards follow.
    expect(card.querySelector('.rounded-pill')).toBeNull();
    const row = card.querySelector('svg')?.parentElement;
    expect(row?.querySelector('svg')).not.toBeNull();
    expect(row?.textContent).toContain(t('home.caps.modes.title'));
  });

  it('answers the pointer with colour, never with geometry', () => {
    const { container } = render(<CapabilityLanes />);

    for (const card of cards(container).slice(0, 3)) {
      expect(card.className).not.toContain('--r-hover');
      expect(card).toHaveClass('transition-colors', 'hover:bg-surface-container-high');
    }
  });
});
