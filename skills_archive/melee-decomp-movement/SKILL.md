---
name: melee-decomp-movement
description: Reference for building a Melee-accurate ground/air movement state machine. Where real frame/physics attributes live in the Melee decomp (ftCo_DatAttrs, the common motion-state functions, the MS_* enum), authentic Captain Falcon values, the world-unit→pixel question, and the Rust statechart library decision (hand-roll enum+match for rollback). Use when porting Melee dash/walk/run/turn/jumpsquat/landing logic.
---

# melee-decomp-movement

Captured from a deep read of the Melee decompilation and a survey of Rust state-machine
crates, June 2026. Goal: build a rollback-deterministic platform-fighter movement machine
(walk / dash / run / pivot / jumpsquat / jump / landing) with authentic feel.

Repos referenced (under `~/projects/games/smash/.ext/`):
- `melee/melee/` — the decompilation (C source)
- `melee/libmelee/` — Python lib; ships `characterdata.csv` with base physics in plain text
- `engines/Godot-Smash-Engine/` — NyxTheShield GDScript engine (string-state + central dispatcher)
- `engines/PlatformFighterGodot/` — class-per-state GDScript engine

## TL;DR decisions

- **Hand-roll `fn step(state, input, tune) -> state` with an `enum + match`.** Do NOT pull a
  state-machine crate for the player. Rollback clones the whole state each rolled-back frame;
  POD `#[derive(Copy, Clone, PartialEq)]` is the ideal snapshot. Library FSMs bury
  `Box<dyn>` triggers/closures in the component you must snapshot+checksum → silent desyncs.
- Frame-windowed inputs (dash-start window, jumpsquat buffer, pivot window) want a frame
  counter *inside the state* — the match gives that for free. In Melee a single timer per
  state is the pattern (anim frame), so a `frame: i64` that resets on transition works.
- If state hierarchy ever gets deep (shared "any grounded state can jump/shield"), the ONE
  rollback-clean library is **statig 0.4.1** (`#[superstate]`, plain enum + context, no heap,
  no dispatch, no_std). Until then, plain match.

## Where the real numbers live

Two text sources. Everything else is binary `PlCa.dat` loaded at runtime into `fp->co_attrs`.

### 1. The attribute struct — `ftCo_DatAttrs`
`melee/melee/src/melee/ft/types.h:691-774`. Every character's `fp->co_attrs`. Movement fields:

| field | off | meaning |
|---|---|---|
| `walk_init_vel` / `walk_accel` / `walk_max_vel` | +00/04/08 | walk velocity model |
| `slow_walk_max` / `mid_walk_point` / `fast_walk_min` | +0C/10/14 | walk anim-speed thresholds |
| `gr_friction` | +18 | ground traction (decel when no input) |
| `dash_initial_velocity` | +1C | one-shot dash burst impulse |
| `dash_run_acceleration_a` / `_b` | +20/24 | dash+run accel |
| `dash_run_terminal_velocity` | +28 | run top speed |
| `run_animation_scaling` | +2C | run anim rate = vel / this |
| `max_run_brake_frames` | +30 | run-brake (skid) length |
| `ground_max_horizontal_velocity` | +34 | ground vel hard cap |
| `jump_startup_time` | +38 | **jumpsquat frames** |
| `jump_h_initial_velocity` / `jump_v_initial_velocity` | +3C/40 | fullhop h / v launch |
| `ground_to_air_jump_momentum_multiplier` | +44 | momentum carried ground→air |
| `jump_h_max_velocity` | +48 | horizontal air cap at jump |
| `hop_v_initial_velocity` | +4C | **shorthop** v launch |
| `air_jump_v_multiplier` / `_h_multiplier` | +50/54 | double-jump scaling |
| `max_jumps` | +58 | jump count (incl. ground) |
| `grav` / `terminal_vel` | +5C/60 | gravity / max fall |
| `air_drift_stick_mul` / `aerial_drift_base` / `air_drift_max` | +64/68/6C | air DI model |
| `aerial_friction` | +70 | air horizontal decel |
| `fast_fall_velocity` | +74 | fastfall speed |
| `air_max_horizontal_velocity` | +78 | air speed cap |
| `frames_to_change_direction_on_standing_turn` | +84 | **pivot / turn frames** |
| `weight` | +88 | weight (knockback) |
| `normal_landing_lag` | +E4 | landing lag frames |
| `landingair{n,f,b,hi,lw}_lag` | +E8..+F8 | per-aerial L-cancelable lag |

