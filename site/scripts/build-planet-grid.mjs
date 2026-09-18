/**
 * Bakes the planet's land grid into a module the hero can import.
 *
 * The hero draws the world as a grid of pads, one per 2.5-degree cell that
 * has land under its middle, each carrying the step of the palette its
 * country was assigned. Working that out is a real piece of computation —
 * Natural Earth's outlines cut into shared arcs at every junction, each arc
 * simplified and squared once, the rings reassembled, then a graph colouring
 * over who borders whom — and it takes about a second and a third-party
 * request to do it.
 *
 * None of which belongs on a marketing page, and none of which ever changes.
 * So it runs here, once, and the result is committed. Re-run it only if the
 * grid, the palette's length or the source data need to change:
 *
 *     node scripts/build-planet-grid.mjs
 *
 * The pipeline below is carried over verbatim from `planet-earth-aria.html`
 * at the repository root, which is where it was developed and where it can
 * still be tried out interactively.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Natural Earth's 110m admin-0 set — already a cartographer's generalisation
// of the real borders, which is the point: every shape below is a
// simplification *of the actual geography*.
const COUNTRIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson';

/** The cell, in degrees. Shared with the runtime, which rebuilds every
 *  position from a band and a column rather than carrying coordinates. */
const GRID = 2.5;

/** How many steps the palette has. The graph colouring spreads neighbouring
 *  countries across them, so this has to agree with the runtime's ramps. */
const STEPS = 10;

const globeRadius = 1;

/**
 * How far the outlines get abstracted.
 *
 * `grid` is the coarsest cell an outline is squared onto, in degrees,
 * and everything else is expressed against it. `roundness` is the
 * corner fillet as a fraction of the cell — the two only make sense
 * together, since a fillet much under a fifth of the cell leaves the
 * steps sharp and one approaching half of it rounds the squaring back
 * out of existence. `detail` is the simplification tolerance, also as a
 * fraction of the cell, so an outline is never simplified past the
 * point where its own squaring could show.
 *
 * The cell is a *maximum*, not a constant: it scales down with the
 * feature, see `cellFor`.
 */
const shape = { grid: 2.4, spread: 8, roundness: 0.38, detail: 0.55, minimumArea: 0.28 };

/**
 * The cell an outline of this size is squared onto.
 *
 * One cell for the whole planet cannot work. At the size that squares
 * Africa legibly, Cyprus is smaller than a cell and snaps to nothing —
 * measured at a flat 1.5°, Cyprus kept 0% of its area, Luxembourg 2%
 * and Trinidad 4%. At the size that survives Cyprus, Africa is traced
 * rather than abstracted. So the cell scales with the feature, and an
 * outline is squared at `spread`-th of its own extent, bounded by the
 * planet-wide cell above and an eighth of it below.
 *
 * The scale of a shared arc is the *smaller* of the two countries that
 * own it, which is the cartographer's answer rather than the tidy one:
 * detail should be driven by the smallest thing that needs it, so
 * France's border with Belgium is drawn at Belgium's cell while its
 * border with Spain is drawn at the full one.
 *
 * There is no floor to speak of. An earlier version held the cell above
 * an eighth of the planet-wide one, which is a fixed distance, and a
 * fixed distance is exactly what a small country cannot afford: the
 * abstraction below moves an outline by up to a cell, so a cell that
 * does not shrink with the country eats it. Tying the cell to the
 * feature bounds the error as a *fraction* of the feature instead,
 * whatever its size.
 */
const cellFor = (extent) => Math.max(0.05, Math.min(shape.grid, extent / shape.spread));

/**
 * The aria2t hero's dark stage, and the rule it is built on: the bodies
 * are near-black and the accents carry every bit of colour there is.
 *
 * An earlier pass had this backwards — the plates were navy and indigo
 * and the seams were white, so the colour was in the large flat areas
 * and the lines were colourless. Here the four tonal steps run from
 * that stage's `carbon` to its `graphite`, close enough together that a
 * country reads as a country because of its seam rather than its fill,
 * and the two accents are the stage's own periwinkle and lilac.
 */
