---
name: rapier2d-smashy
description: Deep capability reference for rapier2d 0.34 from the smashy engine viewpoint (rollback-deterministic 60hz platform fighter, f32, snapshot/restore every rolled-back frame, rapier currently used for broadphase+narrowphase candidates only). Covers pipelines, IntegrationParameters, body types, collider anatomy, joints, serde snapshot coverage, determinism limits, contact data, sharp edges. Load when touching rapier integration, evaluating the solver, debugging collision pairs, or designing physics snapshots. Trigger phrases: rapier, broadphase, narrow phase, QueryPipeline, IntegrationParameters, contact manifold, physics snapshot, enhanced-determinism, solver groups, one-way platform physics.
metadata:
  type: reference
---

# rapier2d-smashy

Captured 2026-07-11 from the vendored source at
`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/rapier2d-0.34.0/` (all file:line cites
below are relative to that root; parry cites relative to `parry2d-0.29.0/`). 0.34.0 is the
current crates.io release (published 2026-07-04). Companion parry: 0.29.0, nalgebra 0.35.
Crate promise: bit-identical snapshot/restore and cross-machine determinism conditional on
IEEE-754 compliance (`src/lib.rs:6-9`). Repo: github.com/dimforge/rapier. Docs: docs.rs/rapier2d/0.34.0, rapier.rs.
Smashy prior art: `docs/research/experiment-rapier-fighter.md` (adversarial harness, 2026-07-11;
solver-island experiment not yet written).

## TL;DR decisions (smashy)

- **Snapshot set** = `{RigidBodySet, ColliderSet, IslandManager, BroadPhaseBvh, NarrowPhase, ImpulseJointSet, MultibodyJointSet, IntegrationParameters}`. `PhysicsPipeline` is scratch-only by design (`src/pipeline/physics_pipeline.rs:41` comment) — re-`new()` it. `QueryPipeline` in 0.34 is a borrowed view, nothing to snapshot. `CCDSolver` is a ZST (`src/dynamics/ccd/ccd_solver.rs:80`).
- **Warmstart impulses survive snapshots.** They live in `ContactData` inside `NarrowPhase.contact_graph` (`src/geometry/contact_pair.rs:42-48`), not in the pipeline. Restored sims warmstart identically. `ContactManifoldData.solver_contacts` is serialized deliberately — dropping it would break one post-restore frame for sleeping islands (comment `contact_pair.rs:322-343`).
- **Features for rollback**: `enhanced-determinism` + `serde-serialize`, `parallel` OFF, no SIMD (SIMD + enhanced-determinism is a compile_error, `src/lib.rs:64-67`). Without enhanced-determinism the internal maps are hashbrown with fixed-seed foldhash — deterministic same-binary, not guaranteed cross-platform.
- **Fighter bodies**: dynamic + `lock_rotations()` + `set_linvel` every frame ("dynamic-with-fiat"). Kinematic bodies get `effective_inv_mass = 0` and receive no contact response (`src/dynamics/rigid_body_components.rs:464-482`), so they cannot ride the solver.
- **Hitlag freeze** = `set_linvel(zero)` AND `set_gravity_scale(0.0)`; forgetting either leaks. Even then contact softness leaves ~2e-10 positional residual against ground (see Sharp edges). Exact zero requires body-type flip to Fixed for the freeze window.
- **One-way platforms**: `PhysicsHooks::filter_contact_pair -> None` vetoes the pair; `ContactModificationContext::update_as_oneway_platform` exists (`src/pipeline/physics_hooks.rs:68`). Measured 0 bad frames in the smashy harness.
- If staying candidates-only (current smashy stance): `CollisionPipeline::step` is exactly broadphase+narrowphase with `dt=0`, no solver, no islands, no CCD.

## Pipeline zoo

| Pipeline | Steps | Mutates | Holds |
|---|---|---|---|
| `PhysicsPipeline` | full sim (below) | everything | scratch buffers only, NOT serializable (`physics_pipeline.rs:42-51`) |
| `CollisionPipeline` | broadphase + narrowphase, `dt=0`, no solve/islands/CCD (`collision_pipeline.rs:55-113,130-183`) | broad_phase, narrow_phase, change flags | 2 scratch vecs |
| `QueryPipeline<'a>` | nothing — `Copy` borrowed view | nothing | borrows of BVH/bodies/colliders/filter (`query_pipeline.rs:43-55`) |

