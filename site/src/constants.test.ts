import { describe, expect, it } from 'vitest';
import { WEBSTORE_EXT_ID, WEBSTORE_URL } from './constants';

describe('constants', () => {
  it('exposes the webstore extension id', () => {
    expect(WEBSTORE_EXT_ID).toBe('nmhobajopepdpihahepaddpdifdcenpn');
  });

  it('builds the webstore URL from the extension id', () => {
    expect(WEBSTORE_URL).toBe(
      `https://chromewebstore.google.com/detail/noctis/${WEBSTORE_EXT_ID}`,
    );
  });
});
