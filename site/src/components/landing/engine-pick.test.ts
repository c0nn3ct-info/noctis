import { describe, expect, it } from 'vitest';
import { engineName, engineRest, pickEngine } from './engine-pick';
import { SAMPLE_LINK, parseShareLink } from './share-link';

const pick = (link: string) => pickEngine(parseShareLink(link));

describe('pickEngine', () => {
  it('starts sing-box for a link every engine can run', () => {
    const p = pick(SAMPLE_LINK)!;

    expect(p.engines).toEqual(['singbox', 'xray', 'mihomo']);
    expect(p.chosen).toBe('singbox');
    // Nothing narrowed the list, so there is nothing to name.
    expect(p.because).toBeNull();
  });

  it('names the transport when the transport is what decided', () => {
    const p = pick('vless://u@h.example:443?type=xhttp')!;

    expect(p.engines).toEqual(['xray']);
    expect(p.because?.name).toBe('xhttp');
  });

  it('reads splithttp and h2 as the transports they are', () => {
    expect(pick('vless://u@h.example:443?type=splithttp')!.engines).toEqual(['xray']);
    // xray writes `h2` where sing-box writes `http`, and every engine builds it.
    expect(pick('vless://u@h.example:443?type=h2')!.engines).toEqual([
      'singbox',
      'xray',
      'mihomo',
    ]);
  });

  it('names the protocol when the protocol is what decided', () => {
    const p = pick('hysteria2://u@h.example:443')!;

    expect(p.engines).toEqual(['singbox', 'mihomo']);
    expect(p.because?.name).toBe('Hysteria2');
    expect(engineRest(p.engines).map(engineName)).toEqual(['xray-core']);
  });

  it('takes the shorthand a provider hands out for the same protocol', () => {
    expect(pick('hy2://u@h.example:443')!.engines).toEqual(pick('hysteria2://u@h.example:443')!.engines);
    expect(pick('wg://h.example:51820')!.because).toBeNull();
    expect(pick('socks://h.example:1080')!.because).toBeNull();
  });

  it('leaves nothing when the two rows rule each other out', () => {
    // Hysteria2 is sing-box and mihomo; xhttp is xray alone.
    const p = pick('hysteria2://u@h.example:443?type=xhttp')!;

    expect(p.engines).toEqual([]);
    expect(p.chosen).toBeNull();
    // The tighter row is what the panel names, the other what it is held
    // against.
    expect(p.because?.name).toBe('xhttp');
    expect(p.against?.name).toBe('Hysteria2');
  });

  it('says so when the scheme is not one the tables carry', () => {
    const p = pick('quic://h.example:443')!;

    expect(p.unknown).toBe(true);
    expect(p.chosen).toBeNull();
  });

  it('ignores a transport it has never seen rather than refusing the link', () => {
    // The table carries the six the engines build. A link naming a seventh is
    // not a reason to report that no engine runs it.
    const p = pick('vless://u@h.example:443?type=quicstream')!;

    expect(p.engines).toEqual(['singbox', 'xray', 'mihomo']);
    expect(p.unknown).toBe(false);
  });

  it('has no verdict for something with no protocol in it', () => {
    expect(pickEngine(parseShareLink('not a link'))).toBeNull();
  });

  it('runs only sing-box for the one protocol only sing-box runs', () => {
    const p = pick('shadowtls://u@h.example:443')!;

    expect(p.engines).toEqual(['singbox']);
    expect(p.because?.name).toBe('ShadowTLS');
  });
});
