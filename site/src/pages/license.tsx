import { FileText, Github, Package } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Section } from '@/components/m3/section';
import { t } from '../i18n';
import { Layout } from '../layout';

export function LicensePage() {
  return (
    <Layout current="license">
      <section className="space-y-3 pb-8">
        <h1 className="text-headline-large font-semibold tracking-tight">{t('license.h1')}</h1>
        <p className="text-label-medium uppercase tracking-[0.16em] text-on-surface-variant">
          {t('license.last_updated')}
        </p>
        <p className="max-w-[68ch] text-body-large text-on-surface-variant">{t('license.intro')}</p>
        <ol className="max-w-[68ch] space-y-1 ps-5 text-body-large text-on-surface-variant list-decimal">
          <li>
            <b className="text-on-surface">{t('license.item1.b')}</b>
            {t('license.item1.body')}
          </li>
          <li>
            <b className="text-on-surface">{t('license.item2.b')}</b>
            {t('license.item2.body')}
          </li>
          <li>
            <b className="text-on-surface">{t('license.item3.b')}</b>
            {t('license.item3.body')}
          </li>
        </ol>
      </section>

      <Section header={t('license.eula.h2')} icon={FileText} headingLevel={2}>
        <div className="max-w-[68ch] space-y-4 px-2 py-2 text-body-large text-on-surface-variant">
          <p>{t('license.eula.copyright')}</p>
          <p>{t('license.eula.preamble')}</p>

          <div className="space-y-2">
            <h3 className="text-title-medium text-on-surface">{t('license.eula.grant.h3')}</h3>
            <p>{t('license.eula.grant.body')}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-title-medium text-on-surface">{t('license.eula.restrictions.h3')}</h3>
            <p>{t('license.eula.restrictions.intro')}</p>
            <ul className="space-y-1.5 ps-5 list-disc">
              <li>{t('license.eula.restrictions.item1')}</li>
              <li>{t('license.eula.restrictions.item2')}</li>
              <li>{t('license.eula.restrictions.item3')}</li>
              <li>{t('license.eula.restrictions.item4')}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-title-medium text-on-surface">{t('license.eula.warranty.h3')}</h3>
            <p>{t('license.eula.warranty.body')}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-title-medium text-on-surface">{t('license.eula.liability.h3')}</h3>
            <p>{t('license.eula.liability.body')}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-title-medium text-on-surface">{t('license.eula.termination.h3')}</h3>
            <p>{t('license.eula.termination.body')}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-title-medium text-on-surface">{t('license.eula.law.h3')}</h3>
            <p>{t('license.eula.law.body')}</p>
          </div>
        </div>
      </Section>

      <div className="grid gap-3 pt-6 pb-8 sm:grid-cols-2">
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <Github className="h-5 w-5" />
            </span>
            <CardTitle as="h2" className="mt-2">{t('license.helper.h3')}</CardTitle>
          </CardHeader>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            {t('license.helper.body_before')}
            <a
              className="text-on-surface underline underline-offset-4 hover:text-primary"
              href="https://github.com/c0nn3ct-info/noctis/tree/main/host"
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('license.helper.body_link')}
            </a>
            {t('license.helper.body_after')}
          </p>
        </Card>
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <Package className="h-5 w-5" />
            </span>
            <CardTitle as="h2" className="mt-2">{t('license.engines.h3')}</CardTitle>
          </CardHeader>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            {t('license.engines.intro')}
          </p>
          <ul className="mt-2 space-y-1 text-body-medium text-on-surface-variant">
            <li>
              <a
                className="text-on-surface underline underline-offset-4 hover:text-primary"
                href="https://github.com/SagerNet/sing-box"
                target="_blank"
                rel="noreferrer noopener"
              >
                sing-box
              </a>
              {' — GPL-3.0'}
            </li>
            <li>
              <a
                className="text-on-surface underline underline-offset-4 hover:text-primary"
                href="https://github.com/XTLS/Xray-core"
                target="_blank"
                rel="noreferrer noopener"
              >
                xray-core
              </a>
              {' — MPL-2.0'}
            </li>
            <li>
              <a
                className="text-on-surface underline underline-offset-4 hover:text-primary"
                href="https://github.com/MetaCubeX/mihomo"
                target="_blank"
                rel="noreferrer noopener"
              >
                mihomo
              </a>
              {' — GPL-3.0'}
            </li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
}
