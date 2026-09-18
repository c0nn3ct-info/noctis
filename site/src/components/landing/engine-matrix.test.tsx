import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EngineMatrix } from './engine-matrix';
import { GROUPS, PROTOCOLS } from './engines';
import { t } from '@/i18n';

const section = (key: string) =>
  screen.getByRole('button', { name: t(`home.matrix.group.${key}`) });
const rowsOf = (c: HTMLElement, key: string) =>
  Array.from(c.querySelectorAll(`[data-group="${key}"] tr[data-row]`)) as HTMLElement[];
const shut = (c: HTMLElement, key: string) => rowsOf(c, key).every((r) => r.hasAttribute('hidden'));

describe('EngineMatrix', () => {
  it('measures everything against the same three engines', () => {
    render(<EngineMatrix />);

    const heads = screen.getAllByRole('columnheader').slice(0, 3);
    expect(heads.map((h) => h.textContent)).toEqual([
      `${t('home.matrix.chip.singbox')}sing-box`,
      `${t('home.matrix.chip.xray')}xray-core`,
      `${t('home.matrix.chip.mihomo')}mihomo`,
    ]);
  });

  it('gives each engine its own chip, and fills only the default’s', () => {
    const { container } = render(<EngineMatrix />);

    // Scoped to the head: xray-core's chip names the transport it alone
    // builds, which is also a row further down.
    const head = within(container.querySelector('thead') as HTMLElement);
    const chip = (key: string) => head.getByText(t(`home.matrix.chip.${key}`));

    for (const key of ['singbox', 'xray', 'mihomo']) expect(chip(key)).toBeInTheDocument();
    // "unlocks" described a delta the table stopped drawing.
    expect(screen.queryByText(/unlocks/i)).toBeNull();
    expect(chip('singbox')).toHaveClass('bg-primary');
    expect(chip('xray')).toHaveClass('bg-surface-container-highest');
  });

  it('moves the light to whichever column you ask about', async () => {
    const user = userEvent.setup();
    const { container } = render(<EngineMatrix />);
    const head = (name: string) => screen.getByRole('button', { name: new RegExp(name) });
    const litCells = () =>
      Array.from(container.querySelectorAll('tbody tr[data-row] td.bg-surface-container-low')).length;

    expect(head('sing-box')).toHaveAttribute('aria-pressed', 'true');
    expect(head('mihomo')).toHaveAttribute('aria-pressed', 'false');

    // "How does this compare against mihomo" is the second question anybody
    // asks, and a stripe fixed to the default cannot answer it.
    await user.click(head('mihomo'));

    expect(head('mihomo')).toHaveAttribute('aria-pressed', 'true');
    expect(head('sing-box')).toHaveAttribute('aria-pressed', 'false');
    expect(litCells()).toBeGreaterThan(0);
    const cells = Array.from(
      (rowsOf(container, 'protocols')[0] as HTMLElement).querySelectorAll('td'),
    );
    expect(cells[2]).toHaveClass('bg-surface-container-low');
    expect(cells[0].className).not.toContain('bg-surface-container-low');
  });

  it('puts the light out when you click the lit column again', async () => {
    const user = userEvent.setup();
    const { container } = render(<EngineMatrix />);

    // The light is a reading aid, so three columns weighed evenly is a state a
    // reader is allowed to ask for.
    await user.click(screen.getByRole('button', { name: /sing-box/ }));

    expect(screen.getByRole('button', { name: /sing-box/ })).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelectorAll('tbody tr[data-row] td.bg-surface-container-low')).toHaveLength(0);
    expect(container.querySelector('tfoot td.rounded-b-lg')).toBeNull();
  });

  it('wears its section label as a chip, on the engine chips’ scale', () => {
    render(<EngineMatrix />);

    // Two rows of labels in one table; they should read as one kind of thing.
    const chip = section('protocols').querySelector('span:not([aria-hidden])');
    expect(chip).toHaveTextContent(t('home.matrix.group.protocols'));
    expect(chip).toHaveClass('rounded-pill', 'bg-surface-container-high', 'uppercase');
    // Squeezed, "Over the top" broke across two lines inside its pill.
    expect(chip).toHaveClass('whitespace-nowrap');
  });

  it('rounds the head’s hover the way the lit column is rounded', async () => {
    render(<EngineMatrix />);

    // A hover previews the fill, so it takes the fill's corners rather than
    // dropping a square block behind the chip.
    for (const name of ['sing-box', 'xray-core', 'mihomo']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveClass('rounded-t-lg');
    }
  });

  it('lets the name column shrink to its content on a phone', () => {
    const { container } = render(<EngineMatrix />);

    // At 46% of a 350px screen it left 146px of nothing between a name and
    // its first mark. Unset below `sm`, it shrinks and the marks meet it.
    const corner = container.querySelector('thead td') as HTMLElement;
    expect(corner).toHaveClass('sm:w-[46%]');
    expect(corner.className).not.toMatch(/(^|\s)w-\[/);
  });

  it('pins each section’s own header under the pinned head', () => {
    const { container } = render(<EngineMatrix />);

    // A sticky cell travels only as far as its row group, so the header shares
    // one `tbody` with the rows it names — alone in its own it had nowhere to
    // go. 136px is the site header plus the table head on a phone, 140 from
    // `sm` up, both measured on the built page rather than guessed.
    const cells = Array.from(container.querySelectorAll('[data-section] th, [data-section] td'));
    for (const c of cells) expect(c).toHaveClass('sticky', 'top-[135px]', 'sm:top-[139px]', 'z-10');
    for (const g of GROUPS) {
      expect(container.querySelector(`[data-group="${g.key}"] [data-section]`)).not.toBeNull();
      expect(container.querySelectorAll(`[data-group="${g.key}"] tbody`)).toHaveLength(0);
    }
  });

  it('gives a section header a ground that pins without lighting up', () => {
    const { container } = render(<EngineMatrix />);

    const header = container.querySelector('[data-section]') as HTMLElement;
    const counts = Array.from(header.querySelectorAll('td'));
    // Opaque because it pins, but in the page's own ground: a filled row was a
    // second highlight competing with the lit column for the same glance. The
    // lit column keeps its one fill straight through and passes over.
    expect(counts[0]).toHaveClass('bg-surface-container-low');
    expect(counts[1]).toHaveClass('bg-background');
    expect(header.querySelector('th')).toHaveClass('bg-background', 'border-t');
  });

  it('separates its borders, so a pinned cell keeps them', () => {
    const { container } = render(<EngineMatrix />);

    // A collapsed border belongs to the table rather than to the cell, so a
    // sticky cell carries its background away and leaves its borders behind.
    // That was the torn seam under the head at fractional scroll offsets.
    expect(container.querySelector('table')).toHaveClass('border-separate', 'border-spacing-0');
  });

  it('pins the head, so thirteen rows never outrun the columns naming them', () => {
    const { container } = render(<EngineMatrix />);

    // 64px is the site header's own height, and z-10 puts this under it.
    const cells = Array.from(container.querySelectorAll('thead td, thead th'));
    for (const cell of cells) expect(cell).toHaveClass('sticky', 'top-16', 'z-20');
    // Transparent while it scrolled was fine; pinned, rows would read through.
    expect(cells[0]).toHaveClass('bg-background');
    expect(cells[1]).toHaveClass('bg-surface-container-low');
    expect(cells[2]).toHaveClass('bg-background');
  });

  it('opens on the transports, with the other axes stating their counts', () => {
    const { container } = render(<EngineMatrix />);

    expect(section('transports')).toHaveAttribute('aria-expanded', 'true');
    expect(section('protocols')).toHaveAttribute('aria-expanded', 'false');
    expect(shut(container, 'transports')).toBe(false);
    expect(shut(container, 'protocols')).toBe(true);
  });

  it('draws every protocol at once — no second control inside the section', () => {
    const { container } = render(<EngineMatrix />);

    // The section header is the only control in the table. A "show 8 more"
    // row inside an open section was a second disclosure level for a list the
    // accordion already closes.
    expect(rowsOf(container, 'protocols')).toHaveLength(PROTOCOLS.length);
    expect(screen.queryByRole('button', { name: /more/i })).toBeNull();
    // One per section, one per engine head. Nothing else in the table clicks.
    expect(screen.getAllByRole('button')).toHaveLength(GROUPS.length + 3);
  });

  it('states each engine’s count in that engine’s column, open or shut', () => {
    const { container } = render(<EngineMatrix />);

    const cells = (key: string) =>
      Array.from(
        container.querySelectorAll(`[data-group="${key}"] [data-section] td`),
      ).map((td) => td.textContent);

    expect(cells('protocols')).toEqual(['13', '7', '12']);
    // The one row where xray-core leads, visible before anything is expanded.
    expect(cells('transports')).toEqual(['5', '6', '5']);
    expect(cells('security')).toEqual(['3', '3', '3']);
  });

  it('opens a section on click and closes it again', async () => {
    const user = userEvent.setup();
    const { container } = render(<EngineMatrix />);

    await user.click(section('protocols'));
    expect(section('protocols')).toHaveAttribute('aria-expanded', 'true');
    expect(shut(container, 'protocols')).toBe(false);
    expect(screen.getByText('Shadowsocks')).toBeInTheDocument();

    await user.click(section('protocols'));
    expect(shut(container, 'protocols')).toBe(true);
  });

  it('shuts whichever section was open when another one opens', async () => {
    const user = userEvent.setup();
    const { container } = render(<EngineMatrix />);

    await user.click(section('security'));

    // Three answers to one question, measured against columns at the top: two
    // sections open at once pushes the second one's rows past the header they
    // are read against.
    expect(shut(container, 'security')).toBe(false);
    expect(shut(container, 'transports')).toBe(true);
    expect(section('transports')).toHaveAttribute('aria-expanded', 'false');
  });

  it('holds the header you clicked still while the page changes height', async () => {
    const user = userEvent.setup();
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);

    render(<EngineMatrix />);
    const button = section('protocols');
    // Shutting the protocols takes nine hundred pixels out of the middle of
    // the page. jsdom lays nothing out, so the shift is staged: 300 before the
    // click, 120 after it.
    const tops = [300, 120];
    vi.spyOn(button, 'getBoundingClientRect').mockImplementation(
      () => ({ top: tops.shift() ?? 120 }) as DOMRect,
    );

    await user.click(button);

    expect(scrollBy).toHaveBeenCalledWith(0, -180);
    vi.unstubAllGlobals();
  });

  it('leaves the scroll alone when nothing moved', async () => {
    const user = userEvent.setup();
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);

    render(<EngineMatrix />);
    await user.click(section('transports'));

    expect(scrollBy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shuts the last one too, leaving the table as three counted rows', async () => {
    const user = userEvent.setup();
    const { container } = render(<EngineMatrix />);

    await user.click(section('transports'));

    for (const g of GROUPS) expect(shut(container, g.key)).toBe(true);
    // A state a reader gets to deliberately, never the one the band loads in.
    expect(screen.getByText('13')).toBeInTheDocument();
  });

  it('says whether an engine runs a row, for a reader who sees no dot', async () => {
    const { container } = render(<EngineMatrix />);

    const xhttp = rowsOf(container, 'transports').at(-1) as HTMLElement;
    expect(within(xhttp).getAllByText(t('home.matrix.no'))).toHaveLength(2);
    expect(within(xhttp).getAllByText(t('home.matrix.runs'))).toHaveLength(1);
  });

  it('answers in shape, never in colour alone', () => {
    const { container } = render(<EngineMatrix />);

    // A filled dot or a rule. The table survives a monochrome print and a
    // reader who cannot separate the two tones.
    const shadowtls = rowsOf(container, 'protocols').at(-1) as HTMLElement;
    const marks = Array.from(shadowtls.querySelectorAll('td span[aria-hidden]'));
    expect(marks.map((m) => m.className.includes('rounded-full'))).toEqual([true, false, false]);
  });

  it('keeps the "does not run" rule above the contrast a mark owes', () => {
    const { container } = render(<EngineMatrix />);

    // `--outline-variant` at 28% on the 7% ground measured 2.1:1, under the
    // 3:1 of WCAG 1.4.11. `--outline` at 55% measures 5.6:1.
    const rule = container.querySelector('[data-group="protocols"] span[aria-hidden].w-3\\.5');
    expect(rule).toHaveClass('bg-outline');
  });

  it('lights the default engine’s column and nothing else', () => {
    const { container } = render(<EngineMatrix />);

    const head = screen.getAllByRole('columnheader').slice(0, 3);
    expect(head[0]).toHaveClass('bg-surface-container-low', 'rounded-t-lg');
    expect(head[1]).toHaveClass('bg-background');
    // One token from the head to the foot, so the column is a single fill
    // rather than a run of tinted cells that step against each other.
    const foot = Array.from(container.querySelectorAll('tfoot td'));
    expect(foot[1]).toHaveClass('bg-surface-container-low', 'rounded-b-lg');
    expect(foot[2].className).not.toContain('bg-surface-container');
  });

  it('paints the divider inside the stripe in the stripe’s own colour', () => {
    const { container } = render(<EngineMatrix />);

    // A transparent `border-t` still occupies its pixel, so skipping the rule
    // would open a hairline gap in the lit column at every row.
    const row = rowsOf(container, 'protocols')[1];
    const cells = Array.from(row.querySelectorAll('td'));
    expect(cells[0]).toHaveClass('border-t-surface-container-low', 'bg-surface-container-low');
    expect(cells[1]).toHaveClass('border-t-outline-variant');
  });

  it('turns the chevron rather than swapping an icon, and holds still when asked', () => {
    render(<EngineMatrix />);

    const chevron = section('transports').querySelector('span[aria-hidden]');
    expect(chevron).toHaveClass('-rotate-[135deg]', 'motion-reduce:transition-none');
    expect(section('protocols').querySelector('span[aria-hidden]')).toHaveClass('rotate-45');
  });

  it('names itself for a screen reader without putting a title on the page', () => {
    const { container } = render(<EngineMatrix />);

    const caption = container.querySelector('caption');
    expect(caption).toHaveTextContent(t('home.matrix.caption'));
    expect(caption).toHaveClass('sr-only');
  });
});
