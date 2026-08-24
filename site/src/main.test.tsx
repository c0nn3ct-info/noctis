import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { amplitudeInit, render, createRoot, hydrateRoot } = vi.hoisted(() => ({
  amplitudeInit: vi.fn(),
  render: vi.fn(),
  createRoot: vi.fn(),
  hydrateRoot: vi.fn(),
}));

vi.mock('@amplitude/analytics-browser', () => ({ init: amplitudeInit }));
vi.mock('react-dom/client', () => ({ createRoot, hydrateRoot }));

createRoot.mockReturnValue({ render });

async function load() {
  vi.resetModules();
  const { mountPage } = await import('./main');
  return mountPage;
}

beforeEach(() => {
  vi.clearAllMocks();
  createRoot.mockReturnValue({ render });
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

function mountPoint(html = '') {
  const el = document.createElement('div');
  el.id = 'root';
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

describe('mountPage', () => {
  it('applies the system theme and creates a root', async () => {
    const mountPage = await load();
    const root = mountPoint();

    mountPage(<p>hello</p>);

    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveAttribute('data-theme');

    expect(createRoot).toHaveBeenCalledWith(root);
    expect(hydrateRoot).not.toHaveBeenCalled();
    const tree = render.mock.calls[0][0];
    expect(tree.type).toBe(StrictMode);
    expect(tree.props.children).toEqual(<p>hello</p>);
  });

  // Counting a view is not part of showing the page: the SDK is imported lazily
  // and started on idle, so the first paint never waits on it.
  it('starts analytics only after the page is mounted, off the render path', async () => {
    const mountPage = await load();
    // Warm the module so the lazy import resolves from cache: under fake timers
    // a first-time import waits on real I/O that no microtask flush can reach.
    await import('./lib/analytics');
    vi.useFakeTimers();
    try {
      mountPoint();

      mountPage(<p>hello</p>);
      expect(amplitudeInit).not.toHaveBeenCalled();

      await vi.runAllTimersAsync();
      // The idle callback kicks off a dynamic import, so let its microtasks run.
      for (let i = 0; i < 50 && amplitudeInit.mock.calls.length === 0; i += 1) {
        await Promise.resolve();
      }
      expect(amplitudeInit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hydrates instead when the prerendered markup is already there', async () => {
    const mountPage = await load();
    const root = mountPoint('<p>hello</p>');

    mountPage(<p>hello</p>);

    expect(hydrateRoot).toHaveBeenCalledTimes(1);
    expect(hydrateRoot.mock.calls[0][0]).toBe(root);
    expect(hydrateRoot.mock.calls[0][1].type).toBe(StrictMode);
    expect(createRoot).not.toHaveBeenCalled();
  });

  it('throws when the host page has no #root', async () => {
    const mountPage = await load();
    expect(() => mountPage(<p>hello</p>)).toThrow('Missing #root');
    expect(createRoot).not.toHaveBeenCalled();
    expect(hydrateRoot).not.toHaveBeenCalled();
  });
});
