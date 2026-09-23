// The landing page's own routing matcher.
//
// It exists so the routing band can make its claim honestly: a page that says
// every site gets its own route, and then prints a canned column of verdicts,
// is a picture of a decision rather than a decision. These rules are evaluated.
//
// This is not the extension's matcher. The real one compiles to sing-box, xray
// and mihomo rule sets and runs inside the core; this one only decides enough
// to show what deciding looks like, and never leaves the page. Two laws are
// taken from it verbatim, because they are the two a visitor would otherwise
// get wrong:
//
//   - an entry names a domain and covers that domain and everything under it,
//     glob or not (`extension/src/lib/domain-rules.ts`);
//   - first match wins, and anything that matches no rule goes direct
//     (`routing.json`, help.order and help.fallthrough).
//
// The geosite categories are the one thing a page cannot carry: the real lists
// hold tens of thousands of names and live in the engine. Each category here
// names a couple of its members, which is enough for the rows below to be
// decided rather than declared.

/** Where a request goes. The extension's own three, and its own words. */
export type Direction = 'proxy' | 'direct' | 'block';

/** What the popup's mode selector offers. */
export type Mode = 'global' | 'rules' | 'direct';

export interface Rule {
  direction: Direction;
  /** The three buckets a rule can sit in, as the routing editor names them. */
  kind: 'domain' | 'geosite' | 'geoip';
  /** What the rule is written as: a domain, a category name, or a CIDR range. */
  value: string;
  /** For a category, the members this page can prove. */
  members?: readonly string[];
}

/**
 * The profile the band runs, in evaluation order.
 *
 * Ads first, because a block rule that sits under a proxy rule is a block rule
 * that never fires — which is the whole of what "first match wins" means, and
 * the reason the routing editor lets the order be changed at all.
 */
export const RULES: readonly Rule[] = [
  { direction: 'block', kind: 'geosite', value: 'ads', members: ['doubleclick.net', 'adnxs.com'] },
  {
    direction: 'proxy',
    kind: 'geosite',
    value: 'youtube',
    members: ['youtube.com', 'googlevideo.com'],
  },
  { direction: 'proxy', kind: 'domain', value: 'openai.com' },
  { direction: 'proxy', kind: 'domain', value: 'wikipedia.*' },
  { direction: 'direct', kind: 'domain', value: 'intranet.example' },
  { direction: 'direct', kind: 'geoip', value: '10.0.0.0/8' },
];

/**
 * What the browser asked for, in the order the rows read.
 *
 * Seven, and each one is a different way of arriving at an answer: a category,
 * a subtree, a glob, a block, a private range, and a request no rule mentions.
 */
export const REQUESTS: readonly string[] = [
  'music.youtube.com',
  'api.openai.com',
  'ru.wikipedia.org',
  'static.doubleclick.net',
  'printer.intranet.example',
  '10.0.0.7',
  'news.ycombinator.com',
];

/** A host is under a domain entry when it is that domain or anything below it. */
function coversHost(entry: string, host: string): boolean {
  if (entry.includes('*') || entry.includes('?')) {
    const glob = entry.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]*').replace(/\?/g, '.');
    // `(?:.+\.)?` is the subtree the extension spells out as a second match
    // against `*.` + the pattern: `wikipedia.*` reaches `ru.wikipedia.org`.
    return new RegExp(`^(?:.+\\.)?${glob}$`).test(host);
  }
  return host === entry || host.endsWith(`.${entry}`);
}

/** Whether an IPv4 literal sits inside a CIDR range. Prefixes on octets only. */
function inRange(cidr: string, host: string): boolean {
  const [base, bits] = cidr.split('/');
  const octets = host.split('.');
  if (octets.length !== 4 || octets.some((o) => !/^\d{1,3}$/.test(o))) return false;
  const kept = Math.floor(Number(bits) / 8);
  return base.split('.').slice(0, kept).join('.') === octets.slice(0, kept).join('.');
}

export function matches(rule: Rule, host: string): boolean {
  if (rule.kind === 'geoip') return inRange(rule.value, host);
  if (rule.kind === 'geosite') return (rule.members ?? []).some((m) => coversHost(m, host));
  return coversHost(rule.value, host);
}

export interface Route {
  direction: Direction;
  /** The rule that decided, or `null` where nothing did and the mode did. */
  rule: Rule | null;
}

/**
 * Where a request goes under a given mode.
 *
 * Two of the three modes ignore the profile entirely, which is the fact the
 * band's switch is there to show: global sends everything through the active
 * server, direct sends everything out the way it would have gone anyway, and
 * only the middle one reads the rules.
 */
export function routeFor(host: string, mode: Mode): Route {
  if (mode === 'global') return { direction: 'proxy', rule: null };
  if (mode === 'direct') return { direction: 'direct', rule: null };
  const rule = RULES.find((r) => matches(r, host));
  return { direction: rule ? rule.direction : 'direct', rule: rule ?? null };
}
