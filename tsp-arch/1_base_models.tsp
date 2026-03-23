// ============================================
// Base models: single extends chain (no intersection)
// ============================================
// TypeSpec only supports single extends. Both axes (kind + lifecycle)
// are encoded in one inheritance chain. The emitter walks up the chain
// to determine: kind (State/Event/Effect) + lifecycle (Scope/.../Device).

// State × Lifecycle
model ScopeState extends State {}
model InstanceState extends State {}
model TabState extends State {}
model SessionState extends State {}
model DeviceState extends State {}

// Event × Lifecycle
model ScopeEvent extends Event {}
model InstanceEvent extends Event {}
model TabEvent extends Event {}
model SessionEvent extends Event {}
// DeviceEvent doesn't exist -- events are ephemeral by nature

// Effect × Lifecycle
model ScopeEffect extends Effect {}
model InstanceEffect extends Effect {}
model SessionEffect extends Effect {}
model DeviceEffect extends Effect {}
// TabEffect is just InstanceEffect that survives refresh -- use SessionEffect

// ============================================
// How the emitter distinguishes lifecycle
// ============================================
// Option A: naming convention. ScopeState vs InstanceState is enough
//           for the emitter to pattern-match the name.
// Option B: the base models carry a lifecycle tag as a field:
//
//   model ScopeState extends State { @internal lifecycle: "scope"; }
//   model InstanceState extends State { @internal lifecycle: "instance"; }
//
// Option C: decorator on the base model (keeps fields clean):
//
//   @lifecycle("scope") model ScopeState extends State {}
//
// All three work. Option A is simplest. Option B is self-describing.
// Option C uses decorators but ONLY for emitter hints, not structural semantics.
// The structural constraint (extends State) is in the type graph.

// ============================================
// Emitter mapping table
// ============================================
//
// Lifecycle  | JS/React               | Rust/Dioxus              | Go
// -----------|------------------------|--------------------------|------------------
// Scope      | useState/useRef        | use_signal / let mut     | local var
// Instance   | context/atom/store     | use_context/static       | package var
// Tab        | sessionStorage + sync  | N/A (no tabs)            | N/A
// Session    | BroadcastChannel +     | server session store     | session middleware
//            | localStorage jwt check |                          |
// Device     | localStorage/IDB       | sled/sqlite              | bolt/sqlite
