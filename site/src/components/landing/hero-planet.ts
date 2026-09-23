// The hero's planet.
//
// A dark globe tilted on its axis, its land drawn as a grid of pads, with
// exchanges running on it: a wave gathers onto a pad, a packet leaves along an
// arc, and from where it lands a wave spreads out again. Sixteen of those run
// at once, evenly staggered, so two or three packets are in the air at any
// moment and something is always arriving somewhere.
//
// The camera never performs for the visitor: it is fixed, and the only motion
// is the planet turning on its own axis. Nothing here reacts to the pointer —
// the figure sits behind the hero's copy, and a draggable background is a
// background that eats the page's scroll.
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { motionAllowed } from '@/lib/mock-motion';
import { buildCycle, LANES, PERIOD } from './hero-planet-cycle';
import { GLOBE, buildPacket, buildPads, planetWorld } from './hero-planet-world';
import { planetStage } from './hero-planet-stage';
import type { Stage } from './hero-planet-stage';

export { isDark } from './hero-planet-stage';

/** Earth's own tilt, near enough. The point is that the axis is not the
 *  screen's vertical: a globe spinning about a perfectly upright axis reads as
 *  a texture scrolling past rather than as a body turning. */
const TILT = (23.4 * Math.PI) / 180;
/** And a small lean toward the camera, so the turn carries the pole across
 *  the top of the disc instead of round its edge. */
const LEAN = 0.1;
const SPIN = 0.045;

/**
 * Where the camera stands, as a direction. It only ever moves along this line,
 * to fit the globe to the box.
 *
 * Raised, and that is not a composition choice. The key light comes from above
 * — it has to, or the flat tops of two thousand pads face the darkest part of
 * the sky — so a camera down at the equator looks straight at the half of the
 * planet those tops are *edge on* to, and the land comes out grey and unlit
 * while the poles catch everything. Looking down the same way the light does
 * puts the lit faces toward the viewer.
 */
const VIEW = new Vector3(0.436, 0.356, 0.826);

/** Five consecutive frames this slow and the loop gives up for good. A figure
 *  is never worth a page that cannot scroll. */
const SLOW_FRAME = 80;
const SLOW_STREAK = 5;

export interface HeroSceneDebug {
  /** Simulated seconds since boot. */
  clock: number;
  /** Packets in the air this instant, anywhere on the planet. */
  flying: number;
  /** Of those, the ones on the half of the planet the camera can see —
   *  which is the number the hero is actually tuned for. */
  onScreen: number;
  lanes: number;
  period: number;
  visible: boolean;
  running: boolean;
}

export interface HeroSceneHandle {
  dispose(): void;
  debug(): HeroSceneDebug;
}

/**
 * The surroundings the gloss reflects, painted rather than loaded: a gradient
 * from ground to sky with soft lamps near the horizon and one at the zenith.
 * Equirectangular, so one lamp lands over the viewer's shoulder and another
 * behind the planet's limb.
 */
function studio(renderer: WebGLRenderer, stage: Stage) {
  const source = document.createElement('canvas');
  source.width = 512;
  source.height = 256;
  const context = source.getContext('2d')!;

  const sky = context.createLinearGradient(0, 0, 0, 256);
  const stops = [0, 0.46, 0.54, 1];
  stage.sky.forEach((colour, index) => sky.addColorStop(stops[index], colour));
  context.fillStyle = sky;
  context.fillRect(0, 0, 512, 256);

  for (const [x, y, radius, colour] of stage.lamps) {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, colour);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const texture = new CanvasTexture(source);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(texture).texture;
  pmrem.dispose();
  texture.dispose();
  return environment;
}