const tones = [0x171d2a, 0x1c2334, 0x21293e, 0x263048];


/* ================================================================ *
 * Topology.
 *
 * A border between two countries belongs to both of their rings, so
 * drawing rings whole draws it twice, exactly on top of itself — under
 * additive blending that makes interior borders brighter than
 * coastlines and a point where three countries meet brighter still.
 * And a ring simplified on its own does not agree with its neighbour
 * about where that shared border now runs, so adjacent plates meet in a
 * fringe of slivers.
 *
 * Both follow from treating rings as independent. So they are not: the
 * source rings are cut into *arcs* at every junction, an arc shared by
 * two countries is stored once, shaped once and drawn once, and each
 * ring is reassembled from the shared results. This is the cut / join
 * half of what TopoJSON does.
 * ================================================================ */

const polygonsOf = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(polygonsOf);
  return [];
};

/** Exactly on the antimeridian, to the precision the source writes it
 * — which is what a polygon uses to spell a seam, as against a coast
 * that merely runs close to ±180°. */
const atSeamMeridian = (lon) => Math.abs(Math.abs(lon) - 180) < 1e-9;

/**
 * An edge that exists to close a polygon rather than to describe a
 * border: a run along the antimeridian, or along the pole.
 *
 * Antarctica is the whole of this in the 110m set, and it needs all of
 * it. Its ring dives down the antimeridian from the coast to the pole,
 * crosses to the other side of the seam, and climbs back — three edges
 * that are bookkeeping, not geography. They have to be in the polygon
 * or the fill stops at the coast instead of covering the cap, and they
 * must not be simplified, rounded or drawn, or they turn into a stray
 * line wandering across the continent.
 */
const seamEdge = (a, b) =>
  (Math.abs(a[1]) >= 89.99 && Math.abs(b[1]) >= 89.99) || (atSeamMeridian(a[0]) && atSeamMeridian(b[0]));

/** Rings cross the antimeridian as a ±360 jump. Unwrapping them into a
 * continuous longitude run means every step after this can treat a ring
 * as ordinary plane geometry, and the spherical projection folds the
 * run back at the end for free.
 *
 * A seam step is the exception, and is left alone: +180° to -180° is
 * the same meridian rather than a feature running on eastwards, and
 * straightening it out turns Antarctica's seam into a zero-width spike
 * whose two sides then look like one edge visited twice. */
const unwrap = (ring) => {
  const out = [];
  let previous;
  let previousSource;
  for (const [lon, lat] of ring) {
    let x = lon;
    if (previous !== undefined) {
      if (atSeamMeridian(previousSource) && atSeamMeridian(lon)) {
        x = lon + (previous - previousSource);
      } else {
        while (x - previous > 180) x -= 360;
        while (x - previous < -180) x += 360;
      }
    }
    out.push([x, lat]);
    previous = x;
    previousSource = lon;
  }
  // GeoJSON repeats the first point as the last; everything here works
  // on open rings and closes them at draw time.
  if (out.length > 1) {
    const [fx, fy] = out[0];
    const [lx, ly] = out[out.length - 1];
    if (Math.abs(fx - lx) < 1e-9 && Math.abs(fy - ly) < 1e-9) out.pop();
  }
  return out;
};

const pointKey = ([lon, lat]) => {
  // ±180° keep their sign. They are the same place, but they are two
  // different corners of a seam, and folding them together makes the
  // seam's two sides look like one edge that two rings share.
  const wrapped = atSeamMeridian(lon) ? lon : (((lon + 180) % 360) + 360) % 360 - 180;
  return `${Math.round(wrapped * 1e5)}|${Math.round(lat * 1e5)}`;
};

const edgeKey = (a, b) => (a < b ? `${a}~${b}` : `${b}~${a}`);

const extentOf = (points) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.min(maxX - minX, maxY - minY);
};

const signedArea = (ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
};

const shoelace = (ring) => Math.abs(signedArea(ring));

/* ---------------------------------------------------------------- *
 * Shaping. Every function takes an open polyline and returns one.
 * ---------------------------------------------------------------- */

