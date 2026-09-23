import { CtaPair } from '@/components/landing/cta-pair';
import { EngineReach } from '@/components/landing/engine-reach';
import { FaqBand } from '@/components/landing/faq-band';
import { HeroScene } from '@/components/landing/hero-scene';
import { LinkAnatomy } from '@/components/landing/link-anatomy';
import { PopupBand } from '@/components/landing/popup-band';
import { RoutingBand } from '@/components/landing/routing-band';
import { SubscriptionBand } from '@/components/landing/subscription-band';
import { HERO_PROTOCOLS, PROTOCOLS } from '@/components/landing/engines';
import { LandingSection, SectionHeading } from '@/components/landing/shell';
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

export function HomePage() {
  // Bands arrive as they come up. Where the browser has scroll-driven
  // timelines this is pure CSS and the hook does nothing; see
  // `src/lib/use-enter.ts` for which path runs where.
  useSectionEntrance();
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
        <div className="relative mx-auto flex min-h-[620px] w-full max-w-[1160px] flex-col justify-center px-5 pb-[min(32vh,240px)] pt-14 sm:min-h-[720px] sm:px-8 sm:pb-[min(30vh,270px)] sm:pt-20 md:pb-20 lg:px-10 lg:py-24 [@media(max-height:500px)]:min-h-0 [@media(max-height:500px)]:pt-10">
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
              <h1 className="m-0 text-[clamp(36px,6vw,72px)] leading-[0.93] tracking-[-0.04em] md:text-[min(45px,6vw)] lg:text-[min(72px,5vw)]">
                <span className="block font-extrabold">{t('home.hero.h1_a')}</span>
                <span className="block font-light text-on-surface-variant">
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
              <span className="w-fit rounded-sm bg-background/95 px-1.5 py-0.5 text-overline uppercase text-on-surface-variant backdrop-blur-sm">
                {t('home.hero.works_with')}
              </span>
              <ul
                data-testid="hero-protocols"
                className="flex max-w-[600px] flex-wrap gap-1.5 font-mono sm:gap-2 md:max-w-[420px] lg:max-w-[min(600px,42vw)]"
              >
                {HERO_PROTOCOLS.map((tile) => (
                  <li key={tile.name}>
                    <span className="inline-flex h-9 items-center rounded-pill border border-outline-variant bg-surface-container-low/80 px-3.5 font-mono text-xs text-on-surface backdrop-blur-sm sm:h-10 sm:px-4">
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
                    className="relative before:absolute before:inset-x-0 before:-inset-y-1 sm:before:-inset-y-0.5 before:content-[''] inline-flex h-9 items-center rounded-pill bg-surface-container-high/90 px-3.5 font-mono text-xs text-on-surface backdrop-blur-sm transition-colors duration-med ease-emph hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:px-4"
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

      {/* What the product does with the traffic, before any band says which
          protocols it can do it over: a profile deciding seven requests, and a
          mode that overrules it. It follows the popup because the popup is
          where these three words — proxy, direct, blocked — are read. */}
      <LandingSection id="routing">
        <div data-enter="soft" className="mb-10">
          <SectionHeading
            title={t('home.routing.h2')}
            body={t('home.routing.lede')}
            className="max-w-[760px]"
          />
        </div>
        <div data-enter="soft">
          <RoutingBand />
        </div>
      </LandingSection>

      {/* One band, one claim: all three engines ship, and Noctis starts the
          one a server needs.
        *
          It was a table of twenty-two rows by three columns, under a heading
          that promised an answer about a link. The band above answers that
          about the link you paste, so what is left here is the fact the tiles
          state and the names the hero counts. Full width and no column of
          claims beside it: the tiles are the claim. */}
      <LandingSection id="protocols">
        {/* 40px under the heading, which is the step the band's own parts take
            between them. */}
        <div data-enter="soft" className="mb-10">
          <SectionHeading
            title={t('home.protocols.h2')}
            body={t('home.protocols.lede')}
            className="max-w-[760px]"
          />
        </div>
        <div data-enter="soft">
          <EngineReach />
        </div>
      </LandingSection>

      <LandingSection id="anatomy">
        {/* The heading goes to the band rather than to a column beside the
            panel, and the panel takes the band's full width.
          *
            Beside it is the two-column shape the rest of the page uses, and it
            was the wrong one here: the copy is a heading and one sentence, so
            the left column ran out after three lines and stood empty for the
            height of the panel, while the panel stacked a link, nine values and
            a verdict into a 560px column. One side bare and the other crowded
            was never a density problem inside the panel — it was the column.
          *
            Its measure is wider than the shell's 600: the lede is the band's
            only sentence and the card under it runs the band's full width, so a
            600px column of copy over a 1080px card reads as a caption that lost
            its figure. The answer — which engine this link runs on — is inside
            the card now, on the rail beside the fields that decided it. */}
        <div data-enter="soft" className="mb-10">
          <SectionHeading
            title={t('home.anatomy.h2')}
            body={t('home.anatomy.lede')}
            className="max-w-[760px]"
          />
        </div>
        <div data-enter="soft">
          <LinkAnatomy />
        </div>
      </LandingSection>

      {/* Where the architecture diagram used to stand. That drawing answers
          "why is there a helper", which is a question a visitor has after
          deciding to install rather than before, so it moved to the install
          page; this answers the one a visitor holding a provider's link has
          right now. */}
      <LandingSection id="subscriptions">
        <div data-enter="soft" className="mb-10">
          <SectionHeading
            title={t('home.subs.h2')}
            body={t('home.subs.lede')}
            className="max-w-[760px]"
          />
        </div>
        <div data-enter="soft">
          <SubscriptionBand />
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
