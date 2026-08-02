---
name: parry2d-smashy
description: parry2d 0.29 capability reference from the smashy engine's viewpoint (rollback-deterministic 2D platform fighter, f32, glam Vec2 at the boundary). Trigger on "parry2d", "cast_shapes", "ShapeCastOptions", "shape cast TOI", "GJK/EPA precision", "QueryDispatcher", "Compound shape", "convex decomposition", "Isometry vs Pose", "parry determinism", or when editing crates/world/src/geo.rs or any parry-facing collision code.
metadata:
  type: reference
---

# parry2d 0.29 for smashy

Research date: 2026-07-11. Ground truth: vendored source at
`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/parry2d-0.29.0/` (paths below are relative
to that root unless absolute), plus smashy's own usage in
`/Users/chrishafley/projects/smashy/crates/world/src/geo.rs` and
`/Users/chrishafley/projects/smashy/crates/physics/src/sweep.rs`.
Repo: github.com/dimforge/parry. Docs: docs.rs/parry2d/0.29.0.

## TL;DR

- **0.29 dropped nalgebra for glam.** The math layer is the `glamx` 0.3 crate: `Pose2`/`Rot2`/`Vec2`
  re-exported as `parry2d::math::{Pose, Rotation, Vector}` (`src/math/mod.rs:26-40`). There is no
  `Isometry2` in this version; any doc/tutorial mentioning nalgebra types is stale (pre-0.29).
- Smashy's `geo.rs` converts `glam::Vec2 -> parry2d::math::Vector` (which IS a glam `Vec2` under
  f32) — the conversion is now nominal, and `Iso{pos,rot}` maps to `Pose::from_parts(v, Rot2::from_angle(rot))`.
- **Cuboid-vs-cuboid `contact` has NO specialized path**: the specialization exists in source
  (`src/query/contact/contact_cuboid_cuboid.rs`) but is **commented out of the dispatcher**, so
  box-box contacts go through GJK + EPA like everything else. Same for cuboid-cuboid
  `closest_points`.
- GJK tolerance: `10 * f32::EPSILON ≈ 1.19e-6` (`src/query/gjk/gjk.rs:141-144`). EPA tolerance:
  `100 * f32::EPSILON`, 100-iteration cap (`src/query/epa/epa2.rs:353-354,553`).
- `cast_shapes` with default `ShapeCastOptions` returns `time_of_impact = 0` with status
  `PenetratingOrWithinTargetDist` when already touching; `stop_at_penetration: false` lets a
  penetrating-but-separating pair slide (returns `None` when `normal_vel >= 0`,
  `src/query/shape_cast/shape_cast_support_map_support_map.rs:45`).
- Determinism: parry's default glamx features are `["nostd-libm","i32"]` (`Cargo.toml:279-285`),
  meaning libm only on no_std targets; the `enhanced-determinism` feature (`Cargo.toml:77-81`)
  forces `simba/libm_force` + `glamx/libm` everywhere. geo.rs's header comment claims defaults
  already route through libm — the 0.29 Cargo graph says that guarantee comes from `nostd-libm`
  on wasm plus std math on native, so re-verify the det-lib-spike claim before relying on it.

## Math types and conventions

| parry alias (`src/math/mod.rs`) | concrete (f32/dim2) | notes |
|---|---|---|
| `Real` | `f32` | `f64` feature swaps to f64 |
| `Vector` | `glamx::Vec2` (= glam Vec2) | direct re-export |
| `Pose` | `glamx::Pose2` | translation + `Rot2` |
| `Rotation` / `Rot2` | unit complex `{re: cos, im: sin}` | `glamx-0.3.0/src/rot2.rs:11-33` |
| `DEFAULT_EPSILON` | `f32::EPSILON` | `src/math/mod.rs:43` |

- `Rot2` stores (cos, sin), built via `Rot2::from_angle` which calls `simba::ComplexField::sin_cos`
  (`glamx-0.3.0/src/rot2.rs:55`). This is the transcendental that decides cross-platform identity:
  std `sin_cos` on native by default, libm under `enhanced-determinism` or on no_std.
