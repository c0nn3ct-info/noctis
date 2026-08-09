import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GithubLink } from './github-link';

describe('GithubLink', () => {
  it('renders an icon link to the public repo', () => {
    render(<GithubLink />);
    const link = screen.getByRole('link', { name: 'GitHub' });
    expect(link).toHaveAttribute('href', 'https://github.com/c0nn3ct-info/noctis');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    expect(link).toHaveAttribute('title', 'GitHub');
    expect(link).toHaveClass('bg-transparent', 'h-10');
    expect(link.querySelector('svg')).not.toBeNull();
  });
});
