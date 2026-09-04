import { useState } from 'react';
import {
  AppWindow,
  Apple,
  Bug,
  Check,
  ChevronDown,
  Chrome,
  Copy,
  Download,
  ExternalLink,
  Github,
  HardDrive,
  Info,
  PlayCircle,
  RefreshCw,
  Terminal,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Section } from '@/components/m3/section';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WEBSTORE_EXT_ID, WEBSTORE_URL } from '../constants';

// The issue form the installers point at when a step dies; keeping the link in
// one place means the page and the scripts cannot drift apart.
const INSTALL_ISSUE_URL =
  'https://github.com/c0nn3ct-info/noctis/issues/new?template=install_failure.yml';
import { t } from '../i18n';
import { Layout } from '../layout';

// Exported for Storybook alongside `macosCmd`: the full set is the state the
// page loads in, and a story that wants the default command has to name it.
export const INSTALL_CORES = ['sing-box', 'xray', 'mihomo'] as const;
type SiteCore = (typeof INSTALL_CORES)[number];

// Cores argument, or null when the selection is the full set (installer default)
// or empty — both mean "install everything". Mirrors the extension's builder.
function coresArg(sel: readonly SiteCore[]): string | null {
  const ordered = INSTALL_CORES.filter((c) => sel.includes(c));
  if (ordered.length === 0 || ordered.length === INSTALL_CORES.length) return null;
  return ordered.join(',');
}

// Exported for Storybook: `CodeBlock`'s stories show a real command, and
// building it here rather than restating it keeps the story from drifting when
// the install URL or the extension id changes.
export function macosCmd(sel: readonly SiteCore[]): string {
  const a = coresArg(sel);
  return `curl -fsSL https://noctis.c0nn3ct.info/macos.sh | bash -s -- ${WEBSTORE_EXT_ID}${a ? ` ${a}` : ''}`;
}
function linuxCmd(sel: readonly SiteCore[]): string {
  const a = coresArg(sel);
  return `curl -fsSL https://noctis.c0nn3ct.info/linux.sh | bash -s -- ${WEBSTORE_EXT_ID}${a ? ` ${a}` : ''}`;
}
function windowsCmd(sel: readonly SiteCore[]): string {
  const a = coresArg(sel);
  return `${a ? `$env:NOCTIS_CORES='${a}'; ` : ''}$env:NOCTIS_EXT_ID='${WEBSTORE_EXT_ID}'; iwr -useb https://noctis.c0nn3ct.info/windows.ps1 | iex`;
}

// Exported for Storybook: the copy button's success and blocked-clipboard
// states are two branches a page-level story cannot reach on its own.
export function CodeBlock({ children, label }: { children: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // A blocked clipboard used to be a silent dead end. Say so, and the
      // command is selectable either way.
      setCopied(false);
      setFailed(true);
    }
  };

  return (
    <div className="rounded-md bg-surface-container-highest">
      {/* The button sits in the flow rather than floating over the command: as
          an overlay it covered the first line's text on narrow screens. */}
      <div className="flex items-start gap-1 p-1.5">
        {/* dir=ltr, always: bidi reorders a shell command in Arabic and Farsi
            (`$env:…` came out as `env:…$`), which makes it wrong to read even
            though copying it still works. Wrapping instead of scrolling keeps
            the whole command readable without dragging it. */}
        <pre
          dir="ltr"
          className="min-w-0 flex-1 whitespace-pre-wrap break-words px-1.5 py-1.5 text-left text-body-small font-mono text-on-surface"
        >
          <code>{children}</code>
        </pre>
        <IconButton
          type="button"
          variant="standard"
          size="xs"
          onClick={() => void copy()}
          aria-label={`${copied ? t('install.copied') : t('install.copy')}: ${label}`}
          title={copied ? t('install.copied') : t('install.copy')}
          className="shrink-0 text-on-surface-variant"
        >
          {copied ? <Check /> : <Copy />}
        </IconButton>
      </div>
      {/* One node does both jobs: a confirmation nobody needs to see, and a
          failure everybody does. Two would announce the same thing twice. */}
      <p
        role="status"
        className={failed ? 'px-3 pb-2 text-body-small text-error' : 'sr-only'}
      >
        {copied ? t('install.copied') : failed ? t('install.copy_failed') : ''}
      </p>
    </div>
  );
}

