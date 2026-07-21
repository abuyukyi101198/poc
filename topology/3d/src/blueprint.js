import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

const INK        = 0x1a1a1a;
const LINE_WIDTH = 2;         // px
const SEGMENTS   = 128;       // arc resolution — higher = smoother curves
const TWO_PI     = Math.PI * 2;

// ── Material factories ────────────────────────────────────────────────────────

function lineMat(opts = {}) {
  return new LineMaterial({
    color: INK,
    linewidth: LINE_WIDTH,
    transparent: true,
    opacity: 0,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits:  -2,
    alphaToCoverage: true,   // MSAA smooths the quad border of each thick line
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    ...opts,
  });
}

function surfaceMat(opts = {}) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, ...opts,
  });
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function makeDynamicLine(pointCount) {
  const geo = new LineGeometry();
  geo.setPositions(new Array(pointCount * 3).fill(0));
  const line = new Line2(geo, lineMat());
  line.frustumCulled = false;
  line.renderOrder = 1;
  return line;
}

// Static line from a flat array of [x,y,z, x,y,z, ...] positions.
function makeStaticLine(pts) {
  const geo = new LineGeometry();
  geo.setPositions(pts);
  const line = new Line2(geo, lineMat());
  line.frustumCulled = false;
  line.renderOrder = 1;
  return line;
}

// Arc from aStart sweeping aSweep radians at the given radius and y.
function arcPositions(radius, y, aStart, aSweep) {
  const pos = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = aStart + (aSweep * i) / SEGMENTS;
    pos.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  return pos;
}

// Is angle theta within the arc [aStart, aStart + aSweep]?
function angleInSector(theta, aStart, aSweep) {
  const t = ((theta - aStart) % TWO_PI + TWO_PI) % TWO_PI;
  return t <= aSweep;
}

// Three.js CylinderGeometry places vertices at x = sin(θ), z = cos(θ).
// My convention: x = cos(θ), z = sin(θ).
// Converting: theta_cyl = π/2 − myAngle → sector [start, start+sweep]
//   maps to thetaStart = π/2 − start − sweep, thetaLength = sweep.
function threeArcStart(myStart, mySweep) {
  return Math.PI / 2 - myStart - mySweep;
}

// Three.js RingGeometry places vertices at x = cos(θ), y = sin(θ) in XY.
// After rotateX(−π/2): x = cos(θ), z = −sin(θ).
// My convention: x = cos(θ), z = sin(θ).
// Converting: theta_ring = −myAngle → sector [start, start+sweep]
//   maps to thetaStart = −(start + sweep), thetaLength = sweep.
function ringArcStart(myStart, mySweep) {
  return -(myStart + mySweep);
}

// Flat triangular wall mesh for a solid-cylinder sector cut face.
function makeSectorWall(radius, height, angle) {
  const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
  const y0 = -height / 2, y1 = height / 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, y0, 0,   x, y0, z,   x, y1, z,
    0, y0, 0,   x, y1, z,   0, y1, 0,
  ]), 3));
  return new THREE.Mesh(geo, surfaceMat({ side: THREE.DoubleSide }));
}

// Flat rectangular wall mesh for a pipe sector cut face (inner→outer radial strip).
function makePipeWall(outerRadius, innerRadius, height, angle) {
  const cx = Math.cos(angle), cz = Math.sin(angle);
  const xi = cx * innerRadius, zi = cz * innerRadius;
  const xo = cx * outerRadius, zo = cz * outerRadius;
  const y0 = -height / 2, y1 = height / 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    xi, y0, zi,  xo, y0, zo,  xo, y1, zo,
    xi, y0, zi,  xo, y1, zo,  xi, y1, zi,
  ]), 3));
  return new THREE.Mesh(geo, surfaceMat({ side: THREE.DoubleSide }));
}

// ── Silhouette math ───────────────────────────────────────────────────────────
//
// Tangency condition:  cx·cosθ + cz·sinθ = R
// → θ = φ ± arccos(R/d),  where φ = atan2(cz,cx), d = ||(cx,cz)||

function silhouetteAngles(radius, camera) {
  const cx = camera.position.x;
  const cz = camera.position.z;
  const d  = Math.hypot(cx, cz);
  if (d <= radius) return null;
  return { phi: Math.atan2(cz, cx), halfAngle: Math.acos(radius / d) };
}

// ── Cylinder builder ──────────────────────────────────────────────────────────
//
// angleStart  — where the sector begins, in radians (default 0)
// angleSweep  — how wide the sector is, in radians (default 2π = full cylinder)

