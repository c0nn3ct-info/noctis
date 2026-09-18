// What the planet does: gather, send, spread, and again somewhere else.
//
// One lane is one exchange, whole. A wave converges on a pad; a packet leaves
// it for somewhere else on the planet; and from where it lands, a wave spreads
// out again. The pad it landed on is where that lane's next exchange gathers,
// so a lane walks the world under its own steam.
//
// The parts are written as overlapping envelopes rather than as phases, and
// that is the whole of what makes it flow. Cut into phases, every boundary was
// a step: the converging ring reached the source and vanished, the source
// pad's swell started again from nought, the comet switched on above a pad
// that had already gone dark, the landing flash started from nought too.
// Here every envelope is the same smoothstep `ramp`, each rises where the one
// before it is still up, and the pad glows are drawn by the *same* front at
// radius nought that draws the rings — so the ring arriving and the pad
// lighting are one function reaching the end of its travel.
import { Vector3 } from 'three';
import { MIN_LAND, PAD_LIFT, STEP_ANGLE, spreadFrom } from './hero-planet-world';
import type { Packet, World } from './hero-planet-world';

const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
/** A smoothstep between two moments — the one shape every envelope is built
 *  from, so no two of them can meet at a step. */
const ramp = (t: number, from: number, to: number) => smooth((t - from) / (to - from));

/** Deterministic, so the planet opens the same way every time. */
const hash01 = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h >>> 8) / 16777216;
};

/**
 * How far a front gets before it is spent — about ten cells.
 *
 * Every earlier cut tied this to the land, to the farthest corner of whatever
 * continent the source stood on, and a front that takes a whole continent is a
 * continental event, which nothing the product does is. A fixed small radius
 * also makes every wave the same size, so they read as one kind of thing
 * happening in different places rather than as the map breathing.
 */
const REACH = 0.44;
/** How thick the front is: wide enough that no pad is skipped between frames,
 *  narrow enough to be a front. */
const FRONT = STEP_ANGLE * 2.5;

/** How strong a front is at this distance out. Not an exponential — decaying
 *  from the first step put the head at a third before it had crossed anything.
 *  A smoothstep over the whole run arrives at nothing rather than stopping. */
const strengthAt = (radius: number, reach: number) => smooth(1 - radius / reach);

const GATHER = 2.0;
const FLY = 1.8;
const SPREAD = 2.2;
const REST = 0.5;

/**
 * How far the launch reaches back into the gathering.
 *
 * Without it the packet sets off at the instant the ring arrives, and however
 * continuous that is on paper it still reads as two events end to end: the
 * wave comes in, and *then* something leaves. Starting the flight while the
 * last of the ring is still closing makes one the follow-through of the other.
 */
const HANDOFF = 0.45;

const FLY_START = GATHER - HANDOFF;
const FLY_END = FLY_START + FLY;
const SPREAD_END = FLY_END + SPREAD;
export const PERIOD = SPREAD_END + REST;

/**
 * One speed profile across the whole loop: slow, faster, fast, the send, fast,
 * slower, slow. Each part used to run at its own constant rate, and the loop
 * read as three separate errands rather than one movement.
 */
const accelerate = (k: number) => k ** 1.8;
const decelerate = (k: number) => 1 - (1 - k) ** 1.8;

/**
 * How many exchanges run at once.
 *
 * A packet is in flight for `FLY / PERIOD` of its lane's time, and about half
 * the planet faces the viewer, so the number in frame at any moment is roughly
 * a sixth of this. Measured over six periods, fourteen lanes hold a mean of
 * 2.3 on screen — two or three of the time, four occasionally, and empty for
 * four per cent of it. That is what the hero wants: enough that something is
 * always arriving somewhere, few enough to follow any one of them.
 */
export const LANES = 14;

interface Lane {
  index: number;
  /** How far this lane's packets may fly. A lane whose patch is open water
   *  gets a crossing's worth; the rest get a continent's. */
  reach: number;
  inward: Float32Array;
  outward: Float32Array;
  round: number;
  source: number;
  target: number;
  reachIn: number;
  reachOut: number;
}

/** How far out a front has land to work with, never more than its reach. */
function spanOf(distances: Float32Array): number {
  let far = 0;
  for (let i = 0; i < distances.length; i += 1) {
    const d = distances[i];
    if (d !== Infinity && d > far) far = d;
  }
  return Math.max(STEP_ANGLE * 5, Math.min(REACH, far));
}