/** Ramer–Douglas–Peucker, endpoints pinned. Pinning matters more here
 * than it looks: an arc's endpoints are junctions it shares with its
 * neighbours, and an arc that moved them would tear away from them. */
const simplify = (points, tolerance) => {
  if (tolerance <= 0 || points.length < 3) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    if (last - first < 2) continue;
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let worstIndex = -1;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      const distance = Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (distance > worst) {
        worst = distance;
        worstIndex = i;
      }
    }
    if (worst > tolerance) {
      keep[worstIndex] = 1;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }

  return points.filter((_, index) => keep[index]);
};

/**
 * RDP, but never below a floor of vertices.
 *
 * Plain RDP will happily take an arc down to the two points it started
 * and ended at, and for a shared arc that is a straight chord where a
 * border used to be. The countries it costs most are the small ones: a
 * country bounded by two arcs reduces to a two-vertex ring and stops
 * existing at all, which is how Qatar, Luxembourg and Israel vanish. So
 * the tolerance is relaxed until the arc keeps enough of itself to
 * still be a shape.
 */
const simplifyToward = (points, tolerance, floor) => {
  if (points.length <= floor) return points;
  let attempt = tolerance;
  let current = simplify(points, attempt);
  for (let relax = 0; current.length < floor && relax < 8; relax += 1) {
    attempt /= 2;
    current = simplify(points, attempt);
  }
  if (current.length >= floor) return current;
  const step = (points.length - 1) / (floor - 1);
  return Array.from({ length: floor }, (_, index) => points[Math.round(index * step)]);
};

/**
 * Pulls vertices onto a coarse graticule — the "squared" half of the
 * look. Outlines come out of it stepped along parallels and meridians,
 * the way a map gets drawn from memory of the real thing rather than
 * traced.
 *
 * An arc's endpoints are left exactly where they were. They are the
 * junctions it shares with its neighbours, so leaving them alone is
 * what guarantees the arcs still meet — and it is also what lets every
 * interior vertex snap unconditionally. An earlier version had it the
 * other way round, snapping endpoints for the sake of connectivity and
 * letting small arcs opt out of the rest, and it cost both ways: a
 * country narrower than one cell had every junction it owns land on the
 * same cell and disappeared, and the countries that opted out stayed
 * visibly organic next to squared neighbours. Now nothing tears, the
 * smallest country keeps its true corners, and everything else squares.
 */
const square = (points, grid) => {
  if (grid <= 0 || points.length < 3) return points;
  const at = ([x, y]) => [Math.round(x / grid) * grid, Math.round(y / grid) * grid];
  return points.map((point, index) => (index === 0 || index === points.length - 1 ? point : at(point)));
};

/** Drops vertices that repeat the one before them, which grid snapping
 * makes wherever two source vertices land in the same cell. */
const dedupe = (points, closed) => {
  const out = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - point[0]) < 1e-9 && Math.abs(last[1] - point[1]) < 1e-9) continue;
    out.push(point);
  }
  // An open arc has to keep the endpoint it was handed: that endpoint
  // is a junction another arc is relying on.
  if (!closed && out.length) {
    const wanted = points[points.length - 1];
    const have = out[out.length - 1];
    if (Math.abs(have[0] - wanted[0]) > 1e-9 || Math.abs(have[1] - wanted[1]) > 1e-9) out.push(wanted);
  }
  return out;
};

/** Drops vertices that sit on the line between their neighbours.
 * Snapping a long shallow run onto one row of cells leaves a file of
 * them, and each is a corner the fillet below would have to consider
 * and reject. */
const straighten = (points, closed) => {
  if (points.length < 3) return points;
  const out = [];
  const from = closed ? 0 : 1;
  const to = closed ? points.length : points.length - 1;
  if (!closed) out.push(points[0]);
  for (let i = from; i < to; i += 1) {
    const [vx, vy] = points[i % points.length];
    const [px, py] = points[(i - 1 + points.length) % points.length];
    const [nx, ny] = points[(i + 1) % points.length];
    const cross = (vx - px) * (ny - vy) - (vy - py) * (nx - vx);
    const scale = Math.hypot(vx - px, vy - py) * Math.hypot(nx - vx, ny - vy);
    if (scale > 0 && Math.abs(cross) / scale < 0.004) continue;
    out.push(points[i % points.length]);
  }
  if (!closed) out.push(points[points.length - 1]);
  return out.length >= 3 ? out : points;
};

