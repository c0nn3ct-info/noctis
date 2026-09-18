// The 24 route shells in `pages/` are hand-written HTML that nothing renders,
// so nothing type-checks them either. Two things on them are load-bearing and
// have already drifted once: the accent that puts the page on the planet's
// palette, and the `theme-color` metas that tell the browser chrome what
// ground it is sitting on.
//
// The accent went missing when `/next/` was folded into `/`: the attribute
// lived on that page's own shell, the shell went with the page, and the site
// shipped a release on the neutral palette while its metas already named the
// planet one. This reads both out of `globals.css` so they cannot disagree
// again.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `index.html` under `pages/`, path relative to it. */
async function shells(dir = 'pages') {
  const found = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...(await shells(join(dir, entry.name))));
    else if (entry.name === 'index.html') found.push(join(dir, entry.name));
  }
  return found.sort();
}

/** `250 40% 99%` — the CSS custom property's own shape — as `#rrggbb`. */
function hslToHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** The `--background` of the first rule whose selector contains `selector`. */
function background(css, selector) {
  const at = css.indexOf(selector);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  const block = css.slice(at, css.indexOf('}', at));
  const m = block.match(/--background:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  expect(m, `no --background under ${selector}`).not.toBeNull();
  return hslToHex(Number(m[1]), Number(m[2]), Number(m[3]));
}

const css = await readFile(join(root, 'src/styles/globals.css'), 'utf8');
const files = await shells();

describe('route shells', () => {
  it('covers every route the build entries name', () => {
    // Four pages in six locales, English at the root.
    expect(files).toHaveLength(24);
  });

  it.each(files)('%s opens on the planet accent', async (file) => {
    const html = await readFile(join(root, file), 'utf8');
    // On <html> rather than applied by script, so the neutral palette never
    // paints a frame before the bundle arrives — and so the prerender, which
    // captures `documentElement.outerHTML`, writes it out with the page.
    expect(html).toMatch(/<html\s+lang="[\w-]+"\s+data-accent="planet"/);
  });

  it.each(files)('%s names that palette to the browser chrome', async (file) => {
    const html = await readFile(join(root, file), 'utf8');
    const meta = (scheme) =>
      html.match(
        new RegExp(`theme-color"\\s+content="(#[0-9a-f]{6})"\\s+media="\\(prefers-color-scheme: ${scheme}\\)"`),
      )?.[1];
    expect(meta('dark')).toBe(background(css, ":root[data-accent='planet'].dark"));
    expect(meta('light')).toBe(background(css, ":root[data-accent='planet'] {"));
  });
});
