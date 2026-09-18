// The planet's land: where it is, how it connects, and what draws it.
//
// The world is a grid of pads, one per 2.5-degree cell that has land under
// its middle. Which cells those are, which country each belongs to and which
// step of the palette that country was given are all baked — see
// `scripts/build-planet-grid.mjs` — so nothing here parses geography or asks
// the network for it. This module turns that table into positions, into a
// graph a wave can walk, and into the two meshes the scene draws.
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  AdditiveBlending,
  NormalBlending,
} from 'three';
import { GRID, planetGrid } from './hero-planet-grid';
import type { Stage } from './hero-planet-stage';

export const GLOBE = 1;
/** A cell's side in world units. The grid keeps cells roughly square, so this
 *  is very nearly every cell's width as well as its height. */
const CELL = ((GRID * Math.PI) / 180) * GLOBE;
const GAP = 0.17;
const PAD_SIDE = CELL * (1 - GAP * 2);

/**
 * A pad is deliberately flatter than it is wide.
 *
 * The first cut made them almost cubes, and a cube seen from this camera is
 * mostly *side* — sides are lit at a graze and read dark, so they diluted the
 * country tones until the ramp was barely there. The top has to be most of
 * what you see.
 */
const PAD_HEIGHT = 0.018;
/** How far a pad rises at the crest of a wave — about twice its own height. */
export const PAD_LIFT = 0.036;

/** One step of land, as an angle, so speeds and reach stay in radians. */
export const STEP_ANGLE = (GRID * Math.PI) / 180;

export interface Cell {
  normal: Vector3;
  /** The cell's own width, as a multiple of the modelled pad. */
  stretch: number;
  band: number;
  column: number;
  tone: number;
  country: number;
}

export interface World {
  cells: Cell[];
  /** Up to eight neighbours per cell, `-1` where there is none. */
  neighbours: Int32Array;
  /** The true angle across each of those edges. */
  weights: Float32Array;
  /** How many cells are in each cell's own connected piece of land. */
  sizes: Int32Array;
}

const NEIGHBOURS = 8;
/**
 * The longest an edge may be, as a multiple of a cell.
 *
 * Without this the graph leaks across oceans at high latitude. The grid keeps
 * its cells square by *dropping columns* as the parallels shorten, so near the
 * pole a band is a dozen cells around and each spans thirty degrees of
 * longitude — northern Greenland and northern Siberia land in neighbouring
 * columns despite the Arctic Ocean between them. The edge exists, a front
 * takes it, and the wave surfaces on the far side of a sea it never crossed.
 */
const MAX_EDGE = STEP_ANGLE * 1.8;

/** Land big enough for a front to happen on. A source on a two-pad island
 *  leaves the wave nowhere to travel, and the cycle sits there looking
 *  broken rather than slow. */
export const MIN_LAND = 70;

/**
 * How far a wave pulls a pad toward the crest colour, and how hard it lights
 * it. Both are about a fifth of what the standalone preview uses, and the
 * reason is arithmetic rather than taste.
 *
 * The preview opens with one exchange running. The hero runs fourteen, because
 * that is what holds two or three packets in frame — and a wave is not one
 * event but two, a gathering and a spreading, so at any moment about seven of
 * them are on the half of the planet facing the viewer instead of half of one.
 * At the preview's weights the sum of those seven washed the land out: the
 * violet ramp went pale, the crests blew to white, and the planet read as
 * glass rather than as matte tiles with something happening on them.
 *
 * Measured rather than guessed. Over the same frame the preview lights 3.6% of
 * its land above the crest threshold; the hero at these weights lights 3.5%.
 * If `LANES` changes, these have to move with it.
 */
const CREST_MIX = 0.3;
const LIT_STRENGTH = 0.18;