// Exported for Storybook: the picker is a controlled component, so a story
// can show a selection the page itself only reaches through clicks.
export function CoreMultiSelect({
  selected,
  onToggle,
  label,
}: {
  selected: SiteCore[];
  onToggle: (c: SiteCore) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <h3 id="cores-label" className="text-title-medium text-on-surface">
        {label}
      </h3>
      <div className="max-w-xs">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-labelledby="cores-label cores-value"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-outline bg-surface-container px-3 py-2 text-start font-mono text-body-medium text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span id="cores-value">
                {INSTALL_CORES.filter((c) => selected.includes(c)).join(', ')}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[16rem]">
            {INSTALL_CORES.map((c) => (
              <DropdownMenuCheckboxItem
                key={c}
                checked={selected.includes(c)}
                onCheckedChange={() => onToggle(c)}
                onSelect={(e) => e.preventDefault()}
                className="font-mono"
              >
                {c}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function InstallPage() {
  const [cores, setCores] = useState<SiteCore[]>(() => [...INSTALL_CORES]);
  const toggleCore = (c: SiteCore) =>
    setCores((prev) =>
      prev.includes(c) ? (prev.length > 1 ? prev.filter((x) => x !== c) : prev) : [...prev, c],
    );

  return (
    <Layout current="install">
      <section className="space-y-3 pb-8">
        <h1 className="text-headline-large font-semibold tracking-tight">{t('install.h1')}</h1>
        <p className="max-w-[68ch] text-body-large text-on-surface-variant">{t('install.lede')}</p>
      </section>

      <section className="pb-8">
        <Card variant="filled" padding="md">
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Info className="h-4 w-4 text-on-surface-variant" />
              {t('install.before.title')}
            </CardTitle>
          </CardHeader>
          <ul className="mt-3 space-y-2 text-body-medium text-on-surface-variant">
            <li className="flex items-start gap-2">
              <AppWindow className="mt-0.5 h-4 w-4 shrink-0" />
              {t('install.before.browser')}
            </li>
            <li className="flex items-start gap-2">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0" />
              {t('install.before.disk')}
            </li>
            <li className="flex items-start gap-2">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {t('install.before.admin')}
            </li>
          </ul>
        </Card>
      </section>

      <div className="space-y-4 pb-8">
        <Section header={t('install.step1.title')} icon={Download} headingLevel={2}>
          <div className="max-w-[68ch] space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
            <p>{t('install.step1.body')}</p>
            <div>
              <Button asChild variant="outlined" size="s">
                <a href={WEBSTORE_URL} target="_blank" rel="noreferrer noopener">
                  <Chrome />
                  {t('install.step1.cta')}
                  <ExternalLink />
                </a>
              </Button>
            </div>
          </div>
        </Section>

        <Section header={t('install.step2.title')} icon={Terminal} headingLevel={2}>
          <div className="max-w-[68ch] space-y-5 px-2 pb-3 pt-2 text-body-large text-on-surface-variant">
            <p>{t('install.step2.body1')}</p>

            <div>
              <Button asChild variant="outlined" size="s">
                <a
                  href="https://github.com/c0nn3ct-info/noctis"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Github />
                  {t('install.step2.helper_source')}
                  <ExternalLink />
                </a>
              </Button>
            </div>

            <CoreMultiSelect
              selected={cores}
              onToggle={toggleCore}
              label={t('install.step2.cores_label')}
            />

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-title-medium text-on-surface">
                <Apple className="h-4 w-4" />
                macOS
              </h3>
              <CodeBlock label="macOS">{macosCmd(cores)}</CodeBlock>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-title-medium text-on-surface">
                <Terminal className="h-4 w-4" />
                Linux
              </h3>
              <CodeBlock label="Linux">{linuxCmd(cores)}</CodeBlock>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-title-medium text-on-surface">
                <AppWindow className="h-4 w-4" />
                Windows (PowerShell)
              </h3>
              <CodeBlock label="Windows (PowerShell)">{windowsCmd(cores)}</CodeBlock>
            </div>

            <p>{t('install.step2.body2')}</p>
            <p>{t('install.step2.body3')}</p>
          </div>
        </Section>

        <Section header={t('install.step3.title')} icon={PlayCircle} headingLevel={2}>
          <div className="max-w-[68ch] space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
            <p>{t('install.step3.body')}</p>
          </div>
        </Section>

        {/* An installer that fails leaves the user with a terminal and nobody
            to tell. The script prints a report block for exactly this form. */}
        <Section header={t('install.trouble.title')} icon={Bug} headingLevel={2}>
          <div className="max-w-[68ch] space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
            <p>{t('install.trouble.body')}</p>
            <div>
              <Button asChild variant="outlined" size="s">
                <a href={INSTALL_ISSUE_URL} target="_blank" rel="noreferrer noopener">
                  <Github />
                  {t('install.trouble.cta')}
                  <ExternalLink />
                </a>
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-3 pb-8 sm:grid-cols-2">
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <RefreshCw className="h-5 w-5" />
            </span>
            <CardTitle as="h2" className="mt-2">{t('install.updating.title')}</CardTitle>
            <CardDescription>{t('install.updating.body')}</CardDescription>
          </CardHeader>
        </Card>
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <Trash2 className="h-5 w-5" />
            </span>
            <CardTitle as="h2" className="mt-2">{t('install.uninstalling.title')}</CardTitle>
          </CardHeader>
          <ol className="mt-3 space-y-2 ps-5 text-body-medium text-on-surface-variant list-decimal">
            <li>{t('install.uninstalling.step1')}</li>
            <li>
              {t('install.uninstalling.step2')}
              <ul className="mt-1 space-y-0.5 ps-4 list-disc">
                <li>
                  {'macOS / Linux: '}
                  <code
                    dir="ltr"
                    className="inline-block rounded bg-surface-container-highest px-1 py-0.5 font-mono text-body-small"
                  >
                    ~/.local/share/noctis
                  </code>
                </li>
                <li>
                  {'Windows: '}
                  <code
                    dir="ltr"
                    className="inline-block rounded bg-surface-container-highest px-1 py-0.5 font-mono text-body-small"
                  >
                    %LOCALAPPDATA%\Noctis
                  </code>
                </li>
              </ul>
            </li>
          </ol>
        </Card>
      </div>
    </Layout>
  );
}