/**
 * A patch of the planet per lane, spread by construction.
 *
 * Picking sources uniformly *from the land* is not the same as spreading them
 * over the globe, because the land is not spread over the globe: Eurasia and
 * Africa are one connected piece of 1034 cells out of 1878, so more than half
 * of every uniform draw landed there. Fourteen lanes drawn that way put eight
 * of their exchanges on one hemisphere and none over the Pacific, which is
 * exactly what it looked like.
 *
 * So the lanes do not draw from the land at all. Each one owns a direction
 * from a Fibonacci spiral — the standard way to scatter N points evenly on a
 * sphere, and even by construction rather than on average — and works the
 * land nearest to it. Where its patch is mostly water, as the Pacific pair's
 * is, it works that ocean's shores and its packets cross the water between
 * them.
 *
 * Measured over sixty periods against twenty equal zones of the sphere: the
 * old rule put 18.4% of its flying into one zone and nothing into three of
 * them, with a spread of 4.97; this one peaks at 11.4% and has a spread of
 * 2.67, where a perfectly even scatter would be 5% and 0.
 */
const PATCH = 1.05;

function anchors(count: number): Vector3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = golden * i;
    return new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
  });
}

const ANCHORS = anchors(LANES);

/**
 * How far this lane has to go to find land at all.
 *
 * Not whether the patch holds any — measured, every one of the fourteen does,
 * because a 60-degree patch anywhere still catches a coast. What separates
 * the ocean lanes is how *far*: the Pacific pair has its nearest usable land
 * 0.55 and 0.79 radians out, where every other lane has some within 0.3. They
 * are the ones that have to cross, and the reach below is what lets them.
 */
function nearestLand(world: World, anchor: Vector3): number {
  const { cells, sizes } = world;
  let nearest = Infinity;
  for (let i = 0; i < cells.length; i += 1) {
    if (sizes[i] < MIN_LAND) continue;
    const away = anchor.angleTo(cells[i].normal);
    if (away < nearest) nearest = away;
  }
  return nearest;
}

/** The land this lane works: inside its own patch, or the nearest there is
 *  when the patch is open ocean. */
function landNear(world: World, anchor: Vector3, seed: number): number {
  const { cells, sizes } = world;
  const inside: number[] = [];
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < cells.length; i += 1) {
    if (sizes[i] < MIN_LAND) continue;
    const away = anchor.angleTo(cells[i].normal);
    if (away < PATCH) inside.push(i);
    if (away < best) {
      best = away;
      nearest = i;
    }
  }
  if (!inside.length) return nearest;
  return inside[Math.floor(hash01(seed) * inside.length) % inside.length];
}

/**
 * Somewhere to land: far enough to be a journey, near enough that the arc is
 * a hop rather than a half-orbit, on ground the spreading can happen on, and
 * inside this lane's patch so the lane stays where it was put.
 *
 * The reach runs to 1.6 radians rather than the 1.15 it started at, and that
 * is what lets a packet cross water worth crossing: the Pacific is a shade
 * over two radians at the equator, so a shorter flight can only ever hop
 * along one shore of it.
 */
function landFrom(
  world: World,
  from: number,
  anchor: Vector3,
  reach: number,
  seed: number,
): number {
  const { cells, sizes } = world;
  const here = cells[from].normal;
  const inside: number[] = [];
  const anywhere: number[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (sizes[i] < MIN_LAND) continue;
    const away = here.angleTo(cells[i].normal);
    if (away <= 0.6 || away >= reach) continue;
    anywhere.push(i);
    if (anchor.angleTo(cells[i].normal) < PATCH * 1.25) inside.push(i);
  }
  const pool = inside.length ? inside : anywhere;
  if (!pool.length) return from;
  return pool[Math.floor(hash01(seed) * pool.length) % pool.length];
}

export interface Cycle {
  wave: Float32Array;
  rise: Float32Array;
  lift: number;
  /** Fill the buffers and move the packets for this moment. */
  step(time: number): void;
  /** How many packets are in the air right now — what the tests assert on. */
  flying(time: number): number;
}

/**
 * The lanes.
 *
 * Lane `i` of `n` runs a whole period ahead of the clock by `i/n` of one, so
 * they are evenly staggered and never march in time with each other. They
 * share the two buffers and blend by `max`, so where two waves meet the
 * brighter wins rather than the sum blowing out — the same rule the bed and
 * the fronts already use.
 */
