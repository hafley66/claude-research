# /pipey-not-sinky-jutsu

Audit the pipeline / ops / rule-engine design in the current conversation for
positional gating. Sinky smells: "this op can only appear at the end",
"no op may follow a Sink", "terminal kind", or a hardcoded name list
(`STREAM_OP_NAMES = [...]`) living anywhere that isn't the op def itself.

The wanted model = BigQuery pipe `|>`, shell `|`, jq, KQL: every step is
rows-in -> rows-out (possibly zero rows, possibly with a side effect like
`tee`), and the next step just accumulates more semantics on the running
cursor. `expect_zero` is an op that emits zero rows on success and N on
failure — a filter like any other. Nothing positional.

Do:
1. Audit for sink/terminator/producer distinctions and name-list registries.
2. Reframe each as "ops accumulate semantics line by line"; give its
   row-in -> row-out signature.
3. Propose refactors moving behavior onto the op def (return type, effect
   kind, retraction shape) instead of walk-time/fuser-time rules.
4. Check whether anything can still chain after the supposed terminal; if
   not, that's the smell.
5. If the design is already pipey, say so and stop. Don't invent smells.

Retraction note: differential dataflow handles add and delete symmetrically
in every operator — no operator is privileged as "the end" — so sink-style
designs also fight the layer v4 is built on.

## Grounding quotes

- BigQuery pipe syntax: "Pipe operators can be applied in any order, any
  number of times." Aggregate-then-filter is legal.
- jq `|`: feeds outputs of the left filter into the right. jq `empty`:
  "returns no results. None at all." — zero output is a filter, not a
  terminator.
- Unix: uniform byte-stream interface is why no command is terminal; `tee`
  proves side effect + pass-through is one op, not two roles. McIlroy:
  "handle text streams, because that is a universal interface."
- KQL: every operator accepts a tabular dataset from the pipe and emits one
  to the next; none is positional.
- rxjs/LINQ as the anti-pattern: creation vs pipeable operators + Subscriber
  as sink means the consumer end is a different kind of thing than the
  middle, so you can't freely re-pipe past it.
