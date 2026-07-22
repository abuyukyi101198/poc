import anime from 'animejs';
import { createScene }            from './scene.js';
import { rightSilhouetteAnchor }  from './blueprint.js';
import { generateScene }          from './layout/engine.js';
import { topologyData }           from './data/topology.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

const container = document.getElementById('canvas-container');
const { renderer, scene, camera, controls } = createScene(container);

// ── Generate topology scene ───────────────────────────────────────────────────

const { superSpines, spines, leaves, racks, machines, dividers, allLineMaterials, updateAll } =
  generateScene(scene, topologyData);

// ── SVG leader line (anchored to first super-spine) ───────────────────────────

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
  const anchor = rightSilhouetteAnchor(superSpines[0], camera);
  const s      = projectToScreen(anchor);
  const diagX  = 60, diagY = 45, shoulder = 50;
  const ex = s.x + diagX, ey = s.y - diagY, lx = ex + shoulder;
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
//
// Animates each hierarchy level as a unit rather than per-object to keep the
// timeline concise. Each level fades in 300 ms after the previous one.

const tl = anime.timeline({ easing: 'easeInOutCubic' });

function animateLevel(objects, t) {
  const meshMats = objects.flatMap(o => o.meshes.map(m => m.material));
  const lineMats = objects.flatMap(o => o.lines.map(l => l.material));

  if (meshMats.length) {
    tl.add({
      targets: meshMats, opacity: [0, 1], duration: 600,
      update: () => meshMats.forEach(m => { m.needsUpdate = true; }),
    }, t);
  }
  if (lineMats.length) {
    tl.add({
      targets: lineMats, opacity: [0, 1], duration: 500,
      update: () => lineMats.forEach(m => { m.needsUpdate = true; }),
    }, t + 400);
  }
}

animateLevel(superSpines, 0);
animateLevel(spines,      300);
animateLevel(leaves,      600);
animateLevel(racks,       900);
animateLevel(machines,    1200);

// Sector divider lines appear alongside super-spines.
if (dividers.length) {
  const divMats = dividers.map(l => l.material);
  tl.add({
    targets: divMats, opacity: [0, 1], duration: 500,
    update: () => divMats.forEach(m => { m.needsUpdate = true; }),
  }, 0);
}

tl.add({
  targets: svgEl, opacity: [0, 1], duration: 400,
  complete: placeLeader,
}, tl.duration + 100);

// ── Render loop ───────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateAll(camera);
  renderer.render(scene, camera);
}

animate();
