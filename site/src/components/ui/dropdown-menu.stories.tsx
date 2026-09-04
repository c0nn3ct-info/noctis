import type { Meta, StoryObj } from '@storybook/react-vite';
import { Apple, Bug, ChevronDown, FileText, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

const meta = {
  title: 'Primitives/DropdownMenu',
  component: DropdownMenu,
  parameters: {
    // The content renders through a Radix portal, at the end of <body>. Autodocs
    // is on for every story in this project, and an inline docs block would let
    // the open menus of three stories stack on top of each other outside their
    // own blocks — so each one gets its own iframe on the docs page.
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Items, a label and a separator. Open on mount so the anatomy is visible
 * without a click.
 */
export const Items: Story = {
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outlined" size="s">
          Install command
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Copy for</DropdownMenuLabel>
        <DropdownMenuItem>
          <Apple /> macOS
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Terminal /> Linux
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Terminal /> Windows
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <FileText /> Install guide
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Bug /> Report a failed install
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/**
 * The install page's proxy-engine picker: monospaced checkbox items whose
 * indicator sits in a fixed logical-start gutter, so the labels stay aligned
 * whether or not an item is checked, in both text directions.
 */
export const CheckboxItems: Story = {
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outlined" size="s" className="font-mono">
          sing-box, xray
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[16rem]">
        <DropdownMenuCheckboxItem checked className="font-mono">
          sing-box
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked className="font-mono">
          xray
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={false} className="font-mono">
          mihomo
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/** The resting state: the trigger alone, with nothing in the portal. */
export const Closed: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outlined" size="s">
          Install command
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem>
          <Apple /> macOS
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Terminal /> Linux
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Terminal /> Windows
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
