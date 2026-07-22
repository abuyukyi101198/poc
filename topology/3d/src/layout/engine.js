import { buildCylinder, updateCylinder } from '../components/cylinder.js';
import { buildPipe, updatePipe }         from '../components/pipe.js';
import { buildMachineSlot }              from '../components/machineSlot.js';
import { makeStaticLine }                from '../components/shared.js';
import { allocateAngles }                from './allocator.js';
import { LEVELS, MACHINE_PROTRUSION }   from './constants.js';

// ── Public API ────────────────────────────────────────────────────────────────
//
// generateScene(scene, data) → {
//   superSpines,       // buildCylinder results  (innermost ring)
//   spines,            // buildPipe results
//   leaves,            // buildPipe results
//   racks,             // buildPipe results      (outermost ring)
//   dividers,          // Line2[]  — radial sector-boundary lines
//   allLineMaterials,  // LineMaterial[]  — for resolution updates on resize
//   updateAll(camera), // call every frame to refresh silhouette + arc lines
// }

export function generateScene(scene, data) {
  const { heights } = allocateAngles(data);

  const superSpines      = [];
  const spines           = [];
  const leaves           = [];
  const racks            = [];
  const machines         = [];
  const dividers         = [];
  const allLineMaterials = [];

  const reg = (obj, arr) => {
    arr.push(obj);
    allLineMaterials.push(...obj.lineMaterials);
  };

  // Radial sector-divider lines at each sector boundary (center → outer edge).
  for (const sector of data.sectors) {
    const line = makeDividerLine(scene, sector._angleStart);
    dividers.push(line);
    allLineMaterials.push(line.material);
  }

  // Build geometry level by level, walking the hierarchy tree.
  for (const sector of data.sectors) {
    for (const ss of sector.superSpines ?? []) {

      reg(buildCylinder(scene, {
        radius:     LEVELS.SUPER_SPINE.radius,
        height:     heights.ss,
        angleStart: ss._angleStart,
        angleSweep: ss._angleSweep,
      }), superSpines);

      for (const spine of ss.spines ?? []) {

        reg(buildPipe(scene, {
          outerRadius: LEVELS.SPINE.outerRadius,
          innerRadius: LEVELS.SPINE.innerRadius,
          height:      heights.spine,
          angleStart:  spine._angleStart,
          angleSweep:  spine._angleSweep,
        }), spines);

        for (const leaf of spine.leaves ?? []) {

          reg(buildPipe(scene, {
            outerRadius: LEVELS.LEAF.outerRadius,
            innerRadius: LEVELS.LEAF.innerRadius,
            height:      heights.leaf,
            angleStart:  leaf._angleStart,
            angleSweep:  leaf._angleSweep,
          }), leaves);

          for (const rack of leaf.racks ?? []) {

            reg(buildPipe(scene, {
              outerRadius: LEVELS.RACK.outerRadius,
              innerRadius: LEVELS.RACK.innerRadius,
              height:      heights.rack,
              angleStart:  rack._angleStart,
              angleSweep:  rack._angleSweep,
              yOffset:     rack._yOffset,
            }), racks);

            const machOuter = LEVELS.RACK.outerRadius + MACHINE_PROTRUSION;
            const machInner = LEVELS.RACK.outerRadius;
            for (const machine of rack.machines ?? []) {
              reg(buildMachineSlot(scene, {
                outerRadius: machOuter,
                innerRadius: machInner,
                height:      machine._height,
                angleStart:  machine._angleStart,
                angleSweep:  machine._angleSweep,
                yOffset:     machine._yOffset,
              }), machines);
            }
          }
        }
      }
    }
  }

  function updateAll(camera) {
    superSpines.forEach(c => updateCylinder(c, camera));
    [...spines, ...leaves, ...racks].forEach(p => updatePipe(p, camera));
  }

  return { superSpines, spines, leaves, racks, machines, dividers, allLineMaterials, updateAll };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDividerLine(scene, angle) {
  const r    = LEVELS.RACK.outerRadius;
  const x    = Math.cos(angle) * r;
  const z    = Math.sin(angle) * r;
  const line = makeStaticLine([0, 0, 0,  x, 0, z]);
  scene.add(line);
  return line;
}
