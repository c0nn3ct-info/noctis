// Which engine a pasted link would run on.
//
// The answer is read off `engines.ts` — the same two tables the matrix draws —
// so the panel and the grid cannot disagree about what runs where. Nothing here
// knows a fact of its own.
//
// The whole difference between the three engines is three sentences, and this
// is what states them one link at a time: sing-box runs all thirteen protocols,
// xray-core runs seven of them and is the only engine that builds xhttp, mihomo
// runs twelve. A visitor holding a link wants their line of that, not the grid.
import { ENGINES, GROUPS, type Capability, type EngineKey } from './engines';
import type { Field } from './share-link';

const PROTOCOL_ROWS = GROUPS.find((g) => g.key === 'protocols')!.rows;
const TRANSPORT_ROWS = GROUPS.find((g) => g.key === 'transports')!.rows;

/** Every engine, in the order the matrix lists them — sing-box first. */
const ALL: readonly EngineKey[] = ENGINES.map((e) => e.key);

/** `vless://` → `vless`. Transport rows carry a second name instead. */
function schemeOf(row: Capability): string | undefined {
  return row.sub?.endsWith('://') ? row.sub.slice(0, -3) : undefined;
}

const BY_SCHEME = new Map<string, Capability>();
for (const row of PROTOCOL_ROWS) {
  const scheme = schemeOf(row);
  if (scheme) BY_SCHEME.set(scheme, row);
}

/* The other spellings a panel or a provider hands out for the same protocol.
 * The table stores one scheme per row because the matrix has one column of
 * names to print; a pasted link is whatever its author wrote. */
const SCHEME_ALIASES: Record<string, string> = {
  hy: 'hysteria',
  hy2: 'hysteria2',
  wg: 'wireguard',
  socks: 'socks5',
  socks4: 'socks5',
  socks5h: 'socks5',
  http: 'https',
};

const BY_TRANSPORT = new Map<string, Capability>();
for (const row of TRANSPORT_ROWS) {
  BY_TRANSPORT.set(row.name, row);
  // `xhttp` is also written `splithttp`; the table already carries both.
  if (row.sub) BY_TRANSPORT.set(row.sub, row);
}
// xray writes the same transport `h2` where sing-box writes `http`.
BY_TRANSPORT.set('h2', BY_TRANSPORT.get('http')!);

export interface EnginePick {
  /** The engines that run this link, in the matrix's order. */
  engines: readonly EngineKey[];
  /** The one Noctis starts: the first of them, since sing-box leads the list. */
  chosen: EngineKey | null;
  /**
   * The row that cut the list down, when one did. It is what the panel names:
   * "only xray-core builds xhttp" is an answer, "xray-core" alone is not.
   */
  because: Capability | null;
  /** The transport, when it is the reason nothing is left. */
  against: Capability | null;
  /** A scheme the tables do not carry. */
  unknown: boolean;
}

function valueOf(fields: readonly Field[], label: string): string | undefined {
  return fields.find((f) => f.label === label)?.value;
}

/**
 * What the link in the panel would run on.
 *
 * Returns `null` when there is no protocol to go on at all, which is the
 * panel's empty state rather than a verdict.
 *
 * An unrecognised transport is ignored rather than refused: the table carries
 * the six the engines build, and a link is free to name a seventh that none of
 * them does. Saying "no engine" on the strength of a spelling this file has
 * never seen would be a guess wearing a verdict's clothes.
 */
export function pickEngine(fields: readonly Field[]): EnginePick | null {
  const scheme = valueOf(fields, 'protocol')?.toLowerCase();
  if (!scheme) return null;

  const protocol = BY_SCHEME.get(SCHEME_ALIASES[scheme] ?? scheme);
  if (!protocol) {
    return { engines: [], chosen: null, because: null, against: null, unknown: true };
  }

  const named = valueOf(fields, 'transport')?.toLowerCase();
  const transport = named ? BY_TRANSPORT.get(named) : undefined;

  const engines = ALL.filter(
    (key) => protocol.runs.includes(key) && (!transport || transport.runs.includes(key)),
  );

  /* Which of the two rows to name. Both can narrow — a Hysteria2 link asking
   * for xhttp is refused by each of them in turn — so the panel names the
   * tighter one, and the other is what it is held against. */
  const protocolNarrows = protocol.runs.length < ALL.length;
  const transportNarrows = !!transport && transport.runs.length < ALL.length;
  const tighter =
    transportNarrows && (!protocolNarrows || transport.runs.length <= protocol.runs.length)
      ? transport
      : protocolNarrows
        ? protocol
        : null;

  return {
    engines,
    chosen: engines[0] ?? null,
    because: engines.length === ALL.length ? null : tighter,
    against: engines.length === 0 ? (tighter === transport ? protocol : (transport ?? null)) : null,
    unknown: false,
  };
}

/** What that engine is called. */
export function engineName(key: EngineKey): string {
  return ENGINES.find((e) => e.key === key)!.name;
}

/** The engines this link leaves out, for the case where it leaves out one. */
export function engineRest(engines: readonly EngineKey[]): readonly EngineKey[] {
  return ALL.filter((key) => !engines.includes(key));
}
