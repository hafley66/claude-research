# /reactive-jutsu

Map the time domain of the system. Where /call-tree-jutsu shows the spatial call graph, this shows the temporal event graph.

## Arguments
- (none): full sweep of the reactive topology in context
- `internal`: synchronous/in-process event flow only (dot access, function calls, computed derivations, effect chains)
- `external`: boundary events only (sockets, queues, key input, pubsub, timers, file watchers)
- `both`: internal and external layered on the same timeline axis
- `from <source>`: trace downstream from a specific event origin

## Instructions

Find every point where "something happens because something else happened." That is the event graph.

### Event taxonomy

Not all events look like events. Normalize them.

- Function call -- synchronous, pull
- Property access that triggers computation -- synchronous, pull
- `select {}`, `merge()`, `race()`, `Promise.all()` -- event-OR or event-AND
- Queue/socket/channel message -- async, push
- Timer, interval, cron -- async, push, periodic
- User input -- async, push, unpredictable
- Computed/derived/memo recalculation -- synchronous, reactive pull

### What to show

- **Event sources** -- where time enters the system. Origin, emission shape, temporal character (once, periodic, on-demand, unpredictable).
- **Merge points** -- where streams converge. What feeds in, what comes out.
- **Gate/filter/switch** -- where events are dropped, buffered, debounced, or rerouted.
- **Derivation chains** -- synchronous transforms between async boundaries. Collapse pure chains. Expand chains with effects or branching.
- **Effect sites** -- same markers as /call-tree-jutsu: `[IO]`, `[NET]`, `[DB]`, `[FS]`, `[UI]`.
- **Backpressure/buffering** -- where the system accumulates unprocessed events.

### Visual rules

- Time flows left-to-right or top-to-bottom. Pick one.
- Merge points visually distinct from pass-through. A junction, not a waypoint.
- Async boundaries get a visible break. `~>` async, `->` sync, `=>` batched/buffered.
- Marble-diagram style when showing what a specific combinator does with its inputs.
- One screen. Two if genuinely wide.

### Purpose

After reading a /reactive-jutsu the user should see what events exist, where they merge, where they gate, where they cause effects, and where the async boundaries are.
