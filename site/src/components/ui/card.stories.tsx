import type { Meta, StoryObj } from '@storybook/react-vite';
import { Info, Mail, Package, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Grid, Row, Stack } from '@/storybook/layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

const meta = {
  title: 'Primitives/Card',
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/**
 * The five surfaces. `elevated` is the default; `outlined` draws its container
 * with a border because its fill is the page background; `accent` takes its
 * colors from the `--dir-*` custom properties (see the Accent story).
 */
export const Variants: Story = {
  render: () => (
    <Grid columns={2} align="stretch" style={{ width: 480 }}>
      <Card variant="elevated">
        <CardTitle>Elevated</CardTitle>
        <CardDescription>Default. Sits above the page on a shadow.</CardDescription>
      </Card>
      <Card variant="filled">
        <CardTitle>Filled</CardTitle>
        <CardDescription>Before you start — the install page's callout.</CardDescription>
      </Card>
      <Card variant="outlined">
        <CardTitle>Outlined</CardTitle>
        <CardDescription>Privacy and license pages. Border, no fill.</CardDescription>
      </Card>
      <Card variant="tonal">
        <CardTitle>Tonal</CardTitle>
        <CardDescription>Primary container. Carries emphasis, not status.</CardDescription>
      </Card>
      <Card variant="accent" className="dir-proxy">
        <CardTitle>Accent</CardTitle>
        <CardDescription>Routing direction, inherited from --dir-container.</CardDescription>
      </Card>
    </Grid>
  ),
};

/** Four padding steps. `none` is for cards whose child owns its own insets. */
export const Paddings: Story = {
  render: () => (
    <Stack style={{ width: 320 }}>
      <Label>none</Label>
      <Card variant="outlined" padding="none">
        <div className="text-body-medium text-on-surface-variant" style={{ padding: 8 }}>
          The child sets its own insets.
        </div>
      </Card>
      <Label>sm — 16px</Label>
      <Card variant="outlined" padding="sm">
        <CardDescription>Compact rows and dense lists.</CardDescription>
      </Card>
      <Label>md — 20px</Label>
      <Card variant="outlined" padding="md">
        <CardDescription>Default. Every card the site ships.</CardDescription>
      </Card>
      <Label>lg — 24px</Label>
      <Card variant="outlined" padding="lg">
        <CardDescription>Standalone cards with room to breathe.</CardDescription>
      </Card>
    </Stack>
  ),
};

/**
 * Every slot at once. `CardHeader` stacks title and description, `CardContent`
 * and `CardFooter` add their own top margin, so the parts never need spacing
 * from the caller.
 */
export const Anatomy: Story = {
  render: () => (
    <div style={{ width: 380 }}>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle as="h2">One extension, three proxy engines</CardTitle>
          <CardDescription>Noctis picks the engine each server needs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Row gap={8}>
            <Badge variant="primary" size="sm">
              sing-box
            </Badge>
            <Badge variant="default" size="sm">
              xray-core
            </Badge>
            <Badge variant="default" size="sm">
              mihomo
            </Badge>
          </Row>
        </CardContent>
        <CardFooter>
          <Button variant="filled" size="s">
            Install guide
          </Button>
          <Button variant="text" size="s">
            Read the license
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

/**
 * `variant="accent"` reads `--dir-container` / `--dir-on-container` rather than
 * naming a palette, so the same card takes the color of the routing direction it
 * sits in. The three `.dir-*` classes in `styles/globals.css` are what set them.
 */
export const Accent: Story = {
  render: () => (
    <Grid columns={3} align="stretch" style={{ width: 540 }}>
      <div className="dir-proxy">
        <Card variant="accent">
          <CardTitle>Proxy</CardTitle>
          <CardDescription>domain:openai.com</CardDescription>
        </Card>
      </div>
      <div className="dir-direct">
        <Card variant="accent">
          <CardTitle>Direct</CardTitle>
          <CardDescription>geosite:private</CardDescription>
        </Card>
      </div>
      <div className="dir-block">
        <Card variant="accent">
          <CardTitle>Block</CardTitle>
          <CardDescription>geosite:category-ads-all</CardDescription>
        </Card>
      </div>
    </Grid>
  ),
};

/**
 * The pattern the privacy and license pages use: an outlined card whose header
 * leads with a tonal icon badge and a real `h2`, so the cards stay part of the
 * page outline instead of floating outside it.
 */
export const IconCards: Story = {
  render: () => (
    <Grid columns={2} align="stretch" style={{ width: 620 }}>
      <Card variant="outlined" padding="md">
        <CardHeader>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <CardTitle as="h2" className="mt-2">
            Children
          </CardTitle>
        </CardHeader>
        <p className="mt-2 text-body-medium text-on-surface-variant">
          Noctis is not designed for or directed at children under 13. The extension collects no
          information from anyone.
        </p>
      </Card>
      <Card variant="outlined" padding="md">
        <CardHeader>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
            <Mail className="h-5 w-5" />
          </span>
          <CardTitle as="h2" className="mt-2">
            Contact
          </CardTitle>
        </CardHeader>
        <p className="mt-2 text-body-medium text-on-surface-variant">
          For privacy questions, write to{' '}
          <a
            className="text-on-surface underline underline-offset-4 hover:text-primary"
            href="mailto:help@c0nn3ct.info"
          >
            help@c0nn3ct.info
          </a>
          .
        </p>
      </Card>
      <Card variant="outlined" padding="md">
        <CardHeader>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
            <Package className="h-5 w-5" />
          </span>
          <CardTitle as="h2" className="mt-2">
            3. Proxy engines
          </CardTitle>
        </CardHeader>
        <p className="mt-2 text-body-medium text-on-surface-variant">
          Noctis ships these proxy engines, each redistributed under its upstream license.
        </p>
      </Card>
      <Card variant="filled" padding="md">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Info className="h-4 w-4 text-on-surface-variant" />
            Before you start
          </CardTitle>
        </CardHeader>
        <p className="mt-2 text-body-medium text-on-surface-variant">
          The filled variant of the same pattern, with the icon inline in the title — the install
          page's callout.
        </p>
      </Card>
    </Grid>
  ),
};
