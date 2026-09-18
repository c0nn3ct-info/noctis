// Every component and every page has a story, and this is what makes that a
// requirement rather than a habit.
//
// The story smoke test (`src/storybook/stories.smoke.test.tsx`) mounts every
// story there is, so a story that throws fails the suite. What it cannot see is
// a story that was never written — and nothing else here asks for one, so a
// band can ship with an empty Storybook section while every build goes green.
// That is exactly how it went on the aria2t site, whose gate this is ported
// from (`site/scripts/stories-check-core.mjs` there).
//
// The rule is the convention this tree already follows. A `.tsx` under
// `src/components/` or `src/pages/` that is neither a test nor a story has a
// sibling `*.stories.tsx`. Hooks and pure modules are `.ts` and render nothing,
// so they are not in scope.
//
// Split like the prerender generator: the work is here and importable, the
// entry beside it is two lines.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Directories whose `.tsx` files render UI a reader should be able to open. */
export const STORY_ROOTS = ['src/components', 'src/pages'];

/** Every source file under `dir` that is expected to have a story. */
export function subjects(dir, fs = { readdirSync, statSync }) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      out.push(...subjects(full, fs));
      continue;
    }
    if (!entry.endsWith('.tsx')) continue;
    if (/\.(test|spec|stories)\.tsx$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

/** The subjects with no sibling story, relative to `root`. */
export function missingStories(root, fs = { readdirSync, statSync }) {
  const out = [];
  for (const r of STORY_ROOTS) {
    for (const file of subjects(resolve(root, r), fs)) {
      try {
        fs.statSync(file.replace(/\.tsx$/, '.stories.tsx'));
      } catch {
        out.push(file.slice(root.length + 1));
      }
    }
  }
  return out;
}

/** Reports and returns the exit code, so the entry stays two lines. */
export function main(root = resolve(here, '..'), log = console) {
  const missing = missingStories(root);
  if (!missing.length) {
    log.log('stories: every component and page has one.');
    return 0;
  }
  log.error(`stories: ${missing.length} file(s) with no sibling *.stories.tsx:`);
  for (const m of missing) log.error(`  ${m}`);
  log.error('\nEvery component and page is openable in Storybook. Write the story, or');
  log.error('move the module out of src/components and src/pages if it renders nothing.');
  return 1;
}
