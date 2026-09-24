import '@testing-library/jest-dom/vitest';
import { LOCALES, loadLocale } from '@/i18n';

// Pages load their one locale on demand; tests switch between all six.
await Promise.all(LOCALES.map(loadLocale));

// jsdom lacks a few browser APIs the site's components touch.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom has a `CSS` namespace with no `supports`; every browser has it, and the
// FAQ asks it whether CSS can animate its panels.
if (typeof CSS.supports !== 'function') {
  CSS.supports = (() => false) as typeof CSS.supports;
}
