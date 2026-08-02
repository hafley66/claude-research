---
name: glam-smashy
description: glam 0.30-0.33 capability reference from the smashy engine's viewpoint -- Vec2 determinism (scalar vs SIMD, libm vs std, fma), normalize near-zero semantics, angle/perp conventions, the four-simultaneous-versions hazard, nalgebra interop, f32-to-fixed migration surface. Trigger phrases: glam determinism, Vec2 normalize epsilon, glam versions, glam nalgebra, Frame2 basis math, rollback float math, glam libm, perp sign, mul_add determinism, glam serde snapshot.
metadata:
  type: reference
---

# glam 0.30-0.33 for smashy

Research date: 2026-07-11. Latest glam release verified: **0.33.2** (crates.io, 2026-06-28).
Vendored sources cited as `glam-<ver>/...` under `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/`.
Repo: https://github.com/bitshifter/glam-rs · docs: https://docs.rs/glam

## TL;DR decisions

1. **Vec2 f32 is 100% scalar code in every glam version.** SIMD backends (`src/f32/{sse2,neon,coresimd,wasm32}/`) contain only `mat2 mat3a mat4 quat vec3a vec4` -- no vec2 file, in 0.30.10 and 0.33.2 alike. Cross-CPU divergence cannot enter through Vec2 arithmetic (add/sub/mul/div/dot/perp/length): those are plain IEEE-754 f32 ops, bit-identical on aarch64 and x86_64.
2. **The only Vec2 non-determinism doors are transcendental fns via `std`.** smashy's glam 0.30.10 resolves features `[debug-glam-assert, default, serde, std]` -- **no `libm`**, despite Cargo.toml comments in `crates/*/Cargo.toml` claiming "default features carry glamx/libm". The libm claim is true only for the glam 0.33.2 that nalgebra/glamx pull. Fix the comments or add `libm` to the workspace glam feature set before shipping cross-machine netplay.
3. **smashy's current op set is trig-free, so it is already bit-portable.** Grep of `crates/` (see table below) shows no `to_angle`/`from_angle`/`sin`/`atan2` use; everything used (abs, sqrt-based length, min/max/clamp, dot, perp, normalize_or_zero, round, signum, lerp) is IEEE-exact under both std and libm.
4. **Do not force-unify the four locked glam versions.** Only 0.30.10 (workspace) and 0.33.2 (nalgebra/glamx/parry/rapier) actually compile; 0.31.1/0.32.1 are lockfile-only residue of nalgebra's optional features. Unification means bumping the workspace to 0.33 -- the API cost is small (below) but it does not remove nalgebra's own pin, so it stays two-versions minimum until glamx/nalgebra track your version.
5. **`mul_add` is deterministic and safe** (always fused, correctly rounded, both math backends), but glam never uses fma internally unless `fast-math` **and** `target_feature=fma` (`glam-0.30.10/src/sse2.rs:129-136`). Leave `fast-math` off; it is the one feature documented to break bit-identity (`glam-0.30.10/src/lib.rs:256`).

## Version map in smashy's Cargo.lock

`cargo tree -i glam@<ver>` in /Users/chrishafley/projects/smashy, 2026-07-11:

| Version | Pulled by | Compiles? |
|---|---|---|
| 0.30.10 | workspace crates (`css`, `physics`, `html`, `world`, `godot-shell` -- `glam = "0.30"`, features `["serde"]`) and `godot-core 0.4.5` (adds `debug-glam-assert`) | yes |
| 0.31.1 | nobody (`cargo tree -i` prints nothing, even `--target all`) | **no** -- lock residue |
| 0.32.1 | nobody | **no** -- lock residue |
| 0.33.2 | `glamx 0.3.0` -> `parry2d 0.29` / `rapier2d 0.34`; `nalgebra 0.35` via `convert-glam033` | yes |

Why 0.31/0.32 are locked at all: `nalgebra 0.35.0` declares optional deps `glam030/031/032/033` behind `convert-glam03X` features (`nalgebra-0.35.0/Cargo.toml:68-71`). Cargo's resolver is feature-agnostic, so all four land in Cargo.lock and get vendored; only `convert-glam033` is enabled (by glamx, confirmed via `cargo metadata`). They cost download/vendor space, not compile time.

**The real hazard**: `glam030::Vec2` and `glam033::Vec2` are distinct types. Any value crossing the smashy-sim -> rapier boundary must convert; passing a 0.30 Vec2 where parry expects 0.33 is a compile error with a confusing "expected Vec2, found Vec2" message. Conversion currently goes through nalgebra types at the `crates/physics` boundary.

