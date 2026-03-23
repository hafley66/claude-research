// ============================================
// Boundary: async crossing points
// ============================================

union Cardinality {
  once: {};       // oneshot: promise, future, <-chan (cap 1)
  streamO: {};    // receive-only: Observable, <-chan, mpsc::Receiver, ReadableStream
  streamI: {};    // send-only: Subject.next, chan<-, mpsc::Sender, WritableStream
  stream: {};     // bidirectional: WebSocket, chan T, TransformStream, Subject
}

//   Cardinality | Go            | Rust tokio         | JS/TS
//   ------------|---------------|--------------------|-----------------------
//   once        | <-chan (cap 1)| oneshot::Receiver   | Promise<T>
//   streamO     | <-chan T      | mpsc::Receiver<T>   | ReadableStream / Observable
//   streamI     | chan<- T      | mpsc::Sender<T>     | WritableStream
//   stream      | chan T        | (Sender + Receiver)  | TransformStream / Subject

model Boundary<
  TIn,
  TOut,
  TCard extends Cardinality = Cardinality.once,
> {
  input: TIn;
  output: TOut;
  cardinality: TCard;
}

// Curried aliases for common combos:
alias Fetch<TIn, TOut> = Boundary<TIn, TOut, Cardinality.once>;
alias StreamO<TOut> = Boundary<{}, TOut, Cardinality.streamO>;
alias StreamI<TIn> = Boundary<TIn, {}, Cardinality.streamI>;
alias Stream<TIn, TOut> = Boundary<TIn, TOut, Cardinality.stream>;

// Replay/cache config for streams:
model StreamConfig {
  replay: int32 = 0;       // 0 = no replay, 1 = BehaviorSubject-like, N = ring buffer
  refCount: boolean = true; // teardown when no subscribers?
}

// Sync availability is derived from defaults:
//   All fields have defaults -> sync readable (BehaviorSubject, Signal, watch)
//   Missing defaults -> async (Observable, mpsc, must wait for first value)
//   "eventual" = no-default + replay:1 -> empty until first emit, then cached
//   This is shareReplay(1) / lazy-init / SWR. Emitter strategy, not type property.
