// The land the hero's planet is drawn on. The grid itself is generated, so
// what is worth testing is the two things the runtime builds from it and the
// scene then trusts: that the graph joins land to land and nothing else, and
// that every piece of it is measured.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { GRID, planetGrid } from './hero-planet-grid';
import { MIN_LAND, planetWorld, spreadFrom } from './hero-planet-world';

const world = planetWorld();

/** The cell nearest a place, so the tests can talk in coordinates. */
function at(lon: number, lat: number): number {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const want = new Vector3(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
  let best = 0;
  let bestDot = -2;
  world.cells.forEach((cell, i) => {
    const dot = cell.normal.dot(want);
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  });
  return best;
}

describe('the baked grid', () => {
  it('unpacks to one entry per cell, in band order', () => {
    const grid = planetGrid();
    expect(grid.columns.length).toBe(world.cells.length);
    expect(grid.bands.length).toBe(grid.columns.length);
    expect(grid.tone.length).toBe(grid.columns.length);
    // Bands only ever go up: the cells are stored band by band, and the graph
    // below relies on that to find a cell by its band and column.
    for (let i = 1; i < grid.bands.length; i += 1) {
      expect(grid.bands[i]).toBeGreaterThanOrEqual(grid.bands[i - 1]);
    }
  });

  it('keeps every country inside the palette it was coloured for', () => {
    for (const cell of world.cells) {
      expect(cell.tone).toBeGreaterThanOrEqual(0);
      expect(cell.tone).toBeLessThan(10);
    }
  });

  it('covers the world at the grid it says it does', () => {
    expect(GRID).toBe(2.5);
    // Land is a bit under a third of the surface, and the poles are dropped,
    // so a few per cent of a 68-band grid is the right order.
    expect(world.cells.length).toBeGreaterThan(1500);
    expect(world.cells.length).toBeLessThan(2400);
  });
});

describe('the land graph', () => {
  it('joins neighbours and nothing further', () => {
    // Every edge is a real step between adjacent cells. The guard on edge
    // length is what stops the graph leaking across the Arctic, where a band
    // is a dozen cells around and "adjacent" columns are an ocean apart.
    const longest = ((GRID * Math.PI) / 180) * 1.8;
    for (let i = 0; i < world.cells.length; i += 1) {
      for (let e = 0; e < 8; e += 1) {
        const to = world.neighbours[i * 8 + e];
        if (to < 0) continue;
        expect(world.cells[i].normal.angleTo(world.cells[to].normal)).toBeLessThanOrEqual(longest + 1e-6);
      }
    }
  });

  it('does not let a wave cross an ocean', () => {
    // The one property the whole animation rests on. A front measures its
    // distance through the land, so North America can reach Alaska on foot
    // and cannot reach Europe, Siberia or Brazil at all — the Bering Strait,
    // the Atlantic and the Isthmus of Panama are all wider than a cell here.
    const distances = new Float32Array(world.cells.length);
    spreadFrom(world, at(-98, 39), distances);

    expect(distances[at(-150, 64)]).toBeLessThan(1.2);
    for (const [name, lon, lat] of [
      ['Europe', 2, 47],
      ['Siberia', 100, 62],
      ['Brazil', -50, -10],
      ['Australia', 134, -25],
    ] as const) {
      expect(distances[at(lon, lat)], name).toBe(Infinity);
    }
  });

  it('walks Eurasia end to end without leaving it', () => {
    const distances = new Float32Array(world.cells.length);
    spreadFrom(world, at(100, 62), distances);
    expect(distances[at(2, 47)]).toBeLessThan(1.4);
    expect(distances[at(-98, 39)]).toBe(Infinity);
  });

  it('measures every piece of land it can start a wave on', () => {
    // A source on a two-pad island leaves the wave nowhere to travel and the
    // cycle sits there looking broken, so the sizes have to be real.
    const usable = world.cells.filter((_, i) => world.sizes[i] >= MIN_LAND);
    expect(usable.length).toBeGreaterThan(world.cells.length * 0.9);

    // And a component's size has to agree with what the graph can actually
    // reach from inside it.
    const distances = new Float32Array(world.cells.length);
    const start = at(-98, 39);
    spreadFrom(world, start, distances);
    const reached = [...distances].filter((d) => d !== Infinity).length;
    expect(reached).toBe(world.sizes[start]);
  });
});
