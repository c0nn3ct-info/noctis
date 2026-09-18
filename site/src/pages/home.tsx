import { Check, Route, ScanSearch, ShieldCheck, Shuffle, type LucideIcon } from 'lucide-react';
import { ArchitectureDiagram } from '@/components/architecture-diagram';
import { CapabilityLanes } from '@/components/landing/capability-lanes';
import { CtaPair } from '@/components/landing/cta-pair';
import { EngineMatrix } from '@/components/landing/engine-matrix';
import { FaqBand } from '@/components/landing/faq-band';
import { HeroScene } from '@/components/landing/hero-scene';
import { LinkAnatomy } from '@/components/landing/link-anatomy';
import { PopupBand } from '@/components/landing/popup-band';
import { HERO_PROTOCOLS, PROTOCOLS } from '@/components/landing/engines';
import {
  ClaimList,
  LandingSection,
  PointList,
  SectionHeading,
  type Claim,
  type Point,
} from '@/components/landing/shell';
import { t } from '@/i18n';
import { useSectionEntrance } from '@/lib/use-enter';
import { Layout } from '@/layout';

/**
 * The landing page, at `/` and each locale's root.
 *
 * Bands, furniture and entrances follow the aria2t landing page, which solved
 * the same problems first: `LandingSection`/`SectionHeading` own the rhythm,
 * `data-enter` hands each band its arrival, and the product appears as the
 * mock the site already ships rather than as an illustration of itself.
 *
 * Three things are shared with the rest of the site rather than redrawn: the
 * popup and browser mocks, the architecture diagram, and the FAQ's ten
 * questions, which come from `FAQ_KEYS` — the same ten the FAQPage JSON-LD in
 * scripts/prerender.mjs and src/i18n/seo.ts publishes, so the visible answers
 * and the structured ones cannot drift apart.
 */

/** What the matrix cannot say: who picks the engine, and when you find out. */
const ENGINE_CLAIMS: readonly { icon: LucideIcon; key: string }[] = [
  { icon: Shuffle, key: 'c1' },
  { icon: ScanSearch, key: 'c2' },
];

/** What the anatomy band's panel proves, beside the panel that proves it. */
const ANATOMY_POINTS: readonly Point[] = [
  { icon: Check, text: 'home.anatomy.p1' },
  { icon: Route, tone: 'tertiary', text: 'home.anatomy.p2' },
  { icon: ShieldCheck, tone: 'primary', text: 'home.anatomy.p3' },
];