/** Equirectangular lon/lat to a point on the unit sphere. */
function onSphere(lon: number, lat: number): Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new Vector3(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * The land as a graph: up to eight neighbours per cell, each edge carrying
 * the real angle between the two cells.
 *
 * East and west are the next column of the same band. North and south are not
 * the same column number — the number of columns around a parallel falls with
 * its cosine — so a cell's neighbour one band up is whichever column of that
 * band its own longitude lands in, and the two either side of it are the
 * diagonals. Water has no cell and therefore no edge, which is the whole
 * point: a front walking this graph follows the coastline.
 *
 * Both the diagonals and the weights are there for the same reason. Four
 * neighbours and one step per edge is the taxicab metric, whose circles are
 * diamonds — and that is what the first cut drew, a square front standing on
 * its corner, turning with the grid rather than with the land.
 */
function buildWorld(): World {
  const grid = planetGrid();
  const cells: Cell[] = [];
  const slots: Int32Array[] = [];
  for (let band = 0; band < grid.counts.length; band += 1) {
    slots.push(new Int32Array(grid.counts[band]).fill(-1));
  }

  const lonOf = (band: number, column: number) => {
    const step = 360 / grid.counts[band];
    return -180 + column * step + step / 2;
  };

  for (let i = 0; i < grid.columns.length; i += 1) {
    const band = grid.bands[i];
    const column = grid.columns[i];
    const middle = -85 + band * GRID + GRID / 2;
    const lonStep = 360 / grid.counts[band];
    slots[band][column] = cells.length;
    cells.push({
      normal: onSphere(lonOf(band, column), middle),
      stretch: (((lonStep * Math.PI) / 180) * Math.cos((middle * Math.PI) / 180) * GLOBE) / CELL,
      band,
      column,
      tone: grid.tone[i],
      country: grid.country[i],
    });
  }

  const neighbours = new Int32Array(cells.length * NEIGHBOURS).fill(-1);
  const weights = new Float32Array(cells.length * NEIGHBOURS);
  const slotAt = (band: number, lon: number, offset: number) => {
    if (band < 0 || band >= grid.counts.length) return -1;
    const count = grid.counts[band];
    const k = Math.floor(((lon + 180) / 360) * count) + offset;
    return slots[band][((k % count) + count) % count];
  };

  cells.forEach((cell, i) => {
    const row = slots[cell.band];
    const count = grid.counts[cell.band];
    const lon = lonOf(cell.band, cell.column);
    const found = [
      row[(cell.column + 1) % count],
      row[(cell.column - 1 + count) % count],
      slotAt(cell.band + 1, lon, 0),
      slotAt(cell.band - 1, lon, 0),
      slotAt(cell.band + 1, lon, 1),
      slotAt(cell.band + 1, lon, -1),
      slotAt(cell.band - 1, lon, 1),
      slotAt(cell.band - 1, lon, -1),
    ];
    for (let e = 0; e < NEIGHBOURS; e += 1) {
      const to = found[e];
      if (to < 0 || to === i) continue;
      const span = cell.normal.angleTo(cells[to].normal);
      if (span > MAX_EDGE) continue;
      neighbours[i * NEIGHBOURS + e] = to;
      weights[i * NEIGHBOURS + e] = span;
    }
  });

  return { cells, neighbours, weights, sizes: componentSizes(neighbours, cells.length) };
}

/** One pass over the graph: how many cells each connected piece of land has. */
function componentSizes(neighbours: Int32Array, count: number): Int32Array {
  const label = new Int32Array(count).fill(-1);
  const size = new Int32Array(count);
  const queue = new Int32Array(count);
  const tally: number[] = [];
  let next = 0;
  for (let seed = 0; seed < count; seed += 1) {
    if (label[seed] >= 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail] = seed;
    tail += 1;
    label[seed] = next;
    let found = 1;
    while (head < tail) {
      const at = queue[head];
      head += 1;
      for (let e = 0; e < NEIGHBOURS; e += 1) {
        const to = neighbours[at * NEIGHBOURS + e];
        if (to < 0 || label[to] >= 0) continue;
        label[to] = next;
        queue[tail] = to;
        tail += 1;
        found += 1;
      }
    }
    tally.push(found);
    next += 1;
  }
  for (let i = 0; i < count; i += 1) size[i] = tally[label[i]];
  return size;
}

/**
 * Shortest path from one cell to every other, in radians along the land, and
 * `Infinity` for everything the source cannot reach on foot.
 *
 * Dijkstra rather than breadth-first, because the edges are not all the same
 * length: a diagonal is half again as long as a step along a parallel, and
 * counting both as one is what made a front a diamond. Runs when a source
 * changes, not per frame.
 */
export function spreadFrom(world: World, source: number, into: Float32Array): Float32Array {
  const { neighbours, weights } = world;
  const count = into.length;
  into.fill(Infinity);
  into[source] = 0;
  const heapNode = new Int32Array(count + 1);
  const heapCost = new Float32Array(count + 1);
  let size = 0;

  const push = (node: number, cost: number) => {
    size += 1;
    let at = size;
    while (at > 1 && heapCost[at >> 1] > cost) {
      heapNode[at] = heapNode[at >> 1];
      heapCost[at] = heapCost[at >> 1];
      at >>= 1;
    }
    heapNode[at] = node;
    heapCost[at] = cost;
  };

  const pop = () => {
    const best = heapNode[1];
    const node = heapNode[size];
    const cost = heapCost[size];
    size -= 1;
    let at = 1;
    for (;;) {
      let child = at << 1;
      if (child > size) break;
      if (child < size && heapCost[child + 1] < heapCost[child]) child += 1;
      if (heapCost[child] >= cost) break;
      heapNode[at] = heapNode[child];
      heapCost[at] = heapCost[child];
      at = child;
    }
    heapNode[at] = node;
    heapCost[at] = cost;
    return best;
  };

  push(source, 0);
  while (size) {
    const at = pop();
    const here = into[at];
    for (let e = 0; e < NEIGHBOURS; e += 1) {
      const to = neighbours[at * NEIGHBOURS + e];
      if (to < 0) continue;
      const cost = here + weights[at * NEIGHBOURS + e];
      if (cost >= into[to]) continue;
      into[to] = cost;
      push(to, cost);
    }
  }
  return into;
}

/**
 * The pad: a rounded slab modelled once at world size, based at y = 0 so an
 * instance placed on the sphere stands on it.
 *
 * Rounded, not round. At three tenths of the side — where this started — the
 * fillet meets itself halfway along every edge and a pad ten pixels across is
 * a dot; the flat of each side has to survive for the grid to read as squares.
 */
function padGeometry(): ExtrudeGeometry {
  const half = PAD_SIDE / 2;
  const radius = PAD_SIDE * 0.17;
  const bevel = PAD_SIDE * 0.008;
  const inner = half - bevel;
  const r = Math.max(0.0001, radius - bevel);

  const shape = new Shape();
  shape.moveTo(-inner + r, -inner);
  shape.lineTo(inner - r, -inner);
  shape.absarc(inner - r, -inner + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(inner, inner - r);
  shape.absarc(inner - r, inner - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-inner + r, inner);
  shape.absarc(-inner + r, inner - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-inner, -inner + r);
  shape.absarc(-inner + r, -inner + r, r, Math.PI, Math.PI * 1.5, false);

  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(0.002, PAD_HEIGHT - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox!.min.y, 0);
  return geometry;
}

export interface Pads {
  mesh: InstancedMesh;
  /** Push the two buffers out: `wave` is colour and light, `rise` is height. */
  apply(wave: Float32Array, rise: Float32Array, lift: number): void;
  dispose(): void;
}

/**
 * The land, as one instanced mesh.
 *
 * Merging every pad into a single geometry with its tone baked into the vertex
 * colours is the right answer for a still picture and the wrong one for a
 * moving planet: a merged pad has no identity left, so nothing can lift or
 * light one of them. Here every pad is an instance — its resting matrix and
 * resting colour are kept aside, and a frame is two writes.
 */
export function buildPads(world: World, stage: Stage): Pads {
  const { cells } = world;
  const tones = stage.pads.map((hex) => new Color(hex));

  const geometry = padGeometry();
  // Matte, but not flat. Roughness at 0.95 killed the sheen and most of the
  // shading with it; at 0.8 the environment still models the top against the
  // walls without lying on it. No clearcoat at all: a tenth of one is still a
  // coat, and two thousand small highlights read as a wet surface.
  // No `vertexColors`. The tint comes from `instanceColor`, which three.js
  // applies on its own for an instanced mesh; asking for vertex colours as
  // well turns on `USE_COLOR`, which multiplies by a `color` attribute this
  // geometry does not have — an unbound attribute reads as black, and the
  // whole planet came out grey with the emissive as its only colour.
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.8,
    clearcoat: 0,
  });

  /**
   * How a pad reads as lit: its own colour, and nothing else.
   *
   * `instanceColor` reaches the diffuse term only, so a pad carrying a wave
   * could be a paler violet but never a lit one. The first answer to that was
   * a second instanced mesh drawn additively over the first, and that was a
   * mistake twice over: it put a translucent shell around every pad, so the
   * grid looked like glass, and it made the highlight a thing that appears
   * rather than a colour that changes. One float per instance goes straight
   * into the emissive term instead — same surface, same silhouette, brighter.
   */
  const litColour = new Color(stage.crest);
  const litStrength = stage.dark ? LIT_STRENGTH : 0.04;
  // Paired with the patch below. three.js keys its program cache on the
  // material's own parameters and knows nothing about `onBeforeCompile`, so
  // another physical material with the same flags could be served this one's
  // compiled program — or this one could be served theirs, unpatched, and the
  // pads would simply never light.
  material.customProgramCacheKey = () => 'planet-pads-lit';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLit = { value: litColour };
    shader.uniforms.uLitStrength = { value: litStrength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLit;\nvarying float vLit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uLit;\nuniform float uLitStrength;\nvarying float vLit;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uLit * (vLit * uLitStrength);',
      );
  };

  const mesh = new InstancedMesh(geometry, material, cells.length);
  mesh.name = 'planet_pads';
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.instanceColor = new InstancedBufferAttribute(
    new Float32Array(cells.length * 3),
    3,
  ).setUsage(DynamicDrawUsage);
  const lit = new InstancedBufferAttribute(new Float32Array(cells.length), 1).setUsage(
    DynamicDrawUsage,
  );
  geometry.setAttribute('aLit', lit);

  const up = new Vector3(0, 1, 0);
  const east = new Vector3();
  const north = new Vector3();
  const matrix = new Matrix4();
  // The resting state, kept so a frame never has to rebuild a basis.
  const rest = new Float32Array(cells.length * 16);
  const tone = new Float32Array(cells.length * 3);

  cells.forEach((cell, i) => {
    const n = cell.normal;
    // At the poles the meridian is undefined; any tangent will do, and a pad
    // up there is a ribbon nobody reads anyway.
    east.crossVectors(up, n);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    north.crossVectors(n, east).normalize();
    matrix.makeBasis(east.clone().multiplyScalar(cell.stretch), n.clone(), north.clone());
    matrix.setPosition(n.x * GLOBE, n.y * GLOBE, n.z * GLOBE);
    matrix.toArray(rest, i * 16);

    const colour = tones[cell.tone];
    tone[i * 3] = colour.r;
    tone[i * 3 + 1] = colour.g;
    tone[i * 3 + 2] = colour.b;
  });

  mesh.instanceMatrix.array.set(rest);
  mesh.instanceColor.array.set(tone);

  const crest = new Color(stage.crest);
  const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

  return {
    mesh,
    apply(wave, rise, lift) {
      const matrices = mesh.instanceMatrix.array as Float32Array;
      const colours = mesh.instanceColor!.array as Float32Array;
      const litArray = lit.array as Float32Array;
      for (let i = 0; i < cells.length; i += 1) {
        const w = wave[i];
        const h = rise[i];
        const base = i * 16;
        if (lift === 0 || h === 0) {
          matrices[base + 12] = rest[base + 12];
          matrices[base + 13] = rest[base + 13];
          matrices[base + 14] = rest[base + 14];
        } else {
          const n = cells[i].normal;
          const out = h * lift;
          matrices[base + 12] = rest[base + 12] + n.x * out;
          matrices[base + 13] = rest[base + 13] + n.y * out;
          matrices[base + 14] = rest[base + 14] + n.z * out;
        }

        const c = i * 3;
        if (w === 0) {
          colours[c] = tone[c];
          colours[c + 1] = tone[c + 1];
          colours[c + 2] = tone[c + 2];
        } else {
          const k = Math.min(1, w) * CREST_MIX;
          colours[c] = tone[c] + (crest.r - tone[c]) * k;
          colours[c + 1] = tone[c + 1] + (crest.g - tone[c + 1]) * k;
          colours[c + 2] = tone[c + 2] + (crest.b - tone[c + 2]) * k;
        }

        // A smoothstep, not a clamped subtraction: `max(0, w - 0.2)` has a
        // corner at the threshold, and with the bed breathing just below it
        // every pad crossed that corner twice a cycle, which is what
        // flickered.
        litArray[i] = smooth((w - 0.26) / 0.5);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
      lit.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export interface Packet {
  group: Group;
  /**
   * Place the comet: two unit normals, how far along it is, and how present.
   * Returns the point on the surface it is over, which is what the trail
   * underneath is drawn from.
   */
  at(from: Vector3, to: Vector3, k: number, presence: number): Vector3;
  /** Where it is over right now, or nothing when it is not in the air. Read
   *  by the scene's `debug` rather than walking the group's children. */
  over(): Vector3 | null;
  hide(): void;
  dispose(): void;
}

const SEGMENTS = 120;
const TAIL = 0.22;

/**
 * The packet: the one thing in the scene that is not the surface.
 *
 * A comet running along an arc over the planet — a lit stroke with a head,
 * fading out behind. An earlier cut flew a small cube, which at the scale a
 * pad is drawn reads as one more lit pad that happens to be floating; the next
 * drew a hard segment cut out of a tube with `setDrawRange`, which snapped a
 * whole tube segment at a time at both ends. Both were the same mistake in
 * different clothes: the packet was being switched on and off rather than
 * arriving and leaving.
 *
 * So nothing is cut and nothing is toggled. The whole arc is one tube, built
 * once per flight, and every vertex carries its own alpha — opaque at the
 * head, fading to nothing a fifth of the arc behind it, and nought everywhere
 * ahead. Moving the head is a write into a colour buffer, the tail is a
 * gradient rather than an edge, and the comet fades up as it sets off.
 */
export function buildPacket(stage: Stage): Packet {
  const group = new Group();
  group.name = 'planet_packet';
  group.visible = false;

  const crest = new Color(stage.crest);
  const cometMaterial = new MeshBasicMaterial({
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: stage.additive ? AdditiveBlending : NormalBlending,
  });
  const comet = new Mesh(undefined, cometMaterial);
  group.add(comet);

  // The same lit-plastic trim the preview's `trim()` builds: the clearcoat is
  // part of it, and without it the head reads as a matte bead rather than as
  // the bright end of a stroke.
  const headMaterial = new MeshPhysicalMaterial({
    color: stage.crest,
    emissive: stage.crest,
    emissiveIntensity: stage.dark ? 1.1 : 0.12,
    roughness: 0.28,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    metalness: 0,
  });
  const head = new Mesh(new SphereGeometry(PAD_SIDE * 0.34, 14, 10), headMaterial);
  group.add(head);

  const ground = new Vector3();
  const point = new Vector3();
  let along: Float32Array | null = null;
  let curve: CatmullRomCurve3 | null = null;
  let fromKey: string | null = null;
  let toKey: string | null = null;

  const rebuild = (from: Vector3, to: Vector3) => {
    const apart = from.angleTo(to);
    // High enough to clear the pads it passes over and to be seen against
    // them, rather than lying in among them.
    const height = 0.1 + 0.26 * (apart / Math.PI);
    const path: Vector3[] = [];
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      point.copy(from).lerp(to, t).normalize();
      path.push(
        point.clone().multiplyScalar(GLOBE + PAD_HEIGHT + PAD_LIFT * 0.5 + Math.sin(Math.PI * t) * height),
      );
    }
    // Kept, because the head has to be placed by the *same* curve. An earlier
    // cut placed the tube by this curve and the head by lerping the two
    // normals, and CatmullRom's default parameter is centripetal — not uniform
    // in the input points — so the bright bead and the bright end of the
    // stroke drifted apart as they travelled.
    curve = new CatmullRomCurve3(path);
    comet.geometry?.dispose();
    comet.geometry = new TubeGeometry(curve, SEGMENTS, PAD_SIDE * 0.5, 7, false);

    // Where each vertex sits along the tube. `TubeGeometry` lays its vertices
    // out ring by ring, so this is the ring index over the number of rings.
    const rings = 8;
    const count = comet.geometry.attributes.position.count;
    along = new Float32Array(count);
    for (let i = 0; i < count; i += 1) along[i] = Math.floor(i / rings) / SEGMENTS;
    comet.geometry.setAttribute(
      'color',
      new BufferAttribute(new Float32Array(count * 4), 4).setUsage(DynamicDrawUsage),
    );
  };

  let flying = false;
  return {
    group,
    over: () => (flying ? ground : null),
    at(from, to, k, presence) {
      if (presence <= 0.01 || from.angleTo(to) < 1e-4) {
        group.visible = false;
        flying = false;
        return ground.copy(from);
      }
      flying = true;
      group.visible = true;

      const nextFrom = `${from.x.toFixed(4)},${from.y.toFixed(4)},${from.z.toFixed(4)}`;
      const nextTo = `${to.x.toFixed(4)},${to.y.toFixed(4)},${to.z.toFixed(4)}`;
      if (nextFrom !== fromKey || nextTo !== toKey) {
        fromKey = nextFrom;
        toKey = nextTo;
        rebuild(from, to);
      }

      const colours = comet.geometry.attributes.color as BufferAttribute;
      const array = colours.array as Float32Array;
      const trail = along!;
      for (let i = 0; i < trail.length; i += 1) {
        // How far behind the head this vertex is: one at the head, nought a
        // fifth of the arc back, and nought everywhere ahead of it.
        const behind = k - trail[i];
        const t = behind < 0 || behind > TAIL ? 0 : 1 - behind / TAIL;
        const c = i * 4;
        array[c] = crest.r;
        array[c + 1] = crest.g;
        array[c + 2] = crest.b;
        array[c + 3] = (t <= 0 ? 0 : t * t * (3 - 2 * t)) * presence;
      }
      colours.needsUpdate = true;

      curve!.getPoint(Math.min(1, Math.max(0, k)), head.position);
      head.scale.setScalar(0.4 + 0.6 * presence);
      return ground.copy(head.position).normalize();
    },
    hide() {
      group.visible = false;
      flying = false;
    },
    dispose() {
      comet.geometry?.dispose();
      cometMaterial.dispose();
      head.geometry.dispose();
      headMaterial.dispose();
    },
  };
}

let cached: World | null = null;

/** The world, built once per page. The grid never changes, so neither does
 *  the graph over it. */
export function planetWorld(): World {
  if (!cached) cached = buildWorld();
  return cached;
}
