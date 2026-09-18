// The missing-story gate, ported from the aria2t site along with the gate
// itself. The walk and the report are pure given a file system, so both run
// against a fake one; `main` is checked on the real tree, which is the
// assertion that matters — every component and page in this repo has a story
// right now.
import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORY_ROOTS, main, missingStories, subjects } from './stories-check-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A file system built from a path -> entries map. */
function fakeFs(tree) {
  return {
    readdirSync: (dir) => {
      const key = String(dir);
      if (!(key in tree)) throw new Error(`ENOENT ${key}`);
      return tree[key];
    },
    statSync: (path) => {
      const key = String(path);
      if (key in tree) return { isDirectory: () => true };
      if (!files.has(key)) throw new Error(`ENOENT ${key}`);
      return { isDirectory: () => false };
    },
  };
}

let files = new Set();

describe('subjects', () => {
  it('walks into directories and skips tests, stories and non-tsx', () => {
    const dir = resolve(root, 'src/components');
    const nested = resolve(dir, 'ui');
    const tree = {
      [dir]: ['badge.tsx', 'badge.test.tsx', 'badge.stories.tsx', 'use-thing.ts', 'ui'],
      [nested]: ['button.tsx'],
    };
    files = new Set([
      resolve(dir, 'badge.tsx'),
      resolve(dir, 'badge.test.tsx'),
      resolve(dir, 'badge.stories.tsx'),
      resolve(dir, 'use-thing.ts'),
      resolve(nested, 'button.tsx'),
    ]);
    expect(subjects(dir, fakeFs(tree))).toEqual([
      resolve(dir, 'badge.tsx'),
      resolve(nested, 'button.tsx'),
    ]);
  });
});

describe('missingStories', () => {
  it('names the subjects with no sibling story', () => {
    const comps = resolve(root, 'src/components');
    const pages = resolve(root, 'src/pages');
    const tree = { [comps]: ['told.tsx', 'untold.tsx'], [pages]: ['page.tsx'] };
    files = new Set([
      resolve(comps, 'told.tsx'),
      resolve(comps, 'told.stories.tsx'),
      resolve(comps, 'untold.tsx'),
      resolve(pages, 'page.tsx'),
    ]);
    expect(missingStories(root, fakeFs(tree))).toEqual([
      'src/components/untold.tsx',
      'src/pages/page.tsx',
    ]);
  });

  it('looks in both roots', () => {
    expect(STORY_ROOTS).toEqual(['src/components', 'src/pages']);
  });
});

describe('main', () => {
  it('passes on this tree, and says so', () => {
    const log = { log: vi.fn(), error: vi.fn() };
    expect(main(root, log)).toBe(0);
    expect(log.log).toHaveBeenCalledWith('stories: every component and page has one.');
    expect(log.error).not.toHaveBeenCalled();
  });

  it('defaults to this package and the console, which is how the entry calls it', () => {
    const said = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(main()).toBe(0);
    expect(said).toHaveBeenCalledWith('stories: every component and page has one.');
    said.mockRestore();
    // and the walk defaults to the real file system
    expect(missingStories(root)).toEqual([]);
    expect(subjects(resolve(root, 'src/pages')).length).toBeGreaterThan(0);
  });

  it('fails on a tree with a story missing, and names it', () => {
    // A real tree, because that is what the entry point walks: one component
    // with a story, one without, and a page without.
    const tmp = mkdtempSync(join(tmpdir(), 'stories-check-'));
    try {
      mkdirSync(join(tmp, 'src/components/ui'), { recursive: true });
      mkdirSync(join(tmp, 'src/pages'), { recursive: true });
      writeFileSync(join(tmp, 'src/components/told.tsx'), '');
      writeFileSync(join(tmp, 'src/components/told.stories.tsx'), '');
      writeFileSync(join(tmp, 'src/components/ui/untold.tsx'), '');
      writeFileSync(join(tmp, 'src/pages/page.tsx'), '');

      const log = { log: vi.fn(), error: vi.fn() };
      expect(main(tmp, log)).toBe(1);
      const said = log.error.mock.calls.flat().join('\n');
      expect(said).toContain('2 file(s) with no sibling *.stories.tsx');
      expect(said).toContain('src/components/ui/untold.tsx');
      expect(said).toContain('src/pages/page.tsx');
      // the one that has a story is not named ("untold" ends in it, so the
      // assertion is on the whole path)
      expect(said).not.toContain('src/components/told.tsx');
      expect(log.log).not.toHaveBeenCalled();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
