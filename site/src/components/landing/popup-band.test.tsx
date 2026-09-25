import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PopupBand } from './popup-band';
import { t } from '@/i18n';

describe('PopupBand', () => {

  it('fits the whole phone mock on the screen, scaled rather than scrolled', () => {
    const { container } = render(<PopupBand />);

    // A 380px surface on a 360px phone either scrolls sideways or shrinks. It
    // shrinks: the popup is the subject, and the half that scrolled off was the
    // half with the answer in it.
    expect(container.querySelector('.overflow-x-auto')).toBeNull();
    const fit = container.querySelector('[data-fit]') as HTMLElement;
    expect(fit.style.getPropertyValue('--s')).toContain('100cqw');
    expect(fit.parentElement?.className).toContain('[container-type:inline-size]');
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
    expect(strip?.querySelector('[data-fit]')).not.toBeNull();
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