- Conversion hazards for smashy: (1) `Iso.rot == 0.0` fast path in geo.rs (`to_pose`,
  geo.rs:83-89) avoids `sin_cos` entirely — keep it, it removes the transcendental from
  axis-aligned queries; (2) geo.rs's own `Iso::apply` uses `f32::sin_cos` (std) while parry's
  `Rot2::from_angle` uses simba's — two different sin_cos implementations can disagree in the
  last ulp on the same angle, so never mix `Iso::apply` output with parry witness points in a
  bit-equality check; (3) angle convention is standard CCW radians in both.
- Relative-pose pattern used throughout parry: `pos12 = pos1.inv_mul(pos2)`; queries run in
  shape 1's local frame, results (witness points, normals) are **local to each shape**
  (`src/query/shape_cast/shape_cast.rs:281-283`).

## Shape zoo (dim2, f32)

`ShapeType` enum, `src/shape/shape.rs:32-77`:

| Shape | 2D? | SupportMap? | smashy relevance |
|---|---|---|---|
| `Ball` | yes | yes | `Shape::Ball` in geo.rs |
| `Cuboid` | yes | yes | `Shape::Cuboid`, Body boxes |
| `Capsule` | yes | yes | struct = `{segment: Segment, radius: Real}` (`src/shape/capsule.rs:71-82`) |
| `Segment` | yes | yes | endpoints in shape-LOCAL frame (geo.rs convention too) |
| `Triangle` | yes | yes | building block for meshes |
| `ConvexPolygon` | 2D-only | yes | `from_convex_hull(&[Vector])`, `from_convex_polyline` (`src/shape/convex_polygon.rs:105-140`) |
| `Polyline` | yes | no (composite) | open/closed chains of segments; good for stage outlines |
| `TriMesh` | yes | no (composite) | 2D "trimesh" = triangle soup |
| `Compound` | yes | no (composite) | `Vec<(Pose, SharedShape)>` + BVH |
| `HalfSpace` | yes | special-cased | infinite plane; has dedicated dispatcher arms |
| `HeightField` | yes | no | 1D height array in 2D |
| `Voxels` | yes | no | new-ish voxel grid shape; has dedicated cast/intersect paths |
| `RoundCuboid`, `RoundTriangle` | yes | yes | `RoundShape<S>` = shape + border radius |
| `ConvexPolyhedron`, `Cylinder`, `Cone`, `RoundCylinder/Cone/ConvexPolyhedron` | **3D-only ghosts** | — | `#[cfg(feature = "dim3")]` in shared source (`src/shape/shape.rs:57-77`); files like `cone.rs`, `cylinder.rs`, `tetrahedron.rs`, `heightfield3.rs` sit in the 2D crate's src tree but do not compile into parry2d |

`SharedShape` (`src/shape/shared_shape.rs`) is the `Arc<dyn Shape>` wrapper with constructors for
all of the above plus `convex_decomposition` / `convex_hull` (see path compilation below).

## Query inventory (`src/query/mod.rs:28-48`)

All free functions take world-space `&Pose` per shape and `&dyn Shape`; all return
`Result<_, Unsupported>` because dispatch can fail on exotic pairs.

