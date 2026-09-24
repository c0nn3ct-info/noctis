import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { PopupMock } from './popup-mock';

const realMin = Math.min;

/** Run the mock traffic ticker forward with a fixed `Math.random`. */
function tick(seconds: number, random: number) {
  vi.spyOn(Math, 'random').mockReturnValue(random);
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

/** Whether the hero is showing its speed meter at all. */
function hasReadout(): boolean {
  const status = screen.getByRole('heading', { level: 2 }).parentElement as HTMLElement;
  return status.querySelectorAll('.tabular-nums > span').length > 0;
}

/** The line the ambient wave is currently drawing. */
function wave(container: HTMLElement): string {
  return container.querySelector('svg > path:nth-of-type(2)')?.getAttribute('d') ?? '';
}

function readout() {
  // Found by level, not by wording: the heading is the one thing in the hero
  // that changes when the tunnel goes down.
  const status = screen.getByRole('heading', { level: 2 }).parentElement as HTMLElement;
  const [down, up] = Array.from(status.querySelectorAll('.tabular-nums > span'));
  return { down: down.textContent ?? '', up: up.textContent ?? '' };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PopupMock', () => {
  it('opens on the settled seed of the deterministic traffic walk', () => {
    const { container } = render(<PopupMock />);

    expect(container.firstChild).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('heading', { name: 'You are protected' })).toBeInTheDocument();
    expect(screen.getByText('203.0.113.47')).toBeInTheDocument();
    expect(screen.getByText('reality')).toBeInTheDocument();

    // The seed is a fixed PRNG walk, so the opening frame is always the same.
    expect(readout()).toEqual({ down: '874KB/s', up: '105KB/s' });

    // 44 seeded samples feed the ambient wave (43 cubic segments).
    const line = container.querySelectorAll('svg > path')[1].getAttribute('d') ?? '';
    expect(line.split('C')).toHaveLength(44);
  });

  it('does not advance the walk while the tab is in the background', () => {
    // A background tab still runs timers on some engines; advancing the walk
    // there only burns battery redrawing something nobody is looking at. The
    // aria2t site's shared landing clock guards the same way.
    const { container } = render(<PopupMock />);
    const opening = wave(container);

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    tick(10, 0.5);
    expect(wave(container)).toBe(opening);

    // And picks up where it left off once the tab is back, rather than
    // replaying the ten seconds it sat out.
    hidden.mockReturnValue(false);
    tick(1, 0.5);
    expect(wave(container)).not.toBe(opening);
  });

  it('does not advance the walk while the popup is scrolled out of view', () => {
    let report: ((e: { isIntersecting: boolean }[]) => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
          report = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { container, unmount } = render(<PopupMock />);
    const opening = wave(container);

    act(() => report!([{ isIntersecting: false }]));
    tick(10, 0.5);
    expect(wave(container)).toBe(opening);

    act(() => report!([{ isIntersecting: true }]));
    tick(1, 0.5);
    expect(wave(container)).not.toBe(opening);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('merges a custom className onto the popup frame', () => {
    const bare = render(<PopupMock />).container.firstChild;
    expect(bare).toHaveClass('w-[380px]');

    const { container } = render(<PopupMock className="w-full max-w-[380px]" />);
    // twMerge lets the caller's width win over the default 380px.
    expect(container.firstChild).toHaveClass('shadow-e3', 'w-full', 'max-w-[380px]');
    expect(container.firstChild).not.toHaveClass('w-[380px]');
  });

  it('lists the pinned servers and highlights the connected one', () => {
    render(<PopupMock />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    // The row is the control now, so the styling and the state sit on it.
    const rows = screen.getAllByRole('button', { name: /\d+ ms$/ });
    const [amsterdam, frankfurt, singapore] = rows;

    expect(amsterdam).toHaveClass('bg-success-container', 'rounded-xl');
    expect(amsterdam).toHaveAttribute('aria-pressed', 'true');
    expect(within(amsterdam).getByText('ams.example.net:443')).toBeInTheDocument();
    expect(within(amsterdam).getByText('23ms')).toBeInTheDocument();
    // Only the live row gets the larger squircle monogram.
    expect(amsterdam.querySelector('.shape-squircle-md')).not.toBeNull();

    expect(frankfurt).toHaveClass('rounded-lg');
    expect(frankfurt).toHaveAttribute('aria-pressed', 'false');
    expect(frankfurt).not.toHaveClass('bg-success-container');
    expect(frankfurt.querySelector('.shape-squircle-md')).toBeNull();
    expect(within(singapore).getByText('188ms')).toBeInTheDocument();
  });

  it('matches the popup routing switcher', () => {
    render(<PopupMock />);
    const routing = screen.getByRole('group', { name: 'Routing' });
    expect(within(routing).getByRole('button', { name: 'Global' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(routing).getByRole('button', { name: 'Direct' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(routing).getByRole('button', { name: '✨ Sirius' })).toBeInTheDocument();
    // Drawn, not offered: it opens a surface the mock does not have.
    const viewAll = screen.getAllByText('View all')[0].closest('button');
    expect(viewAll).toHaveAttribute('tabindex', '-1');
    expect(viewAll).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the footer actions', () => {
    render(<PopupMock />);
    // One button, not a split one: `AddMenu` opens a menu from a single
    // filled trigger, and the caret this mock used to draw was never there.
    // Like both View all buttons and Panel, it goes nowhere in the mock, so it
    // is out of the tab order and the tree; the power button is the live one.
    const add = screen.getByText('Add').closest('button');
    expect(add).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: /View all/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('scrolls a fresh sample in every second and switches to MB/s at the top end', () => {
    render(<PopupMock />);
    // 0.9 is above the burst threshold, so this is the plain AR(1) ramp:
    // 895046 → 1021938 → 1125989, crossing 1 MiB on the second tick.
    tick(2, 0.9);
    expect(readout()).toEqual({ down: '1.1MB/s', up: '169KB/s' });

    // The buffer scrolls rather than grows: still 44 samples, 43 segments.
    const line = document.querySelectorAll('svg > path')[1].getAttribute('d') ?? '';
    expect(line.split('C')).toHaveLength(44);
  });

  it('mixes in an occasional burst below the 8% threshold', () => {
    render(<PopupMock />);
    // 0.05 < 0.08, so every tick also adds a 0.05 * 650_000 burst:
    // 895046 * 0.82 + 16_000 + 32_500 = 782_438.
    tick(1, 0.05);
    expect(readout()).toEqual({ down: '764KB/s', up: '79KB/s' });
  });

  it('falls back to B/s once the sample drops below a kibibyte', () => {
    // The walk floors down-speed at 40 KB/s via Math.min(2_600_000, Math.max(…)),
    // so the B/s formatting is only reachable by neutering that outer clamp.
    vi.spyOn(Math, 'min').mockImplementation((...values: number[]) =>
      values[0] === 2_600_000 ? 600 : realMin(...values),
    );
    render(<PopupMock />);
    expect(readout()).toEqual({ down: '600B/s', up: '72B/s' });
  });

  it('holds the seeded frame when paused', () => {
    const { container } = render(<PopupMock paused />);
    const seeded = readout();
    expect(seeded).toEqual({ down: '874KB/s', up: '105KB/s' });

    // No ticker at all, so a minute of wall clock leaves the frame alone —
    // what a docs page or a screenshot needs from the mock.
    tick(60, 0.9);
    expect(readout()).toEqual(seeded);

    const line = container.querySelectorAll('svg > path')[1].getAttribute('d') ?? '';
    expect(line.split('C')).toHaveLength(44);
  });

  it('holds the seeded frame under automation, without being told to', () => {
    // What the prerender pass sees. Left to walk, the captured markup would be
    // a frame the visitor's first render cannot reproduce.
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    try {
      render(<PopupMock />);
      const seeded = readout();
      tick(60, 0.9);
      expect(readout()).toEqual(seeded);
    } finally {
      Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    }
  });

  it('holds the seeded frame for a reader who asked for less motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    render(<PopupMock />);
    const seeded = readout();
    tick(60, 0.9);
    expect(readout()).toEqual(seeded);
  });

  it('stops the ticker when it unmounts', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const view = render(<PopupMock />);
    view.unmount();
    expect(clear).toHaveBeenCalled();
  });});

describe('PopupMock, operated', () => {
  /** The row buttons, in list order. */
  function rows() {
    return screen.getAllByRole('button', { name: /\d+ ms$/ });
  }

  it('takes the tunnel down and brings it back', () => {
    render(<PopupMock />);
    const power = screen.getByRole('button', { name: 'Disconnect' });
    expect(power).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('203.0.113.47')).toBeInTheDocument();

    fireEvent.click(power);

    // Everything the hero says follows from the one flag.
    // `hero.title.ready` and `hero.sub.activeDetail`: a chosen server with the
    // engine stopped is ready, not broken, and its line names the transport
    // instead of the address it no longer has.
    expect(screen.getByRole('heading', { name: 'Ready to connect' })).toBeInTheDocument();
    expect(screen.getByText('🇳🇱 Amsterdam · tcp · reality')).toBeInTheDocument();
    expect(screen.queryByText('203.0.113.47')).not.toBeInTheDocument();
    const off = screen.getByRole('button', { name: 'Connect' });
    expect(off).toHaveAttribute('aria-pressed', 'false');
    // The chosen server keeps the choice, and loses the running colour.
    expect(rows()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(rows()[0]).not.toHaveClass('bg-success-container');

    fireEvent.click(off);
    expect(screen.getByRole('heading', { name: 'You are protected' })).toBeInTheDocument();
    expect(rows()[0]).toHaveClass('bg-success-container');
  });

  it('drops the readout when the tunnel goes down, and freezes the wave', () => {
    const { container } = render(<PopupMock />);
    expect(readout().down).not.toBe('0B/s');
    const before = wave(container);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    // The real hero renders the meter only while there is a reading, so the
    // numbers go at once rather than counting themselves down to nothing.
    expect(hasReadout()).toBe(false);

    // `PopupAmbientTraffic` buffers only seconds that moved, so the last active
    // minute stays on screen: the wave stops rather than resetting, however
    // long the tunnel is down.
    tick(30, 0.9);
    expect(wave(container)).toBe(before);

    // And the next byte picks up from where it stopped.
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(hasReadout()).toBe(true);
    tick(1, 0.9);
    expect(wave(container)).not.toBe(before);
  });

  it('switches the active server, and the hero follows it', () => {
    render(<PopupMock />);
    fireEvent.click(rows()[1]);

    expect(screen.getByText('198.51.100.12')).toBeInTheDocument();
    expect(screen.getByText('tls')).toBeInTheDocument();
    // The name keeps its flag, the way the real hero prints `active.name`. The
    // line is two elements — the name, then the handshake in bold — so it is
    // read whole rather than matched as one text node.
    const hero = screen.getByRole('heading', { level: 2 }).parentElement as HTMLElement;
    expect(hero.textContent).toContain('🇩🇪 Frankfurt · via tls');

    expect(rows()[1]).toHaveClass('bg-success-container');
    expect(rows()[0]).not.toHaveClass('bg-success-container');
    expect(rows()[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the routing mode', () => {
    render(<PopupMock />);
    const routing = within(screen.getByRole('group', { name: 'Routing' }));
    const direct = routing.getByRole('button', { name: 'Direct' });

    fireEvent.click(direct);
    expect(direct).toHaveAttribute('aria-pressed', 'true');
    expect(routing.getByRole('button', { name: 'Global' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // The saved profile is named by its own emoji plus its label.
    const profile = routing.getByRole('button', { name: '✨ Sirius' });
    fireEvent.click(profile);
    expect(profile).toHaveAttribute('aria-pressed', 'true');
    expect(direct).toHaveAttribute('aria-pressed', 'false');
  });
});
