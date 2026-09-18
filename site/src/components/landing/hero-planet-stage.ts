// Which stage the planet stands on, and so every colour in it.
//
// Two stages, and the light one is not a tint of the dark one. A planet cut
// out of a white page needs a *pale* globe with *darker* pads on it, which is
// the opposite of the relationship the dark stage has, and its rims have to
// come down to almost nothing: a coloured rim over white does not read as
// light, it reads as a stain.
//
// The palette is fixed rather than read off the page. The pads are a scale of
// tone, not an accent — there are ten steps of it and a graph colouring that
// spreads neighbouring countries across them — and the four accents the site
// offers have no ten-step scale to give. What the accents do reach is the
// rest of the hero: the buttons, the headline, the chips beside it.

/** A stage's colours. Values are 0xRRGGBB, as three.js wants them. */
export interface Stage {
  dark: boolean;
  /** The ten steps of the land, darkest first on the dark stage. */
  pads: readonly number[];
  /** What a wave brightens toward, and what the packet is made of. */
  crest: number;
  /** The sea: the sphere the pads stand on. */
  globe: number;
  /** The painted surroundings, top to bottom, that the gloss reflects. */
  sky: readonly [string, string, string, string];
  /** Soft lamps in that surrounding: x, y, radius, colour. */
  lamps: readonly (readonly [number, number, number, string])[];
  environment: number;
  hemi: { sky: number; ground: number; intensity: number };
  key: number;
  rims: readonly { color: number; intensity: number }[];
  /** Whether the comet adds its light to the ground or blends over it.
   *  Additive light needs dark to escape into. */
  additive: boolean;
  exposure: number;
}

/**
 * The dark ramp.
 *
 * Ten steps of one cold violet, evenly spaced. Two things it is not: it does
 * not run down into the body black — half the countries then sat at the same
 * value as the globe under them, and a pad that matches its background is not
 * a pad — and it is not desaturated toward the page, which reads as dirt
 * rather than as a lighter violet.
 */
const DARK_PADS = [
  0x463a66, 0x554876, 0x645786, 0x736596, 0x8273a6, 0x9182b7, 0xa091c7, 0xaf9fd7, 0xbeaee7,
  0xcdbcf7,
] as const;

/**
 * The light ramp, inverted: on a white page a pad has to be *darker* than the
 * globe, not lighter.
 *
 * Half the range of the dark one, and the chroma rises as the steps darken.
 * The first cut ran near-white to near-black, and because the colouring
 * deliberately puts neighbours far apart, every border slammed a pale country
 * against an almost black one and the planet came out speckled.
 */
const LIGHT_PADS = [
  0xbdafde, 0xb1a0da, 0xa48fd6, 0x987fd2, 0x8b6ecf, 0x7e5ccc, 0x704ac9, 0x6338c7, 0x5a31b9,
  0x512bab,
] as const;

const DARK: Stage = {
  dark: true,
  pads: DARK_PADS,
  crest: 0xe2d6ff,
  globe: 0x05070c,
  // The zenith carries real light. With a near-black top and the lamps all
  // down near the horizon, a pad's flat top faced the darkest part of the sky
  // while its bevel and its rounded corners faced the brightest — so every pad
  // came out a bright rim around a dark middle, and the grid read as two
  // thousand little frames with holes in them.
  sky: ['#4a5478', '#2a3148', '#0d111a', '#06070b'],
  lamps: [
    [150, 24, 250, 'rgba(226, 232, 248, 0.5)'],
    [150, 70, 268, 'rgba(216, 224, 242, 0.62)'],
    [392, 104, 214, 'rgba(168, 199, 250, 0.38)'],
    [286, 172, 190, 'rgba(187, 154, 247, 0.26)'],
  ],
  environment: 1.15,
  hemi: { sky: 0xa8c7fa, ground: 0x04060a, intensity: 0.3 },
  key: 1.05,
  // Rims down. They sit near the equator and so light the pads' *walls*,
  // which is the other half of why a pad read as a frame.
  rims: [
    { color: 0xbb9af7, intensity: 1.5 },
    { color: 0x7dcfee, intensity: 1.2 },
  ],
  additive: true,
  exposure: 1,
};

const LIGHT: Stage = {
  dark: false,
  pads: LIGHT_PADS,
  crest: 0x3a1f9e,
  // A white globe with a cool grey in it turns the shadowed half muddy under
  // a violet land. This is the palest step of the same violet instead, so
  // nothing in the scene is off-hue.
  globe: 0xeceaf6,
  sky: ['#ffffff', '#f7f5fc', '#eae7f5', '#d8d3ea'],
  lamps: [
    [150, 24, 250, 'rgba(255, 255, 255, 0.8)'],
    [150, 70, 268, 'rgba(255, 255, 255, 0.95)'],
    [392, 104, 214, 'rgba(240, 236, 252, 0.7)'],
    [286, 172, 190, 'rgba(223, 212, 250, 0.5)'],
  ],
  environment: 1,
  hemi: { sky: 0xffffff, ground: 0xd8d3ea, intensity: 1.4 },
  key: 1.5,
  rims: [
    { color: 0xbb9af7, intensity: 0.5 },
    { color: 0x7dcfee, intensity: 0.4 },
  ],
  additive: false,
  exposure: 0.92,
};

/** Whether the page is on its dark theme. `applyTheme` (src/lib/theme.ts)
 *  always leaves exactly one of `light`/`dark` on the root element. */
export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function planetStage(): Stage {
  return isDark() ? DARK : LIGHT;
}
