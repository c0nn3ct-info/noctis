import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoutingBand } from './routing-band';
import { REQUESTS, routeFor } from './routing-scene';
import { t } from '@/i18n';

const tile = (c: HTMLElement, mode: string) =>
  c.querySelector(`[data-mode="${mode}"]`) as HTMLElement;
const requests = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-request]')) as HTMLElement[];
/** Which lane each request's full dot sits in, read off the table. */
const lanes = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-cell][data-hit]')).map((el) =>
    el.getAttribute('data-cell'),
  );
const ruleCells = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-rule]')) as HTMLElement[];

describe('RoutingBand', () => {
  it('opens on the rules, with one row per request the browser made', () => {
    const { container } = render(<RoutingBand />);

    expect(tile(container, 'rules')).toHaveAttribute('aria-pressed', 'true');
    expect(requests(container).map((r) => r.getAttribute('data-request'))).toEqual([...REQUESTS]);
  });

  it('puts each request in the lane it was sent down, and nowhere else', () => {
    const { container } = render(<RoutingBand />);

    expect(lanes(container)).toEqual(REQUESTS.map((h) => routeFor(h, 'rules').direction));
    // One full dot per row: the lane is the answer, so a second would be a
    // second answer.
    expect(lanes(container)).toHaveLength(REQUESTS.length);
  });

  it('gives every tile the distribution its mode would produce', () => {
    const { container } = render(<RoutingBand />);

    const bar = (mode: string) =>
      Array.from(tile(container, mode).querySelectorAll('[data-lane]')).map((s) =>
        s.getAttribute('data-lane'),
      );

    // Global is one colour, and so is Direct: one answer for everything.
    expect(new Set(bar('global'))).toEqual(new Set(['proxy']));
    expect(bar('global')).toHaveLength(REQUESTS.length);
    expect(new Set(bar('direct'))).toEqual(new Set(['direct']));
    // By rules is three, sorted into lanes: that difference is the whole point
    // of the bar.
    expect(bar('rules')).toEqual([
      'proxy',
      'proxy',
      'proxy',
      'direct',
      'direct',
      'direct',
      'block',
    ]);
  });

  it('names the rule that decided, and says so when none did', () => {
    const { container } = render(<RoutingBand />);

    expect(ruleCells(container)[0]).toHaveTextContent('youtube');
    expect(ruleCells(container)[0]).toHaveTextContent('geosite');
    expect(ruleCells(container)[1]).toHaveTextContent('openai.com');
    expect(ruleCells(container).at(-1)).toHaveTextContent(t('home.routing.no_rule'));
  });

  it('says nothing about rules in a mode that read none', async () => {
    const user = userEvent.setup();
    const { container } = render(<RoutingBand />);

    await user.click(tile(container, 'global'));

    // A dash rather than "no rule matched": nothing was consulted, so there is
    // no lookup to report the result of. And the column leaves the
    // accessibility tree with its width, or a screen reader hears the answer
    // the page is busy hiding.
    expect(ruleCells(container)[0]).toHaveTextContent('—');
    expect(ruleCells(container)[0]).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText(t('home.routing.no_rule'))).toBeNull();
  });

  it('collapses the rule column in the modes that never read a rule', async () => {
    const user = userEvent.setup();
    const { container } = render(<RoutingBand />);

    const grid = requests(container)[0].parentElement as HTMLElement;
    expect(grid.style.gridTemplateColumns).toContain('170px');
    expect(ruleCells(container)[0]).toHaveClass('opacity-100');

    await user.click(tile(container, 'global'));

    // Column and all: a column of dashes would be the page insisting the mode
    // consulted something.
    expect(grid.style.gridTemplateColumns).toContain('0px');
    expect(ruleCells(container)[0]).toHaveClass('opacity-0');
  });

  it('answers every request again when the mode changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<RoutingBand />);

    await user.click(tile(container, 'global'));

    expect(tile(container, 'global')).toHaveAttribute('aria-pressed', 'true');
    expect(lanes(container).every((lane) => lane === 'proxy')).toBe(true);

    await user.click(tile(container, 'direct'));

    expect(lanes(container).every((lane) => lane === 'direct')).toBe(true);

    await user.click(tile(container, 'rules'));

    expect(lanes(container)).toEqual(REQUESTS.map((h) => routeFor(h, 'rules').direction));
  });

  it('greys a lane that carried nothing, and colours the ones that did', async () => {
    const user = userEvent.setup();
    const { container } = render(<RoutingBand />);

    const head = (lane: string) => container.querySelector(`[data-head="${lane}"]`) as HTMLElement;
    expect(head('proxy')).toHaveClass('text-dir');

    await user.click(tile(container, 'direct'));

    expect(head('direct')).toHaveClass('text-dir');
    expect(head('proxy')).toHaveClass('text-on-surface-variant');
    expect(head('block')).toHaveClass('text-on-surface-variant');
  });

  it('carries the product’s own three tints, by the product’s own classes', () => {
    const { container } = render(<RoutingBand />);

    // `dir-proxy`, `dir-direct` and `dir-block` are what the extension's
    // routing pages set; every tint here is an alpha of the `--dir` they set.
    expect(container.querySelector('[data-head="proxy"]')?.className).toContain('dir-proxy');
    expect(container.querySelector('[data-cell="block"]')?.className).toContain('dir-block');
  });

  it('says what the chosen mode does, and only for the chosen one', async () => {
    const user = userEvent.setup();
    const { container } = render(<RoutingBand />);

    expect(within(tile(container, 'rules')).getByText(t('home.routing.about_rules'))).toBeInTheDocument();
    // The others carry the short line instead: three paragraphs stacked is a
    // column of reading where the bars already say it.
    expect(within(tile(container, 'global')).getByText(t('home.routing.short_global'))).toBeInTheDocument();
    expect(screen.queryByText(t('home.routing.about_global'))).toBeNull();

    await user.click(tile(container, 'global'));

    expect(within(tile(container, 'global')).getByText(t('home.routing.about_global'))).toBeInTheDocument();
  });
});
