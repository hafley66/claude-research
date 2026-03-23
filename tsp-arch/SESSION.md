# TypeSpec Architecture Modeling Session

## What This Is
A cross-language linker/IDL using TypeSpec as the schema layer. Not a UI framework abstraction -- a type system for expressing what addressable models exist, who references who, and what boundaries they cross. Emitters are compilers that resolve references and generate per-target glue.

## Core Principles

### 1. Everything is an addressable model
- State<TProps, TPattern>: addressable, store-managed, subscribable
- LocalState: anonymous, lexical scope, no address (closure variable vs named fn)
- Event: always identifiable (source path)
- Effect: always addressable (needs dedup key)
- Default address = TypeSpec source path + symbol name (globally unique by construction)
- Explicit Str pattern = parameterized, many instances keyed by resolved params

### 2. Enum-driven configuration, never inline strings
- Lifecycle, mutation semantics, sharing -- all enums or namespaced decorator enums
- No `@lifecycle("session")` with bare strings. Always `Lifecycle.session` or `@session`.
- Closed sets that monomorphize to zero-cost enums per target language

### 3. Path analysis of references
- Who references who = the dependency graph
- Dead code = unreferenced models
- Codegen entrypoints = models referenced across boundaries
- N+1 detection = effects inside array-typed references
- Waterfall detection = effects referencing other effects

### 4. Emitter as multi-pass compiler
- Pass 1: validate extended TSP logic (nonsensical combos, missing refs)
- Pass 2: emit per target (Rust, TS, Go, etc.)
- Forward pass: only emit what's reachable from entrypoints, not everything
- Tree-shaking by construction

### 5. Monomorphized enums across languages
- Every enum in TypeSpec becomes a zero-cost equivalent per target
- Same discriminants, same variants, same serialization
- Swappable parts: any target can consume any other target's enums via serde/JSON

## Type System

### Base classes (checked by TypeSpec)
```
model State<TProps = {}, TPattern extends string = ""> {}
model LocalState {}
model Event<TProps = {}, TPattern extends string = ""> {}
model Effect<TProps = {}, TPattern extends string = ""> {}
```

### Boundary cardinality
```
union Cardinality { once, streamO, streamI, stream }
```
Maps to: Go chan directions, Rust mpsc, JS Observable/Subject

### Configuration axes (enum-driven, emitter-validated)
- Lifecycle: scope | instance | tab | session | device
- Mutation: reactive | readonly | mutable
- Sharing: derived from lifecycle (scope=local, instance+=shared)
- Persistence: derived from lifecycle (scope/instance=RAM, tab=session, session=backend, device=DB)
- Sync availability: derived from field defaults (all defaults=sync, missing=async)

### Store (binds State to lifecycle)
Same State shape, different Store = different lifecycle. State doesn't know or care.

### Three manual holes (everything else generated)
1. Reducer arms (event -> state logic)
2. Effect bodies (async impl)
3. Render/view (UI markup)

### Two emission zones
- Zone 1 (gen/): always overwritten, types + wiring
- Zone 2 (src/): scaffold once, compiler errors = TODO list

## TypeSpec Constraints
- Single `extends` only (no intersection)
- `fn` is standalone only, `op` in interfaces only
- No partial generic application (alias-per-combo workaround)
- No conditional types / mapped types / infer
- All semantic validation lives in emitter, not TypeSpec checker
- TypeSpec checks: shape + extends hierarchy
- Emitter checks: everything else (valid combos, boundary rules, ref analysis)

## Open Design Decisions
- LocalState as base class vs just "fields on a State" vs decorator
- Whether Lifecycle belongs as generic on State or as namespaced decorator enum
- Monad<T> wrapper pattern for per-field metadata vs decorator per field
- How to express "this auto-generated entrypoint is referenced in this manual component body"
- Chrome extension multi-context (background/content/popup) address space mapping

## Files
- 0_basis.tsp - Base classes and lifecycle hierarchy
- 1_base_models.tsp - Concrete base models, emitter mapping
- 2_str.tsp - Parameterized string identity (folded into State generic)
- 3_boundary.tsp - Async boundaries, cardinality, stream config
- 4_route.tsp - Route as state machine node
- 5_component.tsp - ComponentRef, Mutable, EffectEnvelope
- 6_emit_zones.tsp - Emission strategy, waterfall detection
- 7_grid_example.tsp - Grid columns with effect visibility