/**
 * Bends every segment onto the eight compass directions.
 *
 * This is the "squared" half of the look, and it is the step the
 * squaring actually lives in. Snapping vertices to a grid — which is
 * what an earlier version did on its own — quantises where the corners
 * are but says nothing about the directions between them: two lattice
 * points are still joined by whatever vector runs between them, and
 * measured across the whole planet only a quarter of the outline length
 * came out anywhere near a parallel or a meridian. So each segment is
 * split instead into an axis-aligned run plus a 45° diagonal, both
 * ending exactly where the segment did. Endpoints never move, so arcs
 * still meet; every direction in the result is one of eight; and
 * rounding the corners afterwards turns a staircase into the bent trace
 * the aria2t hero paints its machines with.
 *
 * The comparison happens in a latitude-corrected space. Longitude is
 * compressed toward the poles, so a diagonal that is 45° in raw lon/lat
 * is far shallower than 45° on the globe, and without the correction
 * Canada's corners would not be the same shape as Kenya's.
 *
 * One bend per segment is not enough. A single L across a long segment
 * leaves the outline a whole segment's width away from where the border
 * runs, which for a thin country is most of the country — measured that
 * way, the worst-hit ones kept under a third of their area. So a
 * segment is first cut into as many pieces as it takes for each bend to
 * stay inside one cell, and comes out as a staircase that follows the
 * real line instead of one step that departs from it.
 */
const octilinear = (points, closed, cell) => {
  const out = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const stretch = Math.max(0.15, Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180));
    const steps = Math.max(1, Math.ceil(Math.min(Math.abs((b[0] - a[0]) * stretch), Math.abs(b[1] - a[1])) / cell));

    for (let step = 0; step < steps; step += 1) {
      const from = [a[0] + ((b[0] - a[0]) * step) / steps, a[1] + ((b[1] - a[1]) * step) / steps];
      const to = [a[0] + ((b[0] - a[0]) * (step + 1)) / steps, a[1] + ((b[1] - a[1]) * (step + 1)) / steps];
      out.push(from);
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const flat = dx * stretch;
      if (Math.abs(flat) < 1e-9 || Math.abs(dy) < 1e-9) continue;
      if (Math.abs(Math.abs(flat) - Math.abs(dy)) < 1e-9) continue;
      if (Math.abs(flat) > Math.abs(dy)) {
        out.push([to[0] - (Math.sign(dx) * Math.abs(dy)) / stretch, from[1]]);
      } else {
        out.push([from[0], to[1] - Math.sign(dy) * Math.abs(flat)]);
      }
    }
  }
  if (!closed) out.push(points[points.length - 1]);
  return out;
};

/**
 * Rounds the corners and leaves the straights alone.
 *
 * This replaces Chaikin corner cutting, which rounds a polyline by
 * averaging every vertex with its neighbours — and therefore rounds
 * everything, including the long grid-aligned runs that the squaring
 * step just produced. The squaring was still in there, but averaged
 * away to a wobble; what came out read as an organic blob rather than
 * as a deliberate shape. A fillet is the other way about: each corner
 * is cut back by a fixed distance along both of its edges and bridged
 * with a quadratic arc, so a run stays exactly as straight as it was
 * and every corner gets the same radius. Straight runs meeting at
 * constant-radius corners is the whole of the intended shape language.
 *
 * The cut is capped at 45% of either edge so two neighbouring corners
 * cannot eat into each other, and a turn shallower than about seven
 * degrees is left alone — at that angle a fillet is invisible and only
 * costs vertices.
 */
