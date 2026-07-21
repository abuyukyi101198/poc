import * as THREE from 'three';
import anime from 'animejs';
import { createScene } from './scene.js';
import { buildCylinder, updateCylinder, buildPipe, updatePipe, rightSilhouetteAnchor } from './blueprint.js';

// ── Setup ────────────────────────────────────────────────────────────────────

const container = document.getElementById('canvas-container');
const { renderer, scene, camera, controls } = createScene(container);

// Build cylinders and pipes here
const cylinders = [
  buildCylinder(scene, { radius: 1.5, height: 3.5, angleStart: 0, angleSweep: Math.PI * 1.5 }),
];

const pipes = [
  buildPipe(scene, { outerRadius: 2.5, innerRadius: 1.8, height: 2.0, angleStart: Math.PI * 0.25, angleSweep: Math.PI }),
];

// Collect all LineMaterials across every object for resize updates
const allLineMaterials = [
  ...cylinders.flatMap(c => c.lineMaterials),
  ...pipes.flatMap(p => p.lineMaterials),
];

// ── SVG leader line (anchored to first cylinder) ──────────────────────────────

const svgEl      = document.getElementById('annotations');
const leaderPath = document.getElementById('leader-path');
const leaderDot  = document.getElementById('leader-dot');
const leaderText = document.getElementById('leader-text');

function projectToScreen(v3) {
  const v = v3.clone().project(camera);
  return {
    x: (v.x *  0.5 + 0.5) * window.innerWidth,
    y: (v.y * -0.5 + 0.5) * window.innerHeight,
  };
}

function placeLeader() {
  const anchor = rightSilhouetteAnchor(cylinders[0], camera);
  const s = projectToScreen(anchor);

  const diagX = 60, diagY = 45, shoulder = 50;
  const ex = s.x + diagX;
  const ey = s.y - diagY;
  const lx = ex + shoulder;

  leaderDot.setAttribute('cx', s.x);
  leaderDot.setAttribute('cy', s.y);
  leaderPath.setAttribute('d', `M ${s.x} ${s.y} L ${ex} ${ey} L ${lx} ${ey}`);
  leaderText.setAttribute('x', lx + 6);
  leaderText.setAttribute('y', ey + 4);
}

window.addEventListener('resize', () => {
  allLineMaterials.forEach(m => m.resolution.set(window.innerWidth, window.innerHeight));
  placeLeader();
});

// ── Entrance animation ────────────────────────────────────────────────────────

const tl = anime.timeline({ easing: 'easeInOutCubic' });

cylinders.forEach((cyl, ci) => {
  const base = ci * 200;

  cyl.meshes.forEach(m => {
    tl.add({
      targets: m.material,
      opacity: [0, 1],
      duration: 600,
      update: () => { m.material.needsUpdate = true; },
    }, base);
  });

  cyl.lines.forEach((line, i) => {
    tl.add({
      targets: line.material,
      opacity: [0, 1],
      duration: 500,
      update: () => { line.material.needsUpdate = true; },
    }, base + 400 + i * 110);
  });
});

pipes.forEach((pipe, pi) => {
  const base = (cylinders.length + pi) * 200;

  pipe.meshes.forEach(m => {
    tl.add({
      targets: m.material,
      opacity: [0, 1],
      duration: 600,
      update: () => { m.material.needsUpdate = true; },
    }, base);
  });

  pipe.lines.forEach((line, i) => {
    tl.add({
      targets: line.material,
      opacity: [0, 1],
      duration: 500,
      update: () => { line.material.needsUpdate = true; },
    }, base + 400 + i * 110);
  });
});

tl.add({
  targets: svgEl,
  opacity: [0, 1],
  duration: 400,
  complete: placeLeader,
}, tl.duration + 100);

// ── Render loop ───────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  cylinders.forEach(cyl  => updateCylinder(cyl,  camera));
  pipes.forEach(pipe     => updatePipe(pipe,      camera));
  renderer.render(scene, camera);
}

animate();