export function HomePage() {
  // Bands arrive as they come up. Where the browser has scroll-driven
  // timelines this is pure CSS and the hook does nothing; see
  // `src/lib/use-enter.ts` for which path runs where.
  useSectionEntrance();
  const points = ANATOMY_POINTS.map((p) => ({ ...p, text: t(p.text) }));
  const claims: Claim[] = ENGINE_CLAIMS.map(({ icon, key }) => ({
    icon,
    title: t(`home.protocols.${key}.title`),
    body: t(`home.protocols.${key}.body`),
  }));

  return (
    <Layout current="home" bleed>
      {/* The hero is the one section that is not a LandingSection: it is
          already on screen when the page opens, so there is nothing for it to
          arrive from. It keeps the band padding by hand. */}
      {/* A tall band with its content centred, which is how the aria2t hero
          sits: measured there, the headline lands 158px under the sticky header
          at 1440 and 56px at 390. Padding alone got the phone right and left
          the desktop 62px high, because `pt-24` hangs the copy off the top
          instead of centring it in a band with room to spare. */}
      <section className="relative overflow-hidden">
        {/* The planet is the band's ground, not a picture beside the copy: it
            runs the full width and the headline sits on it. A figure in its
            own column is something the page shows you; a figure the words are
            standing on is the place the words are about.
          *
          * It is hung off the right so the land sits under the right-hand half
          * and the limb crosses behind the headline, and it is taller than the
          * band so no edge of the canvas can appear. */}
        {/* Wide enough for the copy and the planet to sit side by side, the
            planet is beside it and behind it. Below that there is only one
            column, so it drops under the words instead, anchored to the
            bottom-right corner.
          *
            The switch is at `md`, not `lg`. The copy needs about 600px and
            the planet wants the rest, which a 768px band already has — held
            at `lg` the whole thing fell back to the stacked layout at 1000px,
            where there is plainly room for both, and left a small globe in a
            corner of a very empty band.
          *
            Stacked, the globe climbs under the buttons and the chips rather
            than waiting below them, and it is wider than the window. Both
            because it can: those rows carry their own grounds — filled,
            outlined, blurred — so they read over a planet, and the band does
            not have to buy the figure's whole height in padding to give it a
            size worth looking at. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[2%] end-[-14%] h-[74%] w-[128%] sm:bottom-[1%] sm:end-[-10%] sm:h-[76%] sm:w-[112%] md:inset-y-[-12%] md:end-[-3%] md:h-auto md:w-[62%] lg:inset-y-[-14%] lg:end-[-4%] lg:w-[72%] xl:w-[80%]"
        >
          <HeroScene aria-label={t('home.hero.scene_alt')} />
        </div>

        {/* And the scrim that keeps the copy legible over it: opaque where the
            words are, gone by the time it reaches the planet. Downward on a
            phone, inward from the copy's edge once there is room for both.
          *
          * An ellipse around the copy rather than a wash across the band, and
          * that is the difference between the planet going behind the words
          * and the planet going dim. A left-to-right gradient dims a
          * full-height column: it has to reach past the headline, so it also
          * reaches the globe's near limb at half strength, and the land comes
          * out grey on that side — two different planets joined down the
          * middle. An ellipse covers the block the words are in and lets go
          * in every direction, so the figure keeps its own contrast
          * everywhere nothing is written on it.
          *
          * Every alpha goes through `--hero-wash` (globals.css), which is the
          * whole of what makes the two stages agree: these are authored for
          * the dark one, where light copy over a lit globe has to be pushed a
          * long way down to win, and on the light stage the same numbers are
          * a white fog over already-pale land. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,hsl(var(--background)/calc(1*var(--hero-wash)))_0%,hsl(var(--background)/calc(0.95*var(--hero-wash)))_22%,hsl(var(--background)/calc(0.6*var(--hero-wash)))_34%,transparent_48%)] md:bg-[radial-gradient(ellipse_40%_62%_at_20%_48%,hsl(var(--background)/calc(1*var(--hero-wash)))_0%,hsl(var(--background)/calc(0.96*var(--hero-wash)))_50%,hsl(var(--background)/calc(0.55*var(--hero-wash)))_78%,transparent_100%)] lg:bg-[radial-gradient(ellipse_34%_60%_at_19%_48%,hsl(var(--background)/calc(1*var(--hero-wash)))_0%,hsl(var(--background)/calc(0.96*var(--hero-wash)))_52%,hsl(var(--background)/calc(0.55*var(--hero-wash)))_78%,transparent_100%)]"
        />

        {/* And the band's free edges, where the figure runs off it and has to
            dissolve rather than cut. The seam at the bottom matters most: the
            next section starts on that line, and a globe sliced by it reads
            as a mistake rather than as a picture. The far edge only exists
            below `md`, where the stacked globe is wider than the screen — it
            is what makes that read as a planet bigger than the window instead
            of one with a side sawn off.
          *
            Neither is scaled by `--hero-wash`: dissolving the figure where it
            leaves the band is the same job in either theme. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[14%] bg-[linear-gradient(to_top,hsl(var(--background))_0%,hsl(var(--background)/0.55)_46%,transparent_100%)] md:h-[11%]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-0 w-[9%] bg-[linear-gradient(to_left,hsl(var(--background)/0.85)_0%,hsl(var(--background)/0.4)_45%,transparent_100%)] md:hidden"
        />
        {/* The aurora that used to tie the two columns together is gone with
            them. It was a teal glow for a band that now has a violet planet in
            it, and laid over the figure it turned the land grey-green. One
            figure is enough; a second glow is only a second figure. */}
        {/* The band's own height, and below `md` that includes a strip for the
            planet: stacked, the figure is the subject rather than a backdrop,
            and it can only be drawn at a size worth looking at if the band
            carries room for it under the copy. Without any strip the globe
            was squeezed into whatever was left and came out a third of the
            size it has beside the copy — but the strip only has to carry the
            part of the figure the buttons are not standing on, which is why
            it is smaller than the globe. Capped in vh as well as px so a
            short window does not end up with a hero two screens tall. */}
        <div className="relative mx-auto flex min-h-[620px] w-full max-w-[1160px] flex-col justify-center px-5 pb-[min(32vh,240px)] pt-14 sm:min-h-[720px] sm:px-8 sm:pb-[min(30vh,270px)] sm:pt-20 md:pb-20 lg:px-10 lg:py-24">
          {/* aria2t's shape, and for its reason: only the reading blocks are
              capped, and the buttons and the chips are their siblings at the
              band's own width.
            *
              Held in a grid column instead — which is what this was, with an
              empty second column reserving the planet's half — the pair had
              358px to sit in at 813, needed 362, and broke onto two lines at
              their own widths. A row of two buttons that wraps reads as a
              layout that ran out of room rather than as a choice between two
              things, and it did it in a band 45px wide. */}
          <div className="flex flex-col">
            {/* Two weights, one sentence: the claim in 800, the qualifier in
                250. The variable-weight system face is what makes the second
                line recede without changing its size or its colour alone.
              *
                The measure narrows where the planet comes alongside, and the
                heading's size is capped with it — aria2t's rule, and the
                reason is the wrap: the longer line runs about nine times the
                font size, so a measure that stops growing while the font
                keeps going is exactly how two lines become three. */}
            <div className="max-w-[600px] md:max-w-[420px] lg:max-w-[min(600px,42vw)]">
              <h1 className="m-0 text-[clamp(38px,6vw,72px)] leading-[0.93] tracking-[-0.04em] md:text-[min(45px,6vw)] lg:text-[min(72px,5vw)]">
                <span className="block font-extrabold">{t('home.hero.h1_a')}</span>
                <span className="block font-[250] text-on-surface-variant">
                  {t('home.hero.h1_b')}
                </span>
              </h1>

              <p className="m-0 mt-5 max-w-[44ch] text-[clamp(16px,1.6vw,19px)] leading-[1.53] text-on-surface-variant [text-wrap:pretty]">
                {t('home.hero.lede')}
              </p>
            </div>

            {/* Full width while they stack, their own width once they sit in a
                row — which needs the row to have the band to sit in. */}
            <CtaPair className="mt-7 sm:mt-8" />

            {/* aria2t's Works with block: a label over a row of names you can
                run your eye along. Thirteen chips filled four lines and read as
                a wall, so the hero names the five a visitor is most likely to
                be holding a link for and counts the rest. Both lists come out
                of `PROTOCOLS`, so the count can never drift from the grid
                and the hero can never name a protocol the grid does not. */}
            <div className="mt-8 flex flex-col gap-3 lg:mt-10">
              {/* The chips below carry their own grounds and the buttons above
                  are filled, which leaves this label as the only copy sitting
                  straight on the figure. It gets a ground too — aria2t
                  measured the same label at 1.4:1 over its scene and reached
                  the same conclusion. */}
              <span className="w-fit rounded-sm bg-background/95 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-on-surface-variant backdrop-blur-sm">
                {t('home.hero.works_with')}
              </span>
              <ul
                data-testid="hero-protocols"
                className="flex max-w-[600px] flex-wrap gap-1.5 font-mono sm:gap-2 md:max-w-[420px] lg:max-w-[min(600px,42vw)]"
              >
                {HERO_PROTOCOLS.map((tile) => (
                  <li key={tile.name}>
                    <span className="inline-flex h-9 items-center rounded-pill border border-outline-variant bg-surface-container-low/80 px-3.5 font-mono text-xs text-on-surface backdrop-blur-sm transition-colors duration-med ease-emph hover:border-outline hover:bg-surface-container-high/85 sm:h-10 sm:px-4">
                      {tile.name}
                    </span>
                  </li>
                ))}
                {/* The sixth is a count, not a name, so it is filled rather than
                    outlined — and it goes to the grid that lists the eight,
                    which is what a visitor reading this row wants next. */}
                <li>
                  <a
                    href="#protocols"
                    className="inline-flex h-9 items-center rounded-pill bg-surface-container-high/90 px-3.5 font-mono text-xs text-on-surface backdrop-blur-sm transition-colors duration-med ease-emph hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:px-4"
                  >
                    {t('home.hero.more').replace('{n}', String(PROTOCOLS.length - HERO_PROTOCOLS.length))}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The product, second: everything below it is a claim about the thing
          this band shows. */}
      <PopupBand />

      {/* One band, one object. The grid and the engine rows were two blocks
          saying the same thing in different languages — the grid's own group
          labels were engine names — and the transports were a paragraph because
          there was nowhere structural to put them. The matrix is where all
          three meet. */}
      <LandingSection id="protocols">
        {/* Two columns, the same shape the anatomy band takes. Run across the
            band's full 1080 the table travels most of a screen from a name to
            its third mark; capped at 860 under a heading it left a quarter of
            the band empty on the right, and the heading sat over 400px of
            blank name column. Beside it, the heading fills what the table does
            not need and the marks come in under their own columns. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,660px)] lg:gap-14">
          {/* The column stretches and the heading sticks inside it, 80px under
              the site header. Thirteen rows leave the left column a thousand
              pixels of nothing to sit above otherwise, and the heading is the
              question the table answers — they belong on screen together. The
              entrance goes on the inner element: a transform on the sticky one
              would make it its own containing block and pin it in place. */}
          <div>
            <div className="lg:sticky lg:top-[80px]">
              <div data-enter="soft">
                <SectionHeading title={t('home.protocols.h2')} body={t('home.protocols.lede')} />
              </div>
              {/* Two claims the table cannot make. It answers what runs where;
                  these answer who chooses and when you find out — both read off
                  `selectCore` and `serverUnsupportedReasons`. No rule above
                  them: the size step from the lede is the break, and a line
                  drawn across half the band reads as a division the band does
                  not have. */}
              <ClaimList claims={claims} className="mt-9" />
            </div>
          </div>
          {/* `overflow-x: auto` makes this a scroll container, and a scroll
              container is what a sticky table head sticks to — pinned inside
              it, the head measured 23px from the viewport top instead of the
              64 it asks for, half of it behind the site header. The table fits
              from 360px up, so the scroller is only there for the narrowest
              phones and goes away at `sm`. */}
          {/* `overflow-x: auto` makes this a scroll container, and a scroll
              container is what a sticky table head sticks to — pinned inside
              it, the head measured 23px from the viewport top instead of the
              64 it asks for, half of it behind the site header. The table fits
              from 360px up, so the scroller is only there for the narrowest
              phones and goes away at `sm`. */}
          <div
            data-enter="soft"
            className="scrollbar-quiet min-w-0 self-start overflow-x-auto sm:overflow-x-visible"
          >
            <EngineMatrix className="w-auto max-w-[660px] sm:w-full" />
          </div>
        </div>
      </LandingSection>

      <LandingSection id="anatomy">
        {/* Two columns again, now that the panel is narrow. It held a full copy
            of the link before and needed every pixel of the band; a table of
            nine short rows needs about 460, and left on its own it sat in the
            left half of a 1080px panel with the right half empty. */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-14">
          <div>
            <div data-enter="soft">
              <SectionHeading title={t('home.anatomy.h2')} body={t('home.anatomy.lede')} />
            </div>
            <PointList points={points} className="mt-8" />
          </div>
          <div data-enter="soft" className="min-w-0">
            <LinkAnatomy />
          </div>
        </div>
      </LandingSection>

      <LandingSection id="capabilities">
        {/* No body: the only thing the lede said was which lane each group sits
            on, which describes the page rather than the product. */}
        <div data-enter="soft" className="mb-8">
          <SectionHeading title={t('home.caps.h2')} />
        </div>
        {/* No stagger and no `data-enter` on the lanes: they are already the one
            thing on the page that moves on its own, and an arrival on top of a
            marquee reads as a stutter. */}
        <CapabilityLanes />
      </LandingSection>

      <LandingSection id="why-three-parts">
        <div data-enter="soft" className="mb-8">
          <SectionHeading title={t('home.arch.h2')} body={t('home.arch.lede')} />
        </div>
        {/* Wrapped rather than marked: the diagram is the live page's component
            too, and the entrance rules are global, so an attribute inside it
            would animate a page that never asked for one. */}
        <div data-enter="soft">
          <ArchitectureDiagram />
        </div>
      </LandingSection>

      {/* The band writes its own heading, so it gets no SectionHeading: its
          heading, its lede and the two contact links are one column, with the
          questions beside them. It closes the page. */}
      <LandingSection id="faq">
        <FaqBand />
      </LandingSection>
    </Layout>
  );
}