`PhysicsPipeline::step` takes 12 args (`physics_pipeline.rs:490-504`), broad phase is `BroadPhaseBvh` (the 0.34 BVH; SAP is gone). Stage order (`:505-797`):

1. Drain joint-deferred wake-ups (ordered `Vec::drain` under enhanced-determinism, hashset otherwise — `:510-519, 556-565`).
2. Apply user changes to colliders then bodies (`src/pipeline/user_changes.rs:10-167`): parent/pos propagation, mass-prop recompute flags, enable/disable propagation to colliders and joints.
3. `detect_collisions` (`:119-186`): `broad_phase.update` → `narrow_phase.handle_user_changes` → `register_pairs` → `compute_contacts(prediction_distance(), dt, ...)` → `compute_intersections`.
4. CCD substep loop (`:618-778`): `max_ccd_substeps == 0` disables CCD outright; kinematic-position velocities interpolated from `next_position` (`:682`, `rigid_body_components.rs:147-153`); islands updated + solved per substep; `advance_to_final_positions` copies `next_position` into `position` (`:722`).
5. Gravity is applied inside the solve stage, per active body, as `force = user_force + gravity * mass * gravity_scale` (`physics_pipeline.rs:245-256`, `rigid_body_components.rs:951-954`), then integrated into velocity inside the velocity solver (`src/dynamics/solver/velocity_solver.rs:119-121,164-172`). This is why zeroing linvel alone does not survive a step during hitlag.
6. Contact-force events from `total_impulse_magnitude * inv_dt` vs threshold (`:338-363`).
7. Final world mass-props update, change flags cleared, `step_completed`.

`QueryPipeline` 0.34 API: no `update()` exists. Build per-use via
`broad_phase.as_query_pipeline(narrow_phase.query_dispatcher(), &bodies, &colliders, filter)`
(`query_pipeline.rs:135-149`; `_mut` variant `:152-166`). Methods: `cast_ray`,
`cast_ray_and_get_normal`, `intersect_ray` (iterator), `project_point`, `intersect_point`,
`intersect_aabb_conservative` (uses stored AABBs, does not recompute — `:429-431`),
`cast_shape`, `cast_shape_nonlinear`, `intersect_shape` (`:212-537`). The acceleration
structure is the broad-phase BVH itself, maintained as a side effect of pipeline stepping.
Most pre-0.34 samples do not compile (glam `Vec2` math, no `vector!` macro).

## IntegrationParameters (`src/dynamics/integration_parameters.rs`)

Struct `:168-247`, defaults `:303-328`. No stored `erp` field in 0.34 — ERP/CFM are derived
from spring coefficients.

| Field | Default | Notes |
|---|---|---|
| `dt` | 1/60 | matches smashy tick natively |
| `min_ccd_dt` | 1/6000 | min CCD substep |
| `contact_softness` | freq 30 Hz, damping 5.0 | `SpringCoefficients`; over-damped → residual penetration (below) |
| `warmstart_coefficient` | 1.0 | scales warmstart impulses |
| `length_unit` | 1.0 | your-units per meter; scales all `normalized_*` |
| `normalized_allowed_linear_error` | 0.001 | penetration slop never corrected |
| `normalized_max_corrective_velocity` | 10.0 | max depenetration speed |
| `normalized_prediction_distance` | 0.002 | predictive-contact gap (speculative contacts) |
| `num_solver_iterations` | 4 | outer TGS iterations |
| `num_internal_pgs_iterations` | 1 | inner PGS per outer |
| `num_internal_stabilization_iterations` | 1 | bias-free stabilization iters |
| `min_island_size` | 128 | bodies per island before splitting |
| `max_ccd_substeps` | 1 | 0 = CCD globally off |

All fields are plain `Copy` POD (`:169` derives incl. serde) — safe in a snapshot, no
determinism hazard from the params themselves.

**Why contacts never settle at exactly zero** (the 2e-10 smashy measured): contacts are soft
constraints. `erp(dt) = dt·ω/(dt·ω + 2ζ)` with ω = 2π·30, ζ = 5 (`:80-91`), and the impulse
update is scaled by `cfm_factor = 1/(1+cfm_coeff)` (`:117-138`, derivation in comment).
Compliance means steady state is a force balance with tiny nonzero bias, not an exact plane
snap. Tunable (raise frequency, lower damping_ratio), not eliminable. This is the documented
reason smashy declined the solver for resolution.