const fillet = (points, radius, closed, steps = 4) => {
  if (radius <= 0 || points.length < 3) return points;
  const out = [];
  const from = closed ? 0 : 1;
  const to = closed ? points.length : points.length - 1;
  if (!closed) out.push(points[0]);

  for (let i = from; i < to; i += 1) {
    const vertex = points[i % points.length];
    const [px, py] = points[(i - 1 + points.length) % points.length];
    const [nx, ny] = points[(i + 1) % points.length];
    const inX = vertex[0] - px;
    const inY = vertex[1] - py;
    const outX = nx - vertex[0];
    const outY = ny - vertex[1];
    const inLength = Math.hypot(inX, inY);
    const outLength = Math.hypot(outX, outY);
    if (inLength < 1e-9 || outLength < 1e-9) {
      out.push(vertex);
      continue;
    }
    const cross = (inX * outY - inY * outX) / (inLength * outLength);
    const dot = (inX * outX + inY * outY) / (inLength * outLength);
    if (Math.abs(Math.atan2(cross, dot)) < 0.12) {
      out.push(vertex);
      continue;
    }

    const cut = Math.min(radius, inLength * 0.45, outLength * 0.45);
    const start = [vertex[0] - (inX / inLength) * cut, vertex[1] - (inY / inLength) * cut];
    const end = [vertex[0] + (outX / outLength) * cut, vertex[1] + (outY / outLength) * cut];
    out.push(start);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const u = 1 - t;
      out.push([
        u * u * start[0] + 2 * u * t * vertex[0] + t * t * end[0],
        u * u * start[1] + 2 * u * t * vertex[1] + t * t * end[1],
      ]);
    }
    out.push(end);
  }

  if (!closed) out.push(points[points.length - 1]);
  return out;
};

const shapeArc = (points, closed, cell) => {
  const floor = closed ? 6 : 4;
  const simplified = simplifyToward(points, cell * shape.detail, floor);
  const snapped = straighten(dedupe(square(simplified, cell), closed), closed);
  return fillet(dedupe(octilinear(snapped, closed, cell), closed), cell * shape.roundness, closed);
};

/**
 * Cuts every ring at its junctions, shapes each distinct arc once, and
 * hands back both halves of what the scene needs: the arcs themselves,
 * for drawing borders exactly once each, and the countries with their
 * rings reassembled from those same shaped arcs, for the fills.
 *
 * The cut rule is the standard one. Count how many rings each vertex
 * belongs to and how many rings each edge belongs to; then a vertex is
 * a junction when it belongs to more rings than the edges either side
 * of it do (three countries meeting), or when the edges either side of
 * it disagree (a coastline turning into an interior border). Between
 * two junctions every edge has the same multiplicity, so the two
 * countries sharing an interior arc always cut it at the same places
 * and produce the same vertex list — which is what lets the arc be
 * recognised as one arc and stored once.
 */
