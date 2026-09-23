import { describe, expect, it } from 'vitest';
import {
  ENGINES,
  GROUPS,
  HERO_PROTOCOLS,
  PROTOCOLS,
  CAPABILITIES,
  coverageFor,
  type EngineKey,
} from './engines';

const names = (key: string) => GROUPS.find((g) => g.key === key)!.rows.map((r) => r.name);
const runs = (key: string, name: string) =>
  GROUPS.find((g) => g.key === key)!.rows.find((r) => r.name === name)!.runs;

describe('ENGINES', () => {
  it('ships three, sing-box the one already running', () => {
    expect(ENGINES.map((e) => e.name)).toEqual(['sing-box', 'xray-core', 'mihomo']);
    expect(ENGINES[0].isDefault).toBe(true);
    expect(ENGINES.slice(1).map((e) => e.isDefault)).toEqual([undefined, undefined]);
  });
});

describe('PROTOCOLS', () => {
  it('lists the thirteen the extension parses', () => {
    // ProtocolKind in extension/src/types/server.ts, one row each.
    expect(PROTOCOLS.map((p) => p.name)).toEqual([
      'VLESS',
      'VMess',
      'Trojan',
      'Shadowsocks',
      'WireGuard',
      'SOCKS',
      'HTTP',
      'Hysteria',
      'Hysteria2',
      'TUIC',
      'AnyTLS',
      'SSH',
      'ShadowTLS',
    ]);
  });

  it('gives each one the scheme its share link actually starts with', () => {
    // The REGISTRY in extension/src/lib/uri-parsers/index.ts.
    const byName = Object.fromEntries(PROTOCOLS.map((p) => [p.name, p.sub]));
    expect(byName.Shadowsocks).toBe('ss://');
    expect(byName.SOCKS).toBe('socks5://');
    expect(byName.HTTP).toBe('https://');
    for (const p of PROTOCOLS) expect(p.sub).toMatch(/^[a-z0-9]+:\/\/$/);
  });

  it('matches CORE_PROTOCOLS exactly, engine by engine', () => {
    // extension/src/lib/core-capabilities.ts: xray lacks hysteria, hysteria2,
    // tuic, anytls, ssh and shadowtls; mihomo lacks shadowtls alone.
    expect(runs('protocols', 'VLESS')).toEqual(['singbox', 'xray', 'mihomo']);
    expect(runs('protocols', 'Hysteria2')).toEqual(['singbox', 'mihomo']);
    expect(runs('protocols', 'ShadowTLS')).toEqual(['singbox']);
  });

  it('promises no format the extension cannot build', () => {
    // The band used to say mihomo adds Snell, SSR and Mieru. None of the three
    // is a ProtocolKind: no parser reads them and no builder emits them.
    const all = GROUPS.flatMap((g) => g.rows).map((r) => r.name);
    for (const ghost of ['Snell', 'SSR', 'Mieru', 'VLESS Reality']) {
      expect(all).not.toContain(ghost);
    }
  });
});

describe('the other two axes', () => {
  it('names the transports the extension builds, xhttp under its other name too', () => {
    // `transportOk` in core-capabilities.ts.
    expect(names('transports')).toEqual(['tcp', 'ws', 'grpc', 'httpupgrade', 'http', 'xhttp']);
    expect(GROUPS[1].rows.at(-1)?.sub).toBe('splithttp');
  });

  it('gives xray-core the one thing it alone can do', () => {
    expect(runs('transports', 'xhttp')).toEqual(['xray']);
    expect(runs('transports', 'ws')).toEqual(['singbox', 'xray', 'mihomo']);
  });

  it('attributes the security layers to no engine in particular', () => {
    // `securityOk` and the vision-flow check take no core argument: every
    // engine accepts TLS, Reality and xtls-rprx-vision, and every engine
    // rejects the retired flows. The band used to call them xray's.
    expect(names('security')).toEqual(['TLS', 'Reality', 'XTLS vision']);
    for (const row of GROUPS[2].rows) expect(row.runs).toHaveLength(3);
  });
});

describe('coverageFor', () => {
  it('counts the whole list per engine, which is the figure the band states', () => {
    expect(CAPABILITIES).toHaveLength(22);
    expect(ENGINES.map((e) => coverageFor(e.key as EngineKey))).toEqual([21, 16, 20]);
  });

  it('leaves exactly one capability to each of the two that stand alone', () => {
    const only = (key: EngineKey) =>
      CAPABILITIES.filter((c) => c.runs.length === 1 && c.runs[0] === key).map((c) => c.name);

    expect(only('singbox')).toEqual(['ShadowTLS']);
    expect(only('xray')).toEqual(['xhttp']);
    expect(only('mihomo')).toEqual([]);
  });
});

describe('HERO_PROTOCOLS', () => {
  it('hands the hero five, and never one the matrix is missing', () => {
    expect(HERO_PROTOCOLS.map((p) => p.name)).toEqual([
      'VLESS',
      'VMess',
      'Trojan',
      'Shadowsocks',
      'Hysteria2',
    ]);
    for (const p of HERO_PROTOCOLS) expect(PROTOCOLS).toContain(p);
  });
});

describe('GROUPS', () => {
  it('carries the three axes the cards count, in the order they are counted', () => {
    expect(GROUPS.map((g) => g.key)).toEqual(['protocols', 'transports', 'security']);
  });
});
