import { describe, expect, it } from 'vitest';
import { REQUESTS, RULES, matches, routeFor, type Rule } from './routing-scene';

const route = (host: string) => routeFor(host, 'rules');

describe('matches', () => {
  it('covers the domain an entry names and everything under it', () => {
    const rule: Rule = { direction: 'proxy', kind: 'domain', value: 'openai.com' };

    expect(matches(rule, 'openai.com')).toBe(true);
    expect(matches(rule, 'api.openai.com')).toBe(true);
    expect(matches(rule, 'a.b.openai.com')).toBe(true);
    // Not a suffix of the string, a suffix of the name: the entry has to end a
    // label, or `notopenai.com` would be caught by `openai.com`.
    expect(matches(rule, 'notopenai.com')).toBe(false);
    expect(matches(rule, 'openai.com.example')).toBe(false);
  });

  it('gives a glob entry the same subtree', () => {
    const rule: Rule = { direction: 'proxy', kind: 'domain', value: 'wikipedia.*' };

    // The law `domain-rules.ts` states: `rutracker.*` reaches
    // `www.rutracker.org` the way `rutracker.org` reaches it.
    expect(matches(rule, 'wikipedia.org')).toBe(true);
    expect(matches(rule, 'ru.wikipedia.org')).toBe(true);
    expect(matches(rule, 'wikipedia.example.com')).toBe(false);
  });

  it('matches a category by the members this page can prove', () => {
    const rule = RULES.find((r) => r.value === 'youtube')!;

    expect(matches(rule, 'music.youtube.com')).toBe(true);
    expect(matches(rule, 'redirector.googlevideo.com')).toBe(true);
    expect(matches(rule, 'youtube.example')).toBe(false);
  });

  it('matches an address inside a range, and only the addresses', () => {
    const rule = RULES.find((r) => r.kind === 'geoip')!;

    expect(matches(rule, '10.0.0.7')).toBe(true);
    expect(matches(rule, '10.255.3.1')).toBe(true);
    expect(matches(rule, '11.0.0.7')).toBe(false);
    expect(matches(rule, 'ten.example')).toBe(false);
  });
});

describe('routeFor', () => {
  it('lets the first matching rule decide', () => {
    // The same host under two rules: whichever is first in the profile wins,
    // which is why the routing editor lets the order be changed at all.
    const rules: Rule[] = [
      { direction: 'block', kind: 'domain', value: 'ads.example' },
      { direction: 'proxy', kind: 'domain', value: 'example' },
    ];
    const first = (list: Rule[]) => list.find((r) => matches(r, 'ads.example'))!;

    expect(first(rules).direction).toBe('block');
    expect(first([...rules].reverse()).direction).toBe('proxy');
  });

  it('sends what no rule mentions straight out', () => {
    expect(route('news.ycombinator.com')).toEqual({ direction: 'direct', rule: null });
  });

  it('decides each of the band’s requests, one way per row', () => {
    expect(REQUESTS.map((host) => route(host).direction)).toEqual([
      'proxy',
      'proxy',
      'proxy',
      'block',
      'direct',
      'direct',
      'direct',
    ]);
    expect(route('music.youtube.com').rule?.value).toBe('youtube');
    expect(route('printer.intranet.example').rule?.value).toBe('intranet.example');
  });

  it('ignores the profile in the two modes that ignore it', () => {
    for (const host of REQUESTS) {
      expect(routeFor(host, 'global')).toEqual({ direction: 'proxy', rule: null });
      expect(routeFor(host, 'direct')).toEqual({ direction: 'direct', rule: null });
    }
  });
});
