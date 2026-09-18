import { describe, expect, it } from 'vitest';
import { SAMPLE_LINK, parseShareLink } from './share-link';

/** The property the panel rests on: the cells account for every character. */
function spellsBack(link: string) {
  return parseShareLink(link)
    .map((f) => f.raw)
    .join('');
}

describe('parseShareLink', () => {
  it('reads every field of a Reality share link, in the order they appear', () => {
    const fields = parseShareLink(SAMPLE_LINK);

    expect(fields.map((f) => f.label)).toEqual([
      'protocol',
      'uuid',
      'host',
      'port',
      'security',
      'sni',
      'fingerprint',
      'transport',
      'tag',
    ]);
    expect(fields.map((f) => f.value)).toEqual([
      'vless',
      'd1f4...8c2a',
      'ams.example.net',
      '443',
      'reality',
      'cdn.example.com',
      'chrome',
      'tcp',
      'Amsterdam',
    ]);
  });

  it('spells the input back, character for character', () => {
    expect(spellsBack(SAMPLE_LINK)).toBe(SAMPLE_LINK);
    expect(spellsBack('vmess://a@b.example:1?type=ws#x')).toBe('vmess://a@b.example:1?type=ws#x');
    expect(spellsBack('trojan://pw@h.example')).toBe('trojan://pw@h.example');
    expect(spellsBack('ss://h.example:8388')).toBe('ss://h.example:8388');
    expect(spellsBack('vless://')).toBe('vless://');
  });

  it('marks the fields that decide how the tunnel is built', () => {
    const decides = parseShareLink(SAMPLE_LINK).filter((f) => f.decides).map((f) => f.label);

    expect(decides).toEqual(['protocol', 'host', 'security', 'transport']);
  });

  it('carries an unknown parameter through under its own name', () => {
    const fields = parseShareLink('vless://u@h.example:443?flow=xtls-rprx-vision&pbk=abc');

    expect(fields.map((f) => f.label)).toEqual(['protocol', 'uuid', 'host', 'port', 'flow', 'pbk']);
    expect(fields.find((f) => f.label === 'flow')?.value).toBe('xtls-rprx-vision');
  });

  it('handles a link with no credential, no port, no query and no tag', () => {
    expect(parseShareLink('socks5://h.example').map((f) => f.label)).toEqual(['protocol', 'host']);
  });

  it('keeps an IPv6 host whole rather than splitting it on its own colons', () => {
    const fields = parseShareLink('vless://u@[2001:db8::1]:443?type=tcp');

    expect(fields.find((f) => f.label === 'host')?.value).toBe('[2001:db8::1]');
    expect(fields.find((f) => f.label === 'port')?.value).toBe('443');
    expect(spellsBack('vless://u@[2001:db8::1]:443?type=tcp')).toBe('vless://u@[2001:db8::1]:443?type=tcp');
  });

  it('keeps an IPv6 host with no port whole', () => {
    expect(parseShareLink('vless://[::1]').find((f) => f.label === 'host')?.value).toBe('[::1]');
  });

  it('decodes what the link percent-encoded', () => {
    const fields = parseShareLink('vless://u@h.example:443?sni=a%2Eb#My%20Server');

    expect(fields.find((f) => f.label === 'sni')?.value).toBe('a.b');
    expect(fields.find((f) => f.label === 'tag')?.value).toBe('My Server');
  });

  it('leaves an undecodable escape as it was written rather than throwing', () => {
    const fields = parseShareLink('vless://u@h.example:443?sni=%E0%A4%A#%ZZ');

    expect(fields.find((f) => f.label === 'sni')?.value).toBe('%E0%A4%A');
    expect(fields.find((f) => f.label === 'tag')?.value).toBe('%ZZ');
  });

  it('takes a parameter with no value, and an empty tag', () => {
    const fields = parseShareLink('vless://u@h.example:443?allowInsecure&#');

    expect(fields.find((f) => f.label === 'allowInsecure')?.value).toBe('');
    expect(fields.map((f) => f.label)).toContain('tag');
  });

  it('reads nothing out of a string that is not a link', () => {
    expect(parseShareLink('')).toEqual([]);
    expect(parseShareLink('just some text')).toEqual([]);
    expect(parseShareLink('vless:/missing-a-slash')).toEqual([]);
  });

  it('is spelled entirely in ASCII, which the monospace column depends on', () => {
    // The panel quotes each slice in a monospace column; neither `…` nor an
    // emoji is in the fallback chain at the width its character count claims.
    expect(SAMPLE_LINK).toMatch(/^[\x20-\x7e]+$/);
  });

  it('is the sample the panel opens on', () => {
    expect(SAMPLE_LINK.startsWith('vless://')).toBe(true);
    expect(parseShareLink(SAMPLE_LINK)).toHaveLength(9);
  });
});
