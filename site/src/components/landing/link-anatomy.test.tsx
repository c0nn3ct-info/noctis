import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkAnatomy, fieldAt } from './link-anatomy';
import { SAMPLE_LINK, parseShareLink } from './share-link';
import { t } from '@/i18n';

const lines = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-field]')) as HTMLElement[];
const values = (c: HTMLElement) =>
  lines(c).map((line) => line.querySelector('[data-value]') as HTMLElement);
const slices = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-slice]')) as HTMLElement[];
const states = (els: HTMLElement[]) => els.map((el) => el.getAttribute('data-state'));
const field = () => screen.getByRole('textbox', { name: t('home.anatomy.input_aria') });
const rail = (c: HTMLElement) => c.querySelector('[data-rail]') as HTMLElement;
/** The engine chip that is filled, if one is. */
const chosen = (c: HTMLElement) => c.querySelector('[data-state="chosen"]');
/** What state a given engine's chip is in: chosen, able or out. */
const lamp = (c: HTMLElement, key: string) =>
  c.querySelector(`[data-engine="${key}"]`)?.getAttribute('data-state');

const parsed = parseShareLink(SAMPLE_LINK);

describe('fieldAt', () => {
  it('reads a character of the link back to the field it belongs to', () => {
    // `vless://` is the first eight characters, and the uuid follows it.
    expect(fieldAt(parsed, 0)).toBe(0);
    expect(fieldAt(parsed, 7)).toBe(0);
    expect(fieldAt(parsed, 8)).toBe(1);
    expect(fieldAt(parsed, SAMPLE_LINK.length - 1)).toBe(parsed.length - 1);
  });

  it('has no field before the link or after it', () => {
    expect(fieldAt(parsed, -1)).toBeNull();
    expect(fieldAt(parsed, SAMPLE_LINK.length)).toBeNull();
    expect(fieldAt([], 0)).toBeNull();
  });
});