const buildGeography = (collection) => {
  const rings = [];
  for (const [index, feature] of collection.features.entries()) {
    const name = feature.properties?.ADMIN ?? feature.properties?.NAME ?? String(index);
    // Deterministic, and spread enough that neighbours rarely share a
    // tone — the tones are the whole of the relief now that the plates
    // are flat.
    let hash = 0;
    for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

    for (const polygon of polygonsOf(feature.geometry)) {
      const part = { name, tone: hash % tones.length, rings: [] };
      for (const source of polygon) {
        const points = unwrap(source);
        if (points.length < 3) continue;
        part.rings.push({
          points,
          keys: points.map(pointKey),
          area: shoelace(points),
          extent: extentOf(points),
          arcs: [],
        });
      }
      if (part.rings.length) rings.push(part);
    }
  }

  const vertexRings = new Map();
  const edgeRings = new Map();
  for (const part of rings) {
    for (const ring of part.rings) {
      for (const key of new Set(ring.keys)) vertexRings.set(key, (vertexRings.get(key) ?? 0) + 1);
      for (let i = 0; i < ring.keys.length; i += 1) {
        const key = edgeKey(ring.keys[i], ring.keys[(i + 1) % ring.keys.length]);
        edgeRings.set(key, (edgeRings.get(key) ?? 0) + 1);
      }
    }
  }

  const arcs = new Map();
  /**
   * Looks an arc up by identity, registering it the first time.
   *
   * Shaping waits for a second pass: an arc cannot be squared until
   * every ring that owns it is known, because the cell it is squared
   * onto is the smallest of their extents.
   *
   * The `offset` is the antimeridian showing through. An arc is stored
   * in whichever longitude frame the ring that first reached it was
   * unwrapped into, and the next ring to share it may be a full turn
   * away — Russia's Pacific edge sits past +180° in one ring and before
   * -180° in its neighbour. On the sphere the two spellings are the
   * same place, so borders do not care, but a ring reassembled out of
   * arcs from both frames has a 360°-wide tear in it, and a plate
   * triangulated from that ring wraps the planet. So each reference
   * carries the whole turns needed to bring the shared arc back into
   * its own ring's frame.
   */
  const arcFor = (points, closed, internal, seam, extent) => {
    const keys = points.map(pointKey);
    const forward = keys.join(',');
    const backward = [...keys].reverse().join(',');
    const key = forward <= backward ? forward : backward;
    let arc = arcs.get(key);
    if (!arc) {
      arc = {
        closed,
        internal,
        seam,
        source: points,
        extent,
        shaped: null,
        head: keys[0],
        lonFirst: points[0][0],
        lonLast: points[points.length - 1][0],
      };
      arcs.set(key, arc);
    }
    arc.extent = Math.min(arc.extent, extent);
    const isForward = arc.head === keys[0];
    const anchor = isForward ? arc.lonFirst : arc.lonLast;
    return { arc, forward: isForward, offset: Math.round((points[0][0] - anchor) / 360) * 360 };
  };

  for (const part of rings) {
    for (const ring of part.rings) {
      const count = ring.keys.length;
      const edgeAt = (i) => edgeRings.get(edgeKey(ring.keys[i], ring.keys[(i + 1) % count]));
      const seamAt = (i) => seamEdge(ring.points[i], ring.points[(i + 1) % count]);
      const junctions = [];
      for (let i = 0; i < count; i += 1) {
        const here = edgeAt(i);
        const before = (i - 1 + count) % count;
        if (edgeAt(before) !== here || vertexRings.get(ring.keys[i]) > here || seamAt(before) !== seamAt(i)) {
          junctions.push(i);
        }
      }

      if (!junctions.length) {
        ring.arcs.push(arcFor(ring.points, true, edgeAt(0) > 1, seamAt(0), ring.extent));
        continue;
      }
      for (let j = 0; j < junctions.length; j += 1) {
        const from = junctions[j];
        const to = junctions[(j + 1) % junctions.length];
        const points = [];
        for (let i = from; ; i = (i + 1) % count) {
          points.push(ring.points[i]);
          if (i === to) break;
        }
        if (points.length < 2) continue;
        ring.arcs.push(arcFor(points, false, edgeAt(from) > 1, seamAt(from), ring.extent));
      }
    }
  }

  // Now that every ring that owns an arc is known, the arc knows its
  // cell and can be shaped. A seam is polygon bookkeeping: it is kept
  // exactly as the source wrote it, so the two sides of the
  // antimeridian still line up, and it is never drawn.
  for (const arc of arcs.values()) {
    arc.shaped = arc.seam ? arc.source : shapeArc(arc.source, arc.closed, cellFor(arc.extent));
  }

  // Reassembly. A closed ring is its one arc; a cut ring is its arcs
  // end to end, each contributing everything but its final vertex,
  // which is the next arc's first.
  const countries = [];
  for (const part of rings) {
    const assembled = part.rings
      .map((ring) => {
        if (ring.arcs.length === 1 && ring.arcs[0].arc.closed) {
          const { arc, offset } = ring.arcs[0];
          const points = offset ? arc.shaped.map(([x, y]) => [x + offset, y]) : arc.shaped;
          return { points, area: ring.area, arcs: ring.arcs };
        }
        const points = [];
        for (const { arc, forward, offset } of ring.arcs) {
          const shaped = forward ? arc.shaped : [...arc.shaped].reverse();
          for (let i = 0; i < shaped.length - 1; i += 1) points.push([shaped[i][0] + offset, shaped[i][1]]);
        }
        return { points: dedupe(points, true), area: ring.area, arcs: ring.arcs };
      })
      .filter((ring) => ring.points.length >= 3);

    const [outer, ...holes] = assembled;
    // Whether a ring is worth drawing is judged on the *source* ring,
    // not on the shaped one. Shaping only ever shrinks a ring, so
    // measuring after it would quietly delete real countries for being
    // hard to simplify rather than for being small.
    if (!outer || outer.area < shape.minimumArea) continue;
    const kept = [outer, ...holes.filter((ring) => ring.area >= shape.minimumArea * 3)];
    countries.push({
      name: part.name,
      tone: part.tone,
      outer: outer.points,
      holes: kept.slice(1).map((ring) => ring.points),
      // The rings are kept whole as well as flattened, because the
      // coastal wall needs two things the point lists have lost: which
      // of a ring's arcs face open sea, and, for a hole, that the sea
      // is on the inside of it.
      rings: kept.map((ring, index) => ({ points: ring.points, arcs: ring.arcs, hole: index > 0 })),
    });
  }

  return { countries, arcs: [...arcs.values()].filter((arc) => !arc.seam) };
};
/** Even-odd point-in-polygon, in lon/lat. `j` trails `i` by one, so
 * the update has to hand j the index i is leaving — `j = i += 1` gives
 * it the one i is arriving at, which makes every edge degenerate and
 * the whole test answer for the closing edge alone. */
