import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@amplitude/analytics-browser', () => ({ init: vi.fn() }));

async function load() {
  vi.resetModules();
  const amplitude = await import('@amplitude/analytics-browser');
  const analytics = await import('./analytics');
  return { init: vi.mocked(amplitude.init), initAmplitude: analytics.initAmplitude };
}

afterEach(() => {
  vi.unstubAllGlobals();
  // Drop any instance-level shadows a test added.
  Reflect.deleteProperty(navigator, 'webdriver');
  Reflect.deleteProperty(navigator, 'doNotTrack');
  Reflect.deleteProperty(navigator, 'globalPrivacyControl');
});

describe('initAmplitude', () => {
  it('does nothing without a window (SSR)', async () => {
    const { init, initAmplitude } = await load();
    vi.stubGlobal('window', undefined);
    initAmplitude();
    expect(init).not.toHaveBeenCalled();
  });

  it('does nothing for automated (webdriver) sessions', async () => {
    const { init, initAmplitude } = await load();
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    initAmplitude();
    expect(init).not.toHaveBeenCalled();
  });

  it('respects Do Not Track', async () => {
    const { init, initAmplitude } = await load();
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    initAmplitude();
    expect(init).not.toHaveBeenCalled();
  });

  it('respects Global Privacy Control', async () => {
    const { init, initAmplitude } = await load();
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });
    initAmplitude();
    expect(init).not.toHaveBeenCalled();
  });

  it('counts page views and sessions, and captures nothing else', async () => {
    const { init, initAmplitude } = await load();
    initAmplitude();
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith('79c9d01f039a5629c8e2804d611bf6f8', {
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

    initAmplitude();
    expect(init).toHaveBeenCalledTimes(1);
  });

  // The privacy page promises no session recording. Assert on the shape rather
  // than the absence of a string, so re-enabling any capture flag fails here.
  it('never enables session replay or DOM capture', async () => {
    const { init, initAmplitude } = await load();
    initAmplitude();
    const opts = init.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(opts).toBeDefined();
    expect(opts).not.toHaveProperty('sessionReplay');
    const autocapture = opts?.autocapture as Record<string, boolean>;
    expect(autocapture.elementInteractions).toBe(false);
    expect(autocapture.networkTracking).toBe(false);
    expect(autocapture.formInteractions).toBe(false);
  });
});
