import { ArrowRight, Check, Chrome, ExternalLink, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/m3/section';
import { ArchitectureDiagram } from '../components/architecture-diagram';
import { BrowserMock } from '../components/browser-mock';
import { FaqSection } from '../components/faq-section';
import { PopupMock } from '../components/popup-mock';
import { WEBSTORE_URL } from '../constants';
import { localePath, t } from '../i18n';
import { Layout } from '../layout';

const PROTOCOLS = [
  'VLESS',
  'VLESS Reality',
  'VMess',
  'Trojan',
  'Shadowsocks',
  'Hysteria/2',
  'TUIC',
  'WireGuard',
  'AnyTLS',
  'ShadowTLS',
] as const;

const FEATURE_KEYS = [
  'engine',
  'servers',
  'routing',
  'modes',
  'health',
  'pinned',
  'logs',
  'webrtc',
  'adblock',
] as const;

export function HomePage() {
  const installHref = localePath('/install/');
  return (
    <Layout current="home">
      <section className="grid items-start gap-8 pb-10 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-display-small font-semibold leading-[1.05] tracking-tight sm:text-[44px] lg:text-[52px]">
            {t('home.hero.h1')}
            <br />
            <span className="text-on-surface-variant">{t('home.hero.h1_sub')}</span>
          </h1>
          <div className="flex w-full justify-center lg:hidden">
            <PopupMock className="w-full max-w-[380px]" />
          </div>
          <p className="max-w-xl text-body-large text-on-surface-variant">{t('home.hero.lede')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="filled" size="s">
              <a href={installHref}>
                {t('home.hero.cta_install')}
                <ArrowRight className="rtl:-scale-x-100" />
              </a>
            </Button>
            <Button asChild variant="outlined" size="s">
              <a href={WEBSTORE_URL} target="_blank" rel="noreferrer noopener">
                <Chrome />
                {t('home.hero.cta_webstore')}
                <ExternalLink />
              </a>
            </Button>
          </div>
        </div>
        <div className="hidden lg:block">
          <BrowserMock>
            <PopupMock />
          </BrowserMock>
        </div>
      </section>

      <div className="pb-12">
        <div className="flex items-baseline gap-3 border-b border-outline-variant pb-2">
          <span className="text-label-medium uppercase tracking-[0.12em] text-on-surface-variant">
            {t('home.works_with')}
          </span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PROTOCOLS.map((p) => (
            <li key={p}>
              <Badge variant="outline" size="md" className="font-mono">
                {p}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4 pb-12">
        <Section header={t('home.what_you_get')} icon={Check} count={FEATURE_KEYS.length}>
          <ul className="space-y-2 px-2 pb-2 pt-1">
            {FEATURE_KEYS.map((k) => (
              <li
                key={k}
                className="flex items-start gap-3 rounded-md px-2 py-2"
              >
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-title-small">{t(`home.feat.${k}.title`)}</div>
                  <div className="text-body-medium text-on-surface-variant">
                    {t(`home.feat.${k}.body`)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <section className="space-y-3 pb-12" id="protocols">
        <h2 className="flex items-center gap-2 text-headline-small font-medium tracking-tight">
          <Server className="h-5 w-5 text-on-surface-variant" />
          {t('home.protocols.h2')}
        </h2>
        <p className="max-w-3xl text-body-large text-on-surface-variant">
          {t('home.protocols.body')}
        </p>
      </section>

      <section id="why-three-parts" className="scroll-mt-24 space-y-4 pb-12">
        <h2 className="text-headline-small font-medium tracking-tight">{t('home.why.h2')}</h2>
        <p className="max-w-2xl text-body-medium text-on-surface-variant">{t('home.why.body')}</p>
        <ArchitectureDiagram />
      </section>

      <section className="space-y-3 pb-12" id="engine">
        <h2 className="text-headline-small font-medium tracking-tight">{t('home.engine.h2')}</h2>
        <p className="max-w-3xl text-body-large text-on-surface-variant">
          {t('home.engine.body')}
        </p>
      </section>

      <FaqSection />

      <section className="space-y-4 pb-4">
        <h2 className="text-headline-small font-medium tracking-tight">{t('home.start.h2')}</h2>
        <p className="text-body-large text-on-surface-variant">{t('home.start.body')}</p>
        <Button asChild variant="filled-tonal" size="s">
          <a href={installHref}>
            {t('home.start.cta')}
            <ArrowRight className="rtl:-scale-x-100" />
          </a>
        </Button>
      </section>
    </Layout>
  );
}
