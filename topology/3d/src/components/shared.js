import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const INK        = 0x1a1a1a;
export const LINE_WIDTH = 2;         // px
export const SEGMENTS   = 128;       // arc resolution — higher = smoother curves
export const TWO_PI     = Math.PI * 2;

// ── Material factories ────────────────────────────────────────────────────────

export function lineMat(opts = {}) {
  return new LineMaterial({
    color: INK,
    linewidth: LINE_WIDTH,
    transparent: true,
    opacity: 0,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits:  -2,
    alphaToCoverage: true,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    ...opts,
  });
}

export function surfaceMat(opts = {}) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, ...opts,
  });
}

// ── Line factories ────────────────────────────────────────────────────────────

export function makeDynamicLine(pointCount) {
  const geo = new LineGeometry();
  geo.setPositions(new Array(pointCount * 3).fill(0));
  const line = new Line2(geo, lineMat());
  line.frustumCulled = false;
  line.renderOrder = 1;
  return line;
}

// Static line from a flat array of [x,y,z, x,y,z, ...] positions.
export function makeStaticLine(pts) {
  const geo = new LineGeometry();
  geo.setPositions(pts);
  const line = new Line2(geo, lineMat());
  line.frustumCulled = false;
  line.renderOrder = 1;
  return line;
}

// ── Arc math ──────────────────────────────────────────────────────────────────

// Positions for an arc from aStart sweeping aSweep radians at radius and y.
export function arcPositions(radius, y, aStart, aSweep) {
  const pos = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = aStart + (aSweep * i) / SEGMENTS;
    pos.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  return pos;
}

// Returns true if theta falls within [aStart, aStart + aSweep].
export function angleInSector(theta, aStart, aSweep) {
  const t = ((theta - aStart) % TWO_PI + TWO_PI) % TWO_PI;
  return t <= aSweep;
}

// ── Three.js angle-convention converters ──────────────────────────────────────
//
// This codebase uses the standard math convention: x = cos(θ), z = sin(θ).
//
// Three.js CylinderGeometry uses: x = sin(θ), z = cos(θ).
//   → theta_cyl = π/2 − myAngle
//   → sector [start, start+sweep] maps to thetaStart = π/2 − start − sweep.
//
// Three.js RingGeometry uses x = cos(θ), y = sin(θ) in XY.
//   After rotateX(−π/2): x = cos(θ), z = −sin(θ).
//   → theta_ring = −myAngle
//   → sector [start, start+sweep] maps to thetaStart = −(start + sweep).

export function threeArcStart(myStart, mySweep) {
  return Math.PI / 2 - myStart - mySweep;
}

export function ringArcStart(myStart, mySweep) {
  return -(myStart + mySweep);
}

// ── Silhouette math ───────────────────────────────────────────────────────────
//
// Tangency condition: cx·cosθ + cz·sinθ = R
// → θ = φ ± arccos(R/d),  where φ = atan2(cz,cx),  d = ||(cx,cz)||

export function silhouetteAngles(radius, camera) {
  const cx = camera.position.x;
  const cz = camera.position.z;
  const d  = Math.hypot(cx, cz);
  if (d <= radius) return null;
  return { phi: Math.atan2(cz, cx), halfAngle: Math.acos(radius / d) };
}

// ── Wall mesh factories ───────────────────────────────────────────────────────

// Flat triangular wall mesh for a solid-cylinder sector cut face.
export function makeSectorWall(radius, height, angle) {
  const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
  const y0 = -height / 2, y1 = height / 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, y0, 0,   x, y0, z,   x, y1, z,
    0, y0, 0,   x, y1, z,   0, y1, 0,
  ]), 3));
  return new THREE.Mesh(geo, surfaceMat({ side: THREE.DoubleSide }));
}

// Flat rectangular wall mesh for a pipe sector cut face (inner→outer strip).
export function makePipeWall(outerRadius, innerRadius, height, angle) {
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
