import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Check, Download } from 'lucide-react';
import { Section, SectionLink } from './section';

describe('Section', () => {
  it('renders the header, icon and children without a count or action', () => {
    const { container } = render(
      <Section header="Install" icon={Download}>
        <p>Body</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { name: 'Install', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    // No count pill and no action slot.
    expect(container.querySelectorAll('header > div')).toHaveLength(1);
  });

  it('renders a count pill, including zero, and an action slot', () => {
    render(
      <Section header="Servers" icon={Check} count={0} action={<button type="button">Add</button>}>
        <p>rows</p>
      </Section>,
    );
    expect(screen.getByText('0')).toHaveClass('rounded-pill');
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('SectionLink', () => {
  it('renders a button with supporting text and fires onClick', async () => {
    const onClick = vi.fn();
    render(
      <SectionLink
        title="Routing"
        icon={Check}
        supporting="3 rules"
        onClick={onClick}
        className="mt-2"
      />,
    );
    const btn = screen.getByRole('button', { name: /Routing/ });
    expect(btn).toHaveClass('mt-2');
    expect(screen.getByText('3 rules')).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the supporting line when not provided', () => {
    render(<SectionLink title="Settings" icon={Download} onClick={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Settings' });
    expect(btn.querySelectorAll('span > span')).toHaveLength(1);
  });
});

// The level belongs to the caller: hard-coding h3 skipped a level on every site
// page that used this as a top-level section.
describe('Section heading level', () => {
  it('renders the header at the level the caller asks for', () => {
    const { rerender } = render(
      <Section header="Steps" icon={Check}>
        <p>x</p>
      </Section>,
    );
    // The panel level keeps truncating: those rows are a fixed width.
    expect(screen.getByRole('heading', { name: 'Steps', level: 3 })).toHaveClass('truncate');

    rerender(
      <Section header="Steps" icon={Check} headingLevel={2}>
        <p>x</p>
      </Section>,
    );
    // A document-level section carries document-level weight, and must not clip:
    // at 390px the truncating version lost the tail of several real headings.
    const h2 = screen.getByRole('heading', { name: 'Steps', level: 2 });
    expect(h2).toHaveClass('text-title-large');
    expect(h2).not.toHaveClass('truncate');
  });
});
