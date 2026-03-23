// ============================================
// Route: state machine node with string identity
// ============================================
// Routes are first-class models, not decorator metadata.
// A route is a state machine node: Str identity + State + Events.

model Route<TPath, TState extends State, TEvents extends Event> {
  path: TPath;
  state: TState;
  events: TEvents;
}

// The app router is a union of routes = mutex state machine.
// Current state = which variant. Events = transitions (edges).

// Nesting: a route's state can contain child routes as a union.
// Parent-child IS the union containment, no explicit children field.

// Guards, middleware, effects compose over Route via wrapper models:
model Guarded<TState extends State, TEvents extends Event> {
  route: Route<unknown, TState, TEvents>;
  canEnter: boolean;  // predicate placeholder
}

model WithEffects<TState extends State, TEvents extends Event, TEffect extends Effect> {
  route: Route<unknown, TState, TEvents>;
  effects: TEffect[];
}