export function buildCylinder(scene, {
  radius = 1.5, height = 3.5,
  angleStart = 0, angleSweep = TWO_PI,
} = {}) {
  const isSector = angleSweep < TWO_PI - 0.001;
  const aEnd = angleStart + angleSweep;
  const y0 = -height / 2, y1 = height / 2;

  // Main mesh: pass the converted start angle so Three.js's (sin,cos) convention
  // lines up with our (cos,sin) arc/wall geometry.
  const mainMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 256, 1, false,
      threeArcStart(angleStart, angleSweep), angleSweep),
    surfaceMat()
  );
  scene.add(mainMesh);
  const meshes = [mainMesh];

  const lines = [];

  if (isSector) {
    // Flat wall meshes close the sector cuts so the depth buffer occludes
    // anything behind those faces.
    [angleStart, aEnd].forEach(a => {
      const wall = makeSectorWall(radius, height, a);
      scene.add(wall);
      meshes.push(wall);
    });

    // Static edge lines that define the cut faces.
    const rimPt = a => [Math.cos(a) * radius, Math.sin(a) * radius];
    const [rAx, rAz] = rimPt(angleStart);
    const [rBx, rBz] = rimPt(aEnd);

    const staticEdges = [
      // Center vertical axis
      makeStaticLine([0, y0, 0,   0, y1, 0]),
      // Rim verticals at each cut
      makeStaticLine([rAx, y0, rAz,  rAx, y1, rAz]),
      makeStaticLine([rBx, y0, rBz,  rBx, y1, rBz]),
      // Top radials (center → rim)
      makeStaticLine([0, y1, 0,  rAx, y1, rAz]),
      makeStaticLine([0, y1, 0,  rBx, y1, rBz]),
      // Bottom radials (center → rim)
      makeStaticLine([0, y0, 0,  rAx, y0, rAz]),
      makeStaticLine([0, y0, 0,  rBx, y0, rBz]),
    ];
    staticEdges.forEach(l => { scene.add(l); lines.push(l); });
  }

  // Dynamic arc rings and silhouettes (updated every frame by updateCylinder).
  const ringTop = makeDynamicLine(SEGMENTS + 1);
  const ringBot = makeDynamicLine(SEGMENTS + 1);
  const silA    = makeDynamicLine(2);
  const silB    = makeDynamicLine(2);
  [ringTop, ringBot, silA, silB].forEach(l => { scene.add(l); lines.push(l); });

  const lineMaterials = lines.map(l => l.material);

  return {
    meshes, lines, lineMaterials,
    ringTop, ringBot, silA, silB,
    radius, height, angleStart, angleSweep, isSector,
  };
}

// ── Cylinder per-frame update ─────────────────────────────────────────────────

export function updateCylinder(cyl, camera) {
  const { radius, height, angleStart, angleSweep, ringTop, ringBot, silA, silB } = cyl;
  const angles = silhouetteAngles(radius, camera);
  if (!angles) return;
  const { phi, halfAngle } = angles;

  // Cap rings: draw the sector arc — depthTest + polygonOffset handles occlusion.
  ringTop.geometry.setPositions(arcPositions(radius,  height / 2, angleStart, angleSweep));
  ringBot.geometry.setPositions(arcPositions(radius, -height / 2, angleStart, angleSweep));

  // Silhouettes: only draw when the tangent angle falls inside the sector.
  const setSil = (line, theta) => {
    if (!angleInSector(theta, angleStart, angleSweep)) {
      line.geometry.setPositions([0, 0, 0, 0, 0, 0]); // degenerate → invisible
    } else {
      const sx = Math.cos(theta) * radius, sz = Math.sin(theta) * radius;
      line.geometry.setPositions([sx, -height / 2, sz, sx, height / 2, sz]);
    }
  };
  setSil(silA, phi + halfAngle);
  setSil(silB, phi - halfAngle);
}

// World-space point on the right silhouette — for leader-line anchoring.
export function rightSilhouetteAnchor(cyl, camera, yFraction = 0.12) {
  const { radius, height } = cyl;
  const y      = height * yFraction;
  const angles = silhouetteAngles(radius, camera);
  if (!angles) return new THREE.Vector3(radius, y, 0);
  const { phi, halfAngle } = angles;

  const p1 = new THREE.Vector3(Math.cos(phi + halfAngle) * radius, y, Math.sin(phi + halfAngle) * radius);
  const p2 = new THREE.Vector3(Math.cos(phi - halfAngle) * radius, y, Math.sin(phi - halfAngle) * radius);
  const v1  = p1.clone().project(camera);
  const v2  = p2.clone().project(camera);
  return v1.x >= v2.x ? p1 : p2;
}

