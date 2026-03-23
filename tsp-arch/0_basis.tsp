// ============================================
// Axis 1: WHAT -- the three kinds of model
// ============================================

model State {}
model Event {}
model Effect {}

// ============================================
// Axis 2: LIFECYCLE -- what start/end pair scopes this value
// ============================================
//
//  Device
//    └─ 1:many Session (one device, many login sessions over time)
//        └─ 1:many Tab (one tab/window lifetime)
//            └─ 1:many Instance (one SPA boot / process start)
//                └─ 1:many Scope (one fn/block/component mount)
//
// Sharing is DERIVED: Scope = local, Instance+ = shared.
// Persistence is DERIVED: Scope/Instance = RAM, Tab = sessionStorage,
//   Session = cross-tab/backend, Device = localStorage/DB.
//
// NOTE: TypeSpec only supports single `extends`. No `extends A & B`.
// Lifecycle is encoded by nesting the extends chain:
//   State -> ScopeState -> user model
//   State -> InstanceState -> user model
// The emitter walks the chain to find both the kind (State/Event/Effect)
// and the lifecycle (Scope/Instance/Tab/Session/Device).
