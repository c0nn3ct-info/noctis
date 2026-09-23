/* The two capability axes, read off the extension rather than written here:
 *
 *   - the thirteen protocols are `ProtocolKind` in extension/src/types/server.ts
 *   - the scheme each one is pasted as is the REGISTRY in
 *     extension/src/lib/uri-parsers/index.ts
 *   - which engine runs which protocol is CORE_PROTOCOLS, and which engine
 *     builds which transport is `transportOk`, both in
 *     extension/src/lib/core-capabilities.ts
 *   - the security layers are `Security` in types/server.ts, gated by
 *     `securityOk` and VISION_FLOWS
 *
 * Three claims the page used to make are not in those tables, and are gone:
 *
 *   - "mihomo adds Snell, SSR and Mieru" — none of the three is a ProtocolKind,
 *     so no parser reads them and no builder emits them. mihomo runs sing-box's
 *     set minus shadowtls and adds nothing.
 *   - "xray-core adds XTLS flows and REALITY-vision" — `securityOk` and the
 *     vision-flow check take no core argument. Every engine accepts TLS,
 *     Reality and xtls-rprx-vision, and every engine rejects the retired flows.
 *   - "xhttp and splithttp" as two additions — one transport, two names for it.
 *
 * What is left is the whole difference: xray-core runs seven of the thirteen
 * and is the only engine that builds xhttp; mihomo runs twelve.
 */

export type EngineKey = 'singbox' | 'xray' | 'mihomo';

export interface Engine {
  key: EngineKey;
  /** What the binary is called, in every locale. */
  name: string;
  /** The one that is already running. The others are switched on. */
  isDefault?: true;
}

export const ENGINES: readonly Engine[] = [
  { key: 'singbox', name: 'sing-box', isDefault: true },
  { key: 'xray', name: 'xray-core' },
  { key: 'mihomo', name: 'mihomo' },
];

const ALL: readonly EngineKey[] = ['singbox', 'xray', 'mihomo'];
const NO_XRAY: readonly EngineKey[] = ['singbox', 'mihomo'];

export interface Capability {
  name: string;
  /** The scheme a share link starts with, or the other name a panel gives it. */
  sub?: string;
  runs: readonly EngineKey[];
}

export type GroupKey = 'protocols' | 'transports' | 'security';

export interface Group {
  key: GroupKey;
  rows: readonly Capability[];
}

export const GROUPS: readonly Group[] = [
  {
    key: 'protocols',
    rows: [
      { name: 'VLESS', sub: 'vless://', runs: ALL },
      { name: 'VMess', sub: 'vmess://', runs: ALL },
      { name: 'Trojan', sub: 'trojan://', runs: ALL },
      { name: 'Shadowsocks', sub: 'ss://', runs: ALL },
      { name: 'WireGuard', sub: 'wireguard://', runs: ALL },
      { name: 'SOCKS', sub: 'socks5://', runs: ALL },
      { name: 'HTTP', sub: 'https://', runs: ALL },
      { name: 'Hysteria', sub: 'hysteria://', runs: NO_XRAY },
      { name: 'Hysteria2', sub: 'hysteria2://', runs: NO_XRAY },
      { name: 'TUIC', sub: 'tuic://', runs: NO_XRAY },
      { name: 'AnyTLS', sub: 'anytls://', runs: NO_XRAY },
      { name: 'SSH', sub: 'ssh://', runs: NO_XRAY },
      { name: 'ShadowTLS', sub: 'shadowtls://', runs: ['singbox'] },
    ],
  },
  {
    key: 'transports',
    rows: [
      { name: 'tcp', runs: ALL },
      { name: 'ws', runs: ALL },
      { name: 'grpc', runs: ALL },
      { name: 'httpupgrade', runs: ALL },
      { name: 'http', runs: ALL },
      { name: 'xhttp', sub: 'splithttp', runs: ['xray'] },
    ],
  },
  {
    key: 'security',
    rows: [
      { name: 'TLS', runs: ALL },
      { name: 'Reality', runs: ALL },
      { name: 'XTLS vision', runs: ALL },
    ],
  },
];

/** Every protocol, in the order the matrix draws them. */
export const PROTOCOLS: readonly Capability[] = GROUPS[0].rows;

/**
 * The five the hero names, by how often a visitor is holding a link for one.
 *
 * Filtered out of `PROTOCOLS` rather than written out again, so the hero still
 * cannot name a protocol the matrix does not list.
 */
const HERO_NAMES: readonly string[] = ['VLESS', 'VMess', 'Trojan', 'Shadowsocks', 'Hysteria2'];

export const HERO_PROTOCOLS: readonly Capability[] = PROTOCOLS.filter((p) =>
  HERO_NAMES.includes(p.name),
);

/**
 * Every capability the band counts, in one list: the thirteen protocols, the
 * six transports and the three security layers.
 *
 * The band states a single figure per engine — 21 of 22, 16 of 22, 20 of 22 —
 * and groups the whole list by which engines run each one, so the three axes
 * stop being three separate questions.
 */
export const CAPABILITIES: readonly Capability[] = GROUPS.flatMap((g) => g.rows);

/** How many of them this engine runs. */
export function coverageFor(engine: EngineKey): number {
  return CAPABILITIES.filter((c) => c.runs.includes(engine)).length;
}
