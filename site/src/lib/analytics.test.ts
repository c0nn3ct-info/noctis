import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@amplitude/unified', () => ({ initAll: vi.fn() }));

async function load() {
  vi.resetModules();
  const amplitude = await import('@amplitude/unified');
  const analytics = await import('./analytics');
  return { initAll: vi.mocked(amplitude.initAll), initAmplitude: analytics.initAmplitude };
}

afterEach(() => {
  vi.unstubAllGlobals();
  // Drop any instance-level navigator.webdriver shadow added by a test.
  Reflect.deleteProperty(navigator, 'webdriver');
});

describe('initAmplitude', () => {
  it('does nothing without a window (SSR)', async () => {
    const { initAll, initAmplitude } = await load();
    vi.stubGlobal('window', undefined);
    initAmplitude();
    expect(initAll).not.toHaveBeenCalled();
  });

  it('does nothing for automated (webdriver) sessions', async () => {
    const { initAll, initAmplitude } = await load();
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    initAmplitude();
    expect(initAll).not.toHaveBeenCalled();
  });

  it('initializes amplitude once and only once', async () => {
    const { initAll, initAmplitude } = await load();
    initAmplitude();
    expect(initAll).toHaveBeenCalledTimes(1);
    expect(initAll).toHaveBeenCalledWith('79c9d01f039a5629c8e2804d611bf6f8', {
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    });

    initAmplitude();
    expect(initAll).toHaveBeenCalledTimes(1);
  });
});