const encloses = (ring, x, y) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};const paintCountries = (countries, steps) => {
  const owners = new Map();
  countries.forEach((country, index) => {
    for (const ring of country.rings) {
      for (const { arc } of ring.arcs) {
        if (!arc.internal) continue;
        const set = owners.get(arc) ?? new Set();
        set.add(index);
        owners.set(arc, set);
      }
    }
  });

  const neighbours = countries.map(() => new Set());
  for (const set of owners.values()) {
    if (set.size < 2) continue;
    for (const a of set) for (const b of set) if (a !== b) neighbours[a].add(b);
  }

  const chosenFor = new Array(countries.length).fill(-1);
  const order = countries
    .map((country, index) => index)
    .sort((a, b) => neighbours[b].size - neighbours[a].size);

  const used = new Array(steps).fill(0);
  for (const index of order) {
    const taken = [...neighbours[index]].map((other) => chosenFor[other]).filter((step) => step >= 0);
    let chosen = 0;
    let best = -Infinity;
    for (let step = 0; step < steps; step += 1) {
      const clearance = taken.length ? Math.min(...taken.map((other) => Math.abs(other - step))) : steps;
      // Clearance dominates; among equals the rarest step wins, so the
      // ramp gets used evenly instead of piling onto one end.
      const score = clearance * 1000 - used[step];
      if (score > best) {
        best = score;
        chosen = step;
      }
    }
    chosenFor[index] = chosen;
    used[chosen] += 1;
  }

  return chosenFor;
};

/**
 * Who owns which point of the globe.
 *
 * Deciding which country lies under a grid cell is the expensive part
 * of this scene — a couple of thousand lookups against a hundred and
 * eighty outlines — so the box test in front of it is not an
 * optimisation, it is the difference between a frame and a second.
 * Neither the answer nor the step it carries depends on the stage or
 * the variant, so this runs once.
 */
const ownership = (geography, steps) => {
  const boxed = geography.countries.map((country, index) => {
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lon, lat] of country.outer) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return { index, step: steps[index], minLon, maxLon, minLat, maxLat, country };
  });

  return (lon, lat) => {
    for (const box of boxed) {
      for (const shift of [-360, 0, 360]) {
        const x = lon + shift;
        if (x < box.minLon || x > box.maxLon || lat < box.minLat || lat > box.maxLat) continue;
        if (!encloses(box.country.outer, x, lat)) continue;
        if (box.country.holes.some((hole) => encloses(hole, x, lat))) continue;
        return box;
      }
    }
    return null;
  };
};

/* ================================================================ *
 * The bake.
 * ================================================================ */

