# Amendment 01 — Visual Language & Geometry Simplification

## Purpose

This amendment supersedes portions of the original MVP specification relating to rendering style and geometric representation.

The goal is to move away from a holographic "JARVIS" aesthetic toward a clean technical illustration style inspired by the anime.js homepage. The visualization should resemble an exploded engineering drawing rather than a science-fiction HUD.

---

# 1. Visual Language

## Replace Blueprint Style

The previous blueprint specification should be considered obsolete.

The visualization **must not** resemble:

- JARVIS interfaces
- holograms
- volumetric glow
- emissive neon rendering
- transparent blue cylinders
- bloom-heavy rendering

Instead, the renderer should emulate a technical CAD illustration similar to the anime.js landing page.

The desired characteristics are:

- clean line work
- extremely thin outlines
- flat shading
- minimal color palette
- no visual noise
- emphasis on geometry rather than lighting

The scene should feel like an interactive engineering drawing.

---

# 2. Material Guidelines

## Surfaces

Surfaces should be nearly invisible.

Surfaces exist only to provide shape.

Avoid obvious transparency effects.

Recommended:

- neutral matte material
- low opacity (10–20%) if transparency is required
- otherwise fully opaque with subtle lighting

The surface should never compete with the outlines.

---

## Edges

Edges become the primary visual language.

Requirements:

- thin
- crisp
- constant width
- monochrome

Avoid:

- bloom
- glow
- emissive materials
- additive blending
- halos

Geometry should remain readable through line definition alone.

---

## Lighting

Lighting should be extremely subtle.

The scene should resemble a CAD viewport.

Requirements:

- AmbientLight
- one DirectionalLight

Avoid:

- HDR environments
- reflections
- physically based materials
- dramatic shadows

---

## Background

Replace the dark blueprint background with a neutral technical background.

Recommended palette:

```
#E8E5DF
```

or

```
#F2F1EE
```

The scene should resemble technical paper rather than a futuristic display.

---

# 3. Sector Definition

The previous implementation omitted sectors.

This is incorrect.

Sectors are a first-class navigation concept and must be explicitly represented.

---

## Definition

Each IP Floor is divided into angular sectors.

Each sector represents one top-level branch of the network hierarchy.

The hierarchy becomes:

```
Floor

↓

Sector

↓

Super Spine

↓

Spine

↓

Leaf

↓

Rack

↓

Machine
```

The sector determines the angular coordinate for every descendant object.

---

## Rendering

Render visible radial divider lines.

Each divider:

- begins at the cylinder center
- extends to the outer shell
- is rendered using the same line style as shell outlines

Dividers should remain visible at all zoom levels.

---

## Labels

Each sector must have a visible identifier.

Example naming:

```
Sector A
Sector B
Sector C
```

or

```
S01
S02
S03
```

The labels should be positioned outside the Machine Shell.

They should remain upright regardless of camera rotation.

Implementation options:

- CSS2DRenderer
- Sprite labels
- Billboard text

The label implementation should be replaceable later.

---

# 4. Shell Rendering

Shells should appear as construction guides rather than solid objects.

Each shell consists of:

- outer circular outline
- inner circular outline
- optional vertical guide surface

The shell itself should never dominate the scene.

Reduce shell opacity significantly compared to the previous implementation.

---

# 5. Rack Representation

The current rack implementation is overly literal.

Do not model physical cabinets.

Remove:

- cabinet geometry
- doors
- frame thickness
- rack bodies

Instead, the Rack Shell represents the cabinet location.

The rack itself should be implied.

---

# 6. Server Representation

Servers should become the visible representation instead of racks.

Each server is rendered as a shallow rectangular protrusion directly attached to the outer surface of the Rack Shell.

Servers should not exist inside a cabinet mesh.

Each protrusion should:

- extend outward slightly
- maintain constant dimensions
- remain flush with the shell
- align tangentially to the cylinder

The visual appearance should resemble engraved or mounted modules on a cylindrical surface.

---

## Layout

Servers remain arranged in two columns.

Example:

```
□ □

□ □

□ □

□ □
```

Spacing should emulate rack units.

The protrusions themselves communicate rack occupancy.

No additional cabinet geometry is necessary.

---

# 7. Geometry Simplification

Reduce geometric complexity wherever possible.

Replace complex meshes with primitive geometry.

Preferred primitives:

- cylinders
- boxes
- lines

Avoid decorative bevels or mechanical detail.

The visualization should communicate topology rather than realism.

---

# 8. Backface Rendering

The previous implementation renders interior faces of shells.

This is incorrect.

The visualization should behave like a technical illustration.

Only exterior faces should be visible.

---

## Material Configuration

All shell materials should use:

```javascript
material.side = THREE.FrontSide;
```

Avoid:

```javascript
THREE.DoubleSide
```

unless absolutely required.

---

## Geometry

Normals should point outward.

Interior faces should not be visible through transparent geometry.

The cylinder should feel hollow rather than volumetric.

---

# 9. Outline Priority

Rendering priority should become:

1. outlines
2. labels
3. server protrusions
4. shell surfaces

The eye should naturally follow the construction lines first.

---

# 10. Animation

The rendering style should extend to animation.

Avoid:

- flashy transitions
- glow pulses
- holographic effects

Instead use:

- smooth easing
- mechanical motion
- camera drift
- subtle interpolation

Animations should feel like manipulating a CAD model.

---

# Acceptance Criteria

This amendment is considered implemented when:

- The visualization matches the clean technical illustration aesthetic of the anime.js reference rather than a holographic blueprint.
- Glow, bloom, emissive materials, and strong transparency have been removed.
- Every floor is explicitly divided into labeled sectors with visible radial divider lines.
- Sector labels are rendered outside the Machine Shell and remain legible during camera movement.
- Physical rack cabinets are no longer modeled.
- Servers are represented exclusively as shallow protrusions mounted directly on the Rack Shell surface in a two-column arrangement.
- Geometry has been simplified to basic primitives with outlines carrying the majority of the visual information.
- Only outward-facing surfaces are rendered; interior/backfaces are not visible.
- The resulting scene resembles an interactive engineering illustration rather than a science-fiction control interface.