## Rigid body types

`RigidBodyType { Dynamic=0, Fixed=1, KinematicPositionBased=2, KinematicVelocityBased=3 }`
(`src/dynamics/rigid_body_components.rs:27-58`). Discriminants feed `ActiveCollisionTypes::test`
bit shifts.

The single mechanism: `update_world_mass_properties` zeroes `effective_inv_mass` and
`effective_world_inv_inertia` for every non-Dynamic type (`:464-482`). Impulses multiply by
effective inverse mass (`apply_impulse`, `:702-704`), gravity multiplies by effective mass
(`:951-954`) — so Fixed and both Kinematic kinds are immovable by the solver and immune to
gravity, with no solver special-casing.

| Type | Solver sees | Velocity source | Notes |
|---|---|---|---|
| Dynamic | finite mass | forces + constraints | only type the solver moves |
| Fixed | infinite mass | none | dominance group 128 (`:1147-1153`) |
| KinematicPositionBased | infinite mass | derived: `pose_err * inv_dt` from user-set `next_position` (`:147-153`) | solver never overwrites its `next_position` (`velocity_solver.rs:332-338`) |
| KinematicVelocityBased | infinite mass | user `set_linvel` | positions integrated from velocity |

- Damping (post-solve, every step): `vel *= 1/(1 + dt*damping)` (`:756-762`, applied at
  `velocity_solver.rs:328`). Default 0.
- Integration is symplectic Euler (`:934-947`, `:769-778`).
- CCD: `RigidBodyCcd` (`:971-1000`): `ccd_enabled` default false; "moving fast" threshold is
  `ccd_thickness/10` (`:1013-1040`); `soft_ccd_prediction` default 0.
- Sleep: dynamic sleeps when `|v| < 0.4·length_unit` and `|ω| < 0.5` for 2.0 s
  (`:1226-1239, 1304-1335`); kinematic only at exactly zero velocity; negative thresholds =
  never sleep. For rollback, sleeping is state — it is serialized with IslandManager, so
  restores are consistent, but consider `cannot_sleep()` on fighters to remove a whole class
  of wake-order concerns.

## Collider anatomy

- `ColliderType { Solid, Sensor }` (`src/geometry/collider_components.rs:68-80`). Sensors go
  through `compute_intersections`, produce `CollisionEvent` with `SENSOR` flag and
  `contact_pair: None` in the handler — no manifolds, no impulses.
- **ActiveCollisionTypes** default = `DYNAMIC_DYNAMIC | DYNAMIC_KINEMATIC | DYNAMIC_FIXED`
  (`collider_components.rs:339-345`). `FIXED_FIXED`, `KINEMATIC_FIXED`, `KINEMATIC_KINEMATIC`
  are all excluded by default.
- **Parentless colliders are typed Fixed for pair filtering** — contact branch
  `narrow_phase.rs:851-852` (`unwrap_or(RigidBodyType::Fixed)`), intersection branch
  `:742-751`. So two parentless colliders never collide under defaults. This is the empirical
  smashy finding, confirmed in source; fix is `ActiveCollisionTypes::all()` or attach parents.
  Same-parent collider pairs are skipped unconditionally (`:736-740`).
- **Filter order** in narrow phase (`:894-944`): active_collision_types (either collider may
  pass) → `collision_groups.test` → `FILTER_CONTACT_PAIRS` hook → `solver_groups.test`.
  Failing solver_groups still computes contacts (events fire) but strips `COMPUTE_IMPULSES`.
- `collision_groups` = "compute at all"; `solver_groups` = "feed to solver"
  (`collider_components.rs:369-372`). `InteractionGroups::test` default mode And:
  `(a.memberships & b.filter)!=0 && (b.memberships & a.filter)!=0`
  (`interaction_groups.rs:125-130`); Or mode only when both sides opt in (`:148-154`).
  Default = memberships GROUP_1, filter ALL (`:157-164`). 32 groups in a u32.
- **ActiveEvents default empty** (`event_handler.rs:33-50`) — no events unless a collider
  opts in; per-pair OR, one side is enough (`narrow_phase.rs:792`). `ActiveHooks` likewise
  default empty (`physics_hooks.rs:142-158`).
