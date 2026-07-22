import * as THREE from 'three';
import {
  TWO_PI, SEGMENTS,
  surfaceMat, makeStaticLine,
  arcPositions, threeArcStart, ringArcStart,
} from './shared.js';

// ── Builder ───────────────────────────────────────────────────────────────────
//
// A lightweight static protrusion representing one server slot.
// Geometry: outer curved surface + top/bottom annular caps + arc outline lines.
// No inner curved surface (rack's outer wall serves as the floor).
// No per-frame updates — silhouette tracking is handled by the parent rack pipe.
//
// Options:
//   outerRadius — outer surface radius (= RACK.outerRadius + MACHINE_PROTRUSION)
//   innerRadius — inner surface radius (= RACK.outerRadius)
//   height      — slot height (computed by allocator from inset rules)
//   angleStart  — slot angular start (computed by allocator with insets)
//   angleSweep  — slot angular sweep (computed by allocator with insets)
//   yOffset     — slot vertical centre (computed by allocator)

export function buildMachineSlot(scene, {
  outerRadius, innerRadius, height,
  angleStart, angleSweep,
  yOffset = 0,
} = {}) {
  const y0   = -height / 2;
  const y1   =  height / 2;
  const aEnd = angleStart + angleSweep;

  const meshes = [];
  const lines  = [];

  // Outer curved face
  const outerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      outerRadius, outerRadius, height, SEGMENTS, 1, true,
      threeArcStart(angleStart, angleSweep), angleSweep,
    ),
    surfaceMat(),
  );
  meshes.push(outerMesh);

  // Top and bottom annular caps (inner → outer, in XZ plane)
  [y1, y0].forEach(y => {
    const geo = new THREE.RingGeometry(
      innerRadius, outerRadius, SEGMENTS, 1,
      ringArcStart(angleStart, angleSweep), angleSweep,
    );
    geo.rotateX(-Math.PI / 2);
    const cap = new THREE.Mesh(geo, surfaceMat({ side: THREE.DoubleSide }));
    cap.position.y = y;
    meshes.push(cap);
  });

  meshes.forEach(m => scene.add(m));

  // Top and bottom arc lines (outer radius)
  lines.push(
    makeStaticLine(arcPositions(outerRadius, y1, angleStart, angleSweep)),
    makeStaticLine(arcPositions(outerRadius, y0, angleStart, angleSweep)),
  );

  // Outer vertical edge lines and top/bottom radials at sector cuts
  [angleStart, aEnd].forEach(a => {
    const ox = Math.cos(a) * outerRadius, oz = Math.sin(a) * outerRadius;
    const ix = Math.cos(a) * innerRadius, iz = Math.sin(a) * innerRadius;
    lines.push(
      makeStaticLine([ox, y0, oz,  ox, y1, oz]),          // outer vertical
      makeStaticLine([ix, y1, iz,  ox, y1, oz]),           // top radial
      makeStaticLine([ix, y0, iz,  ox, y0, oz]),           // bottom radial
    );
  });

  lines.forEach(l => scene.add(l));

  // Apply vertical offset (local coords → world position)
  [...meshes, ...lines].forEach(o => { o.position.y += yOffset; });

  return { meshes, lines, lineMaterials: lines.map(l => l.material) };
}
