import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EngineReach, reachGroups } from './engine-reach';
import { CAPABILITIES, ENGINES, coverageFor } from './engines';
import { t } from '@/i18n';

const tiles = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('button[data-engine]')) as HTMLElement[];
const rows = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-reach]')) as HTMLElement[];
const chip = (c: HTMLElement, name: string) =>
  c.querySelector(`[data-capability="${name}"]`) as HTMLElement;
const chosen = (c: HTMLElement) => c.querySelector('[data-chosen]') as HTMLElement;

describe('reachGroups', () => {
  it('groups every capability by who runs it, widest group first', () => {
    const groups = reachGroups();

    expect(groups.map((g) => g.engines.join('+'))).toEqual([
      'singbox+xray+mihomo',
      'singbox+mihomo',
      'singbox',
      'xray',
    ]);
    expect(groups.map((g) => g.rows.length)).toEqual([15, 5, 1, 1]);
    // Nothing is lost or counted twice on the way into the groups.
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(CAPABILITIES.length);
  });

  it('puts the two that stand alone at the bottom, where the differences are', () => {
    const groups = reachGroups();

    expect(groups.at(-2)?.rows.map((r) => r.name)).toEqual(['ShadowTLS']);
    expect(groups.at(-1)?.rows.map((r) => r.name)).toEqual(['xhttp']);
  });
});

