import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HomePage } from './home';
import { HERO_PROTOCOLS, PROTOCOLS } from '@/components/landing/engines';
import { t } from '@/i18n';

describe('HomePage', () => {
  it('opens on a two-part headline and the sentence that qualifies it', () => {
    render(<HomePage />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(t('home.hero.h1_a'));
    expect(h1).toHaveTextContent(t('home.hero.h1_b'));
    expect(screen.getByText(t('home.hero.lede'))).toBeInTheDocument();
  });

  it('opens on the headline, with nothing above it competing for the line', () => {
    const { container } = render(<HomePage />);

    // The capsule over the h1 looked like a button and competed with the
    // sentence it sat on, and the dot inside it pulsed for a state that never
    // changes. Both are gone, and so is the price line that replaced them.
    expect(container.querySelector('.animate-status-dot')).toBeNull();
    const hero = container.querySelector('main section') as HTMLElement;
    // Everything the band puts behind the copy — the planet and its scrims —
    // is decoration and says so, so the first thing a reader meets is the
    // headline. Asserted on that rather than on a sibling index, which only
    // held while the band had exactly one decorative layer.
    const spoken = [...hero.children].filter((child) => child.getAttribute('aria-hidden') !== 'true');
    expect(spoken).toHaveLength(1);
    expect(spoken[0].querySelector('h1')).not.toBeNull();
  });

  it('names five protocols in the hero and counts the rest into the grid', () => {
    render(<HomePage />);

    // Thirteen chips filled four lines and read as a wall. The five are the
    // ones a visitor most often has a link for; the sixth chip is the count of
    // what is left, and it is the only one that goes anywhere.
    const hero = within(screen.getByTestId('hero-protocols'));
    for (const tile of HERO_PROTOCOLS) {
      expect(hero.getByText(tile.name)).toBeInTheDocument();
    }
    expect(screen.getByText(t('home.hero.works_with'))).toBeInTheDocument();
    const rest = PROTOCOLS.length - HERO_PROTOCOLS.length;
    expect(hero.getByRole('link', { name: t('home.hero.more').replace('{n}', String(rest)) })).toHaveAttribute(
      'href',
      '#protocols',
    );
  });

  it('sizes the hero chips as a finger target, not as a label', () => {
    render(<HomePage />);

    // aria2t's own answer to the same question: 36px on a phone, 40 from `sm`.
    // The sixth chip is the only one that clicks, and it was 30px tall.
    const hero = within(screen.getByTestId('hero-protocols'));
    expect(hero.getByRole('link', { name: /more/ })).toHaveClass('h-9', 'sm:h-10');
    expect(hero.getByText('VLESS')).toHaveClass('h-9', 'sm:h-10');
  });

  it('names no protocol in the hero the grid below does not list', () => {
    render(<HomePage />);

    const hero = within(screen.getByTestId('hero-protocols'));
    const named = PROTOCOLS.map((p) => p.name);
    const count = t('home.hero.more').replace('{n}', String(PROTOCOLS.length - HERO_PROTOCOLS.length));
    for (const item of hero.getAllByRole('listitem')) {
      const label = item.textContent ?? '';
      expect(named.includes(label) || label === count).toBe(true);
    }
  });

  it('runs six bands, each opening on its own heading', () => {
    const { container } = render(<HomePage />);

    // Each band's own heading is its first — the popup band's mock carries an
    // h2 of its own, deliberately, so the page's whole h2 list is not the
    // band list.
    const bands = Array.from(container.querySelectorAll('main section[data-enter-section]'));
    expect(bands.map((b) => b.querySelector('h2')?.textContent)).toEqual([
      t('home.popup.h2'),
      t('home.routing.h2'),
      t('home.protocols.h2'),
      t('home.anatomy.h2'),
      t('home.subs.h2'),
      t('home.faq.h2'),
    ]);
  });

  it('answers the engine band with three tiles rather than a grid of marks', () => {
    const { container } = render(<HomePage />);

    // It was twenty-two rows by three columns: sixty-six marks, nine of which
    // said only that the three engines agree about TLS.
    const protocols = container.querySelector('#protocols') as HTMLElement;
    expect(protocols.querySelector('table')).toBeNull();
    expect(protocols.querySelectorAll('button[data-engine]')).toHaveLength(3);
    expect(protocols.querySelectorAll('[data-chosen]')).toHaveLength(1);
    // The same twenty-two capabilities are there, grouped by who runs them.
    expect(protocols.querySelectorAll('[data-reach]')).toHaveLength(4);
    expect(protocols.querySelectorAll('[data-capability]')).toHaveLength(PROTOCOLS.length + 9);
    // And the claims beside it are gone with it: the tiles are the claim.
    expect(protocols.querySelector('[data-tile]')).toBeNull();
    expect(container.querySelector('#engine')).toBeNull();
  });

  it('opens no band with a kicker over its heading', () => {
    const { container } = render(<HomePage />);

    // A heading carries its own weight, and a label above one repeats the
    // section name into the outline for nothing. aria2t's shell took the
    // pattern out; this page followed.
    for (const key of ['protocols', 'routing', 'anatomy', 'engines']) {
      expect(screen.queryByText(t(`home.${key}.eyebrow`))).toBeNull();
    }
    expect(container.querySelectorAll('[data-kicker]')).toHaveLength(0);
  });

  it('leaves the hero out of the entrance sweep — it is already on screen', () => {
    const { container } = render(<HomePage />);

    const first = container.querySelector('main section');
    expect(first).not.toHaveAttribute('data-enter-section');
    expect(first?.querySelector('h1')).not.toBeNull();
  });

  it('shows the product before it makes any claim about it', () => {
    const { container } = render(<HomePage />);

    const bands = Array.from(container.querySelectorAll('main section[data-enter-section]'));
    expect(bands[0]).toHaveAttribute('id', 'popup');
  });

  it('closes on the FAQ band, which writes its own heading', () => {
    const { container } = render(<HomePage />);
    const sections = Array.from(container.querySelectorAll('main section'));

    const last = within(sections.at(-1) as HTMLElement);
    expect(sections.at(-1)).toHaveAttribute('id', 'faq');
    expect(last.getByRole('heading', { level: 2 })).toHaveTextContent(t('home.faq.h2'));
    expect(last.getByText(t('home.faq.no_answer'))).toBeInTheDocument();
  });

  it('lets the anatomy panel make the band’s case on its own', () => {
    render(<HomePage />);

    // The panel itself is the proof: a field, not a picture of one.
    expect(screen.getByRole('textbox', { name: t('home.anatomy.input_aria') })).toBeInTheDocument();
    // And it ends on the engine the pasted link asks for, which is what the
    // band is for.
    expect(screen.getByText(t('home.anatomy.engine_any'))).toBeInTheDocument();
    // The three points beside it are gone: they wrote down what the panel
    // draws — which fields decide, and which engine ends up running the link —
    // and a band that captions its own figure is read twice.
    expect(screen.queryByText(/decide how the tunnel works/i)).toBeNull();
  });

  it('puts the figure behind the copy and fades it out under the words', () => {
    const { container } = render(<HomePage />);

    // The planet is the band's ground rather than a picture beside it, so it
    // is the copy that needs cover, not the figure that needs a frame. The
    // scrim runs downward on a phone, where there is one column, and inward
    // from the copy's edge once there are two — and it is transparent well
    // before the far edge either way, or the land goes grey under a film.
    const scrim = container.querySelector('[class*="linear-gradient"]') as HTMLElement;
    // Downward on a phone, where there is one column and the planet sits
    // below the words.
    expect(scrim.className).toContain('to_bottom');
    expect(scrim.className).toContain('transparent_48%');
    // And an ellipse around the copy once there are two, so the figure keeps
    // its contrast everywhere nothing is written on it. A left-to-right wash
    // would have to dim a full-height column to cover the headline, and it
    // takes the globe's near limb with it.
    expect(scrim.className).toContain('md:bg-[radial-gradient(ellipse');
    expect(scrim.className).toContain('at_19%_48%');

    // Both switch at `md`, with the figure. Held at `lg` the band fell back
    // to the stacked layout at a thousand pixels, where there is plainly room
    // for the copy and the planet side by side.
    const figure = container.querySelector('[role="img"]')?.parentElement as HTMLElement;
    expect(figure.className).toContain('md:inset-y-');
    expect(figure.className).not.toContain('md:bottom-auto');

    // Every alpha in the scrim goes through `--hero-wash`, which is what lets
    // one authored shape serve both stages: these are written for the dark
    // one, and on the light one the same numbers are a white fog over
    // already-pale land.
    expect(scrim.className).toContain('var(--hero-wash)');

    // The band's free edges dissolve rather than cut. The seam at the bottom
    // is the one that always has to — the next section starts on that line —
    // and it reaches the page's own colour, unscaled, in either theme.
    const edges = [...container.querySelectorAll('section > [aria-hidden]')].map((el) => el.className);
    expect(edges.some((c) => c.includes('bottom-0') && c.includes('to_top') && !c.includes('--hero-wash'))).toBe(true);

    // And the stacked layout reserves a strip for the figure rather than
    // squeezing it into what is left: without it the globe came out a third
    // of the size it has beside the copy.
    const band = container.querySelector('main section > div.relative') as HTMLElement;
    // Only the part the buttons are not standing on: at 240px the strip ran
    // past the globe and left the foot of the band empty on a phone.
    expect(band.className).toContain('pb-[min(20vh,150px)]');
    expect(band.className).toContain('md:pb-20');

    // Square on a phone and hung from the foot, so the scene — which fits the
    // globe to the narrower side and centres it — puts it under the buttons
    // rather than up behind the lede.
    expect(figure.className).toContain('aspect-square');
    expect(figure.className).toContain('sm:aspect-auto');
  });

  it('keeps the call to action on one row wherever it fits on one', () => {
    const { container } = render(<HomePage />);

    // Only the reading blocks are capped; the pair and the chips are their
    // siblings at the band's own width. Held inside a grid column — which is
    // how the planet's half used to be reserved — the pair had 358px to sit
    // in at 813 and needed 362, so it broke onto two lines at their own
    // widths, in a band 45px wide. A row of two buttons that wraps reads as a
    // layout that ran out of room rather than as a choice between two things.
    const hero = container.querySelector('main section') as HTMLElement;
    expect(hero.querySelector('.grid')).toBeNull();

    const pair = hero.querySelector('a[href*="install"]')?.closest('div') as HTMLElement;
    expect(pair.parentElement?.className).not.toContain('max-w-');
    // And the heading's measure and its size are capped together, since the
    // size is what decides the wrap.
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('md:text-[min(45px,6vw)]');
    expect(heading.parentElement?.className).toContain('md:max-w-[420px]');

    // The teal aurora went with the two-column layout: it was a second glow
    // for a band that now has a violet planet in it, and over the figure it
    // turned the land grey-green.
    expect(container.querySelector('.animate-aurora-drift')).toBeNull();
  });

  it('leaves the sandbox boundary to the install page', () => {
    render(<HomePage />);

    // The diagram answers "why is there a helper", which is a question a
    // visitor has after deciding to install rather than before.
    expect(screen.queryByRole('region', { name: t('home.diagram.aria') })).toBeNull();
  });

  it('sits in the site chrome, at the page’s own width', () => {
    const { container } = render(<HomePage />);

    // Queried by position, not by role: the popup mock brings its own <footer>,
    // which a browser scopes out of `contentinfo` because it sits inside a
    // <section> — jsdom's role mapping does not, so the role query finds three.
    const root = container.firstElementChild as HTMLElement;
    expect(root.querySelector(':scope > header')).not.toBeNull();
    expect(root.querySelector(':scope > footer')).not.toBeNull();
    expect(screen.getByRole('main')).toHaveClass('w-full');
  });

  it('asks for the install twice: once at the top, once at the end', () => {
    render(<HomePage />);

    // Scoped to the page: the header nav and the footer carry an "Install"
    // link of their own, with the same label.
    const main = within(screen.getByRole('main'));
    expect(main.getAllByRole('link', { name: t('home.cta.install') })).toHaveLength(2);
    // The store is offered once, beside the hero's Install. The closing band
    // runs a single full-width Install instead of repeating the choice.
    expect(main.getAllByRole('link', { name: t('home.cta.webstore') })).toHaveLength(1);
  });
});
