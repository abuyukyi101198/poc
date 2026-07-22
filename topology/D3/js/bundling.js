/**
 * bundling.js — Phase 3
 * Hierarchical edge bundling for the radial topology visualization (§6.4).
 *
 * Algorithm: simplified Holten-style control-point deflection.
 *   For each "bundle group" (links sharing a common ancestor at a specific
 *   hierarchy level, within the same plane), each link's cubic Bezier control
 *   points are deflected toward the group's circular-mean control angles by
 *   `bundleStrength` (β).
 *
 *   β = 0  →  fully separate curves  (identical to Phase 2 plain Bezier)
 *   β = 1  →  maximally bundled  (all links in a group share one trunk path)
 *   Default: 0.7  (spec §9.2)
 *
 * Per-plane independence (spec §6.4 point 4):
 *   Data and management links are NEVER placed in the same bundle group.
 *   The `plane` field is always part of the group key for routing-layer links.
 *
 * Grouping rules (see bundleGroupKey):
 *
 *   R3→R4  spine→leaf:
 *     Group by (plane, target-leaf half of circle).
 *     The 8-link ECMP full mesh is split into a "near" group (leaves whose
 *     mid-angle < π) and a "far" group (mid-angle ≥ π), creating two visible
 *     trunks — one on each side of the spine ring — rather than a single
 *     weak centroid for all four leaves.
 *
 *   R4→R5  leaf→rack:
 *     Group by (plane, source leaf).  Each leaf bundles its 2–3 outgoing
 *     rack links into a small local fan.
 *
 *   R5→R6  rack→server:
 *     Group by source rack.  Each rack's 4–8 server links fan from the rack
 *     arc into the server ring.
 *
 *   R1→R3  pod→spine:
 *     Group by plane.  Only 2 links per group; mild visual convergence in
 *     the narrow gap between the pod and spine rings.
 *
 *   R1→R5  pod→rack containment + all others:
 *     Each link is its own singleton group — no bundling.  Pod→rack links are
 *     already straight radial lines due to the Phase 2 full-circle special
 *     case; deflecting their control points adds no visual value.
 *
 * Exports: computeBundledPaths(layoutNodes, links, bundleStrength)
 */

const TWO_PI = 2 * Math.PI;

/**
 * computeBundledPaths(layoutNodes, links, bundleStrength = 0.7)
 *
 * Returns a Map<string, string> mapping each drawable link's key
 * (`"${source}→${target}"`) to a bundled SVG cubic-Bezier path string.
 *
 * Links whose endpoints are not in layoutNodes (e.g. border-leaf-1 SAT stub)
 * are silently excluded — matching the behaviour of Phase 2's drawLinks().
 *
 * All drawable links appear in the returned Map, including singleton groups
 * (which get a plain Phase-2-equivalent Bezier path so callers never need a
 * separate fallback).
 */
export function computeBundledPaths(layoutNodes, links, bundleStrength = 0.7) {
  const β = bundleStrength;
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));

  const drawable = links.filter(
    l => nodeById.has(l.source) && nodeById.has(l.target)
  );

  // ── Step 1: classify each link and place it in a bundle group ────────────────
  const groups = new Map();

  drawable.forEach(link => {
    const s = nodeById.get(link.source);
    const t = nodeById.get(link.target);
    // Orient consistently: inner = closer to chart centre, outer = farther
    const [inner, outer] = s.outerRadius <= t.outerRadius ? [s, t] : [t, s];

    const key = bundleGroupKey(link, inner, outer);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ link, inner, outer });
  });

  // ── Step 2: compute bundled paths for each group ─────────────────────────────
  const pathMap = new Map();

  groups.forEach(members => {
    bundleGroup(members, β).forEach(({ linkKey, path }) => {
      pathMap.set(linkKey, path);
    });
  });

  return pathMap;
}

// ── Group-key assignment ──────────────────────────────────────────────────────

/**
 * bundleGroupKey — assigns a bundle-group key to a link given its oriented
 * (inner, outer) endpoint nodes.
 *
 * Links with the same key are bundled together.  The plane is always part of
 * the key for R3/R4 routing layers, enforcing per-plane independence (§6.4 #4).
 */
function bundleGroupKey(link, inner, outer) {
  const rp = `${inner.ring}-${outer.ring}`;

  switch (rp) {
    case 'R3-R4': {
      // Spine → Leaf (ECMP full mesh).
      // Split 4 leaves into two angular halves so we get two focused trunks
      // instead of one weak centroid for the whole spread-out leaf ring.
      const a_outer = (outer.startAngle + outer.endAngle) / 2;
      const half = a_outer < Math.PI ? 'near' : 'far';
      return `${link.plane}:spine-leaf:${half}`;
    }

    case 'R4-R5':
      // Leaf → Rack: each leaf's small fan bundles separately per plane.
      return `${link.plane}:leaf-rack:${inner.id}`;

    case 'R5-R6':
      // Rack → Server: server fans are contained within one rack's arc region.
      // Rack links are always plane='shared', so no plane key needed.
      return `shared:rack-server:${inner.id}`;

    case 'R1-R3':
      // Pod → Spine: mild convergence in the narrow pod↔spine gap, per plane.
      return `${link.plane}:pod-spine`;

    default:
      // Pod→Rack containment (R1-R5) and any unrecognised pair: no bundling.
      return `singleton:${link.source}→${link.target}`;
  }
}