/**
 * Walk the grid and record every cell with land under its middle.
 *
 * The grid is not a lattice: the number of columns around a parallel falls
 * with its cosine, so a pad stays roughly square all the way to the poles
 * instead of stretching into a ribbon. The runtime rebuilds the same
 * counts from the same formula, so only the *occupied* columns travel.
 */
const walk = (owner) => {
  const counts = [];
  const bands = [];
  for (let lat = -85; lat < 85; lat += GRID) {
    const middle = lat + GRID / 2;
    const count = Math.max(8, Math.round((360 * Math.cos((middle * Math.PI) / 180)) / GRID));
    const lonStep = 360 / count;
    const row = [];
    for (let k = 0; k < count; k += 1) {
      const lon = -180 + k * lonStep + lonStep / 2;
      const found = owner(lon, middle);
      if (found) row.push({ column: k, step: found.step, country: found.index });
    }
    counts.push(count);
    bands.push(row);
  }
  return { counts, bands };
};

/** Base64 of a typed array — small enough to read as one line in the diff,
 *  and nothing has to parse a thousand numbers at start-up. */
const pack = (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');

const main = async () => {
  const response = await fetch(COUNTRIES_URL);
  if (!response.ok) throw new Error(`Geography data request failed: ${response.status}`);
  const geography = buildGeography(await response.json());
  const steps = paintCountries(geography.countries, STEPS);
  const { counts, bands } = walk(ownership(geography, steps));

  const cells = bands.flat();
  const perBand = Uint16Array.from(bands.map((row) => row.length));
  const columns = Uint16Array.from(cells.map((cell) => cell.column));
  const stepOf = Uint8Array.from(cells.map((cell) => cell.step));
  const countryOf = Uint16Array.from(cells.map((cell) => cell.country));

  const out = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/landing/hero-planet-grid.ts',
  );
  writeFileSync(
    out,
    `// Generated by scripts/build-planet-grid.mjs — do not edit by hand.
//
// The world as a ${GRID}-degree grid: which cells have land under them, which
// country each belongs to, and which step of the palette that country was
// given by the graph colouring. Rebuilt only when the grid, the palette's
// length or the source outlines change.
//
// ${cells.length} cells over ${counts.length} bands, from Natural Earth 110m admin-0.

/** The cell, in degrees. */
export const GRID = ${GRID};

/** How many steps the palette has, and so how many the colouring used. */
export const STEPS = ${STEPS};

const COUNTS = '${pack(Uint16Array.from(counts))}';
const PER_BAND = '${pack(perBand)}';
const COLUMNS = '${pack(columns)}';
const TONE = '${pack(stepOf)}';
const COUNTRY = '${pack(countryOf)}';

const unpack = (text: string): Uint8Array => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const words = (text: string): Uint16Array => {
  const bytes = unpack(text);
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
};

export interface PlanetGrid {
  /** How many columns each band of latitude is divided into. */
  counts: Uint16Array;
  /** Per cell, in band order: which column it occupies. */
  columns: Uint16Array;
  /** Per cell: which band it is in. */
  bands: Uint16Array;
  /** Per cell: its country's step of the palette. */
  tone: Uint8Array;
  /** Per cell: which country it belongs to. */
  country: Uint16Array;
}

/** The grid, unpacked. Cheap enough to do at boot: five base64 strings and
 *  one pass to expand the per-band run lengths into a band per cell. */
export function planetGrid(): PlanetGrid {
  const counts = words(COUNTS);
  const perBand = words(PER_BAND);
  const columns = words(COLUMNS);
  const country = words(COUNTRY);
  const tone = unpack(TONE);

  const bands = new Uint16Array(columns.length);
  let at = 0;
  for (let band = 0; band < perBand.length; band += 1) {
    for (let n = 0; n < perBand[band]; n += 1, at += 1) bands[at] = band;
  }
  return { counts, columns, bands, tone, country };
}
`,
  );
  process.stdout.write(`${cells.length} cells over ${counts.length} bands → ${path.relative(process.cwd(), out)}\n`);
};

await main();
