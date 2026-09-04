import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { composeStories, setProjectAnnotations, type Meta } from '@storybook/react-vite';
import * as projectAnnotations from '../../.storybook/preview';

// No other gate in this package mounts a story: `tsc --noEmit`, `storybook
// build` and `storybook dev --smoke-test` all pass on a story that throws on
// its first render. This file closes that gap without a browser — every story
// under `src/**` is composed with the real project annotations, so `withLocale`
// and `withTheme` run exactly as they do in the workshop, and then rendered in
// jsdom.
//
// Loaders run, `play` does not: the claim under test is that a reader can open
// the story at all, and several `play` functions drive a pointer or read the
// clipboard, which belongs in a browser. The components' own behaviour is
// covered by the unit test next to each of them.

setProjectAnnotations([projectAnnotations]);

/** The composed-story surface used here; `composeStories` types it away. */
type ComposedStory = ComponentType & { storyName: string; load: () => Promise<void> };

const storyModules = import.meta.glob<{ default: Meta }>('../**/*.stories.tsx', { eager: true });

const files = Object.keys(storyModules).sort();

/** `[case name, story]` per story, in file order. */
const cases: [string, ComposedStory][] = [];
const filesWithoutStories: string[] = [];

for (const file of files) {
  const storyModule = storyModules[file];
  // Every story file sets `title` explicitly, so the case names read like the
  // workshop's sidebar; the path is a fallback for a file that forgets to.
  const title = storyModule.default.title ?? file;
  const stories = Object.values(composeStories(storyModule)) as ComposedStory[];
  if (stories.length === 0) filesWithoutStories.push(file);
  for (const story of stories) cases.push([`${title} › ${story.storyName}`, story]);
}

describe('every story', () => {
  // Without this, a glob that matches nothing — or a file whose exports stop
  // being recognised as stories — would leave the suite green and empty.
  it('is reached by the glob', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(filesWithoutStories).toEqual([]);
  });

  // Capitalised so the story can be used as the component it is.
  it.each(cases)('%s', async (_name, Story) => {
    await Story.load();
    const { container } = render(<Story />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
