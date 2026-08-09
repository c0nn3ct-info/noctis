import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { initAll, render, createRoot, hydrateRoot } = vi.hoisted(() => ({
  initAll: vi.fn(),
  render: vi.fn(),
  createRoot: vi.fn(),
  hydrateRoot: vi.fn(),
}));

vi.mock('@amplitude/unified', () => ({ initAll }));
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
  it('applies the system theme, starts analytics and creates a root', async () => {
    const mountPage = await load();
    const root = mountPoint();

    mountPage(<p>hello</p>);

    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(initAll).toHaveBeenCalledTimes(1);

    expect(createRoot).toHaveBeenCalledWith(root);
    expect(hydrateRoot).not.toHaveBeenCalled();
    const tree = render.mock.calls[0][0];
    expect(tree.type).toBe(StrictMode);
    expect(tree.props.children).toEqual(<p>hello</p>);
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