- Material: friction 1.0, restitution 0.0, combine rule Average; effective rule is
  `max(rule1, rule2)` with priority ClampedSum>Max>Multiply>Min>Average
  (`src/dynamics/coefficient_combine_rule.rs:33-73`).
- `contact_skin` default 0.0, affects solver contacts only, not raw manifold points
  (`collider.rs:60,706`; `contact_pair.rs:157`).
- Mass: `ColliderMassProps::Density(1.0)` default; only enabled, parented colliders
  contribute to the body's mass props (`rigid_body_components.rs:415-455`).

## Contact data for gameplay payloads

- Lookup: `narrow_phase.contact_pair(h1, h2)`, `contact_pairs_with(h)`, `contact_pairs()`
  (`narrow_phase.rs:142,220,264`).
- `ContactPair { collider1, collider2, manifolds: Vec<ContactManifold> }`
  (`contact_pair.rs:147-162`). Useful: `has_any_active_contact` (`:182`),
  `total_impulse()` = Σ manifold impulse × world normal (`:198-203`),
  `total_impulse_magnitude` (`:208`), `max_impulse` (`:217`),
  `find_deepest_contact` (`:252-272`, most-negative `dist`).
- 2D manifold holds ≤2 points (`ArrayVec<TrackedContact,2>`, parry
  `contact_manifold.rs:478-479`); `local_n1/local_n2` per-shape local normals (`:484-486`);
  world normal on `ContactManifoldData.normal` (`contact_pair.rs:313-349`).
- Per point `TrackedContact`: `local_p1`, `local_p2`, `dist` (negative = penetrating),
  feature ids, `data: ContactData { impulse, tangent_impulse, warmstart_* }`
  (parry `:107-150`; rapier `contact_pair.rs:34-49`). Impulse sign: applied to body1,
  negated for body2.
- Events: `CollisionEvent::Started/Stopped(h1, h2, flags)` with `SENSOR`/`REMOVED` flags
  (`src/geometry/mod.rs:80-174`). `ContactForceEvent.total_force_magnitude` is the sum of
  per-contact magnitudes, NOT |sum| (`:187-192`); impulses→forces via `* inv_dt` (`:202-232`).
  `ChannelEventCollector` wraps two mpsc senders (`event_handler.rs:187-230`). Events are
  transient — never part of any snapshot; pending events at snapshot time are simply re-derived
  by re-stepping.

## Joints (2D)

Two sets, same `GenericJoint` description: `ImpulseJointSet` (impulse/soft, allows loops,
slight compliance) vs `MultibodyJointSet` (reduced-coordinate, rigid, tree-only). 2D has 3
DOFs: `LIN_X`, `LIN_Y`, `ANG_X` (`src/dynamics/joint/mod.rs:63-89`).

| Joint | Locked | Free/coupled |
|---|---|---|
| FixedJoint | LIN_X, LIN_Y, ANG_X | — |
| RevoluteJoint | LIN_X, LIN_Y | ANG_X |
| PrismaticJoint | LIN_Y, ANG_X | LIN_X |
| PinSlotJoint | LIN_Y | rest |
| RopeJoint | — | coupled LIN axes + max-distance limit (`rope_joint.rs:23-40`) |
| SpringJoint | — | coupled LIN axes + ForceBased position motor (`spring_joint.rs:23-40`) |

`GenericJoint` (`generic_joint.rs:260-312`): masks + `limits: [JointLimits; 3]` +
`motors: [JointMotor; 3]` + `contacts_enabled` (default **true** — jointed bodies still
collide with each other; disable for attached-body pairs). Motors: `target_vel/target_pos/
stiffness/damping/max_force`, model `AccelerationBased` default (`:195-225`). Joint softness
default is near-rigid (freq 1e6, ζ 1 — `integration_parameters.rs:67-72`) unlike contacts.
Smashy relevance: tether/grab mechanics map to RopeJoint; otherwise unused.

## Snapshotting for rollback

Serialized (all `cfg_attr(serde-serialize, derive(...))`):

