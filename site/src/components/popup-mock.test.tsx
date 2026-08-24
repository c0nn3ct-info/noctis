import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { PopupMock } from './popup-mock';

const realMin = Math.min;

/** Run the mock traffic ticker forward with a fixed `Math.random`. */
function tick(seconds: number, random: number) {
  vi.spyOn(Math, 'random').mockReturnValue(random);
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

function readout() {
  const status = screen.getByRole('heading', { name: 'You are protected' })
    .parentElement as HTMLElement;
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
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);

    const [amsterdam, frankfurt, singapore] = rows;
    expect(amsterdam).toHaveClass('bg-success-container', 'rounded-xl');
    expect(within(amsterdam).getByText('ams.example.net:443')).toBeInTheDocument();
    expect(within(amsterdam).getByText('23ms')).toBeInTheDocument();
    // Only the live row gets the larger squircle monogram.
    expect(amsterdam.querySelector('.shape-squircle-md')).not.toBeNull();

    expect(frankfurt).toHaveClass('rounded-lg');
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
    expect(screen.getByRole('button', { name: 'View all routing profiles' })).toBeInTheDocument();
  });

  it('renders the footer actions', () => {
    render(<PopupMock />);
    expect(screen.getByRole('button', { name: 'View all servers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More add options' })).toBeInTheDocument();
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

  it('stops the ticker when it unmounts', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const view = render(<PopupMock />);
    view.unmount();
    expect(clear).toHaveBeenCalled();
  });
});
