// The landing page's own share-link reader.
//
// It exists so the anatomy band can make its claim honestly. The band says
// every field is read locally, and a static grid of nine cells cannot say that
// the way a field you paste your own link into does — the same reasoning the
// aria2t landing applies to its file picker and its rate limits: a picture of a
// control is not a control.
//
// This is not the extension's parser. The real one validates, resolves an
// engine and reports errors; this one only takes a link apart far enough to
// show what a link is made of, and never leaves the page.

export interface Field {
  /** The slice of the input this field was read out of, delimiters included. */
  raw: string;
  /**
   * The part of that slice which is punctuation rather than payload: `?fp=`,
   * `@`, `:`, `#`. The listing sets it back a step so the value it introduces
   * is what the eye lands on.
   */
  prefix: string;
  /** What follows the value inside `raw`, which only the scheme has: `://`. */
  suffix: string;

  /** The field's name, as the engines spell it. */
  label: string;
  /** What the field resolved to. */
  value: string;
  /**
   * Whether this field changes how the tunnel is built rather than merely
   * where it points. Those are the ones worth reading first.
   */
  decides: boolean;
}

/* Query keys the engines name differently from the share link. Anything not
 * here keeps its own key as its label, so a link carrying `flow` or `pbk` still
 * gets a cell rather than being silently dropped. */
const LABELS: Record<string, string> = { fp: 'fingerprint', type: 'transport' };

/** The keys that decide how the tunnel is built. `protocol` and `host` too. */
const DECIDES = new Set(['security', 'type']);

/** Percent-decoding that survives a half-typed escape, because this runs on
 * every keystroke of a field a visitor is editing. */
function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Takes a share link apart into the fields it carries.
 *
 * Exhaustive by construction: every character of `link` lands in exactly one
 * field's `raw`, so joining them spells the input back. That is what lets the
 * panel show the whole link above the cells and promise the cells account for
 * it — `share-link.test.ts` asserts the round trip.
 *
 * Returns `[]` for anything without a `://`, which is the panel's empty state.
 */
export function parseShareLink(link: string): Field[] {
  const sep = link.indexOf('://');
  if (sep === -1) return [];

  const fields: Field[] = [];
  const scheme = link.slice(0, sep);
  fields.push({
    raw: link.slice(0, sep + 3),
    prefix: '',
    suffix: '://',
    label: 'protocol',
    value: scheme,
    decides: true,
  });

  const rest = link.slice(sep + 3);

  // The authority ends at the query or the fragment, whichever comes first.
  const marks = [rest.indexOf('?'), rest.indexOf('#')].filter((i) => i !== -1);
  const authorityEnd = marks.length ? Math.min(...marks) : rest.length;
  const authority = rest.slice(0, authorityEnd);
  const tail = rest.slice(authorityEnd);

  // Last `@`, not the first: a password may contain one.
  const at = authority.lastIndexOf('@');
  if (at !== -1) {
    fields.push({
      raw: authority.slice(0, at),
      prefix: '',
      suffix: '',
      label: 'uuid',
      value: authority.slice(0, at),
      decides: false,
    });
  }
  const hostport = authority.slice(at + 1);
  if (hostport) {
    // An IPv6 host is bracketed and full of colons, so the port separator is
    // the first colon after the closing bracket rather than the last one.
    const bracket = hostport.lastIndexOf(']');
    const colon = hostport.indexOf(':', bracket === -1 ? 0 : bracket);
    const hostEnd = colon === -1 ? hostport.length : colon;
    const prefix = at === -1 ? '' : '@';
    fields.push({
      raw: prefix + hostport.slice(0, hostEnd),
      prefix,
      suffix: '',
      label: 'host',
      value: hostport.slice(0, hostEnd),
      decides: true,
    });
    if (colon !== -1) {
      fields.push({
        raw: hostport.slice(hostEnd),
        prefix: ':',
        suffix: '',
        label: 'port',
        value: hostport.slice(hostEnd + 1),
        decides: false,
      });
    }
  }

  const hash = tail.indexOf('#');
  const query = hash === -1 ? tail : tail.slice(0, hash);
  if (query) {
    // Split on `&` but keep each delimiter with the parameter it introduces, so
    // the leading `?` and every `&` are accounted for.
    query
      .slice(1)
      .split('&')
      .forEach((part, i) => {
        const raw = (i === 0 ? '?' : '&') + part;
        const eq = part.indexOf('=');
        const key = eq === -1 ? part : part.slice(0, eq);
        fields.push({
          raw,
          // A parameter with no `=` is punctuation all the way down: there is
          // no value under it to set apart.
          prefix: eq === -1 ? raw : raw.slice(0, raw.length - part.length + eq + 1),
          suffix: '',
          label: LABELS[key] ?? key,
          value: eq === -1 ? '' : decode(part.slice(eq + 1)),
          decides: DECIDES.has(key),
        });
      });
  }
  if (hash !== -1) {
    const tag = tail.slice(hash + 1);
    fields.push({
      raw: tail.slice(hash),
      prefix: '#',
      suffix: '',
      label: 'tag',
      value: decode(tag),
      decides: false,
    });
  }

  return fields;
}

/**
 * A Reality share link, invented but well-formed — what the panel opens on.
 *
 * The uuid is elided rather than faked in full: a complete one reads as a
 * credential someone might try.
 *
 * Plain ASCII, and the `...` is three dots rather than an ellipsis: the panel
 * quotes each slice in a monospace column, and neither `…` nor an emoji is in
 * the fallback chain at the width its character count claims.
 */
export const SAMPLE_LINK =
  'vless://d1f4...8c2a@ams.example.net:443?security=reality&sni=cdn.example.com&fp=chrome&type=tcp#Amsterdam';