| Function | Signature (f32/dim2) | Returns |
|---|---|---|
| `intersection_test` | `(&Pose, &dyn Shape, &Pose, &dyn Shape) -> Result<bool, Unsupported>` | boolean overlap |
| `distance` | `(&Pose, &dyn Shape, &Pose, &dyn Shape) -> Result<Real, Unsupported>` | 0.0 when overlapping (no penetration depth) |
| `contact` | `(&Pose, &dyn Shape, &Pose, &dyn Shape, prediction: Real) -> Result<Option<Contact>, Unsupported>` | `Contact{point1, point2, normal1, normal2, dist}`; `dist < 0` = penetration depth; `None` when separated by more than `prediction` |
| `closest_points` | `(... , max_dist: Real) -> Result<ClosestPoints, Unsupported>` | enum `Intersecting` / `WithinMargin(p1, p2)` / `Disjoint` |
| `cast_shapes` | `(&Pose, Vector, &dyn Shape, &Pose, Vector, &dyn Shape, ShapeCastOptions) -> Result<Option<ShapeCastHit>, Unsupported>` | linear-motion TOI (`src/query/shape_cast/shape_cast.rs:272-284`) |
| `cast_shapes_nonlinear` | takes `NonlinearRigidMotion` per shape | TOI with rotation during the cast |
| ray | trait `RayCast`: `cast_ray`, `cast_ray_and_get_normal`, `cast_local_ray(...) -> Option<Real>` with `solid: bool` (`src/query/ray/ray.rs:357-383`) | `RayIntersection{time_of_impact, normal, feature}` |
| point | trait `PointQuery`: `project_point(&Pose, Vector, solid) -> PointProjection`, `distance_to_local_point`, `contains_local_point`, `project_point_and_get_feature` (`src/query/point/point_query.rs:214-251`) | `PointProjection{is_inside, point}` |

Smashy currently uses `intersection_test`, `distance`, `contact` via `NaiveGeom` (geo.rs:121-154)
and treats `Err(Unsupported)` as false/`f32::MAX`/`None` — safe for its 4-shape zoo, all of which
are SupportMap so `Unsupported` cannot actually occur pairwise.

### `contact` prediction semantics

`contact_support_map_support_map` runs GJK `closest_points` with the prediction as the margin;
when GJK reports penetration it falls back to a fresh `EPA::new()` for depth + normal
(`src/query/contact/contact_support_map_support_map.rs:60-67`). So:
- separated by `<= prediction`: contact from GJK path (accurate to `eps_tol`)
- penetrating: contact from EPA path (accurate to `100*EPSILON`-ish, can pick the wrong face on
  near-square overlaps — comment at `contact_support_map_support_map.rs:83` acknowledges FaceId
  tolerance handling for exactly this)

## Shape casting / TOI

`ShapeCastOptions` (`src/query/shape_cast/shape_cast.rs:206-244`), defaults:
`max_time_of_impact: Real::MAX`, `target_distance: 0.0`, `stop_at_penetration: true`,
`compute_impact_geometry_on_penetration: true`.

`ShapeCastStatus` (`shape_cast.rs:10-31`): `Converged`, `OutOfIterations` (conservative — usually
usable), `Failed` (numerical trouble — still conservative), `PenetratingOrWithinTargetDist`.

t=0 edge cases (support-map path, `shape_cast_support_map_support_map.rs:21-66`):
- Uses `gjk::directional_distance`. If `target_distance > 0`, shape 1 is wrapped in a
  `RoundShape{border_radius: target_distance}` on the fly (lines 21-28) — a skin-radius cast.
- Already penetrating/within target distance: with `stop_at_penetration: true` you get
  `Some(hit)` with `time_of_impact == 0` and status `PenetratingOrWithinTargetDist`; witness
  points/normals are only reliable if `compute_impact_geometry_on_penetration` (default true).
- `stop_at_penetration: false` + separating relative velocity (`normal_vel >= 0` at t=0):
  returns `None` (line 45). This is the "let overlapping bodies slide apart" mode a fighter's
  depenetration wants.
- Witness compensation for skin casts: `witness1 - normal1 * target_distance` (line 62).

For rollback use: `cast_shapes` is iterative (GJK-based conservative advancement), so
`OutOfIterations`/`Failed` are reachable states you must handle deterministically — the same
inputs give the same status on every machine, but treat the hit as a hit rather than retrying.

## QueryDispatcher and fallback order

`DefaultQueryDispatcher` (`src/query/default_query_dispatcher.rs`), per-query arm order:

1. `Ball` + `Ball` — closed-form (`intersection_test` line 183-185, similarly distance/contact/cast).
2. `HalfSpace` + SupportMap (either order) — plane clip.
3. `contact` only: `Ball` + `ConvexPolyhedron`-family specializations (lines ~330-340 region).
4. `closest_points` only: `Segment`+`Segment`, `Triangle`+`Cuboid` specializations; the
   `Cuboid`+`Cuboid` and `Cuboid`+`Triangle` arms are **commented out** in 0.29.
