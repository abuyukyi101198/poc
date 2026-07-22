import * as THREE from 'three';
import {
  TWO_PI, SEGMENTS,
  surfaceMat, makeDynamicLine, makeStaticLine,
  arcPositions, angleInSector,
  threeArcStart, ringArcStart, silhouetteAngles,
  makePipeWall,
} from './shared.js';

// ── Builder ───────────────────────────────────────────────────────────────────
//
// Rendered with four meshes so the depth buffer correctly occludes lines:
//   • Outer curved surface
//   • Inner curved surface (BackSide — acts as depth occluder from outside)
//   • Top and bottom annular caps (DoubleSide)
// For sectors: two flat annular wall meshes are added at the cut faces.
//
// Options:
//   outerRadius — outer radius (default 2.5)
//   innerRadius — inner radius / bore radius (default 1.5)
//   height      — pipe height (default 2.0)
//   angleStart  — sector start angle in radians, (cos,sin) convention (default 0)
//   angleSweep  — sector sweep in radians (default 2π = full pipe)
//   trim        — world-unit gap at each cut face; each ring's arc is pulled inward
//                 by trim/radius radians so the gap is constant across radii
//   yOffset     — vertical offset of the pipe centre (default 0)

export function buildPipe(scene, {
  outerRadius = 2.5, innerRadius = 1.5, height = 2.0,
  angleStart = 0, angleSweep = TWO_PI,
  yOffset = 0,
} = {}) {
  const isSector = angleSweep < TWO_PI - 0.001;
  const aEnd = angleStart + angleSweep;
  const y0 = -height / 2, y1 = height / 2;

  // Outer curved surface.
  const outerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(outerRadius, outerRadius, height, 256, 1, true,
      threeArcStart(angleStart, angleSweep), angleSweep),
    surfaceMat()
  );

  // Inner curved surface — BackSide renders when viewed from outside,
  // writing to the depth buffer and occluding lines behind the inner wall.
  const innerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(innerRadius, innerRadius, height, 256, 1, true,
      threeArcStart(angleStart, angleSweep), angleSweep),
    surfaceMat({ side: THREE.BackSide })
  );

  // Annular caps — RingGeometry uses (cos,−sin) in XZ after rotateX(−π/2),
  // so ringArcStart converts to our (cos,sin) convention.
  const makeAnnulus = y => {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 256, 1,
      ringArcStart(angleStart, angleSweep), angleSweep);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, surfaceMat({ side: THREE.DoubleSide }));
    m.position.y = y;
    return m;
  };
  const topCap = makeAnnulus(y1);
  const botCap = makeAnnulus(y0);

  const meshes = [outerMesh, innerMesh, topCap, botCap];
  meshes.forEach(m => scene.add(m));

  const lines = [];

  if (isSector) {
    // Flat annular wall meshes stay at the geometric cuts for depth occlusion.
    [angleStart, aEnd].forEach(a => {
      const wall = makePipeWall(outerRadius, innerRadius, height, a);
      scene.add(wall);
      meshes.push(wall);
    });

    // Static edge lines stay at the geometric cut positions.
    // The trim gap is visible as the space between the arc endpoints and these lines.
    const outerPt = a => [Math.cos(a) * outerRadius, Math.sin(a) * outerRadius];
    const innerPt = a => [Math.cos(a) * innerRadius, Math.sin(a) * innerRadius];
    const [oAx, oAz] = outerPt(angleStart), [oBx, oBz] = outerPt(aEnd);
    const [iAx, iAz] = innerPt(angleStart), [iBx, iBz] = innerPt(aEnd);

    const edgeLines = [
      // Outer rim verticals at cuts
      makeStaticLine([oAx, y0, oAz,  oAx, y1, oAz]),
      makeStaticLine([oBx, y0, oBz,  oBx, y1, oBz]),
      // Inner rim verticals at cuts
      makeStaticLine([iAx, y0, iAz,  iAx, y1, iAz]),
      makeStaticLine([iBx, y0, iBz,  iBx, y1, iBz]),
      // Top radials (inner → outer) at cuts
      makeStaticLine([iAx, y1, iAz,  oAx, y1, oAz]),
      makeStaticLine([iBx, y1, iBz,  oBx, y1, oBz]),
      // Bottom radials at cuts
      makeStaticLine([iAx, y0, iAz,  oAx, y0, oAz]),
      makeStaticLine([iBx, y0, iBz,  oBx, y0, oBz]),
    ];

    edgeLines.forEach(l => { scene.add(l); lines.push(l); });
  }

  // Dynamic lines — updated every frame by updatePipe.
  const outerRingTop = makeDynamicLine(SEGMENTS + 1);
  const outerRingBot = makeDynamicLine(SEGMENTS + 1);
  const outerSilA    = makeDynamicLine(2);
  const outerSilB    = makeDynamicLine(2);
  const innerRingTop = makeDynamicLine(SEGMENTS + 1);
  const innerRingBot = makeDynamicLine(SEGMENTS + 1);
  [outerRingTop, outerRingBot, outerSilA, outerSilB, innerRingTop, innerRingBot]
    .forEach(l => { scene.add(l); lines.push(l); });

  // Apply vertical offset to every scene object; dynamic line geometry uses
  // local coordinates so updatePipe needs no changes.
  [...meshes, ...lines].forEach(o => { o.position.y += yOffset; });

  return {
    meshes, lines,
    lineMaterials: lines.map(l => l.material),
    outerRadius, innerRadius, height, angleStart, angleSweep, isSector, yOffset,
    outerRingTop, outerRingBot, outerSilA, outerSilB,
    innerRingTop, innerRingBot,
  };
}

export function updatePipe(pipe, camera) {
  const { outerRadius, innerRadius, height, angleStart, angleSweep,
          outerRingTop, outerRingBot, outerSilA, outerSilB,
          innerRingTop, innerRingBot } = pipe;

  const outerAngles = silhouetteAngles(outerRadius, camera);
  if (!outerAngles) return;
  const { phi, halfAngle } = outerAngles;

  outerRingTop.geometry.setPositions(arcPositions(outerRadius,  height / 2, angleStart, angleSweep));
  outerRingBot.geometry.setPositions(arcPositions(outerRadius, -height / 2, angleStart, angleSweep));

  const setOuterSil = (line, theta) => {
    if (!angleInSector(theta, angleStart, angleSweep)) {
      line.geometry.setPositions([0, 0, 0, 0, 0, 0]);
    } else {
      const sx = Math.cos(theta) * outerRadius, sz = Math.sin(theta) * outerRadius;
      line.geometry.setPositions([sx, -height / 2, sz, sx, height / 2, sz]);
    }
  };
  setOuterSil(outerSilA, phi + halfAngle);
  setOuterSil(outerSilB, phi - halfAngle);

  innerRingTop.geometry.setPositions(arcPositions(innerRadius,  height / 2, angleStart, angleSweep));
  innerRingBot.geometry.setPositions(arcPositions(innerRadius, -height / 2, angleStart, angleSweep));
}