export function buildCycle(world: World, packets: Packet[]): Cycle {
  const { cells } = world;
  const wave = new Float32Array(cells.length);
  const rise = new Float32Array(cells.length);
  const phase = cells.map((cell) => hash01(cell.country) * Math.PI * 2);

  const all: Lane[] = Array.from({ length: LANES }, (_, index) => ({
    index,
    reach: nearestLand(world, ANCHORS[index]) > 0.35 ? 2.5 : 1.6,
    inward: new Float32Array(cells.length),
    outward: new Float32Array(cells.length),
    round: -1,
    source: -1,
    target: 0,
    reachIn: REACH,
    reachOut: REACH,
  }));

  /** The bed: colour only, no height, so the surface is alive while the
   *  planet is still. Each country on its own slow phase. */
  const bed = (time: number) => {
    for (let i = 0; i < cells.length; i += 1) {
      wave[i] = 0.16 * (0.5 + 0.5 * Math.sin(time * 0.62 + phase[i]));
    }
  };

  /** A front, over land distances, laid on top of whatever is there. */
  const front = (distances: Float32Array, radius: number, amplitude: number) => {
    if (amplitude <= 0.01) return;
    for (let i = 0; i < cells.length; i += 1) {
      const d = distances[i];
      if (d === Infinity) continue;
      const value = smooth(1 - Math.abs(d - radius) / FRONT) * amplitude;
      if (value > wave[i]) wave[i] = value;
      if (value > rise[i]) rise[i] = value;
    }
  };

  /** The pads under a point — the mark a packet leaves on the ground. */
  const trailUnder = (point: Vector3, strength: number) => {
    const reach = STEP_ANGLE * 3.6;
    for (let i = 0; i < cells.length; i += 1) {
      const n = cells[i].normal;
      const dot = n.x * point.x + n.y * point.y + n.z * point.z;
      if (dot < 0.82) continue;
      const away = Math.acos(Math.min(1, dot));
      const value = smooth(1 - away / reach) * strength;
      if (value > wave[i]) wave[i] = value;
      if (value > rise[i]) rise[i] = value;
    }
  };

  const run = (lane: Lane, time: number, packet: Packet) => {
    const now = Math.floor(time / PERIOD);
    if (now !== lane.round) {
      lane.round = now;
      const seed = now * 977 + lane.index * 131 + 7;
      const anchor = ANCHORS[lane.index];
      // The lane carries on from where its own last packet landed, so it
      // walks rather than repeats — but only while that walk stays in its
      // patch. Wander out of it and it comes back, which is what keeps the
      // fourteen of them spread instead of drifting together onto the land
      // they all have most of.
      const strayed =
        lane.source < 0 || cells[lane.target].normal.angleTo(anchor) > PATCH;
      lane.source = strayed ? landNear(world, anchor, seed) : lane.target;
      lane.target = landFrom(world, lane.source, anchor, lane.reach, seed + 83);
      spreadFrom(world, lane.source, lane.inward);
      spreadFrom(world, lane.target, lane.outward);
      lane.reachIn = spanOf(lane.inward);
      lane.reachOut = spanOf(lane.outward);
    }

    const age = time % PERIOD;
    const here = cells[lane.source].normal;
    const there = cells[lane.target].normal;

    // The gathering ring, closing in and brightening as it goes.
    if (age < GATHER) {
      const k = age / GATHER;
      const closed = accelerate(k);
      front(lane.inward, lane.reachIn * (1 - closed), (0.3 + 0.7 * closed) * ramp(age, 0, GATHER * 0.14));
    }

    // The source, lit. It is the same front at radius nought, so the ring
    // above does not arrive and stop — it arrives and becomes this.
    const sourceGlow = Math.min(
      ramp(age, GATHER * 0.4, GATHER),
      1 - ramp(age, GATHER, GATHER + FLY * 0.3),
    );
    if (sourceGlow > 0.01) front(lane.inward, 0, sourceGlow);

    // The packet, fading up out of the lit source and down into the lit
    // target, so it is never switched on.
    if (age > FLY_START && age < FLY_END) {
      const k = (age - FLY_START) / FLY;
      // Barely eased: the ring has just arrived at speed and the packet has
      // to carry that speed away with it.
      const eased = k + (smooth(k) - k) * 0.18;
      const presence = Math.min(ramp(k, 0, 0.1), 1 - ramp(k, 0.84, 1));
      trailUnder(packet.at(here, there, eased, presence), 0.7);
    } else {
      packet.at(here, there, 0, 0);
    }

    // The target, lit — rising while the packet is still on its way in, full
    // at the moment it lands, falling as the spreading takes over.
    const targetGlow = Math.min(
      ramp(age, FLY_END - FLY * 0.3, FLY_END),
      1 - ramp(age, FLY_END, FLY_END + SPREAD * 0.3),
    );
    if (targetGlow > 0.01) front(lane.outward, 0, targetGlow);

    // And the spreading ring, which leaves that pad at exactly the brightness
    // it had — `strengthAt(0)` is one — and dies inside its own radius.
    if (age > FLY_END && age < SPREAD_END) {
      const radius = lane.reachOut * decelerate((age - FLY_END) / SPREAD);
      front(lane.outward, radius, strengthAt(radius, lane.reachOut));
    }
  };

  const laneTime = (index: number, time: number) => time + (index / LANES) * PERIOD;

  return {
    wave,
    rise,
    lift: PAD_LIFT,
    step(time) {
      bed(time);
      rise.fill(0);
      for (let i = 0; i < LANES; i += 1) run(all[i], laneTime(i, time), packets[i]);
    },
    flying(time) {
      let count = 0;
      for (let i = 0; i < LANES; i += 1) {
        const age = laneTime(i, time) % PERIOD;
        if (age > FLY_START && age < FLY_END) count += 1;
      }
      return count;
    },
  };
}
