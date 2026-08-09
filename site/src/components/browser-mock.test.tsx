import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserMock } from './browser-mock';

describe('BrowserMock', () => {
  it('renders the chrome frame with its fake address bar', () => {
    const { container } = render(
      <BrowserMock>
        <div data-testid="popup">popup</div>
      </BrowserMock>,
    );
    expect(container.firstChild).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('your-favorite-site.com')).toBeInTheDocument();
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('merges a custom className onto the wrapper', () => {
    const { container } = render(
      <BrowserMock className="max-w-md">
        <span>x</span>
      </BrowserMock>,
    );
    expect(container.firstChild).toHaveClass('relative', 'isolate', 'max-w-md');
  });
});
