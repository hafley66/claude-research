// ============================================
// Component: interface = ops on state
// ============================================
// Models hold data. Interfaces hold operations.
// A component is an interface parameterized by Str + State + Events.

// ComponentRef: typed child reference that carries effect visibility.
model ComponentRef<TComp, TEffects extends Effect[] = []> {
  component: TComp;
  effects: TEffects;
}

// InlineComponent: anonymous component with effects declared inline.
model InlineComponent<TProps extends State, TEffects extends Effect[] = []> {
  props: TProps;
  effects: TEffects;
}

// Mutable: escape hatch for dumb components / form state.
// Event is just Partial<T>. No explicit event enum. Field-level setters.
model Mutable<TState extends State> {
  state: TState;
}
// Emitter: signal per field, patch struct, no reducer generated.

// EffectEnvelope: intrinsic state machine for every Effect.
// idle -> loading -> success | error -> (refetch -> loading -> ...)
model EffectEnvelope<TData, TError = Error> extends ScopeState {
  status: "idle" | "loading" | "success" | "error" = "idle";
  data: TData | null = null;
  error: TError | null = null;
  isStale: boolean = false;
}
// Emitter auto-wraps every Effect in this. You never hand-write loading states.
