// The React side of the figure, which is deliberately almost nothing: a canvas
// in the tree and an effect that pulls the scene in as its own chunk. What is
// worth testing is the four ways that can go wrong — no WebGL, a chunk that
// never loads, an unmount mid-load, and a theme flip while it is running.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HeroScene, canRunScene } from './hero-scene';

const booted: { host: HTMLElement }[] = [];
const disposed = { count: 0 };
const dark = { value: false };
const refuse = { value: false };

vi.mock('./hero-planet', () => ({
  isDark: () => dark.value,
  bootHeroScene: (host: HTMLElement) => {
    if (refuse.value) throw new Error('context lost');
    booted.push({ host });
    return { dispose: () => void disposed.count++, debug: () => ({}) };
  },
}));

beforeEach(() => {
  booted.length = 0;
  disposed.count = 0;
  dark.value = false;
  refuse.value = false;
  vi.stubGlobal('WebGLRenderingContext', class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-accent');
});

describe('canRunScene', () => {
  it('is the one thing the page needs WebGL for', () => {
    expect(canRunScene()).toBe(true);
    vi.unstubAllGlobals();
    expect(canRunScene()).toBe(false);
  });
});

describe('HeroScene', () => {
  it('announces itself as a picture with something to say', async () => {
    // It carries the page's claim rather than decorating a paragraph, so it is
    // announced instead of hidden.
    render(<HeroScene aria-label="Requests crossing a barrier" />);
    const figure = screen.getByRole('img', { name: 'Requests crossing a barrier' });
    expect(figure.querySelector('canvas')).not.toBeNull();
    await waitFor(() => expect(booted).toHaveLength(1));
    expect(booted[0].host).toBe(figure);
  });

  it('takes a class from its caller without losing its own', async () => {
    render(<HeroScene aria-label="figure" className="mx-auto max-w-[560px]" />);
    const figure = screen.getByRole('img');
    expect(figure).toHaveClass('mx-auto', 'max-w-[560px]', 'w-full', 'h-full');
    await waitFor(() => expect(booted).toHaveLength(1));
  });

  it('leaves the page alone when there is no WebGL to draw with', async () => {
    vi.unstubAllGlobals();
    render(<HeroScene aria-label="figure" />);
    // The canvas stays in the tree — the markup has to match the prerender —
    // and nothing boots into it.
    expect(screen.getByRole('img')).toBeInTheDocument();
    await Promise.resolve();
    expect(booted).toHaveLength(0);
  });

  it('rebuilds when the stage under it changes', async () => {
    // The stage is read at boot, so a theme flip is a reboot. It is rare
    // enough that threading a recolour through every material and the baked
    // instance buffers would cost more than it saves.
    render(<HeroScene aria-label="figure" />);
    await waitFor(() => expect(booted).toHaveLength(1));

    dark.value = true;
    document.documentElement.classList.add('dark');
    await waitFor(() => expect(booted).toHaveLength(2));
    expect(disposed.count).toBe(1);
  });

  it('leaves the scene alone when only the accent moves', async () => {
    // The land is a ten-step scale of tone rather than an accent, and the
    // site's four accents have no ten-step scale to offer — they reach the
    // copy and the buttons instead. Rebuilding a WebGL scene for them would
    // be work with nothing to show for it.
    render(<HeroScene aria-label="figure" />);
    await waitFor(() => expect(booted).toHaveLength(1));
    document.documentElement.setAttribute('data-accent', 'cyan');
    await Promise.resolve();
    await Promise.resolve();
    expect(booted).toHaveLength(1);
  });

  it('drops the figure, not the page, when a reboot is refused', async () => {
    render(<HeroScene aria-label="figure" />);
    await waitFor(() => expect(booted).toHaveLength(1));
    refuse.value = true;
    dark.value = true;
    document.documentElement.classList.add('dark');
    await waitFor(() => expect(disposed.count).toBe(1));
    // The observer let go, so a second flip asks for nothing more.
    refuse.value = false;
    dark.value = false;
    document.documentElement.classList.remove('dark');
    await Promise.resolve();
    await Promise.resolve();
    expect(booted).toHaveLength(1);
  });

  it('ignores a mutation that leaves the stage where it was', async () => {
    render(<HeroScene aria-label="figure" />);
    await waitFor(() => expect(booted).toHaveLength(1));
    // Something else writing a class on the root is not a reason to rebuild a
    // WebGL scene.
    document.documentElement.classList.add('scroll-locked');
    await Promise.resolve();
    await Promise.resolve();
    expect(booted).toHaveLength(1);
  });

  it('takes the scene down with it', async () => {
    const view = render(<HeroScene aria-label="figure" />);
    await waitFor(() => expect(booted).toHaveLength(1));
    view.unmount();
    expect(disposed.count).toBe(1);
  });

  it('never boots into a node that has already gone', async () => {
    // The chunk takes a moment; a visitor who navigates in that moment leaves
    // the effect holding a detached ref.
    const view = render(<HeroScene aria-label="figure" />);
    view.unmount();
    await Promise.resolve();
    await Promise.resolve();
    expect(booted).toHaveLength(0);
    expect(disposed.count).toBe(0);
  });
});

describe('HeroScene without its chunk', () => {
  afterEach(() => {
    vi.doUnmock('./hero-planet');
    vi.resetModules();
  });

  it('costs the figure and not the page', async () => {
    // Offline, or a blocker that ate the chunk. The hero keeps its copy and
    // its buttons; there is simply no picture beside them.
    vi.resetModules();
    vi.doMock('./hero-planet', () => {
      throw new Error('chunk blocked');
    });
    const { HeroScene: Fresh } = await import('./hero-scene');
    render(<Fresh aria-label="figure" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    await waitFor(() => expect(booted).toHaveLength(0));
  });
});
