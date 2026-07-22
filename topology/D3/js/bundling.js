/**
 * bundling.js — Phase 3
 * Tree-of-life path computation for the radial topology visualization.
 *
 * Each link is drawn as:
 *   M source outer edge
 *   L arc-circle at gap midpoint (radial stub, same angle → no diagonal)
 *   A arc along gap midpoint circle to target angle
 *   L target inner edge (radial drop)
 *
 * The visual grouping comes from naturally overlapping arcs produced by the
 * tree structure itself — links from adjacent source nodes share arc segments
 * on the gap circle.  No Holten-style angular deflection is applied because
 * any deflection of entry or exit angles produces diagonal line artifacts.
 *
 * bundleStrength (β) is accepted for API compatibility with interaction.js
 * (which calls this with β=0.7 for resting state and β=0 for hover state)
 * but has no effect on the generated paths — both produce identical output.
 *
 * Per-plane independence (spec §6.4 point 4):
 *   Data and management links are NEVER placed in the same bundle group.
 *
 * Exports: computeBundledPaths(layoutNodes, links, bundleStrength)
 */

const TWO_PI = 2 * Math.PI;

/**
 * computeBundledPaths(layoutNodes, links, bundleStrength = 0.7)
 *
 * Returns a Map<string, string> mapping each drawable link's key
 * (`"${source}→${target}"`) to a tree-of-life SVG path string.
 *
 * Links whose endpoints are not in layoutNodes are silently excluded.
 */
export function computeBundledPaths(layoutNodes, links, bundleStrength = 0.7) {
  const nodeById = new Map(layoutNodes.map(n => [n.id, n]));

  const pathMap = new Map();

  links.forEach(link => {
    const s = nodeById.get(link.source);
    const t = nodeById.get(link.target);
    if (!s || !t) return;

    const [inner, outer] = s.outerRadius <= t.outerRadius ? [s, t] : [t, s];
    const isFullCircle = (inner.endAngle - inner.startAngle) >= TWO_PI * 0.99;
    const a_inner = (inner.startAngle + inner.endAngle) / 2;
    const a_outer = (outer.startAngle + outer.endAngle) / 2;
    const a_src   = isFullCircle ? a_outer : a_inner;
    const r_src   = inner.outerRadius;
    const r_tgt   = outer.innerRadius;
    const r_arc   = (r_src + r_tgt) / 2;

    // Plain tree-of-life path: radial stub → arc at gap midpoint → radial drop.
    // a_arc_entry = a_src (stub is radial, no diagonal).
    // a_arc_exit  = a_outer (exit is radial, no diagonal).
    pathMap.set(
      `${link.source}→${link.target}`,
      makeTreePath(r_src, a_src, r_arc, a_src, a_outer, r_tgt, a_outer)
    );
  });

  return pathMap;
}

// ── Path primitive ────────────────────────────────────────────────────────────

/** Compact fixed-precision formatter for SVG coordinates. */
const f = v => v.toFixed(2);

/**
 * makeTreePath — tree-of-life path primitive (mirrors render.js export).
 *   M(r_src, a_src) → L(r_arc, a_arc_entry) → A(r_arc) → L(r_tgt, a_tgt)
 */
function makeTreePath(r_src, a_src, r_arc, a_arc_entry, a_arc_exit, r_tgt, a_tgt) {
  const x0 = r_src * Math.sin(a_src);
  const y0 = -r_src * Math.cos(a_src);
  const xe = r_arc * Math.sin(a_arc_entry);
  const ye = -r_arc * Math.cos(a_arc_entry);
  const x1 = r_arc * Math.sin(a_arc_exit);
  const y1 = -r_arc * Math.cos(a_arc_exit);
  const x3 = r_tgt * Math.sin(a_tgt);
  const y3 = -r_tgt * Math.cos(a_tgt);

  let diff = a_arc_exit - a_arc_entry;
  while (diff >  Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  const sweep = diff >= 0 ? 1 : 0;
  const ra = r_arc.toFixed(2);

  if (Math.abs(diff) < 0.001) {
    // Degenerate arc (pod full-circle) → two radial stubs
    return `M${f(x0)},${f(y0)} L${f(xe)},${f(ye)} L${f(x3)},${f(y3)}`;
  }
  return (
    `M${f(x0)},${f(y0)} ` +
    `L${f(xe)},${f(ye)} ` +
    `A${ra},${ra} 0 0,${sweep} ${f(x1)},${f(y1)} ` +
    `L${f(x3)},${f(y3)}`
  );
}