5. SupportMap + SupportMap — **GJK** (+ **EPA** when penetrating, contact only). This is the path
   every smashy pair except ball-ball actually takes.
6. Composite (Compound/Polyline/TriMesh via `as_composite_shape`) — BVH traversal, recursing into
   sub-shape dispatch per leaf.
7. `Voxels` arms, then `Err(Unsupported)`.

Precision consequence: only ball-ball is closed-form for smashy. Cuboid-cuboid, cuboid-capsule,
segment-anything all resolve through GJK (`eps_tol = 10*f32::EPSILON`, 100-iteration cap,
`src/query/gjk/gjk.rs:141-144, 451`) and, when overlapping, EPA (`_eps_tol = 100*f32::EPSILON`,
100 iterations, `src/query/epa/epa2.rs:353-354, 553`). Expect contact normals on deep box-box
overlap to be EPA-face-selection dependent; near-corner cases can flip between the x and y face
between frames. If a fighter mechanic needs a stable box-box normal, derive it from AABB overlap
arithmetic yourself (which is what `crates/physics/src/sweep.rs` already does — its clamp solve is
hand-written plane projection; rapier/parry only produce the candidate mask).

`QueryDispatcherChain` lets you prepend custom pair handlers before the default
(`src/query/query_dispatcher.rs`); `PersistentQueryDispatcher` adds contact-manifold queries
(what rapier uses).

## Compound shapes and the BVH

- 0.29 renamed `Qbvh` to `Bvh` (`src/partitioning/bvh/`). `Compound::new(Vec<(Pose, SharedShape)>)`
  builds one with `Bvh::from_iter(BvhBuildStrategy::Binned, leaves)`
  (`src/shape/compound.rs:113,136`); access via `compound.bvh()` (compound.rs:661).
- Compound construction PANICS if any part is itself composite (no nested compounds) — flatten
  authored geometry to one level.
- Compounds are not SupportMap, so every query against one is a BVH traversal + per-leaf dispatch.
  Deterministic (traversal order is data-dependent only), but cost is O(log n) per leaf visited.
- For static stage geometry, a `Compound` of `ConvexPolygon`/`Cuboid` parts is the intended shape;
  `Polyline` is the thin-wall alternative (no interior, so no depenetration direction — a fighter
  floor should be a solid shape rather than a polyline if you ever query penetration depth).

## Compiling authored paths to primitives

Pipeline options in `src/transformation/` and `SharedShape` constructors:

| Tool | Where | Use |
|---|---|---|
| `transformation::convex_hull(&[Vec2]) -> Vec<Vec2>` | `convex_hull2.rs` | hull of a point cloud |
| `ConvexPolygon::from_convex_hull / from_convex_polyline` | `convex_polygon.rs:105-140` | returns `Option` — degenerate input gives `None`, handle it |
| `transformation::ear_clipping` | `ear_clipping.rs` | simple polygon -> triangles |
| `transformation::hertel_mehlhorn(...)` | `hertel_mehlhorn.rs`, exported at `transformation/mod.rs:40` | triangles -> few convex polygons (good default for authored outlines) |
| `SharedShape::convex_decomposition(vertices, indices)` | `shared_shape.rs:500` | VHACD; in 2D `indices: &[[u32; 2]]` (polyline edges), returns a `Compound` of convex parts |
| `SharedShape::convex_decomposition_with_params(..., &VHACDParameters)` | `shared_shape.rs:521` | tunable (resolution, concavity) |
| `transformation::polygon_intersection` | `polygon_intersection.rs` | boolean ops on polygons |

Recommended for smashy's authored paths: close the path, ear-clip, hertel_mehlhorn, then emit
`ConvexPolygon` parts into a `Compound` (or convert axis-aligned rectangles to `Cuboid`).
VHACD is approximate and parameter-sensitive — save it for messy organic outlines. All of these
run float algorithms: run them at CONTENT-COMPILE time, ship the resulting vertex lists, never
decompose at runtime inside the rollback sim.

## Feature flags (Cargo.toml of the vendored crate)

