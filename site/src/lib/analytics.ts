import { init } from '@amplitude/analytics-browser';

const API_KEY = '79c9d01f039a5629c8e2804d611bf6f8';

let initialized = false;

// Does the visitor's browser say "do not track me"? Honouring both the old
// header-era flag and the newer Global Privacy Control costs one branch and
// means the privacy page's promise holds without a consent dialog on top.
function optedOut(): boolean {
  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };
  if (nav.globalPrivacyControl === true) return true;
  const dnt = nav.doNotTrack ?? nav.msDoNotTrack ?? (window as { doNotTrack?: string }).doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/**
 * Page views and session boundaries, and nothing else.
 *
 * This used to be `@amplitude/unified` with `autocapture: true` and session
 * replay at `sampleRate: 1`, which recorded the DOM, the console and network
 * calls of every visitor — including everyone reading the privacy page that says
 * Noctis embeds no trackers. Counting visits does not need any of that, so the
 * plugin bundle (rrweb, network capture, element interactions) is gone along
 * with roughly 250 KB gzipped of it.
 *
 * What is left is disclosed on /privacy/ under "This website". Keep the two in
 * step: if a capture flag is ever turned back on, that section has to say so.
 */
export function initAmplitude(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  if (navigator.webdriver) return;
  if (optedOut()) return;
  initialized = true;
  init(API_KEY, {
    // localStorage, not the default cookie: a returning visitor still counts as
    // one person, but nothing rides along on every request to the origin.
    identityStorage: 'localStorage',
    autocapture: {
      pageViews: true,
      sessions: true,
      attribution: false,
      elementInteractions: false,
      formInteractions: false,
      fileDownloads: false,
      frustrationInteractions: false,
      networkTracking: false,
      webVitals: false,
    },
  });
}