### 2. Base physics CSV — `libmelee/melee/characterdata.csv`
Plain text, but ONLY base physics (no frame data, no dash/jump velocities). Captain Falcon
(`Cptfalcon`, index 2):

| gravity | term vel | max walk | shorthop (InitDJSpeed) | fastfall | air speed | air friction | air mobility | jumps | friction | size |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.13 | 2.9 | 0.85 | 2.66 | 2.9 | 1.12 | 0.01 | 0.06 | 1 | 0.08 | 14 |

CSV header order: `Character,CharacterIndex,Jumps,Friction,size,Gravity,TerminalVelocity,MaxWalkSpeed,InitDJSpeed,FastFallSpeed,AirSpeed,AirFriction,AirMobility,InitDJSpeed_x`.
`InitDJSpeed` is the shorthop/airjump v-speed; `InitDJSpeed_x` (0.96) the airjump h-momentum keep.

### 3. The other two libmelee CSVs (checked — do NOT help for movement)
- `framedata.csv` — **hitbox-only**. Rows exist only for actions with hitboxes (attacks,
  numeric action id >= ~44). Columns are `hitbox_N_{status,size,x,y}`, `locomotion_x/y`,
  `iasa`, `facing_changed`. Movement states (Wait/Walk/Dash/KneeBend, ids 15-30) have no
  hitboxes so they are absent. `locomotion_x/y` here is attack-move shift, not walk/dash speed.
- `actiondata.csv` — columns `character,action,zeroindex`; action is the **numeric** `MS_*`
  id (Wait=15 … Dash=21, Run=22, KneeBend=25, JumpF=26 …), no names. Use it only to map ids.
- Both keyed by NUMERIC character index (Falcon = 2), not a name string.

### 4. NOT in the decomp as text
`jump_startup_time` (jumpsquat), `dash_initial_velocity`, `dash_run_terminal_velocity`,
`jump_v_initial_velocity` (fullhop), `hop_v_initial_velocity` (shorthop), `normal_landing_lag`,
pivot frames — all in binary `PlCa.dat`, loaded at runtime into `fp->co_attrs`. Get them by
extracting the DAT, or from community frame tables (SmashWiki / SSBWiki). Falcon jumpsquat is
community-documented at **4 frames**. `characterdata.csv` is the ONLY text source of authentic
numbers, and it carries just the 14 base-physics columns (gravity, terminal vel, max walk,
InitDJSpeed=airjump v, fastfall, air speed, air friction, air mobility=air accel, jumps,
friction, size + index/name + InitDJSpeed_x).

## The motion-state functions (real transition logic)

All under `melee/melee/src/melee/ft/chara/ftCommon/`. These are shared by all characters.

- **Dash** `ftCo_Dash.c`. Enter: `mv.co.dash.x0 = facing * dash_initial_velocity` (one-shot).
  `_Phys` frame 0 applies the impulse, frame 1+ accelerates toward `dash_run_terminal_velocity`.
  Dash→Run in IASA when stick still held past the dash window. Tapping the other way inside the
  early window = **pivot**.
- **Walk** `ftCo_Walk.c` + `ftwalkcommon.c`. target_vel = `lstick.x * walk_max_vel`; accel blends
  `walk_init_vel` + `walk_accel`, scaled down as you approach target (`gr_vel/target_vel`).
  Three anim states (Slow/Middle/Fast) chosen by `slow_walk_max`/`mid_walk_point`/`fast_walk_min`.
- **Turn** `ftCo_Turn.c:74`. Counts down `frames_to_turn`
  (= `frames_to_change_direction_on_standing_turn`), flips `facing_dir`, sets `just_turned`;
  that flag opens the immediate dash-out window (pivot).
- **KneeBend (jumpsquat)** `ftCo_KneeBend.c:30`. Runs exactly `jump_startup_time` frames then
  `ftCo_Jump_Enter`. **Shorthop decided during squat**: if jump released before takeoff,
  `is_short_hop=true` and takeoff uses `hop_v_initial_velocity`, else `jump_v_initial_velocity`.
- **Jump** `ftCo_Jump.c`. `self_vel.x *= ground_to_air_jump_momentum_multiplier` (carry),
  v from shorthop/fullhop branch, h from stick clamped to `jump_h_max_velocity`.
- **Run** `ftCo_Run.c`. accel toward `dash_run_terminal_velocity` via `getAccelAndTarget`;
  anim rate = `|vel| / run_animation_scaling`. RunBrake (skid) on reversing input.
- **Landing** `ftCo_Landing.c`. Locked `normal_landing_lag` frames before IASA opens.