| Type | What round-trips | Skipped fields |
|---|---|---|
| RigidBodySet | Arena + modified list | `default_fixed` (`rigid_body_set.rs:77`) |
| ColliderSet | Arena + modified list | none |
| IslandManager | islands, awake list, sleep candidates | `stack` scratch (`manager.rs:45`) |
| BroadPhaseBvh | full BVH incl. incremental-optimization state (parry `bvh_tree.rs:1747,1758-1759`), pairs map as sorted-content Vec (`broad_phase_bvh.rs:24-31`) | `workspace` |
| NarrowPhase | contact + intersection graphs, warmstart impulses, `start_event_emitted` edge state | `query_dispatcher` (resets to default — custom dispatchers lost, `narrow_phase.rs:66-69`) |
| ImpulseJointSet | joints + graphs + pending `to_wake_up`/`to_join` HashSets (`impulse_joint_set.rs:48-51`) | none |
| MultibodyJointSet | everything incl. multibody workspaces | — |

- Handle stability is a designed guarantee: `src/data/mod.rs:1`, and the Arena serializes its
  free list so post-restore insertions produce identical handles — proven by in-crate test
  `physics_pipeline.rs:906-961`.
- Modified-tracking lists and per-object change bitflags are both serialized, so no manual
  rebuild after deserialize.
- Smashy measured (2-fighter scene): clone-snapshot 0.5 µs / 1668 bytes bincode, restore
  ~1 µs, 57 rollbacks bit-identical by `to_bits()`. Snapshot is NOT O(1) — BVH/graph
  structures grow with body count; re-measure at roster scale.

## Determinism guarantees and limits

- Base promise: same-machine determinism from snapshot/restore; cross-machine only under
  IEEE-754 compliance (`src/lib.rs:6-9`), in practice: build with `enhanced-determinism`.
- `enhanced-determinism` does four things: routes transcendentals through libm
  (`simba/libm_force`, Cargo.toml), swaps hashbrown+foldhash for insertion-ordered
  `IndexMap<_,FxHasher32>` (parry `src/utils/hashmap.rs:54-66`), uses ordered Vec drains for
  joint wake/join queues (`physics_pipeline.rs:510-519,556-565`), and disables the SSE
  flush-to-zero RAII (`src/utils/fp_flags.rs:12-49`).
- Incompatible with `simd-stable`/`simd-nightly` (compile_error, `lib.rs:64-67`).
- `parallel` parallelizes only across islands (`physics_pipeline.rs:284-336`, comment `:299`);
  islands write disjoint bodies and island assignment is serial, so it is not an obvious
  accumulation-order hazard, but it is unaudited for rollback — keep it off. Fighters share
  one island anyway.
- Without enhanced-determinism, map iteration order is table-layout dependent (foldhash fixed
  seed): stable within one binary, not across platforms or capacity changes.

## Sharp edges

1. **Parentless colliders are Fixed for pair filtering** and FIXED_FIXED is off by default →
   two parentless colliders silently never collide (`narrow_phase.rs:851-852`,
   `collider_components.rs:339-345`). Found empirically in smashy before the source confirmed it.
2. **Contact softness residuals**: soft-constraint CFM/ERP leaves ~1e-10-scale penetration
   bias even at rest (`integration_parameters.rs:96-138`); plus `normalized_allowed_linear_error`
   (0.001·length_unit) is deliberately never corrected. Exact plane snaps are out of scope for
   the solver by construction.
3. **Gravity is applied inside `step`**, after your `set_linvel` — freezing a body requires
   zeroing velocity AND `gravity_scale`, or flipping to Fixed.
4. **Kinematic bodies receive no contact response** (effective inverse mass 0) — a fighter
   that must be pushed by walls/other bodies has to be Dynamic.
5. **`max_ccd_substeps: 0` disables CCD globally** even for `ccd_enabled` bodies
   (`physics_pipeline.rs:611-616`).
6. **`ContactForceEvent.total_force_magnitude` is Σ|f|, not |Σf|** (`geometry/mod.rs:187-192`) —
   wrong for knockback direction math; use `ContactPair::total_impulse()` instead.
7. **Failing `solver_groups` still generates contacts/events** — use `collision_groups` when
   you want the pair gone entirely (`narrow_phase.rs:930`).
8. **Custom `query_dispatcher` on NarrowPhase does not survive deserialize** (resets to
   default, `narrow_phase.rs:66-69`).
9. **Pre-0.34 tutorials are stale**: math is glam, `QueryPipeline::update` no longer exists,
   `PhysicsPipeline::step` is 12 args, broad phase type is `BroadPhaseBvh`. Distrust any
   sample using `vector![]` or an owned QueryPipeline.
10. **Joint `contacts_enabled` defaults true** — jointed body pairs collide with each other
    unless disabled (`generic_joint.rs:305-312,437-442`).