describe('EngineReach', () => {
  it('opens on sing-box, which is the engine that starts', () => {
    const { container } = render(<EngineReach />);

    expect(chosen(container)).toHaveAttribute('data-engine', 'singbox');
    expect(chosen(container)).toHaveAttribute('aria-pressed', 'true');
    expect(tiles(container)).toHaveLength(ENGINES.length);
  });

  it('states each engine’s reach as one figure over the whole list', () => {
    const { container } = render(<EngineReach />);

    // 21, 16 and 20 of 22 — computed, so a protocol added to `engines.ts`
    // moves them.
    for (const [i, engine] of ENGINES.entries()) {
      expect(tiles(container)[i]).toHaveTextContent(String(coverageFor(engine.key)));
      expect(tiles(container)[i]).toHaveTextContent(`/${CAPABILITIES.length}`);
    }
  });

  it('gives the chosen tile the room, and its sentence with it', () => {
    const { container } = render(<EngineReach />);

    expect(chosen(container)).toHaveClass('lg:grow-[2.2]');
    expect(chosen(container)).toHaveTextContent(t('home.engines.about.singbox'));
    // The other two keep their figure and wait. Their sentences are laid out
    // too, so the row's height does not change with the choice, but they are
    // out of the button's name.
    expect(tiles(container)[1]).toHaveAccessibleName(expect.not.stringContaining(t('home.engines.about.xray')));
    expect(chosen(container)).toHaveAccessibleName(expect.stringContaining(t('home.engines.about.singbox')));
  });

  it('groups the capabilities by who runs them, under a heading that names them', () => {
    const { container } = render(<EngineReach />);

    expect(rows(container)).toHaveLength(4);
    expect(rows(container)[0]).toHaveTextContent(t('home.engines.reach_all'));
    expect(rows(container)[1]).toHaveTextContent('sing-box + mihomo');
    expect(rows(container)[3]).toHaveTextContent(
      t('home.engines.reach_only').replace('{engine}', 'xray-core'),
    );
    // And the count beside each heading is the size of the group.
    expect(rows(container)[0]).toHaveTextContent('15');
  });

  it('names every capability once, so the hero’s count of eight lands here', () => {
    const { container } = render(<EngineReach />);

    for (const capability of CAPABILITIES) {
      expect(chip(container, capability.name)).not.toBeNull();
    }
    expect(within(container.querySelector('[data-reach]') as HTMLElement).getByText('vless://')).toBeInTheDocument();
  });

  it('answers the chips for whichever engine is in the tile', async () => {
    const user = userEvent.setup();
    const { container } = render(<EngineReach />);

    // sing-box: ShadowTLS is its own, xhttp is not its at all.
    expect(chip(container, 'ShadowTLS')).toHaveAttribute('data-state', 'only');
    expect(chip(container, 'xhttp')).toHaveAttribute('data-state', 'out');
    expect(chip(container, 'VLESS')).toHaveAttribute('data-state', 'runs');

    await user.click(tiles(container)[1]);

    expect(chosen(container)).toHaveAttribute('data-engine', 'xray');
    expect(chip(container, 'xhttp')).toHaveAttribute('data-state', 'only');
    expect(chip(container, 'ShadowTLS')).toHaveAttribute('data-state', 'out');
    expect(chip(container, 'Hysteria2')).toHaveAttribute('data-state', 'out');
  });

  it('marks what an engine cannot run with more than a colour', () => {
    const { container } = render(<EngineReach />);

    const out = chip(container, 'xhttp');
    expect(out).toHaveClass('border-dashed');
    expect(out.firstElementChild).toHaveClass('line-through');
    // And in words, for a reader who gets neither the strike nor the dashes.
    expect(within(out).getByText(t('home.engines.unsupported'))).toBeInTheDocument();
  });

  it('lights the heading of a group the chosen engine belongs to', async () => {
    const user = userEvent.setup();
    const { container } = render(<EngineReach />);

    const heading = (row: HTMLElement) => row.querySelector('span span') as HTMLElement;
    // sing-box is in the first three groups and not in xray's.
    expect(heading(rows(container)[2])).toHaveClass('text-on-surface');
    expect(heading(rows(container)[3])).toHaveClass('text-on-surface-variant');

    await user.click(tiles(container)[1]);

    expect(heading(rows(container)[2])).toHaveClass('text-on-surface-variant');
    expect(heading(rows(container)[3])).toHaveClass('text-on-surface');
  });

  it('is no longer a grid of marks', () => {
    const { container } = render(<EngineReach />);

    expect(container.querySelector('table')).toBeNull();
  });
  describe('on a phone', () => {
    const segments = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-segment]')) as HTMLElement[];

    it('asks for an engine with one segmented control, and keeps the tiles for the row', () => {
      const { container } = render(<EngineReach />);

      const group = container.querySelector('[role="radiogroup"]') as HTMLElement;
      expect(group.closest('.lg\\:hidden')).not.toBeNull();
      expect(tiles(container)[0].parentElement).toHaveClass('hidden', 'lg:flex');
      expect(segments(container).map((s) => s.getAttribute('data-segment'))).toEqual(ENGINES.map((e) => e.key));
      expect(segments(container)[0]).toHaveAttribute('aria-checked', 'true');
      for (const [i, engine] of ENGINES.entries()) {
        expect(segments(container)[i]).toHaveTextContent(String(coverageFor(engine.key)));
      }
    });

    it('moves the choice with the arrows, and only the chosen segment is in the tab order', async () => {
      const user = userEvent.setup();
      const { container } = render(<EngineReach />);

      expect(segments(container).map((s) => s.tabIndex)).toEqual([0, -1, -1]);
      segments(container)[0].focus();
      await user.keyboard('{ArrowRight}');

      expect(segments(container)[1]).toHaveAttribute('aria-checked', 'true');
      expect(segments(container)[1]).toHaveFocus();
      expect(chosen(container)).toHaveAttribute('data-engine', 'xray');

      await user.keyboard('{End}');
      expect(segments(container)[2]).toHaveAttribute('aria-checked', 'true');
      await user.keyboard('{ArrowRight}');
      expect(segments(container)[0]).toHaveAttribute('aria-checked', 'true');
      await user.keyboard('{ArrowLeft}');
      expect(segments(container)[2]).toHaveAttribute('aria-checked', 'true');
      await user.keyboard('{Home}');
      expect(segments(container)[0]).toHaveAttribute('aria-checked', 'true');
    });

    it('answers a tap in the chips at once, and says the chosen engine in one sentence', async () => {
      const user = userEvent.setup();
      const { container } = render(<EngineReach />);
      const says = () =>
        Array.from(container.querySelectorAll('[data-says]'))
          .filter((el) => el.getAttribute('aria-hidden') !== 'true')
          .map((el) => el.getAttribute('data-says'));

      expect(says()).toEqual(['singbox']);

      await user.click(segments(container)[1]);

      expect(says()).toEqual(['xray']);
      expect(chip(container, 'xhttp')).toHaveAttribute('data-state', 'only');
      expect(chip(container, 'ShadowTLS')).toHaveAttribute('data-state', 'out');
    });

    it('puts what differs straight under the control, and what all three share last, in one line', () => {
      const { container } = render(<EngineReach />);

      const shared = rows(container)[0];
      expect(shared).toHaveAttribute('data-reach', 'singbox+xray+mihomo');
      expect(shared).toHaveClass('order-last', 'lg:order-none');
      expect(shared.querySelector('ul')).toHaveClass('hidden', 'lg:flex');
      const line = shared.querySelector('[data-shared-line]') as HTMLElement;
      expect(line).toHaveClass('lg:hidden');
      expect(line).toHaveTextContent('VLESS · VMess');
    });
  });
});
