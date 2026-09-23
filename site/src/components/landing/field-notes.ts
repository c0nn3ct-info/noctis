// What each field of a share link is for, in one clause.
//
// The listing prints these where a code listing prints its comments, which is
// the whole reason the band can drop its tiles: a name and a value tell a
// visitor what the link contains, and only the note tells them what it means.
// `sni=cdn.example.com` is a string until something says it is the site the
// handshake claims to visit.
//
// Keyed off the label the parser resolved, and off the value where the value
// changes the answer: `443` is not any port, and `reality` is not any security
// layer.
import { t } from '@/i18n';
import type { Field } from './share-link';

/** Security layers worth naming. Anything else gets the general note. */
const SECURITY: Record<string, string> = {
  reality: 'home.anatomy.note.reality',
  tls: 'home.anatomy.note.tls',
};

/** The three transports a visitor is most likely to be holding a link for. */
const TRANSPORT: Record<string, string> = {
  tcp: 'home.anatomy.note.tcp',
  ws: 'home.anatomy.note.ws',
  grpc: 'home.anatomy.note.grpc',
};

/** The note the listing prints beside a field. */
export function noteFor(field: Field): string {
  const value = field.value.toLowerCase();
  switch (field.label) {
    case 'protocol':
      return t('home.anatomy.note.protocol');
    case 'uuid':
      return t('home.anatomy.note.uuid');
    case 'host':
      return t('home.anatomy.note.host');
    case 'port':
      // 443 is the one port that says something about the link rather than
      // about the server: it is where everything else on the web already is.
      return t(value === '443' ? 'home.anatomy.note.port_https' : 'home.anatomy.note.port');
    case 'security':
      return t(SECURITY[value] ?? 'home.anatomy.note.security');
    case 'sni':
      return t('home.anatomy.note.sni');
    case 'fingerprint':
      return t('home.anatomy.note.fingerprint').replace('{v}', field.value);
    case 'transport':
      return t(TRANSPORT[value] ?? 'home.anatomy.note.transport');
    case 'tag':
      return t('home.anatomy.note.tag');
    default:
      // A link is free to carry `flow`, `pbk` or anything else an engine
      // understands, and the honest thing to say about those is what Noctis
      // does with them.
      return t('home.anatomy.note.other');
  }
}
