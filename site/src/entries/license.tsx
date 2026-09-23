import { isLocale, loadLocale, setLocale } from '../i18n';
import { mountPage } from '../main';
import { LicensePage } from '../pages/license';

const lang = document.documentElement.lang;
const locale = isLocale(lang) ? lang : 'en';
// The prerendered HTML is already on screen in this language; hydration waits
// for the dictionary so the first client render matches it.
void loadLocale(locale).then(() => {
  setLocale(locale);
  mountPage(<LicensePage />);
});
