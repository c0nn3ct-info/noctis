import { useState } from 'react';
import {
  AppWindow,
  Apple,
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
import { t } from '../i18n';
import { Layout } from '../layout';

const INSTALL_CORES = ['sing-box', 'xray', 'mihomo'] as const;
type SiteCore = (typeof INSTALL_CORES)[number];

// Cores argument, or null when the selection is the full set (installer default)
// or empty — both mean "install everything". Mirrors the extension's builder.
function coresArg(sel: SiteCore[]): string | null {
  const ordered = INSTALL_CORES.filter((c) => sel.includes(c));
  if (ordered.length === 0 || ordered.length === INSTALL_CORES.length) return null;
  return ordered.join(',');
}

function macosCmd(sel: SiteCore[]): string {
  const a = coresArg(sel);
  return `curl -fsSL https://noctis.c0nn3ct.xyz/macos.sh | bash -s -- ${WEBSTORE_EXT_ID}${a ? ` ${a}` : ''}`;
}
function linuxCmd(sel: SiteCore[]): string {
  const a = coresArg(sel);
  return `curl -fsSL https://noctis.c0nn3ct.xyz/linux.sh | bash -s -- ${WEBSTORE_EXT_ID}${a ? ` ${a}` : ''}`;
}
function windowsCmd(sel: SiteCore[]): string {
  const a = coresArg(sel);
  return `${a ? `$env:NOCTIS_CORES='${a}'; ` : ''}$env:NOCTIS_EXT_ID='${WEBSTORE_EXT_ID}'; iwr -useb https://noctis.c0nn3ct.xyz/windows.ps1 | iex`;
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — silently no-op
    }
  };

  return (
    <div className="group relative rounded-md bg-surface-container-highest">
      <pre className="overflow-x-auto px-3 py-3 pe-12 text-body-small font-mono text-on-surface">
        <code>{children}</code>
      </pre>
      <IconButton
        type="button"
        variant="standard"
        size="xs"
        onClick={() => void copy()}
        aria-label={copied ? 'Copied' : 'Copy command'}
        title={copied ? 'Copied' : 'Copy'}
        className="absolute end-1.5 top-1.5 text-on-surface-variant"
      >
        {copied ? <Check /> : <Copy />}
      </IconButton>
    </div>
  );
}

function CoreMultiSelect({
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
      <h3 className="text-title-small text-on-surface">{label}</h3>
      <div className="max-w-xs">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-outline bg-surface-container px-3 py-2 text-left font-mono text-body-medium text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{INSTALL_CORES.filter((c) => selected.includes(c)).join(', ')}</span>
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
        <p className="text-body-large text-on-surface-variant">{t('install.lede')}</p>
      </section>

      <section className="pb-8">
        <Card variant="filled" padding="md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {t('install.before.admin')}
            </li>
          </ul>
        </Card>
      </section>

      <div className="space-y-4 pb-8">
        <Section header={t('install.step1.title')} icon={Download}>
          <div className="space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
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

        <Section header={t('install.step2.title')} icon={Terminal}>
          <div className="space-y-5 px-2 pb-3 pt-2 text-body-large text-on-surface-variant">
            <p>{t('install.step2.body1')}</p>

            <div>
              <Button asChild variant="outlined" size="s">
                <a
                  href="https://github.com/c0nn3ct-xyz/noctis-host"
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
              <h3 className="flex items-center gap-2 text-title-small text-on-surface">
                <Apple className="h-4 w-4" />
                macOS
              </h3>
              <CodeBlock>{macosCmd(cores)}</CodeBlock>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-title-small text-on-surface">
                <Terminal className="h-4 w-4" />
                Linux
              </h3>
              <CodeBlock>{linuxCmd(cores)}</CodeBlock>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-title-small text-on-surface">
                <AppWindow className="h-4 w-4" />
                Windows (PowerShell)
              </h3>
              <CodeBlock>{windowsCmd(cores)}</CodeBlock>
            </div>

            <p>{t('install.step2.body2')}</p>
            <p>{t('install.step2.body3')}</p>
          </div>
        </Section>

        <Section header={t('install.step3.title')} icon={PlayCircle}>
          <div className="space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
            <p>{t('install.step3.body')}</p>
          </div>
        </Section>
      </div>

      <div className="grid gap-3 pb-8 sm:grid-cols-2">
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <RefreshCw className="h-5 w-5" />
            </span>
            <CardTitle className="mt-2">{t('install.updating.title')}</CardTitle>
            <CardDescription>{t('install.updating.body')}</CardDescription>
          </CardHeader>
        </Card>
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <Trash2 className="h-5 w-5" />
            </span>
            <CardTitle className="mt-2">{t('install.uninstalling.title')}</CardTitle>
          </CardHeader>
          <ol className="mt-3 space-y-2 ps-5 text-body-medium text-on-surface-variant list-decimal">
            <li>{t('install.uninstalling.step1')}</li>
            <li>
              {t('install.uninstalling.step2')}
              <ul className="mt-1 space-y-0.5 ps-4 list-disc">
                <li>
                  macOS / Linux:{' '}
                  <code className="rounded bg-surface-container-highest px-1 py-0.5 font-mono text-body-small">
                    ~/.local/share/noctis
                  </code>
                </li>
                <li>
                  Windows:{' '}
                  <code className="rounded bg-surface-container-highest px-1 py-0.5 font-mono text-body-small">
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