// ── Pipe (hollow cylinder) ────────────────────────────────────────────────────
//
// Rendered with four meshes so the depth buffer correctly occludes lines:
//   • Outer curved surface
//   • Inner curved surface (BackSide — faces outward when viewed from outside)
//   • Top and bottom annular caps (DoubleSide)
// For sectors: two additional flat annular wall meshes at the cut faces.
//
// Lines drawn:
//   • Outer silhouettes + outer cap rings  (same logic as buildCylinder)
//   • Inner cap rings                      (the visible hole-opening edges)
//   For sectors: static rim/radial edge lines at the cut faces.

export function buildPipe(scene, {
  outerRadius = 2.5, innerRadius = 1.5, height = 2.0,
  angleStart = 0, angleSweep = TWO_PI,
} = {}) {
  const isSector = angleSweep < TWO_PI - 0.001;
  const aEnd = angleStart + angleSweep;
  const y0 = -height / 2, y1 = height / 2;

  // Outer curved surface
  const outerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(outerRadius, outerRadius, height, 256, 1, true,
      threeArcStart(angleStart, angleSweep), angleSweep),
    surfaceMat()
  );

  // Inner curved surface — BackSide so it renders when viewed from outside,
  // writing to the depth buffer and occluding lines behind the inner wall.
  const innerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(innerRadius, innerRadius, height, 256, 1, true,
      threeArcStart(angleStart, angleSweep), angleSweep),
    surfaceMat({ side: THREE.BackSide })
  );

  // Annular caps — RingGeometry uses (cos,sin) in XY; after rotateX(−π/2) that
  // becomes (cos,−sin) in XZ, so use ringArcStart to match our (cos,sin) convention.
  function makeAnnulus(y) {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 256, 1,
      ringArcStart(angleStart, angleSweep), angleSweep);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, surfaceMat({ side: THREE.DoubleSide }));
    m.position.y = y;
    return m;
  }
  const topCap = makeAnnulus(y1);
  const botCap = makeAnnulus(y0);

  const meshes = [outerMesh, innerMesh, topCap, botCap];
  meshes.forEach(m => scene.add(m));

  const lines = [];

  if (isSector) {
    // Flat annular wall meshes at the two cut faces.
    [angleStart, aEnd].forEach(a => {
      const wall = makePipeWall(outerRadius, innerRadius, height, a);
      scene.add(wall);
      meshes.push(wall);
    });

    // Static edge lines at the cut faces.
    const outerPt = a => [Math.cos(a) * outerRadius, Math.sin(a) * outerRadius];
    const innerPt = a => [Math.cos(a) * innerRadius, Math.sin(a) * innerRadius];
    const [oAx, oAz] = outerPt(angleStart), [oBx, oBz] = outerPt(aEnd);
    const [iAx, iAz] = innerPt(angleStart), [iBx, iBz] = innerPt(aEnd);

    const staticEdges = [
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
    staticEdges.forEach(l => { scene.add(l); lines.push(l); });
  }

  // Dynamic arc rings and silhouettes.
  const outerRingTop = makeDynamicLine(SEGMENTS + 1);
  const outerRingBot = makeDynamicLine(SEGMENTS + 1);
  const outerSilA    = makeDynamicLine(2);
  const outerSilB    = makeDynamicLine(2);
  const innerRingTop = makeDynamicLine(SEGMENTS + 1);
  const innerRingBot = makeDynamicLine(SEGMENTS + 1);
  [outerRingTop, outerRingBot, outerSilA, outerSilB, innerRingTop, innerRingBot]
    .forEach(l => { scene.add(l); lines.push(l); });

  const lineMaterials = lines.map(l => l.material);

  return {
    meshes, lines, lineMaterials,
    outerRadius, innerRadius, height, angleStart, angleSweep, isSector,
    outerRingTop, outerRingBot, outerSilA, outerSilB,
    innerRingTop, innerRingBot,
  };
}

// ── Pipe per-frame update ─────────────────────────────────────────────────────

export function updatePipe(pipe, camera) {
  const { outerRadius, innerRadius, height, angleStart, angleSweep,
          outerRingTop, outerRingBot, outerSilA, outerSilB,
          innerRingTop, innerRingBot } = pipe;

  const outerAngles = silhouetteAngles(outerRadius, camera);
  if (!outerAngles) return;
  const { phi, halfAngle } = outerAngles;

  // Outer cap rings: draw the sector arc.
  outerRingTop.geometry.setPositions(arcPositions(outerRadius,  height / 2, angleStart, angleSweep));
  outerRingBot.geometry.setPositions(arcPositions(outerRadius, -height / 2, angleStart, angleSweep));

  // Outer silhouettes: only within the sector.
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

  // Inner cap rings (the hole-opening edges): draw the sector arc.
  innerRingTop.geometry.setPositions(arcPositions(innerRadius,  height / 2, angleStart, angleSweep));
  innerRingBot.geometry.setPositions(arcPositions(innerRadius, -height / 2, angleStart, angleSweep));
}
