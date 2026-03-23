// ============================================
// Emission strategy: two zones
// ============================================
//
// Zone 1: GENERATED (gen/). Always overwritten. Never hand-edit.
//   - Type definitions (struct/interface/enum)
//   - Default construction
//   - Route parser + formatter
//   - Event dispatch wiring
//   - Signal/reactive wrapper selection
//   - Subscription lifecycle management
//   - Match exhaustiveness shells
//
// Zone 2: AUTHORED (src/). Created once as scaffold. Never overwritten.
//   - Reducer arm bodies: (state, event) -> state logic
//   - Boundary/effect implementations: the async body
//   - Render/view: given state + dispatch, the UI markup
//
// Zone 1 imports: nothing from Zone 2.
// Zone 2 imports: everything from Zone 1.
// One-way dependency. Always.
//
// When TypeSpec changes:
//   1. Zone 1 regenerates entirely.
//   2. Zone 2 untouched.
//   3. Compiler errors in Zone 2 = your TODO list.
//      - New enum variant -> missing match arm.
//      - New field -> missing Default.
//      - New boundary -> unimplemented trait.
//      - Removed thing -> unused import.
//
// Three manual holes. Everything else derived:
//   1. Reducer arms (when THIS event, do THIS to state)
//   2. Effect bodies (to get THIS data, call THIS)
//   3. Render/view (given state + dispatch, show THIS)

// ============================================
// Effect dependency graph -> waterfall detection
// ============================================
// Effects declare deps as fields typed as other Effects.
// Emitter walks the dep graph:
//   - Parallel where deps allow
//   - Sequential where deps require
//   - N+1 warning when: Effect depends on Effect whose output is T[],
//     and the dependent effect runs per-element
//
// ComponentRef<TComp, TEffects>[] (array of children with effects)
//   = the N+1 signal. Effects inside array children multiply.
