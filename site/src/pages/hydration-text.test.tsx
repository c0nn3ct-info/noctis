import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LOCALES, setLocale } from '@/i18n';
import { HomePage } from './home';
import { InstallPage } from './install';
import { LicensePage } from './license';
import { PrivacyPage } from './privacy';

/**
 * scripts/prerender.mjs captures the live DOM, and serialising it merges two
 * adjacent text nodes into one. React then finds one node where it rendered
 * two, fails hydration and throws the prerendered page away to render it
 * again. So no element on a prerendered page may hold two text nodes side by
 * side: `{a} · {b}` has to be one template string.
 */
function adjacentText(root: Element): string[] {
  const hits: string[] = [];
  const walk = (el: Element) => {
    const kids = [...el.childNodes];
    for (let i = 1; i < kids.length; i++) {
      if (kids[i].nodeType === Node.TEXT_NODE && kids[i - 1].nodeType === Node.TEXT_NODE) {
        hits.push(`<${el.tagName.toLowerCase()}> "${el.textContent?.slice(0, 60)}"`);
        break;
      }
    }
    for (const child of el.children) walk(child);
  };
  walk(root);
  return hits;
}

afterEach(() => setLocale('en'));

const PAGES = { home: HomePage, install: InstallPage, license: LicensePage, privacy: PrivacyPage };

describe('prerendered pages hydrate', () => {
  for (const locale of LOCALES) {
    for (const [name, Page] of Object.entries(PAGES)) {
      it(`${name} (${locale}) has no adjacent text nodes`, () => {
        setLocale(locale);
        const { container } = render(<Page />);
        expect(adjacentText(container)).toEqual([]);
      });
    }
  }
});
