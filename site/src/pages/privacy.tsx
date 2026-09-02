import { Ban, Database, Globe, KeyRound, Mail, Network, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Section } from '@/components/m3/section';
import { t } from '../i18n';
import { Layout } from '../layout';

const PERMISSIONS: ReadonlyArray<{ name: string; key: string }> = [
  { name: 'proxy', key: 'privacy.perm.proxy' },
  { name: 'storage', key: 'privacy.perm.storage' },
  { name: 'nativeMessaging', key: 'privacy.perm.nativeMessaging' },
  { name: 'privacy', key: 'privacy.perm.privacy' },
  { name: 'alarms', key: 'privacy.perm.alarms' },
  { name: 'tabs', key: 'privacy.perm.tabs' },
  { name: 'webNavigation', key: 'privacy.perm.webNavigation' },
  { name: 'declarativeNetRequestWithHostAccess', key: 'privacy.perm.dnr' },
  { name: 'clipboardRead', key: 'privacy.perm.clipboardRead' },
  { name: 'host_permissions: <all_urls>', key: 'privacy.perm.hosts' },
];

const STORE_ITEMS = [
  'privacy.stores.item1',
  'privacy.stores.item2',
  'privacy.stores.item3',
  'privacy.stores.item4',
];

const WEBSITE_ITEMS = [
  'privacy.website.item1',
  'privacy.website.item2',
  'privacy.website.item3',
  'privacy.website.item4',
];

const NOTHING_ITEMS = [
  'privacy.nothing.item1',
  'privacy.nothing.item2',
  'privacy.nothing.item3',
  'privacy.nothing.item4',
];

export function PrivacyPage() {
  return (
    <Layout current="privacy">
      <section className="space-y-3 pb-8">
        <h1 className="text-headline-large font-semibold tracking-tight">{t('privacy.h1')}</h1>
        <p className="text-label-medium uppercase tracking-[0.16em] text-on-surface-variant">
          {t('privacy.last_updated')}
        </p>
        <p className="max-w-[68ch] text-body-large text-on-surface-variant">{t('privacy.lede')}</p>
      </section>

      <div className="space-y-4 pb-8">
        <Section header={t('privacy.stores.h2')} icon={Database} headingLevel={2}>
          <div className="max-w-[68ch] space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
            <p>{t('privacy.stores.intro')}</p>
            <ul className="space-y-1.5">
              {STORE_ITEMS.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />
                  {t(k)}
                </li>
              ))}
            </ul>
            <p>{t('privacy.stores.outro')}</p>
          </div>
        </Section>

        <Section header={t('privacy.network.h2')} icon={Network} headingLevel={2}>
          <div className="max-w-[68ch] space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
            <p>{t('privacy.network.intro')}</p>
            <ol className="space-y-1.5 ps-5 list-decimal">
              <li>
                <b className="text-on-surface">{t('privacy.network.proxied.b')}</b>
                {t('privacy.network.proxied.body')}
              </li>
              <li>
                <b className="text-on-surface">{t('privacy.network.sub.b')}</b>
                {t('privacy.network.sub.body')}
              </li>
              <li>
                <b className="text-on-surface">{t('privacy.network.ip.b')}</b>
                {t('privacy.network.ip.body')}
              </li>
            </ol>
            <p>{t('privacy.network.outro')}</p>
          </div>
        </Section>

        <Section header={t('privacy.nothing.h2')} icon={Ban} headingLevel={2}>
          <ul className="max-w-[68ch] space-y-2 px-2 py-2 text-body-large text-on-surface-variant">
            {NOTHING_ITEMS.map((k) => (
              <li key={k} className="flex items-start gap-2">
                <Ban className="mt-1 h-4 w-4 shrink-0 text-on-surface-variant" />
                {t(k)}
              </li>
            ))}
          </ul>
        </Section>

        <Section header={t('privacy.website.h2')} icon={Globe} headingLevel={2}>
          <div className="max-w-[68ch] space-y-3 px-2 py-2 text-body-large text-on-surface-variant">
            <p>{t('privacy.website.intro')}</p>
            <ul className="space-y-1.5">
              {WEBSITE_ITEMS.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />
                  {t(k)}
                </li>
              ))}
            </ul>
            <p>{t('privacy.website.outro')}</p>
          </div>
        </Section>

        <Section
          header={t('privacy.permissions.h2')}
          icon={KeyRound}
          count={PERMISSIONS.length}
          headingLevel={2}
        >
          <div className="px-2 py-2">
            <div className="overflow-hidden rounded-md border border-outline-variant">
              <table className="w-full table-auto text-start text-body-medium">
                <thead className="bg-surface-container-high text-on-surface">
                  <tr>
                    <th className="px-3 py-2 text-start text-label-large font-medium">
                      {t('privacy.permissions.col1')}
                    </th>
                    <th className="px-3 py-2 text-start text-label-large font-medium">
                      {t('privacy.permissions.col2')}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-on-surface-variant">
                  {PERMISSIONS.map((p, i) => (
                    <tr
                      key={p.name}
                      className={i % 2 ? 'bg-surface-container-low' : 'bg-surface-container'}
                    >
                      <td className="px-3 py-2 align-top font-mono text-body-small text-on-surface">
                        {/* Narrow screens have to break these somewhere; from
                            sm up the column is given the room to keep the
                            permission name in one piece. */}
                        <span
                          dir="ltr"
                          className="inline-block [overflow-wrap:anywhere] sm:whitespace-nowrap"
                        >
                          {p.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">{t(p.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-3 pb-8 sm:grid-cols-2">
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <CardTitle as="h2" className="mt-2">{t('privacy.children.h3')}</CardTitle>
          </CardHeader>
          <p className="mt-2 text-body-medium text-on-surface-variant">{t('privacy.children.body')}</p>
        </Card>
        <Card variant="outlined" padding="md">
          <CardHeader>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
              <Mail className="h-5 w-5" />
            </span>
            <CardTitle as="h2" className="mt-2">{t('privacy.contact.h3')}</CardTitle>
          </CardHeader>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            {t('privacy.contact.body_before')}
            <a
              className="text-on-surface underline underline-offset-4 hover:text-primary"
              href="mailto:help@c0nn3ct.info"
            >
              help@c0nn3ct.info
            </a>
            {t('privacy.contact.body_after')}
          </p>
        </Card>
      </div>

      <section className="max-w-[68ch] pb-4 text-body-medium text-on-surface-variant">
        <h2 className="text-title-medium text-on-surface">{t('privacy.changes.h2')}</h2>
        <p className="mt-2">{t('privacy.changes.body')}</p>
      </section>
    </Layout>
  );
}
