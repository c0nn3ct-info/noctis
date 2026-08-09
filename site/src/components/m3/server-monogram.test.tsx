import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServerMonogram } from './server-monogram';

const realIntl = globalThis.Intl;

afterEach(() => {
  globalThis.Intl = realIntl;
  vi.unstubAllGlobals();
});

function mono(container: HTMLElement) {
  return container.firstChild as HTMLElement;
}

describe('ServerMonogram', () => {
  it('renders a leading flag emoji at the default size and shape', () => {
    const { container } = render(<ServerMonogram name="🇳🇱 Amsterdam" />);
    const el = mono(container);
    expect(el).toHaveTextContent('🇳🇱');
    expect(el).toHaveClass('h-11', 'w-11', 'rounded-md', 'text-2xl', 'bg-surface-container-high');
    expect(el.style.background).toBe('');
  });

  it('renders a leading pictographic emoji', () => {
    const { container } = render(<ServerMonogram name="🚀 Rocket relay" />);
    expect(mono(container)).toHaveTextContent('🚀');
  });

  it('derives two initials from multi-word names', () => {
    render(<ServerMonogram name="New York" />);
    expect(screen.getByText('NY')).toBeInTheDocument();
  });

  it('derives two letters from a single word', () => {
    render(<ServerMonogram name="amsterdam" />);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('pads a single-character name', () => {
    render(<ServerMonogram name="q" />);
    expect(screen.getByText('Q·')).toBeInTheDocument();
  });

  it('falls back to dots when nothing alphanumeric remains', () => {
    render(<ServerMonogram name="--- ///" />);
    expect(screen.getByText('··')).toBeInTheDocument();
  });

  it('treats a blank name as non-emoji', () => {
    render(<ServerMonogram name="   " />);
    expect(screen.getByText('··')).toBeInTheDocument();
  });

  it('colours the fallback deterministically from the name', () => {
    const first = render(<ServerMonogram name="Frankfurt" />);
    const style = mono(first.container).style;
    expect(style.background).toMatch(/^hsl\(\d+ 30% var\(--mono-bg-l\)\)$/);
    expect(style.color).toMatch(/^hsl\(\d+ 60% var\(--mono-fg-l\)\)$/);

    const second = render(<ServerMonogram name="Frankfurt" />);
    expect(mono(second.container).style.background).toBe(style.background);
  });

  it.each([
    ['sm', 'h-9', 'shape-squircle-sm'],
    ['md', 'h-11', 'shape-squircle-md'],
    ['lg', 'h-14', 'shape-squircle-lg'],
  ] as const)('supports the %s size with a squircle shape', (size, dim, squircle) => {
    const { container } = render(
      <ServerMonogram name="Frankfurt" size={size} shape="squircle" className="ring-1" />,
    );
    expect(mono(container)).toHaveClass(dim, squircle, 'ring-1');
  });

  it('uses the grapheme segmenter when available', () => {
    const segment = vi.fn(() => ({
      [Symbol.iterator]: () => [{ segment: '🇳🇱' }][Symbol.iterator](),
    }));
    class FakeSegmenter {
      segment = segment;
    }
    globalThis.Intl = { ...realIntl, Segmenter: FakeSegmenter } as unknown as typeof Intl;

    const { container } = render(<ServerMonogram name="🇳🇱 Amsterdam" />);
    expect(segment).toHaveBeenCalledWith('🇳🇱 Amsterdam');
    expect(mono(container)).toHaveTextContent('🇳🇱');
  });

  it('falls back to the regex when the segmenter yields nothing', () => {
    class EmptySegmenter {
      segment() {
        return { [Symbol.iterator]: () => [][Symbol.iterator]() };
      }
    }
    globalThis.Intl = { ...realIntl, Segmenter: EmptySegmenter } as unknown as typeof Intl;
    const { container } = render(<ServerMonogram name="🚀 Relay" />);
    expect(mono(container)).toHaveTextContent('🚀');
  });

  it('falls back to the regex when the segmenter throws', () => {
    class BrokenSegmenter {
      constructor() {
        throw new Error('no ICU');
      }
    }
    globalThis.Intl = { ...realIntl, Segmenter: BrokenSegmenter } as unknown as typeof Intl;
    const { container } = render(<ServerMonogram name="🚀 Relay" />);
    expect(mono(container)).toHaveTextContent('🚀');
  });

  it('works without Intl at all', () => {
    vi.stubGlobal('Intl', undefined);
    const emoji = render(<ServerMonogram name="🇩🇪 Frankfurt" />);
    expect(mono(emoji.container)).toHaveTextContent('🇩🇪');

    const plain = render(<ServerMonogram name="Frankfurt" />);
    expect(mono(plain.container)).toHaveTextContent('FR');
  });

  it('works when Intl exists without a Segmenter', () => {
    globalThis.Intl = { ...realIntl, Segmenter: undefined } as unknown as typeof Intl;
    const { container } = render(<ServerMonogram name="🇸🇬 Singapore" />);
    expect(mono(container)).toHaveTextContent('🇸🇬');
  });
});
