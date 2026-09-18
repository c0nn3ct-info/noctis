import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Check, Globe, Route } from 'lucide-react';
import { ClaimList, LandingSection, PointList, SectionHeading } from './shell';

describe('LandingSection', () => {
  it('is what the entrance observer watches', () => {
    const { container } = render(<LandingSection>band</LandingSection>);

    expect(container.querySelector('section')).toHaveAttribute('data-enter-section');
  });

  it('holds its children in the page width by default', () => {
    const { container } = render(<LandingSection>band</LandingSection>);

    expect(container.querySelector('section > div')).toHaveClass('max-w-[1160px]');
  });

  it('pads inside the page box, where the footer pads too', () => {
    const { container } = render(<LandingSection>band</LandingSection>);

    // The Layout's `bleed` footer is `mx-auto max-w-[1160px] px-5 sm:px-8
    // lg:px-10` — padding inside the box. Padding the section instead put
    // every band's content 40px outside the rule that closes the page.
    const section = container.querySelector('section') as HTMLElement;
    const box = container.querySelector('section > div') as HTMLElement;
    expect(section).not.toHaveClass('px-5');
    expect(box).toHaveClass('px-5', 'sm:px-8', 'lg:px-10');
  });

  it('hands the band the full width when it lays itself out', () => {
    const { container } = render(<LandingSection contained={false}>band</LandingSection>);

    expect(container.querySelector('section > div')).toBeNull();
  });

  it('leaves room under the sticky header only for a band you can link to', () => {
    const anchored = render(<LandingSection id="engines">b</LandingSection>).container;
    const plain = render(<LandingSection>b</LandingSection>).container;

    expect(anchored.querySelector('section')).toHaveClass('scroll-mt-20');
    expect(plain.querySelector('section')).not.toHaveClass('scroll-mt-20');
  });
});

describe('SectionHeading', () => {
  it('is a heading and an optional body, in one column', () => {
    render(<SectionHeading title="One extension, three engines" body="Picks per server." />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('One extension, three engines');
    expect(screen.getByText('Picks per server.')).toBeInTheDocument();
  });

  it('takes no kicker at all — a heading carries its own weight', () => {
    // aria2t's shell.stories.tsx: "An eyebrow goes over a list or a figure,
    // never over a heading." Its own bands pass none, and neither do ours.
    const { container } = render(<SectionHeading title="T" body="B" />);

    // The kicker was a <span> over the heading; nothing renders one now.
    expect(container.querySelectorAll('span')).toHaveLength(0);
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe('H2');
  });

  it('drops to h3 for a band nested under another', () => {
    render(<SectionHeading title="Third" level={3} />);

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Third');
  });

  it('lets the browser choose both wraps', () => {
    const { container } = render(<SectionHeading title="T" body="B" />);

    expect(container.querySelector('h2')).toHaveClass('text-balance');
    expect(container.querySelector('p')).toHaveClass('text-pretty');
  });
});

describe('PointList', () => {
  it('badges each fact in a container pair, so the fill and the text always agree', () => {
    const { container } = render(
      <PointList
        points={[
          { icon: Check, text: 'Read locally' },
          { icon: Globe, tone: 'tertiary', text: 'Stored locally' },
          { icon: Route, tone: 'primary', text: 'No admin rights' },
        ]}
      />,
    );

    const badges = Array.from(container.querySelectorAll('li > span:first-child'));
    expect(badges[0]).toHaveClass('bg-success-container', 'text-success-on-container');
    expect(badges[1]).toHaveClass('bg-tertiary-container', 'text-tertiary-on-container');
    expect(badges[2]).toHaveClass('bg-primary-container', 'text-primary-on-container');
  });

  it('arrives item by item, on the page’s gentler gesture', () => {
    const { container } = render(<PointList points={[{ icon: Check, text: 'One' }]} />);

    // `soft` rather than `wipe`: the clip reveal opens a hard edge across the
    // element, which is what read as blocks snapping in on every scroll past.
    expect(container.querySelector('ul')).toHaveAttribute('data-enter-stagger', 'soft');
  });

  it('starts its badge at the top, so a two-line point does not float it', () => {
    const { container } = render(<PointList points={[{ icon: Check, text: 'One' }]} />);

    expect(container.querySelector('li')).toHaveClass('items-start');
  });
});

describe('ClaimList', () => {
  it('pairs what the visitor gets with how it works', () => {
    render(
      <ClaimList
        claims={[
          { icon: Route, title: 'Only the browser', body: 'Chrome hands over a routing decision.' },
        ]}
      />,
    );

    expect(screen.getByText('Only the browser')).toBeInTheDocument();
    expect(screen.getByText('Chrome hands over a routing decision.')).toBeInTheDocument();
  });

  it('gives the eye a muted place to start, not a coloured badge', () => {
    const { container } = render(
      <ClaimList claims={[{ icon: Route, title: 'T', body: 'B' }]} />,
    );

    const icon = container.querySelector('li > svg');
    expect(icon).toHaveClass('text-on-surface-variant');
    expect(container.querySelector('li > span.rounded-full')).toBeNull();
  });
});
