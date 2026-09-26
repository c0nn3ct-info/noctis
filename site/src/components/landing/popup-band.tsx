// "The whole product is one popup" — the band that shows the product itself,
// modelled on the aria2t site's `SurfacesSection`. The mock is the one the site
// already ships and the live home page already uses, so this band and the rest
// of the site cannot drift apart by a change to one of them.
//
// The switch is aria2t's too, with the terminal client marked as coming: the
// TUI is real and in progress in `host/cmd/noctis`, but it has not shipped, so
// the band shows it rather than offering it.
import { Activity, Gauge, MousePointerClick, Puzzle } from 'lucide-react';
import { BrowserMock } from '@/components/browser-mock';
import { PopupMock } from '@/components/popup-mock';
import { t } from '@/i18n';
import { ClaimList, LandingSection, SectionHeading, type Claim } from './shell';
import { SurfaceSwitch } from './surface-switch';

/**
 * The extension: its popup alone on a phone, and inside a browser frame once
 * there is room for both.
 *
 * The popup renders at its real 380px in both, with no transform. The window is
 * 500 wide, so the popup nearly fills it — the proportion a visitor sees on
 * their own screen. Handing the frame the whole column instead would keep the
 * popup at 380 and still misreport its size, by making the browser around it
 * enormous.
 *
 * Below `sm` the frame is the wrong container: wider than the viewport, it
 * would put the subject of the band off the right edge. The popup goes alone
 * there, laid out at its own 380 and scaled down to the column as one picture,
 * so a 360px phone sees all of it. A popup reflowed to 320 would be a different
 * popup; one scrolled sideways hid the half with the servers in it.
 */
function Extension() {
  return (
    <>
      <div className="[container-type:inline-size] sm:hidden">
        {/* `--s` is the column over 382 — the surface plus a pixel of framing on
            each edge — as a bare number: `atan2` of two lengths is an angle,
            and its tangent is their ratio. Never above 1, so a wide phone
            shows the popup at its own size. The height follows the scale, so
            nothing is left standing under the popup where it used to reach. */}
        <div
          data-fit
          className="flex justify-center"
          style={{
            '--s': 'min(1, tan(atan2(100cqw, 382px)))',
            height: 'calc(602px * var(--s))',
          } as React.CSSProperties}
        >
          {/* Its own layer, so it is rastered once at the scale. Painted with
              the band, Safari rastered the whole popup again on every frame
              of the band's exit and dropped a 60-70ms frame there. */}
          <div className="shrink-0 origin-top will-change-transform [transform:scale(var(--s))]">
            <PopupMock />
          </div>
        </div>
      </div>
      <div className="hidden sm:flex sm:justify-center">
        <BrowserMock className="w-full max-w-[500px]">
          <PopupMock />
        </BrowserMock>
      </div>
    </>
  );
}

/**
 * What only the popup can claim: that the whole of it is in the browser you are
 * already looking at. A claim and how it works, not one sentence trying to be
 * both — the title is what the visitor gets, the line under it is the
 * mechanism.
 */
const CLAIMS: readonly Claim[] = [
  { icon: MousePointerClick, title: 'home.popup.c1.title', body: 'home.popup.c1.body' },
  { icon: Puzzle, title: 'home.popup.c2.title', body: 'home.popup.c2.body' },
  { icon: Activity, title: 'home.popup.c3.title', body: 'home.popup.c3.body' },
  /* Latency came here when the capability lanes went. It is the one thing they
   * said that nothing else on the page or in the FAQ says, and the mock beside
   * these claims is already drawing the pip it describes — so it is a caption
   * for something visible rather than a card standing in for it. */
  { icon: Gauge, title: 'home.popup.c4.title', body: 'home.popup.c4.body' },
].map((c) => ({ ...c }));

export function PopupBand() {
  // Resolved in the render rather than at module scope: `t` reads the locale
  // that is current when it is called, and a constant evaluated on import runs
  // before the entry point has set the page's locale.
  const claims = CLAIMS.map((c) => ({ ...c, title: t(c.title), body: t(c.body) }));
  return (
    // `overflow-x: clip` rather than `hidden` or `auto`: it clips the strip's
    // bleed at the band edge without making this a scroll container, which
    // `auto` would — and a scroll container is what a sticky descendant sticks
    // to. Nothing here is sticky, but the band next door is, and a rule that
    // cannot break the other one is worth preferring.
    <LandingSection id="popup" className="overflow-x-clip">
      {/* What is being described sits beside it rather than above: the heading
          and its three reasons read as one column, the mock as the thing they
          are about. The right column is the wider of the two because it holds a
          browser window; the left only has to hold a heading and three pairs.
          Both start at the top of the row — the heading is what is read first,
          and centring it against a 600px-tall mock pushes it down the band past
          the point where reading starts. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14">
        <div className="flex flex-col items-start gap-6">
          {/* Wrapped rather than given a `data-enter` prop: the attribute is a
              page concern and SectionHeading is shared furniture. */}
          <div data-enter="soft">
            <SectionHeading title={t('home.popup.h2')} body={t('home.popup.body')} />
          </div>
          {/* One surface is pressed and the other is coming, so the switch is a
              statement rather than a control today. It stays because the shape
              of the product is two interfaces over one helper, and a band that
              showed only the popup said the extension was all there is. */}
          <div data-enter="soft">
            <SurfaceSwitch value="extension" />
          </div>
          <ClaimList claims={claims} />
        </div>

        <div data-enter="soft" className="min-w-0">
          <Extension />
        </div>
      </div>
    </LandingSection>
  );
}