**Force-unify recipe (if ever wanted)**: bump workspace `glam = "0.33"` and enable nothing extra (defaults now include `all-types`; for compile time you can trim to `default-features = false, features = ["std","serde"]` -- f32+bool types are always on in 0.33). Then 0.30 drops out once godot-core updates; until then godot-core keeps 0.30 alive. `cargo update` prunes the 0.31/0.32 residue only if nalgebra drops those optional deps.

## Determinism story

### Where non-determinism CAN and CANNOT enter

| Vector op class | Backend | Cross-CPU (same binary arch class)? | Citation |
|---|---|---|---|
| `+ - * / dot perp perp_dot rotate lerp abs min max clamp signum` | plain f32 IEEE ops | bit-identical everywhere | `glam-0.30.10/src/f32/vec2.rs:994,1008,1021` |
| `length`, `normalize*`, `distance` | `math::sqrt` -> `f32::sqrt` or `libm::sqrtf` | bit-identical (sqrt is IEEE correctly-rounded in both) | `vec2.rs:461-463,480-482` |
| `round floor ceil trunc fract copysign` | std or libm equivalents | bit-identical (exact ops) | `math.rs:207-225` |
| `mul_add` | `f32::mul_add` / `libm::fmaf` | bit-identical (fused, one rounding) | `math.rs:133-135` (libm), `math.rs:252-254` (std) |
| `to_angle` (atan2), `from_angle`/`rotate_towards` (sin_cos), `sin cos tan exp ln powf` | **std**: `f32::atan2` etc -- platform libm, **not** correctly rounded, differs macOS vs Linux vs Windows | **NOT portable under `std`; portable under `libm` feature** | `math.rs:47-61` (libm branch), `math.rs:170-184` (std branch) |
| `angle_to` | `acos_approx_f32` -- glam's own 7-degree polynomial + sqrt | bit-identical, deliberately deterministic | `glam-0.30.10/src/f32/math.rs:1-33` |
| Vec3A/Vec4/Mat*/Quat | SSE2 / NEON / scalar per arch | can differ aarch64 vs x86_64 in edge cases; also `scalar-math` changes alignment | `src/f32/{sse2,neon}/` file lists |

Feature interactions (`glam-0.30.10/Cargo.toml [features]`, `src/f32/math.rs` cfg at line 35):
- `libm` -- uses libm for *everything* including sqrt/abs; the branch is active when `feature = "libm"` OR (`nostd-libm` and not `std`). This is the cross-OS determinism switch.
- `fast-math` -- opt-in, allows platform-specific codegen incl. fma contraction in SSE2 paths; documented as breaking bit-identity (`lib.rs:256-259`); "intermediate libraries should not use this".
- `scalar-math` -- forces scalar backends for the SIMD types; irrelevant to Vec2.

Net for the netplay question: **same binary on two same-ISA machines is always bit-identical** (no runtime CPU dispatch anywhere in glam; backend chosen at compile time by `target_feature`). Across ISAs (aarch64 dev vs x86_64 peer) or across OS libms, Vec2 stays identical as long as smashy avoids trig-family calls or turns on `libm`. Watch rapier's side separately: nalgebra 0.35 has a `libm_force`-style story via simba; `crates/godot-shell/Cargo.toml:17-19` already warns "DO NOT set default-features=false on glam or parry2d" per `labs/det-lib-spike/FINDINGS.md`.

### glam features resolved today (`cargo metadata`)

| glam | features |
|---|---|
| 0.30.10 | `debug-glam-assert, default, serde, std` |
| 0.33.2 | `approx, f64, i32, libm, nostd-libm, std, u32` |

`debug-glam-assert` comes from godot-core's default features: in debug builds, `normalize()` on a degenerate vector **panics** (`vec2.rs:531-535` `glam_assert!(normalized.is_finite())`) instead of silently returning inf/NaN. Release builds return non-finite garbage. Prefer the `_or` variants in sim code.

## normalize family -- exact near-zero semantics

There is **no epsilon constant anywhere**. All variants gate on `let rcp = self.length_recip(); rcp.is_finite() && rcp > 0.0` (`glam-0.30.10/src/f32/vec2.rs:546-599`):

| Method | Degenerate result | Line |
|---|---|---|
| `normalize` | inf/NaN vector (debug: panic under glam-assert) | vec2.rs:531 |
| `try_normalize` | `None` | vec2.rs:546 |
| `normalize_or(fallback)` | `fallback` | vec2.rs:564 |
| `normalize_or_zero` | `Vec2::ZERO` (delegates to `normalize_or`) | vec2.rs:581 |
| `normalize_and_length` | `(Vec2::X, 0.0)` -- note hardcoded +X | vec2.rs:588-599 |

