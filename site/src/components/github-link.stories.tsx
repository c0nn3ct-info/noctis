import type { Meta, StoryObj } from '@storybook/react-vite';
import { GithubLink } from './github-link';

const meta = {
  title: 'Blocks/GithubLink',
  component: GithubLink,
} satisfies Meta<typeof GithubLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The header's repository link. It renders as an `<a>` rather than a button —
 * `asChild` hands `IconButton`'s styling to the anchor — so it opens in a new
 * tab, drags as a link, and reads as a link to a screen reader. The label is
 * deliberately untranslated: "GitHub" is the product's own name in every
 * locale.
 */
export const Default: Story = {};
