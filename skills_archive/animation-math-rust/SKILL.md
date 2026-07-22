---
name: animation-math-rust
description: Pure math animation libraries in Rust -- spring physics, easing/tweening, keyframe interpolation, damped harmonic oscillators. No rendering dependency. Trigger on spring animation rust, easing rust, tween rust, keyframe rust, animation math, damped oscillator, spring physics rust, spanda, charmed-harmonica.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Rust crates that compute animation values over time as pure math. No rendering framework dependency. Input: current state + target state + time. Output: interpolated value.

---

## keyframe

- **Repo**: github.com/HannesMann/keyframe | **Stars**: ~139
- **Crate**: keyframe

### Easing functions

38+ built-in easing functions. All are `fn(f32) -> f32` mapping [0,1] to [0,1]:

```rust
use keyframe::EasingFunction;
use keyframe::functions::*;

let t = 0.5; // normalized time
let v = EaseInOutCubic.y(t); // eased value
```

Linear, QuadIn/Out/InOut, CubicIn/Out/InOut, QuartIn/Out/InOut, QuintIn/Out/InOut, SineIn/Out/InOut, ExpoIn/Out/InOut, CircIn/Out/InOut, BackIn/Out/InOut, ElasticIn/Out/InOut, BounceIn/Out/InOut.

### Bezier curves

CSS `cubic-bezier()` compatible:

```rust
use keyframe::functions::BezierCurve;
let ease = BezierCurve::from([0.25, 0.1, 0.25, 1.0]); // CSS ease
let v = ease.y(0.5);
```

### Keyframe sequences

```rust
use keyframe::{keyframes, Keyframe};
use keyframe::functions::*;

let mut seq = keyframes![
    (0.0, 0.0, Linear),        // value 0 at time 0
    (100.0, 0.5, EaseInOut),   // value 100 at time 0.5
    (50.0, 1.0, EaseOut),      // value 50 at time 1.0
];

let v = seq.now(0.25); // interpolated value at t=0.25
seq.advance_by(0.1);   // advance internal clock
```

### mint integration

Works with mint vector types for 2D/3D/4D interpolation:

```rust
use keyframe::mint::Point2;
let a = Point2 { x: 0.0, y: 0.0 };
let b = Point2 { x: 100.0, y: 200.0 };
let mid = keyframe::ease(EaseInOut, a, b, 0.5);
```

---

## spanda

- High-performance animation engine
- Zero dependencies, no_std support

### Spring physics

Damped harmonic oscillator model. Three presets:

| Preset | Stiffness | Damping | Character |
|--------|-----------|---------|-----------|
| Stiff | High | High | Snappy, minimal overshoot |
| Bouncy | Medium | Low | Visible overshoot, playful |
| Wobbly | Low | Low | Loose, jelly-like |

### Multi-dimensional springs

Supports 2D, 3D, 4D vector springs. Each dimension is an independent damped oscillator with shared stiffness/damping parameters.

### Usage pattern

```
spring.set_target(new_position);
// each frame:
spring.update(dt);
let current = spring.value(); // smoothly approaches target
```

---

## charmed-harmonica

- Physics-based animation primitives
- Spring oscillator + projectile motion
- Lighter weight than spanda

---

## rapier (2D / 3D)

- **Site**: rapier.rs
- Full rigid body physics engine. Spring joints, collision, forces.
- Overkill for UI animation but available if layout needs physics simulation (e.g., collision avoidance between graph nodes).

---

## egui built-in animation

egui has animation primitives built into its Context (covered in egui-advanced-patterns skill):

| Method | What |
|--------|------|
| `animate_bool(id, bool) -> f32` | 0.0..1.0 linear |
| `animate_bool_with_easing(id, bool, fn) -> f32` | Custom easing |
| `animate_value_with_time(id, target, duration) -> f32` | Any f32 to target |

Frame-rate independent via `stable_dt`. Auto `request_repaint()` while animating. Restarts from current position on target change (no jump).

---

## When to use what

| Scenario | Library |
|----------|---------|
| Transition between layout states | keyframe (easing + keyframe sequences) |
| Smooth node movement on graph update | spanda (spring physics, natural settling) |
| Simple bool-driven show/hide | egui built-in `animate_bool` |
| Complex multi-property animation | keyframe sequences with mint vectors |
| Physics-based collision avoidance | rapier (heavy) or custom spring forces |
| Graph layout force simulation | fdg or forceatlas2 (not animation libs, but force-based) |