export function bootHeroScene(host: HTMLElement, canvas: HTMLCanvasElement): HeroSceneHandle {
  const stage = planetStage();
  // Transparent: the figure sits behind the hero's copy and has to let the
  // page's own ground through, at whatever the theme has made it.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = stage.exposure;
  renderer.setClearAlpha(0);

  const scene = new Scene();
  const environment = studio(renderer, stage);
  scene.environment = environment;
  scene.environmentIntensity = stage.environment;

  const camera = new PerspectiveCamera(28, 1, 0.05, 100);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);

  scene.add(new HemisphereLight(stage.hemi.sky, stage.hemi.ground, stage.hemi.intensity));
  const key = new DirectionalLight(0xffffff, stage.key);
  key.position.set(1.6, 7.6, 4.2);
  scene.add(key);
  const rigPlaces = [
    [3.4, 2.8, 2.4],
    [0.4, 1.4, 2.8],
  ] as const;
  stage.rims.forEach(({ color, intensity }, index) => {
    const rim = new PointLight(color, intensity, 26);
    const [x, y, z] = rigPlaces[index];
    rim.position.set(x, y, z);
    scene.add(rim);
  });

  // Axis, then spin about it. Nothing stands under the planet: it is a body in
  // the page, not an object on a plinth.
  const axis = new Group();
  axis.rotation.z = -TILT;
  axis.rotation.x = LEAN;
  const spin = new Group();
  axis.add(spin);
  scene.add(axis);

  const world = planetWorld();
  const seaMaterial = new MeshPhysicalMaterial({
    color: stage.globe,
    metalness: 0,
    // Matte. Clearcoat belongs on a small part, where a tight highlight reads
    // as a rolled edge; on a sphere it is one hard white dot, and with two
    // thousand pads standing on it the whole thing turns into a mirror ball.
    roughness: 0.95,
    clearcoat: 0,
  });
  const seaGeometry = new SphereGeometry(GLOBE, 128, 64);
  spin.add(new Mesh(seaGeometry, seaMaterial));

  const pads = buildPads(world, stage);
  spin.add(pads.mesh);

  const packets = Array.from({ length: LANES }, () => {
    const made = buildPacket(stage);
    spin.add(made.group);
    return made;
  });
  const cycle = buildCycle(world, packets);

  const spun = new Quaternion();
  let clock = 0;
  let visible = true;
  let running = true;
  let frame = 0;
  let last = performance.now();
  let slow = 0;

  const draw = () => {
    // Off screen the loop parks instead of ticking empty frames; the observer
    // below starts it again when the figure comes back.
    if (!running || !visible) {
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(draw);
    const now = performance.now();
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;

    clock += delta;
    spin.rotation.y += delta * SPIN;
    cycle.step(clock);
    pads.apply(cycle.wave, cycle.rise, cycle.lift);
    renderer.render(scene, camera);

    // A figure that cannot keep up is worse than no figure.
    slow = performance.now() - now > SLOW_FRAME ? slow + 1 : 0;
    if (slow >= SLOW_STREAK) {
      running = false;
      cancelAnimationFrame(frame);
    }
  };

  const resize = () => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Fit the globe to the shorter side, with room for the packets' arcs and
    // the pads' own lift beyond the surface.
    //
    // How much room depends on the shape of the box. Beside the copy the box
    // is tall and narrow and the margin is real: the arcs leave the globe
    // sideways and there is nothing out there to hide them. Stacked, the box
    // is half as tall as it is wide, the globe is capped by its height with
    // width to spare, and the same margin only shrinks it — an arc that runs
    // off the side there meets the band's own edge fade, which is what that
    // fade is for.
    const vertical = (camera.fov * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    const limiting = Math.min(vertical, horizontal);
    const margin = camera.aspect > 1.4 ? 1.18 : 1.5;
    camera.position.copy(VIEW).multiplyScalar((GLOBE * margin) / Math.sin(limiting / 2));
    camera.lookAt(0, 0, 0);
  };

  const sizes = new ResizeObserver(resize);
  sizes.observe(host);

  // Offscreen is not a reason to keep a WebGL loop warm.
  const seen = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && running && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    },
    { rootMargin: '120px' },
  );
  seen.observe(host);

  resize();
  // Two seconds of simulation before the first paint, so the planet opens on a
  // composed frame rather than on an empty one filling up.
  for (let step = 0; step < 120; step += 1) {
    clock += 1 / 60;
    cycle.step(clock);
  }
  spin.rotation.y = clock * SPIN;
  pads.apply(cycle.wave, cycle.rise, cycle.lift);
  renderer.render(scene, camera);

  if (motionAllowed()) draw();
  else running = false;

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      sizes.disconnect();
      seen.disconnect();
      for (const packet of packets) packet.dispose();
      pads.dispose();
      seaGeometry.dispose();
      seaMaterial.dispose();
      environment.dispose();
      renderer.dispose();
    },
    debug() {
      // A packet counts as on screen when its head is on the camera's side of
      // the planet: the globe is opaque, so anything behind it is hidden.
      const toCamera = camera.position.clone().normalize();
      const turned = new Vector3();
      let onScreen = 0;
      for (const packet of packets) {
        const over = packet.over();
        if (!over) continue;
        turned.copy(over).applyQuaternion(spin.getWorldQuaternion(spun));
        if (turned.dot(toCamera) > 0) onScreen += 1;
      }
      return {
        clock,
        flying: cycle.flying(clock),
        onScreen,
        lanes: LANES,
        period: PERIOD,
        visible,
        running,
      };
    },
  };
}
