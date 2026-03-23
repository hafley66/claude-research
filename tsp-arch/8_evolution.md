# Evolution Log

## Phase 1: Base Class Explosion (files 0-7)
- 3 base models (State, Event, Effect) + 5 lifecycles = 15 base models
- Str<TPattern, TParams> as separate parameterized string type
- Boundary<TIn, TOut, TCard> for async crossings
- gen/ vs src/ emission zones
- Lots of machinery

## Phase 2: Str Folds Into State
- State/Event/Effect all extend Str (everything is addressable)
- Str is the atom, roles wrap it
- LocalState for non-addressable lexical scope data
- Lifecycle as generic on State vs decorator -- debated, settled on decorator

## Phase 3: Wrapper Generics Explored, Rejected
- Tried Scoped<Reactive<T>> wrapper stacking (like Rust Arc<Mutex<RefCell<T>>>)
- TypeSpec has no conditional types to unwrap them
- Emitter can't validate compositions at TypeSpec level
- Abandoned: decorators + extends is the only thing TypeSpec checks

## Phase 4: Single Extends Confirmed
- Research confirmed: no `extends A & B` in TypeSpec
- Flat base models (ScopeState, InstanceState, etc.) are correct path
- Backpropped gaps to TypeSpec skills

## Phase 5: Str Dissolves
- Str is just "named record with typed fields" -- same as State
- Auto-path from TypeSpec source path + model name (globally unique by construction)
- Static segments = field access, params = index access (array/Record fields)
- Manual paths only for external boundaries -> then rejected @path too
- Str removed entirely. Model graph IS the address tree.

## Phase 6: Base Classes Dissolve (CURRENT)
- State/Event/Effect are all just values at different times
- The difference is timing and arity, not type
- Interface + op signature arity replaces base class role detection:
  - op(): Out = thunk/cached
  - op(In): Out = mapping/fetch
  - op(S, E): S = reducer
  - op(S): void = render/consumer
- Interface fields (not ops) = state bindings
- Models are just data. No base classes. No Str.
- Unions = state machines
- Enums = closed config (Lifecycle, Cardinality)
- Decorators = emitter config (lifecycle, cardinality), take enums only

## Final Primitive Set
- **model**: data with fields. fields are graph edges.
- **interface + op**: component unit. op arity = role.
- **union**: state machine (mutex variants).
- **enum**: closed config axis.
- **decorator(enum)**: emitter-consumed configuration.
- **alias**: curried generic shorthands.
- Auto-path from TypeSpec namespace. No manual addressing.
- One interface = one component folder, identical structure per target.