### Motion-state enum — `ftCommon/forward.h`
Ground run: `Wait(15) → WalkSlow → WalkMiddle → WalkFast → Turn → TurnRun → Dash → Run →
RunDirect → RunBrake → KneeBend`. Air: `JumpF/JumpB → JumpAerialF/JumpAerialB → Fall →
FallF/FallB → FallAerial... → FallSpecial...`. Then `Squat/SquatWait/SquatRv`, `Landing`,
`LandingFallSpecial`, attacks.

## Units (world units/frame → pixels)

- 60 fps. Velocities are **world units per frame**; integration is `pos += vel` each frame.
- Frame counters are floats decremented `-= 1.0F` (allows hitlag/slow-mo fractional frames).
- **No pixel scale factor in the decomp** — game units map 1:1 to stage/collision coords.
- To port into a pixels/second pixel-space sim: multiply per-frame values by 60 for /sec, then
  pick a world→pixel scale `K` for the stage and multiply distances/velocities by `K`. Falcon
  is `size` 14 in those units. Decide `K` once from desired on-screen character height and apply
  uniformly to all length/velocity/accel attributes (not to dimensionless multipliers or weight).
- Concrete formulas used in the smash prototype (`K = PX_PER_UNIT = 5.0`, `FPS = 60`):
  - velocity: `px_per_s   = units_per_frame   * FPS * K`        (e.g. fall 2.9 -> 870 px/s)
  - accel:    `px_per_s2  = units_per_frame^2 * FPS * FPS * K`  (e.g. grav 0.13 -> 2340 px/s²)
  - frames stay integer (not scaled). Jump velocities negate (up is -y).
  - Spatial feel (jump-height : run-distance, time-to-apex) is K-invariant; K only sets how big
    the world reads on screen. Proportions between Melee attributes are preserved for any K.

## Godot reference engine values (functional, NOT Falcon-authentic)
`engines/Godot-Smash-Engine/Scripts/Player.gd` (string-state + central `state_handler()`,
single `timer` per state). ProtoChar example tuning, already in pixel-space, good starting point:
`run_speed 470, dash_speed 540, max_air_speed 250, fall_speed 40, max_fall_speed 900,
air_accel 21, traction 20, jump_speed 900, short_hop_speed 645, second_jump_speed 900,
max_air_jumps 1, landing_frames 4, dash_duration 16, jump_squat_duration 5, air_dodge_speed 850`.

## Rust state-machine crate survey (mid-2026, versions verified lib.rs/docs.rs)

| lib | ver | hierarchy | entry/exit | no_std | heap/dispatch | rollback |
|---|---|---|---|---|---|---|
| **statig** | 0.4.1 | yes (superstate) | yes | yes | none (static fns, enum state) | **good** |
| seldom_state | 0.16 (Bevy 0.18) | no | yes (closures) | no | Box<dyn> in component | poor |
| rust-fsm | 0.8.0 | no | no | yes | none | too limited (no state data) |
| sm | 0.9.0 (2019) | no | no | yes | none (typestate) | no (transition changes the type) |
| finny | 0.2.0 (2022) | yes | yes | yes | none | unmaintained |
| moonshine_behavior | active (Bevy) | pushdown stack | via systems | no | enum + stack | better than seldom, stack surface |

Rollback truth: `bevy_ggrs` snapshots only registered components by clone, restores every
rolled-back frame; unregistered/boxed state desyncs silently
(github.com/gschup/bevy_ggrs/blob/main/docs/pitfalls.md). Read input only from `PlayerInputs<T>`,
avoid `Events`/`Local`/unstable query order inside the GGRS schedule.

## Hand-rolled machine sketch (the recommended shape)

```rust
#[derive(Clone, Copy, PartialEq)]
pub enum CharState {
    Stand,
    Walk,                          // hold dir, slow
    Dash,                          // tap dir, frame-windowed burst (use s.frame)
    Run,                           // dash window expired, still held
    Skid,                          // run brake / turnaround
    Turn,                          // standing pivot, frame-windowed
    JumpSquat { full: bool },      // `full` chosen by jump-held-at-takeoff
    Air,
    Landing,                       // locked normal_landing_lag frames
}
// s.frame resets on transition (Melee's per-state anim timer), gates dash window /
// jumpsquat takeoff (frame >= jump_startup_time) / landing lag (frame >= normal_landing_lag).
```

## Determinism note
Existing sim uses `f32` `Vector2`. For cross-machine rollback determinism, swap to fixed-point
before networking; f32 is fine single-machine.
