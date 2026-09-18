// What the planet does, and the one number the hero was tuned to: how many
// packets are in the air over the half of it a viewer can see.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { LANES, PERIOD, buildCycle } from './hero-planet-cycle';
import { MIN_LAND, planetWorld } from './hero-planet-world';
import type { Packet } from './hero-planet-world';

const world = planetWorld();

/** A packet that records where it was put instead of drawing anything. */
function fakePacket(): Packet & { where: Vector3 | null; ends: [Vector3, Vector3] | null } {
  const ground = new Vector3();
  const made = {
    group: null as never,
    where: null as Vector3 | null,
    ends: null as [Vector3, Vector3] | null,
    at(from: Vector3, to: Vector3, k: number, presence: number) {
      made.ends = [from, to];
      if (presence <= 0.01) {
        made.where = null;
        return ground.copy(from);
      }
      made.where = ground.copy(from).lerp(to, k).normalize().clone();
      return made.where;
    },
    over: () => made.where,
    hide() {
      made.where = null;
    },
    dispose() {},
  };
  return made;
}

const packets = Array.from({ length: LANES }, fakePacket);
const cycle = buildCycle(world, packets);

/** The camera looks down this line, and the globe is opaque, so a packet on
 *  the far side of that plane cannot be seen. */
const TOWARD_CAMERA = new Vector3(0.436, 0.356, 0.826).normalize();

function sampleOverACycle(step: number) {
  const seen: number[] = [];
  for (let t = 0; t < PERIOD * 3; t += step) {
    cycle.step(t);
    let onScreen = 0;
    for (const packet of packets) {
      if (packet.where && packet.where.dot(TOWARD_CAMERA) > 0) onScreen += 1;
    }
    seen.push(onScreen);
  }
  return seen;
}

describe('the cycle', () => {
  it('keeps two or three packets in frame', () => {
    // The hero's one quantitative requirement. A lane is in flight for a
    // fixed share of its period and about half the planet faces the camera,
    // so the count follows from `LANES` — this is what pins that number.
    const seen = sampleOverACycle(0.1);
    const mean = seen.reduce((a, b) => a + b, 0) / seen.length;
    // Measured at 2.3 with fourteen lanes. The band is wide enough to survive
    // a small change to the timings and narrow enough to catch a big one.
    expect(mean).toBeGreaterThan(1.7);
    expect(mean).toBeLessThan(3.2);
    // And it rarely empties out: a hero with nothing in the air is a still.
    expect(seen.filter((n) => n === 0).length / seen.length).toBeLessThan(0.1);
  });

  it('scatters its flying over the whole planet, not over the land', () => {
    // Land is not spread evenly over a globe — Eurasia and Africa are one
    // connected piece holding more than half of every cell — so drawing
    // sources uniformly from it drew them uniformly from one hemisphere, and
    // the Pacific never saw a packet. The lanes own Fibonacci directions
    // instead, which are even by construction.
    //
    // Measured against twenty equal zones of the sphere: the old rule scored
    // a spread of 4.97 with three zones empty; this asserts on the shape of
    // the fix rather than its exact number, which lighting and timing can
    // move a little.
    const golden = Math.PI * (3 - Math.sqrt(5));
    const zones = Array.from({ length: 20 }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / 20;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      return new Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
    });
    const hits = new Array(20).fill(0);
    for (let t = 0; t < PERIOD * 40; t += 0.1) {
      cycle.step(t);
      for (const packet of packets) {
        if (!packet.where) continue;
        let best = 0;
        let dot = -2;
        zones.forEach((zone, i) => {
          const d = zone.dot(packet.where!);
          if (d > dot) {
            dot = d;
            best = i;
          }
        });
        hits[best] += 1;
      }
    }
    const total = hits.reduce((a, b) => a + b, 0);
    const share = hits.map((h) => (100 * h) / total);
    const spread = Math.sqrt(share.reduce((a, s) => a + (s - 5) ** 2, 0) / 20);
    expect(spread).toBeLessThan(3.6);
    expect(Math.max(...share)).toBeLessThan(14);
    expect(share.filter((s) => s < 1).length).toBeLessThanOrEqual(3);
  });

  it('never leaves the planet blank', () => {
    // Something is always happening somewhere, even when nothing is flying:
    // the gathering and the spreading run either side of every flight.
    for (let t = 0; t < PERIOD * 2; t += 0.3) {
      cycle.step(t);
      const lit = [...cycle.wave].filter((w) => w > 0.3).length;
      expect(lit).toBeGreaterThan(0);
    }
  });

  it('lifts pads only where something is happening', () => {
    // The bed colours the surface without moving it, so a planet at rest is
    // alive but still. Height belongs to events alone.
    cycle.step(1.234);
    const raised = [...cycle.rise].filter((r) => r > 0).length;
    expect(raised).toBeGreaterThan(0);
    expect(raised).toBeLessThan(world.cells.length * 0.5);
  });

  it('stays inside its buffers', () => {
    for (let t = 0; t < PERIOD; t += 0.37) {
      cycle.step(t);
      for (const w of cycle.wave) expect(w).toBeGreaterThanOrEqual(0);
      for (const r of cycle.rise) expect(r).toBeLessThanOrEqual(1.0001);
    }
  });

  it('flies between real places, however much sea is in the way', () => {
    // A packet may cross an ocean — that is the whole point of it, and the
    // one thing the wave may not do. What it may not do is set off from open
    // water or land in it, or pick a two-pad island the spreading then has
    // nowhere to go on.
    const onLand = new Map(world.cells.map((cell, i) => [cell.normal.toArray().join(), i]));
    for (let t = 0; t < PERIOD * 2; t += 0.4) {
      cycle.step(t);
      for (const packet of packets) {
        expect(packet.ends).not.toBeNull();
        const [from, to] = packet.ends!;
        for (const end of [from, to]) {
          const cell = onLand.get(end.toArray().join());
          expect(cell).toBeDefined();
          expect(world.sizes[cell!]).toBeGreaterThanOrEqual(MIN_LAND);
        }
        // And far enough apart to be a journey rather than a hop next door.
        expect(from.angleTo(to)).toBeGreaterThan(0.4);
      }
    }
  });
});