"Degenerate" means exactly: `1.0 / sqrt(x*x + y*y)` is non-finite. That happens when
- `x*x + y*y` rounds to `0.0`: each `component^2` below ~f32 min subnormal, i.e. |component| ≲ 2.6e-23 (NOT 1e-4-style epsilons -- glam accepts absurdly tiny vectors and normalizes them);
- `x*x + y*y` overflows to inf (|v| ≳ 1.8e19): rcp = 0.0, fails `> 0.0`;
- any NaN/inf component: rcp NaN.

`Frame2::from_vector` (`crates/physics/src/frame.rs:15-26`) gates on `length_sq.is_finite() && length_sq > 0.0` then divides by `length_sq.sqrt()`. Behaviorally equivalent to `normalize_or(fallback)` on the same inputs (both reject len_sq == 0, len_sq == inf, NaN), differing only in computing `v / sqrt(ls)` vs `v * (1/sqrt(ls)).recip()`-path -- one extra rounding in glam's version, so the two can differ in the last ulp. Keep smashy's own gate if bit-stability of existing replays matters.

## Angle conventions (right-handed, +x=0, CCW positive)

| API | Definition | Line (0.30.10 vec2.rs) |
|---|---|---|
| `perp()` | `(-y, x)` = +90° CCW rotation. `Frame2.across = along.perp()` is the left-hand normal of `along`. | 994-999 |
| `perp_dot(rhs)` | `x*rhs.y - y*rhs.x` (2D cross/wedge/determinant); >0 when rhs is CCW of self | 1008-1010 |
| `from_angle(a)` | `(cos a, sin a)` -- unit vector, CCW from +X. Uses sin_cos (**trig: std/libm hazard**) | 954-957 |
| `to_angle()` | `atan2(y, x)` in [-pi, pi] (**trig hazard**) | 964-966 |
| `rotate(rhs)` | complex multiply: self as rotor scales-and-rotates rhs; pure rotation iff self is unit. Trig-free. | 1021-1026 |
| `angle_to(rhs)` | signed, `acos_approx(...) * signum(perp_dot)` -- deterministic polynomial, ~1e-7 error | 983-989 |
| `rotate_towards(rhs, max)` | clamps via angle_to then from_angle -- trig hazard via from_angle | 1035-1041 |
| `angle_between` | deprecated since 0.27, **removed in 0.31.0** | 970-976 |

Rollback-safe rotation idiom: precompute the rotor once as data (`Vec2` cos/sin pair stored in content, not computed with `from_angle` at runtime) and use `rotate`; then no trig runs in the sim loop.

## mul_add

`Vec2::mul_add(a, b)` = component-wise fused `(self*a)+b`, one rounding (`vec2.rs:894-908`). Backends: `f32::mul_add` (std) / `libm::fmaf` -- both correctly rounded, so **deterministic across platforms**, including machines without an fma instruction (rustc calls the software `fmaf` there -- slow, ~20-50x, but same bits). Trade: results differ from the unfused `v*a+b` your current code produces, so introducing mul_add is a replay-breaking precision change; adopt it wholesale or not at all. glam's own internals never contract unless `fast-math`+fma (sse2.rs:129-136), so you cannot get accidental fma from glam.

## smashy usage surface (grep `crates/`, 2026-07-11)

| Op | Count | Op | Count |
|---|---|---|---|
| `.abs(` | 203 | `.normalize_or_zero(` | 17 |
| `.length(` | 118 | `.perp(` | 8 |
| `.max(` | 76 | `.round(` | 7 |
| `.min(` | 73 | `.length_squared(` | 6 |
| `.clamp(` | 62 | `.signum(` | 5 |
| `.dot(` | 29 | `.perp_dot(` / `.normalize(` | 4 / 4 |
| `.lerp(` | 2 | `.distance(` / `.clamp_length_max(` | 1 / 1 |

`normalize_or_zero` callers are all `crates/godot-shell/src/v1/` + ui (legacy layer); `Frame2::from_vector` call sites: `crates/physics/src/lib.rs:44,69`.

### f32 -> fixed-point migration surface

