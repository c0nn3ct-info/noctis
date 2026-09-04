// Hard-coded mock data for stories.
//
// `AmbientWave` is a pure renderer — the parent owns the sample buffer — so a
// story has to supply one. These are literals rather than `Math.random()` walks
// so the wave is the same shape on every reload and in the autodocs snapshot.

// The scale and the buffer length belong to `PopupMock`, which is the component
// that fixes them, so they are taken from there rather than restated: a rescale
// or a longer buffer moves the stories with it instead of leaving them on stale
// numbers.
import { WAVE_MAX, WAVE_N } from '@/components/popup-mock';

export { WAVE_MAX };

/** Number of samples the popup's rolling buffer holds. */
const WAVE_POINTS = WAVE_N;

/**
 * The popup's own opening frame: `PopupMock`'s seeded mulberry32 walk, summed
 * down + up, exactly as `<PopupMock paused />` renders it.
 */
export const WAVE_SEEDED: number[] = [
  818_596, 1_000_236, 928_073, 1_255_780, 1_212_423, 1_316_168, 1_115_936, 1_008_876,
  896_057, 1_077_764, 1_175_021, 1_282_346, 1_141_966, 1_288_167, 1_360_801, 1_292_208,
  1_326_510, 1_640_101, 1_638_760, 1_722_427, 1_428_077, 1_300_322, 1_283_542, 1_275_589,
  1_341_196, 1_159_201, 1_307_359, 1_121_833, 1_220_815, 1_073_293, 925_525, 1_090_600,
  970_021, 1_126_817, 1_222_645, 1_202_992, 1_026_063, 985_287, 934_350, 766_990,
  861_193, 1_022_410, 928_315, 1_002_452,
];

/** An idle tunnel: every sample identical, so the curve is a straight line. */
export const WAVE_FLAT: number[] = Array.from({ length: WAVE_POINTS }, () => 300_000);

/**
 * Alternating floor and ceiling — the worst case for the Catmull-Rom smoothing,
 * and the only shape that shows how far the control points overshoot.
 */
export const WAVE_SPIKY: number[] = Array.from({ length: WAVE_POINTS }, (_, i) =>
  i % 2 === 0 ? 40_000 : 2_600_000,
);
