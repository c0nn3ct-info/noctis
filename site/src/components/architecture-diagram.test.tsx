import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArchitectureDiagram } from './architecture-diagram';

describe('ArchitectureDiagram', () => {
  it('lays out the four nodes left to right', () => {
    const { container } = render(<ArchitectureDiagram />);
    expect(container.firstChild).toHaveAttribute('dir', 'ltr');

    for (const title of ['Extension', 'Helper', 'Proxy engine', 'Proxy server']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByText('Servers, rules, profiles')).toBeInTheDocument();
    expect(screen.getByText('sing-box, xray, or mihomo')).toBeInTheDocument();
    expect(screen.getAllByText('Your machine')).toHaveLength(2);
  });

  it('mutes only the remote proxy-server node', () => {
    render(<ArchitectureDiagram />);
    const remote = screen.getByText('Proxy server');
    expect(remote).toHaveClass('text-on-surface-variant');
    expect(screen.getByText('Extension')).not.toHaveClass('text-on-surface-variant');
    expect(screen.getByText('Internet')).toHaveClass('text-on-surface-variant/70');
  });

  it('labels the connectors and marks the sandbox boundary', () => {
    render(<ArchitectureDiagram />);
    const featured = screen.getByText('native messaging');
    expect(featured).toHaveClass('border-success/40');
    expect(screen.getByText('spawns')).toHaveClass('border-outline-variant');
    expect(screen.getByText('proxy protocols')).toHaveClass('border-outline-variant');
    expect(screen.getByText('sandbox boundary')).toBeInTheDocument();
  });

  it('shows the connection visual only on the featured connector', () => {
    const { container } = render(<ArchitectureDiagram />);
    expect(container.querySelectorAll('.animate-pulse-ring')).toHaveLength(3);
  });
});