Vec2 has no fixed-point sibling in glam (types: f32, f64 `DVec2`, i*/u*/isize int vectors; 0.33 gates them behind `float-types`/`integer-types`/`size-types` features). A swap means a custom `Fx2` newtype. What the above table says it must implement: `abs, min, max, clamp, dot, perp, perp_dot, signum, lerp, length/length_squared/distance` (needs integer sqrt), `normalize_or_zero` (sqrt + div), `round, clamp_length_max`. No trig needed. Frame2 (`crates/physics/src/frame.rs`) ports directly -- it is dot/perp/mul only plus one sqrt. `as_dvec2` (`vec2.rs:1046`) exists for an intermediate f64 step. Serde snapshot format changes shape (i32 raw vs f32), so snapshot schema versioning is part of the swap.

## Snapshot / serialization features (0.30.10 Cargo.toml)

| Feature | Gives | Note |
|---|---|---|
| `serde` | Serialize/Deserialize all types (via `serde_core`) | enabled in smashy; format stable across SIMD on/off (`lib.rs:242`) |
| `bytemuck` | `Pod`/`Zeroable` derives (`vec2.rs:21`) | zero-copy snapshot memcpy; safe for Vec2 (no padding, align 4; `cuda` feature raises Vec2 align to 8 -- don't) |
| `rkyv` (+`bytecheck`) | zero-copy archive | available 0.30-0.33 |
| `zerocopy` | zerocopy traits | added 0.30.9 |
| `speedy`, `encase`, `mint`, `approx`, `rand`, `arbitrary` | interop extras | `mint` is the nalgebra bridge (below) |

## 0.30 -> 0.33 API breaks (from `glam-0.33.2/CHANGELOG.md`)

| Release | Date | Breaks relevant to smashy |
|---|---|---|
| 0.31.0 | 2026-01-21 | `angle_between` removed (use `angle_to`); `Quat::from_affine3` signature; `&self` consistency on matrix/affine methods. smashy: no impact (no angle_between in crates/). |
| 0.31.1 | 2026-02-10 | isize vectors, wasm64; `USES_WASM32_SIMD` renamed. |
| 0.32.0 | 2026-02-11 | only break: `rand` 0.10 bump. |
| 0.32.1 | 2026-03-06 | fix: scalar/matrix division was reversed (`1.0/m` was wrong pre-0.32.1). |
| 0.33.0 | 2026-05-21 | non-f32 types feature-gated (default `all-types`); `#[must_use]` additions. Downstream crates doing `default-features=false` lose DVec2 etc unless they add `f64`. |
| 0.33.2 | 2026-06-28 | `camera`/`dcamera` modules; look_at/perspective methods deprecated as methods. 2D-irrelevant. |

Why four versions coexist: semver-major every glam minor + nalgebra shipping a `convert-glam03X` feature per version to bridge them. This is deliberate ecosystem design, not an accident to "fix".

## nalgebra interop (parry/rapier boundary)

Options, cheapest first:
1. **Manual `.x/.y` construction** -- `na::Vector2::new(v.x, v.y)` / `Vec2::new(p.x, p.y)`. Zero deps, zero surprises, exact bit copy. Recommended at the `crates/physics` seam; it also makes the 0.30-vs-0.33 type split invisible.
2. **`mint` feature** on both glam and nalgebra -- `let m: mint::Vector2<f32> = v.into();` then `na::Vector2::from(m)`. Compiles to the same memcpy; adds the mint dep and one more version-agreement point.
3. **nalgebra `convert-glam030`** -- direct `From` impls between nalgebra types and *glam 0.30* types. Would work for smashy's version, but enabling it activates the currently-dead glam 0.30 dep inside nalgebra and welds nalgebra's build to a specific glam minor. glamx already does this for 0.33 (`convert-glam033`).

All three are moves/copies of two f32s -- no precision cost. The determinism seam is not the conversion; it is what rapier does after (simba/nalgebra math, covered by `labs/det-lib-spike/FINDINGS.md`).

## Known limits and rough edges

- `normalize()` under `debug-glam-assert` (active via godot-core) panics on degenerate input in debug builds only -- debug/release behavior divergence.
- `normalize_and_length` fallback is `Vec2::X`, unlike `normalize_or_zero`'s zero -- easy to mix up.
- glam docs' "bit-for-bit identical results on all platforms" (`lib.rs:256`) is about *codegen*, and silently excludes std transcendentals; only the `libm` feature closes that.
- Older tutorials (pre-0.24) show `angle_between` for signed 2D angles; that name now means something else in 3D and is gone from Vec2 since 0.31.
- Cargo.toml comments in `crates/css`, `crates/physics`, `crates/world`, `crates/godot-shell` claim glam defaults carry libm; resolved features show they do not (workspace glam 0.30.10 is std-math). Stale or aspirational -- verify against `cargo metadata` before trusting.
