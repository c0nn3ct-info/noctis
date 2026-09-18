import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, Cpu, Globe } from 'lucide-react';
import { ClaimList, LandingSection, PointList, SectionHeading } from './shell';

const meta = {
  title: 'Landing/Shell',
  component: SectionHeading,
  parameters: { layout: 'padded' },
  args: {
    title: 'One extension, three proxy engines',
    body: 'Noctis picks the right engine for each server automatically, so protocols a single engine cannot handle just work.',
  },
} satisfies Meta<typeof SectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A band's heading and the sentence under it, in one column at a 600px measure.
 *
 * There is no kicker, and no prop to add one. Every band here used to open with
 * a small uppercase label over its heading, which is the pattern the aria2t
 * shell took out and this one followed: a heading carries its own weight, and a
 * label above one repeats the section name into the document outline for
 * nothing. An eyebrow belongs over a list or a figure, never over a heading.
 *
 * The size is this page's own — heavier and tighter than aria2t's — because the
 * weight pair is what the hero's type is built on. Both wraps are the browser's
 * call (`text-balance` on the heading, `text-pretty` on the body): these are a
 * few words in English and can be half again as long in Spanish or Persian.
 */
export const Heading: Story = {};

/** Nested under another band, so the heading drops a level. */
export const HeadingAsH3: Story = { args: { level: 3 } };

/**
 * The supporting facts under a heading.
 *
 * Each badge is a container pair — `bg-*-container` with its own
 * `-on-container` text — rather than a fill and a colour picked separately.
 * That is not a stylistic preference: the two halves of a pair are defined
 * against each other in both themes, and the hand-picked version this replaced
 * measured 3.39:1 in the light theme.
 *
 * Start-aligned, because a point that wraps to two lines would otherwise float
 * its badge between them.
 */
export const Points: Story = {
  render: () => (
    <PointList
      points={[
        { icon: Check, text: 'Every field was read by this page, in your browser.' },
        { icon: Globe, tone: 'tertiary', text: 'The lifted fields decide how the tunnel is built.' },
        { icon: Cpu, tone: 'primary', text: 'Reality and transport parameters pass through unchanged.' },
      ]}
    />
  ),
};

/**
 * A claim and its mechanism, as pairs: the title is what the visitor gets, the
 * line under it is how it works. Written as pairs rather than a heading bolted
 * onto an existing sentence, which is what makes the two halves say different
 * things instead of one repeating the other.
 *
 * One muted icon each, at the title's size rather than in a filled badge. A row
 * of coloured badges here codes nothing, and with no icon at all the rows read
 * as one grey block — the icon is what gives the eye a place to start.
 */
export const Claims: Story = {
  render: () => (
    <ClaimList
      claims={[
        {
          icon: Check,
          title: 'One tap to switch',
          body: 'The engine reloads its config where it stands; no restart, no reconnect.',
        },
        {
          icon: Globe,
          title: 'The badge is the status',
          body: 'Green once the engine accepts a connection, so the toolbar answers "is it on".',
        },
      ]}
    />
  ),
};

/**
 * The band itself, with the rule it exists to own: `px-5 sm:px-8 lg:px-10` —
 * the same padding the Layout's `bleed` footer uses. The page's own
 * `clamp(16px,4vw,44px)` came out 4px wider than the footer at desktop, so
 * every band sat a few pixels off the rule that closes the page.
 *
 * It also carries `data-enter-section`, which is what the entrance observer
 * watches. The hero is the one section on the page that is not a
 * `LandingSection`, because it is already on screen when the page opens.
 */
export const Band: Story = {
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <LandingSection id="demo" className="bg-surface-container-low">
      <SectionHeading {...args} />
    </LandingSection>
  ),
};