// ── Per-group path computation ────────────────────────────────────────────────

/**
 * bundleGroup — generates a bundled SVG path for every link in a group.
 *
 * For singleton groups (1 member), returns the plain Phase-2 Bezier path
 * unchanged.
 *
 * For multi-member groups:
 *   1. Compute the circular mean of all source (CP1) and target (CP2) angles.
 *   2. Blend each link's natural CP angle toward the group mean by β.
 *   3. Emit the resulting cubic Bezier path.
 *
 * The pod full-circle special case is respected: for a full-circle source arc
 * (pod-1, R1) the source angle is already set to the target's angle (making
 * a straight radial line in Phase 2).  For pod→spine groups, the CP1 angle
 * is NOT deflected so the link stays straight at the source end; only CP2 is
 * pulled toward the group centroid, giving a gentle convergence in the gap.
 */
function bundleGroup(members, β) {
  // Pre-compute angles and geometry for each member
  const items = members.map(({ link, inner, outer }) => {
    const isFullCircle = (inner.endAngle - inner.startAngle) >= TWO_PI * 0.99;
    const a_inner = (inner.startAngle + inner.endAngle) / 2;
    const a_outer = (outer.startAngle + outer.endAngle) / 2;
    // Pod special case: source angle = target angle → straight radial line
    const a_src   = isFullCircle ? a_outer : a_inner;

    const r_src = inner.outerRadius;
    const r_tgt = outer.innerRadius;
    const r_mid = (r_src + r_tgt) / 2;

    return { link, isFullCircle, a_src, a_outer, r_src, r_tgt, r_mid };
  });

  // Singleton: return plain Phase-2-equivalent path (no deflection)
  if (items.length === 1) {
    const d = items[0];
    return [{ linkKey: linkKey(d.link), path: bezierPath(d) }];
  }

  // Circular means for CP1 (source side) and CP2 (target side)
  const [a_mean_src, a_mean_tgt] = circularMeans(items);

  return items.map(d => {
    // For the pod full-circle case, keep CP1 at the natural (target) angle
    // so the straight-line property from Phase 2 is preserved at the source end.
    const a_cp1 = d.isFullCircle
      ? d.a_src
      : circularBlend(d.a_src,   a_mean_src, β);
    const a_cp2   = circularBlend(d.a_outer, a_mean_tgt, β);

    const x0 = d.r_src * Math.sin(d.a_src);
    const y0 = -d.r_src * Math.cos(d.a_src);
    const x1 = d.r_mid * Math.sin(a_cp1);
    const y1 = -d.r_mid * Math.cos(a_cp1);
    const x2 = d.r_mid * Math.sin(a_cp2);
    const y2 = -d.r_mid * Math.cos(a_cp2);
    const x3 = d.r_tgt * Math.sin(d.a_outer);
    const y3 = -d.r_tgt * Math.cos(d.a_outer);

    return {
      linkKey: linkKey(d.link),
      path: `M${f(x0)},${f(y0)} C${f(x1)},${f(y1)} ${f(x2)},${f(y2)} ${f(x3)},${f(y3)}`,
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Plain Phase-2 Bezier path for a single (inner, outer) link item. */
function bezierPath(d) {
  const x0 = d.r_src * Math.sin(d.a_src);
  const y0 = -d.r_src * Math.cos(d.a_src);
  const x1 = d.r_mid * Math.sin(d.a_src);
  const y1 = -d.r_mid * Math.cos(d.a_src);
  const x2 = d.r_mid * Math.sin(d.a_outer);
  const y2 = -d.r_mid * Math.cos(d.a_outer);
  const x3 = d.r_tgt * Math.sin(d.a_outer);
  const y3 = -d.r_tgt * Math.cos(d.a_outer);
  return `M${f(x0)},${f(y0)} C${f(x1)},${f(y1)} ${f(x2)},${f(y2)} ${f(x3)},${f(y3)}`;
}

/**
 * circularMeans — computes the circular mean of source and target angles
 * across all group members using the unit-vector average (atan2 of sum of
 * sin/cos).  This correctly handles the 0/2π wrap-around boundary (e.g. a
 * group whose sources span from 6.0 rad to 0.3 rad resolves to ~0.15 rad,
 * not the spurious arithmetic mean of ~3.15 rad).
 */
function circularMeans(items) {
  let ss = 0, sc = 0, ts = 0, tc = 0;
  items.forEach(d => {
    ss += Math.sin(d.a_src);
    sc += Math.cos(d.a_src);
    ts += Math.sin(d.a_outer);
    tc += Math.cos(d.a_outer);
  });
  return [Math.atan2(ss, sc), Math.atan2(ts, tc)];
}

/**
 * circularBlend — blends angle `a` toward angle `b` by factor `t`, always
 * taking the shortest arc (handles the 0/2π seam correctly).
 */
function circularBlend(a, b, t) {
  let diff = b - a;
  // Normalise diff to [-π, π] — ensures we travel the short way around
  while (diff >  Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  return a + t * diff;
}

/** Canonical link key matching Phase 2's data-join key. */
const linkKey = link => `${link.source}→${link.target}`;

/** Compact fixed-precision formatter for SVG coordinates. */
const f = v => v.toFixed(2);

