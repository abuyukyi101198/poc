import * as THREE from 'three';
import {
  TWO_PI, SEGMENTS,
  surfaceMat, makeDynamicLine, makeStaticLine,
  arcPositions, angleInSector,
  threeArcStart, silhouetteAngles,
  makeSectorWall,
} from './shared.js';

// ── Builder ───────────────────────────────────────────────────────────────────
//
// Options:
//   radius      — cylinder radius (default 1.5)
//   height      — cylinder height (default 3.5)
//   angleStart  — sector start angle in radians, (cos,sin) convention (default 0)
//   angleSweep  — sector sweep in radians (default 2π = full cylinder)
//   trim        — world-unit gap at each cut face; arc endpoints pulled inward
//                 by trim/radius radians so the gap is constant across radii
//   yOffset     — vertical offset of the cylinder centre (default 0)

export function buildCylinder(scene, {
  radius = 1.5, height = 3.5,
  angleStart = 0, angleSweep = TWO_PI,
  yOffset = 0,
} = {}) {
  const isSector = angleSweep < TWO_PI - 0.001;
  const aEnd = angleStart + angleSweep;
  const y0 = -height / 2, y1 = height / 2;

  const mainMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 256, 1, false,
      threeArcStart(angleStart, angleSweep), angleSweep),
    surfaceMat()
  );
  scene.add(mainMesh);
  const meshes = [mainMesh];

  const lines = [];

  if (isSector) {
    [angleStart, aEnd].forEach(a => {
      const wall = makeSectorWall(radius, height, a);
      scene.add(wall);
      meshes.push(wall);
    });

    const rimPt = a => [Math.cos(a) * radius, Math.sin(a) * radius];
    const [rAx, rAz] = rimPt(angleStart);
    const [rBx, rBz] = rimPt(aEnd);

    [
      makeStaticLine([0, y0, 0,   0, y1, 0]),
      makeStaticLine([rAx, y0, rAz,  rAx, y1, rAz]),
      makeStaticLine([rBx, y0, rBz,  rBx, y1, rBz]),
      makeStaticLine([0, y1, 0,  rAx, y1, rAz]),
      makeStaticLine([0, y1, 0,  rBx, y1, rBz]),
      makeStaticLine([0, y0, 0,  rAx, y0, rAz]),
      makeStaticLine([0, y0, 0,  rBx, y0, rBz]),
    ].forEach(l => { scene.add(l); lines.push(l); });
  }

  const ringTop = makeDynamicLine(SEGMENTS + 1);
  const ringBot = makeDynamicLine(SEGMENTS + 1);
  const silA    = makeDynamicLine(2);
  const silB    = makeDynamicLine(2);
  [ringTop, ringBot, silA, silB].forEach(l => { scene.add(l); lines.push(l); });

  [...meshes, ...lines].forEach(o => { o.position.y = yOffset; });

  return {
    meshes, lines,
    lineMaterials: lines.map(l => l.material),
    ringTop, ringBot, silA, silB,
    radius, height, angleStart, angleSweep, isSector, yOffset,
  };
}

export function updateCylinder(cyl, camera) {
  const { radius, height, angleStart, angleSweep, ringTop, ringBot, silA, silB } = cyl;
  const angles = silhouetteAngles(radius, camera);
  if (!angles) return;
  const { phi, halfAngle } = angles;

  ringTop.geometry.setPositions(arcPositions(radius,  height / 2, angleStart, angleSweep));
  ringBot.geometry.setPositions(arcPositions(radius, -height / 2, angleStart, angleSweep));

  const setSil = (line, theta) => {
    if (!angleInSector(theta, angleStart, angleSweep)) {
      line.geometry.setPositions([0, 0, 0, 0, 0, 0]);
    } else {
      const sx = Math.cos(theta) * radius, sz = Math.sin(theta) * radius;
      line.geometry.setPositions([sx, -height / 2, sz, sx, height / 2, sz]);
    }
  };
  setSil(silA, phi + halfAngle);
  setSil(silB, phi - halfAngle);
}

// ── Leader-line helper ────────────────────────────────────────────────────────

// Returns the world-space point on the rightmost silhouette edge, useful for
// anchoring SVG leader lines.
export function rightSilhouetteAnchor(cyl, camera, yFraction = 0.12) {
  const { radius, height, yOffset = 0 } = cyl;
  const y      = yOffset + height * yFraction;
  const angles = silhouetteAngles(radius, camera);
  if (!angles) return new THREE.Vector3(radius, y, 0);
  const { phi, halfAngle } = angles;

  const p1 = new THREE.Vector3(Math.cos(phi + halfAngle) * radius, y, Math.sin(phi + halfAngle) * radius);
  const p2 = new THREE.Vector3(Math.cos(phi - halfAngle) * radius, y, Math.sin(phi - halfAngle) * radius);
  return p1.clone().project(camera).x >= p2.clone().project(camera).x ? p1 : p2;
}