| Feature | Contents | smashy stance |
|---|---|---|
| default | `required-features`(=`dim2`,`f32`) + `std` + `spade` | what smashy uses (world/Cargo.toml pins `parry2d = "0.29"` with defaults; comment forbids `default-features=false`) |
| `enhanced-determinism` | `simba/libm_force`, `indexmap`, `glamx/libm` (`Cargo.toml:77-81`) | forces libm transcendentals on ALL targets; rapier2d 0.34 in crates/physics already enables its own `enhanced-determinism` |
| `f64` | f64 `Real` | off |
| `simd-stable` / `simd-nightly` | `simba/wide` / portable_simd + `simd-is-enabled` | keep OFF for rollback: SIMD lane math changes float results vs scalar |
| `parallel` | rayon in BVH ops | off; nondeterministic reduction orders are not worth it in-sim |
| `spade` | Delaunay (2D triangulation dep) | on by default, needed by some transformation paths |

Determinism watch-item: parry2d's glamx dep is `default-features=false, features=["nostd-libm","i32"]`
(`Cargo.toml:279-285`); `nostd-libm` = `simba/libm` + `glam/nostd-libm` (glamx Cargo.toml:95-98),
i.e. libm only where std is absent (wasm). Native release uses std transcendentals unless
`enhanced-determinism` is on. geo.rs:7-10 asserts defaults already give bit-identity per
labs/det-lib-spike/FINDINGS.md; that held empirically for the spiked ops, but the Cargo graph does
not force it — if a rotated-query divergence ever appears native-vs-wasm, turning on parry2d's
`enhanced-determinism` is the fix (rapier2d already does this transitively for ITS parry copy;
world's direct parry2d dep is a separate feature resolution).

## How smashy uses it today

- `crates/world/src/geo.rs`: `Geometry` trait (intersection_test/distance/contact) over 4 shapes
  (Ball/Cuboid/Segment/Capsule), `NaiveGeom` delegates to `parry2d::query` free functions with a
  `ParryHolder` enum + macro instead of `&dyn Shape` in smashy source. `contact` errors and `None`
  collapse to `None`; `distance` error collapses to `f32::MAX`.
- `crates/physics/src/sweep.rs`: does NOT call parry directly — rapier2d 0.34
  (`enhanced-determinism`) `CollisionPipeline` over sensor cuboids produces a candidate mask;
  the actual clamp solve is hand-written axis-separated AABB arithmetic with
  `CONTACT_EPSILON = 0.001` (sweep.rs:28). parry's `cast_shapes` is available but unused there;
  if the solve ever moves to true swept TOI, `cast_shapes` with
  `stop_at_penetration: false` + `target_distance: CONTACT_EPSILON` is the drop-in.
- godot-shell's v1 sim carries its own private parry2d 0.29 dep (godot-shell/Cargo.toml:21).

## Sharp edges checklist

1. `distance` returns 0.0 inside overlap — pair it with `contact` when depth matters.
2. `contact` with `prediction = f32::MAX` (as geo.rs tests do) makes GJK's margin infinite; fine
   for two convex shapes, but against composites it visits every BVH leaf. Pass a real prediction.
3. EPA normal instability on near-square deep overlaps (see dispatcher section).
4. `ShapeCastHit` witness/normal fields are LOCAL to each shape; transform with
   `hit.transform1_by(&pos1)` (`shape_cast.rs:83-95`) before world-space use.
5. `Capsule::new(a, b, r)` endpoints are local, like `Segment` — geo.rs already documents this
   (geo.rs:40-41); do not pre-add the Iso translation.
6. Ray `solid: bool`: `solid=true` returns t=0 for origins inside the shape; `solid=false`
   returns the exit-boundary hit. Pick per mechanic (projectile spawn-inside rules).
7. `ConvexPolygon::from_convex_hull` returns `None` on degenerate/collinear input — authored-path
   compiler must reject, not unwrap.
8. Version skew: pre-0.29 code/docs use `Isometry2`, `na::`, `Qbvh` — all gone. `Pose`, glam
   types, `Bvh` are the 0.29 names.