describe('LinkAnatomy', () => {
  it('gives every field an entry: its name, its value, what it is for', () => {
    const { container } = render(<LinkAnatomy />);

    expect(field()).toHaveValue(SAMPLE_LINK);
    expect(lines(container)).toHaveLength(parsed.length);
    expect(lines(container).map((l) => l.firstElementChild?.textContent)).toEqual(
      parsed.map((f) => f.label),
    );
    // The value alone. `?security=` is punctuation, and it stays in the link
    // above rather than being quoted a second time down here.
    expect(values(container).map((v) => v.textContent)).toEqual(parsed.map((f) => f.value));
    expect(lines(container)[4]).not.toHaveTextContent('?security=');
  });

  it('sets the name of a field that decides at full weight', () => {
    const { container } = render(<LinkAnatomy />);

    const full = lines(container).map((l) =>
      l.firstElementChild?.className.includes('text-on-surface-variant'),
    );
    expect(full).toEqual(parsed.map((f) => !f.decides));
  });

  it('says what each field is for, and reads the value where the value decides', () => {
    const { container } = render(<LinkAnatomy />);

    expect(lines(container)[0]).toHaveTextContent(t('home.anatomy.note.protocol'));
    // 443 is the port that says something about the link rather than the server.
    expect(lines(container)[3]).toHaveTextContent(t('home.anatomy.note.port_https'));
    expect(lines(container)[4]).toHaveTextContent(t('home.anatomy.note.reality'));
    expect(lines(container)[6]).toHaveTextContent(
      t('home.anatomy.note.fingerprint').replace('{v}', 'chrome'),
    );
    expect(lines(container)[7]).toHaveTextContent(t('home.anatomy.note.tcp'));
  });

  it('follows the value when the link changes, not a canned note', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('vless://u@h.example:8443?security=tls&type=ws');

    expect(lines(container)[3]).toHaveTextContent(t('home.anatomy.note.port'));
    expect(lines(container)[4]).toHaveTextContent(t('home.anatomy.note.tls'));
    expect(lines(container)[5]).toHaveTextContent(t('home.anatomy.note.ws'));
  });

  it('marks nothing until the pointer asks for a mark', () => {
    const { container } = render(<LinkAnatomy />);

    expect(states(slices(container)).every((s) => s === 'plain')).toBe(true);
    expect(container.querySelector('[data-state="active"]')).toBeNull();
  });

  it('lights the row, its value and its slice of the link together', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    // `sni`: the sixth line of the sample link.
    await user.hover(lines(container)[5]);

    expect(lines(container)[5]).toHaveAttribute('data-state', 'active');
    expect(slices(container)[5]).toHaveAttribute('data-state', 'active');
    expect(values(container)[5]).toHaveClass('bg-primary');
    expect(states(slices(container)).filter((s) => s === 'active')).toHaveLength(1);

    await user.unhover(lines(container)[5]);

    expect(container.querySelector('[data-state="active"]')).toBeNull();
  });

  it('marks each entry with what kind of field it is, and lights the mark with it', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);
    const marks = () => lines(container).map((l) => l.querySelector('[data-mark]') as Element);

    expect(marks().every(Boolean)).toBe(true);
    expect(marks()[0]).toHaveClass('lucide-layers');
    expect(marks()[5]).toHaveClass('lucide-globe');
    // Decoration: the name is still the entry's first line for a reader.
    expect(marks()[0]).toHaveAttribute('aria-hidden', 'true');
    expect(marks().filter((m) => m.classList.contains('text-primary'))).toHaveLength(0);

    await user.hover(lines(container)[5]);

    expect(marks().map((m) => m.classList.contains('text-primary'))).toEqual(
      parsed.map((_, i) => i === 5),
    );
  });

  describe('under a finger', () => {
    it('pins a field with a tap, and lets it go with a second', async () => {
      const user = userEvent.setup();
      const { container } = render(<LinkAnatomy />);

      await user.click(lines(container)[5]);
      // The pointer leaving is what a touch screen reports after every tap.
      await user.unhover(lines(container)[5]);

      expect(lines(container)[5]).toHaveAttribute('data-state', 'active');
      expect(lines(container)[5]).toHaveAttribute('aria-pressed', 'true');
      expect(slices(container)[5]).toHaveAttribute('data-state', 'active');

      await user.click(lines(container)[5]);
      await user.unhover(lines(container)[5]);

      expect(container.querySelector('[data-state="active"]')).toBeNull();
    });

    it('moves the pin to whichever field is tapped next', async () => {
      const user = userEvent.setup();
      const { container } = render(<LinkAnatomy />);

      await user.click(lines(container)[1]);
      await user.click(lines(container)[2]);
      await user.unhover(lines(container)[2]);

      expect(states(slices(container)).filter((s) => s === 'active')).toHaveLength(1);
      expect(slices(container)[2]).toHaveAttribute('data-state', 'active');
    });

    it('lets go of a pin on Escape, or on a tap anywhere else', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <>
          <LinkAnatomy />
          <p>elsewhere</p>
        </>,
      );

      await user.click(lines(container)[0]);
      await user.unhover(lines(container)[0]);
      await user.keyboard('{Escape}');
      expect(container.querySelector('[data-state="active"]')).toBeNull();

      await user.click(lines(container)[0]);
      await user.unhover(lines(container)[0]);
      await user.click(screen.getByText('elsewhere'));
      expect(container.querySelector('[data-state="active"]')).toBeNull();
    });

    it('spells a pinned value out in full, which a tooltip never did on a phone', async () => {
      const user = userEvent.setup();
      const { container } = render(<LinkAnatomy />);
      const box = (i: number) => values(container)[i].parentElement as HTMLElement;

      expect(box(5)).toHaveClass('truncate');

      await user.click(lines(container)[5]);

      expect(box(5)).not.toHaveClass('truncate');
      expect(box(5)).toHaveClass('break-all');
      expect(box(4)).toHaveClass('truncate');
    });

    it('pins the engine’s fields from the line that names them', async () => {
      const user = userEvent.setup();
      const { container } = render(<LinkAnatomy />);
      const decided = screen.getByRole('button', { name: new RegExp(t('home.anatomy.decided_by'), 'i') });

      await user.click(decided);
      await user.unhover(rail(container));

      expect(decided).toHaveAttribute('aria-pressed', 'true');
      expect(states(lines(container))).toEqual(parsed.map((f) => (f.decides ? 'active' : 'plain')));
    });
  });

  it('spells the link back out of its own slices', () => {
    const { container } = render(<LinkAnatomy />);

    // Exhaustive by construction: every character lands in exactly one field.
    expect(slices(container).map((s) => s.textContent).join('')).toBe(SAMPLE_LINK);
  });

  it('names what decided the engine, off the link rather than out of a list', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    expect(rail(container)).toHaveTextContent('protocol · host · security · transport');

    // A link with no security parameter has three, and the rail says three.
    await user.clear(field());
    await user.paste('trojan://pw@relay.example.org:8443?type=ws');

    expect(rail(container)).toHaveTextContent('protocol · host · transport');
  });

  it('lights every field the engine was decided by when the rail is pointed at', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.hover(rail(container));

    expect(states(slices(container))).toEqual(
      parsed.map((f) => (f.decides ? 'active' : 'plain')),
    );
    expect(states(lines(container))).toEqual(parsed.map((f) => (f.decides ? 'active' : 'plain')));
    // The ground stays with the pointer: four filled cells would read as a
    // selection rather than as an answer.
    expect(lines(container).filter((l) => l.className.includes('bg-surface-container-low'))).toHaveLength(0);
  });

  it('says in words what each engine does with this link', () => {
    const { container } = render(<LinkAnatomy />);

    const row = (key: string) => container.querySelector(`[data-engine="${key}"]`);
    expect(row('singbox')).toHaveTextContent(t('home.anatomy.chip_starts'));
    expect(row('xray')).toHaveTextContent(t('home.anatomy.chip_able'));
  });

  it('ends on the engine the link asks for, and what decided it', () => {
    const { container } = render(<LinkAnatomy />);

    expect(chosen(container)).toHaveTextContent('sing-box');
    // Every engine runs a VLESS link over tcp, so none of the three is struck.
    expect(['singbox', 'xray', 'mihomo'].map((k) => lamp(container, k))).toEqual([
      'chosen',
      'able',
      'able',
    ]);
    expect(rail(container)).toHaveTextContent(t('home.anatomy.engine_any'));
  });

  it('follows the paste to a different engine', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('vless://u@h.example:443?type=xhttp');

    expect(chosen(container)).toHaveTextContent('xray-core');
    expect(['singbox', 'xray', 'mihomo'].map((k) => lamp(container, k))).toEqual([
      'out',
      'chosen',
      'out',
    ]);
    expect(rail(container)).toHaveTextContent(
      t('home.anatomy.engine_only').replace('{engine}', 'xray-core').replace('{what}', 'xhttp'),
    );
  });

  it('strikes the engine a protocol rules out, and keeps the one it leaves', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('hysteria2://u@h.example:443');

    expect(chosen(container)).toHaveTextContent('sing-box');
    expect(['singbox', 'xray', 'mihomo'].map((k) => lamp(container, k))).toEqual([
      'chosen',
      'out',
      'able',
    ]);
    expect(rail(container)).toHaveTextContent(
      t('home.anatomy.engine_without').replace('{what}', 'Hysteria2').replace('{engine}', 'xray-core'),
    );
  });

  it('refuses a combination no engine builds, in the terms that refused it', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('hysteria2://u@h.example:443?type=xhttp');

    expect(chosen(container)).toBeNull();
    expect(['singbox', 'xray', 'mihomo'].map((k) => lamp(container, k))).toEqual([
      'out',
      'out',
      'out',
    ]);
    // No dash standing in for an engine: every row says, in words, that it
    // cannot run this link, and the sentence under them says why.
    expect(container.querySelectorAll(`[data-engine]`)).toHaveLength(3);
    expect(rail(container)).toHaveTextContent(t('home.anatomy.chip_out'));
    expect(rail(container)).toHaveTextContent(
      t('home.anatomy.engine_none').replace('{other}', 'Hysteria2').replace('{what}', 'xhttp'),
    );
  });

  it('says a scheme is not one it reads, rather than picking an engine anyway', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('quic://h.example:443');

    expect(rail(container)).toHaveTextContent(t('home.anatomy.engine_unknown'));
  });

  it('asks for a link when what it has is not one, and says nothing about engines', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('not a link');

    expect(lines(container)).toHaveLength(0);
    expect(slices(container)).toHaveLength(0);
    expect(rail(container)).toBeNull();
    expect(screen.getByText(t('home.anatomy.empty'))).toBeInTheDocument();
  });

  it('offers a way back to the sample, only once you have left it', async () => {
    const user = userEvent.setup();
    render(<LinkAnatomy />);

    expect(screen.queryByRole('button', { name: t('home.anatomy.reset') })).toBeNull();

    await user.clear(field());
    await user.paste('ss://h.example:8388');
    await user.click(screen.getByRole('button', { name: t('home.anatomy.reset') }));

    expect(field()).toHaveValue(SAMPLE_LINK);
    expect(screen.queryByRole('button', { name: t('home.anatomy.reset') })).toBeNull();
  });

  it('reports on the link rather than on itself', () => {
    render(<LinkAnatomy />);

    // The header used to end in "9 fields read", which is a fact about the
    // panel rather than about the link in it.
    expect(screen.queryByText(/fields read/i)).toBeNull();
  });

  it('hands the colours to a copy of the string, and keeps the control a field', () => {
    const { container } = render(<LinkAnatomy />);

    // An input paints one colour, so the slices are a copy lying under the
    // caret: the input's own text is transparent and it scrolls the copy with
    // it. Both have to carry the same metrics or the two fall out of register.
    const mirror = container.querySelector('[data-mirror]') as HTMLElement;
    expect(mirror).toHaveClass('font-mono', 'text-title-dense', 'leading-[1.6]', 'py-3', 'whitespace-pre');
    expect(field()).toHaveClass('font-mono', 'text-title-dense', 'leading-[1.6]', 'py-3', 'text-transparent');
    expect(mirror).toHaveAttribute('aria-hidden');
  });

  it('claims the caret and the highlight in its own card', () => {
    const { container } = render(<LinkAnatomy />);

    // Both ship as the browser's unless a palette takes them, which is the
    // cheapest tell that a surface was assembled rather than built.
    const card = container.querySelector('[class*="caret-primary"]') as HTMLElement;
    expect(card).toHaveClass(
      'caret-primary',
      'selection:bg-primary-container',
      'selection:text-primary-on-container',
    );
    // And the field's focus indicator is the card's, so the ring follows its
    // radius instead of drawing square corners the radius then clips. Only the
    // field's: the entries are buttons now, and ring themselves.
    expect(card).toHaveClass(
      'has-[input:focus]:ring-2',
      'has-[input:focus]:ring-inset',
      'has-[input:focus]:ring-ring',
    );
  });

  it('gives the field a hit area a finger can land on', () => {
    render(<LinkAnatomy />);

    expect(field()).toHaveClass('py-3');
  });

  it('animates nothing of its own: the band’s entrance carries it', () => {
    const { container } = render(<LinkAnatomy />);

    for (const line of lines(container)) {
      expect(line.style.transform).toBe('');
      expect(line.style.getPropertyValue('--from')).toBe('');
    }
    expect(container.querySelector('[class*="link-cut"]')).toBeNull();
  });
});
