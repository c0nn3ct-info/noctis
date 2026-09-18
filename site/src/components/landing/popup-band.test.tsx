import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PopupBand } from './popup-band';
import { t } from '@/i18n';

describe('PopupBand', () => {

  it('runs the phone mock off the screen edge, and lets the band clip it', () => {
    const { container } = render(<PopupBand />);

    // The 380px surface cannot fit a 390px phone with a gutter either way.
    // Bled, it runs off the edge the way a phone shows anything wider than
    // itself; contained, it was cut mid-card with 20px of ground beside the
    // cut. `overflow-x: clip` on the band keeps those 40px off the document,
    // and unlike `auto` it makes no scroll container for a sticky to catch on.
    const strip = container.querySelector('.overflow-x-auto') as HTMLElement;
    expect(strip.className).toContain('-mx-5');
    expect(container.firstElementChild).toHaveClass('overflow-x-clip');
  });
  it('says what the popup is, and what only it can claim', () => {
    render(<PopupBand />);

    // By name: the popup mock carries an h2 of its own — deliberately, per its
    // own comment — so the band is not the only heading in this tree.
    expect(screen.getByRole('heading', { level: 2, name: t('home.popup.h2') })).toBeInTheDocument();
    expect(screen.getByText(t('home.popup.body'))).toBeInTheDocument();
    expect(screen.getByText(t('home.popup.c1.title'))).toBeInTheDocument();
    expect(screen.getByText(t('home.popup.c2.body'))).toBeInTheDocument();
    expect(screen.getByText(t('home.popup.c3.title'))).toBeInTheDocument();
  });

  it('shows the site’s own popup mock rather than a picture of one', () => {
    const { container } = render(<PopupBand />);

    // PopupMock draws the real POPUP_FRAME: 380x600, verbatim from the
    // extension. Two instances, because the phone strip and the framed
    // desktop copy are both in the DOM and CSS picks one.
    expect(container.querySelectorAll('.w-\\[380px\\]')).toHaveLength(2);
  });

  it('drops the browser frame on a phone, where it would be wider than the screen', () => {
    const { container } = render(<PopupBand />);

    const strip = container.querySelector('.sm\\:hidden');
    const framed = container.querySelector('.sm\\:flex');
    // 382: the 380 surface plus the pixel of site framing on each edge.
    expect(strip?.querySelector('.min-w-\\[382px\\]')).not.toBeNull();
    expect(framed).toHaveClass('hidden');
  });

  it('keeps the frame near the popup’s own size, so it reports it honestly', () => {
    const { container } = render(<PopupBand />);

    // 500 less the popup's 380 and its 8px inset leaves a ~110px strip of the
    // page behind it. A frame given the whole column would keep the popup at
    // 380 and still misreport its size, by making the browser enormous.
    expect(container.querySelector('.max-w-\\[500px\\]')).not.toBeNull();
  });

  it('names both interfaces, with the one that has not shipped marked', () => {
    render(<PopupBand />);

    expect(screen.getByRole('group', { name: t('home.popup.surface_aria') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extension/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Terminal/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('is a band the entrance observer picks up', () => {
    const { container } = render(<PopupBand />);

    expect(container.querySelector('section')).toHaveAttribute('data-enter-section');
    expect(container.querySelector('section')).toHaveAttribute('id', 'popup');
  });
});
