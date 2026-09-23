import { Check, Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import { getLocale, stripLocale, t, withLocale, type Locale } from '../i18n';

function pairPath(currentPath: string, target: Locale): string {
  return withLocale(stripLocale(currentPath), target);
}

// Exported: the footer renders the same six languages as crawlable links, and a
// second copy of this list would drift the moment a locale is added.
export const LOCALE_OPTIONS: ReadonlyArray<{ code: Locale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'zh-CN', label: '中文' },
  { code: 'fa', label: 'فارسی' },
  { code: 'ar', label: 'العربية' },
];

interface LanguageSwitcherProps {
  className?: string;
}

/**
 * The header's language menu, on Radix's menu rather than a hand-rolled list.
 *
 * The old one carried `role="menu"` without the behaviour the role promises:
 * no arrow keys, focus never moved into the list, and Escape unmounted the item
 * that held focus, dropping it onto <body>. Radix brings roving focus,
 * typeahead, Escape returning focus to the trigger, and the open/close fade.
 *
 * Non-modal: a language menu is not worth locking the page's scroll or making
 * the rest of it inert. The items stay real links, so each language is a
 * crawlable URL and a middle click opens it in a new tab.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const locale = getLocale();

  const hrefFor = (target: Locale) =>
    typeof window === 'undefined'
      ? withLocale('/', target)
      : pairPath(window.location.pathname, target);

  const onSelect = (target: Locale) => {
    try {
      localStorage.setItem('noctis-locale', target);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn('relative', className)}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton
            type="button"
            variant="standard"
            size="s"
            className="h-11 w-11"
            aria-label={t('nav.lang_switch_aria')}
            title={t('nav.lang_switch_aria')}
          >
            <Languages />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-surface-container">
          {LOCALE_OPTIONS.map((l) => {
            const active = l.code === locale;
            return (
              <DropdownMenuItem
                key={l.code}
                asChild
                className={cn(
                  'min-h-11 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'font-medium text-on-surface' : 'text-on-surface-variant',
                )}
              >
                <a
                  href={hrefFor(l.code)}
                  hrefLang={l.code}
                  onClick={() => onSelect(l.code)}
                  aria-current={active ? 'true' : undefined}
                >
                  <span>{l.label}</span>
                  {active && <Check aria-hidden className="ms-auto text-primary" />}
                </a>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
