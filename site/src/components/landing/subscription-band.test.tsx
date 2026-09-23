import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscriptionBand } from './subscription-band';
import { t } from '@/i18n';

/** A row's slot, from the translateY it is placed at. */
const offset = (el: HTMLElement) => parseFloat(el.style.transform.replace('translateY(', ''));

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-server]')) as HTMLElement[];
const order = (c: HTMLElement) =>
  rows(c)
    .slice()
    .sort((a, b) => offset(a) - offset(b))
    .map((r) => r.getAttribute('data-server'));
const meta = (c: HTMLElement) => c.querySelector('[data-meta]') as HTMLElement;
const used = (c: HTMLElement) => c.querySelector('[data-used]') as HTMLElement;
const gauge = (c: HTMLElement, half: string) =>
  c.querySelector(`[data-gauge="${half}"]`) as HTMLElement;
const refresh = () => screen.getByRole('button', { name: t('home.subs.refresh') });
const sort = () => screen.getByRole('button', { name: t('home.subs.sort') });

describe('SubscriptionBand', () => {
  it('opens on a fixed reading, so the prerendered card survives hydration', () => {
    const { container } = render(<SubscriptionBand />);

    // 143 down and 12 up, the sample the promo film uses.
    expect(used(container)).toHaveTextContent('155.0');
    expect(gauge(container, 'down').style.height).toBe(`${(143 / 500) * 100}%`);
    expect(gauge(container, 'up').style.height).toBe(`${(12 / 500) * 100}%`);
    expect(meta(container)).toHaveTextContent(t('home.subs.updated').replace('{n}', '6'));
  });

  it('names the three parts the plan is made of', () => {
    render(<SubscriptionBand />);

    // A bar with a percentage says how full the plan is; the legend says what
    // it is made of, which is what the provider actually reported.
    expect(screen.getByText(t('home.subs.down').replace('{n}', '143.0'))).toBeInTheDocument();
    expect(screen.getByText(t('home.subs.up').replace('{n}', '12.0'))).toBeInTheDocument();
    expect(screen.getByText(t('home.subs.left').replace('{n}', '345.0'))).toBeInTheDocument();
  });

  it('gives every server its endpoint, its stack and its latency', () => {
    const { container } = render(<SubscriptionBand />);

    expect(rows(container)).toHaveLength(3);
    const frankfurt = within(rows(container)[0]);
    expect(frankfurt.getByText(/fra\.sirius\.vpn:443/)).toBeInTheDocument();
    expect(frankfurt.getByText(/vless · tcp · reality · xtls-rprx-vision/)).toBeInTheDocument();
    expect(frankfurt.getByText('128 ms')).toBeInTheDocument();
  });

  it('colours a latency by what it is worth, not by rank', () => {
    const { container } = render(<SubscriptionBand />);

    const latency = (row: HTMLElement) => row.querySelector('[data-latency]') as HTMLElement;
    // 128 and 164 are good; 372 is far away and says so.
    expect(latency(rows(container)[0])).toHaveClass('text-success');
    expect(latency(rows(container)[1])).toHaveClass('text-success');
    expect(latency(rows(container)[2])).toHaveClass('text-warning');
  });

  it('moves the rows into latency order rather than redrawing the list', async () => {
    const user = userEvent.setup();
    const { container } = render(<SubscriptionBand />);

    expect(order(container)).toEqual(['Frankfurt', 'Amsterdam', 'London']);

    await user.click(sort());

    // The same three rows, placed again — London's 372 sends it to the foot,
    // and it is the same element that moved there.
    expect(sort()).toHaveAttribute('aria-pressed', 'true');
    expect(rows(container)).toHaveLength(3);
    expect(order(container)).toEqual(['Frankfurt', 'Amsterdam', 'London']);
  });

  it('re-reads the traffic and re-probes the servers on a refresh', async () => {
    const user = userEvent.setup();
    const { container } = render(<SubscriptionBand />);

    const before = Number(used(container).textContent?.replace(/[^\d.]/g, ''));

    await user.click(refresh());
    // The reading travels over the time the request would plausibly take, so
    // the wait has to outlast it.
    await waitFor(() => expect(meta(container)).toHaveTextContent(t('home.subs.updated_now')), {
      timeout: 3000,
    });

    // More traffic than there was, and never less: a provider's counter only
    // goes one way.
    expect(Number(used(container).textContent?.replace(/[^\d.]/g, ''))).toBeGreaterThan(before);
    expect(rows(container)).toHaveLength(3);
  });

  it('says it is working while it works', async () => {
    const user = userEvent.setup();
    const { container } = render(<SubscriptionBand />);

    await user.click(refresh());

    expect(meta(container)).toHaveTextContent(t('home.subs.fetching'));
    // The reading travels over the time the request would plausibly take, so
    // the wait has to outlast it.
    await waitFor(() => expect(meta(container)).toHaveTextContent(t('home.subs.updated_now')), {
      timeout: 3000,
    });
  });

  it('marks the server the tunnel is on, and follows a pick', async () => {
    const user = userEvent.setup();
    const { container } = render(<SubscriptionBand />);

    expect(container.querySelectorAll('[data-selected]')).toHaveLength(1);
    expect(rows(container)[0]).toHaveAttribute('data-selected');

    await user.click(rows(container)[2]);

    expect(rows(container)[2]).toHaveAttribute('data-selected');
    expect(container.querySelectorAll('[data-selected]')).toHaveLength(1);
  });

  it('says whose figures these are', () => {
    render(<SubscriptionBand />);

    expect(screen.getByText(t('home.subs.reported'))).toBeInTheDocument();
  });
});
