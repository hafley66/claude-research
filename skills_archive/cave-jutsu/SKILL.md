---
name: cave-jutsu
description: Command: cave-jutsu. Paint current vs next architecture side-by-side with N+1 callouts, delta table, files list, LOC deltas, invariants preserved. Use before big refactor commit to align on shape.
---

grug want paint current vs next cave painting. user say "cave-jutsu" or "paint current vs next" or "cave painting" = trigger.

purpose: before grug rewrite hot function or loop, paint two pseudocode blocks side-by-side. current on top, next below. annotate N+1 sins on current, ✅ fixes on next. end with delta table + files touched + LOC estimate + behavior invariants kept.

form user expects:

```
───────────────── CURRENT CAVE PAINTING ───────────────────────────────
<file>::<fn> (line-range)

  <pseudocode of current flow, stripped to structure>
  <N+1s marked with ❌ trailing comment>
  <key bad loops / repeat opens / serial awaits called out>

───────────────── NEXT CAVE PAINTING ──────────────────────────────────
<file>::<fn>

  <pseudocode of proposed flow>
  <fixes marked with ✅ trailing comment>
  <fused passes, bulk queries, parallelism, one-shot opens>
```

then:

- **delta summary** table: concern | current | next. one row per axis of change. ~6-10 rows.
- **files touched**: path + STEP label + LOC estimate. small list.
- **LOC rough**: before body / after body / net. one line each.
- **invariants preserved**: bullets. what behavior stays identical (rules fire same, rows written same, CLI flags same, idempotency).
- **NOT changing**: bullets. nearby concerns deliberately deferred. each with reason or "STEP N follow-up".
- end with "match paint?" or equivalent single-line ack prompt.

rules grug follow:

1. pseudocode must be **structural**, not literal. strip comments, shorten names, preserve control flow. reader sees shape in 5 seconds.
2. N+1 callouts are **trailing comments** on the offending line, with ❌. say what's wasted. "2nd open ❌", "COMPILE IN LOOP ❌", "N*M*P SQL ❌".
3. fixes in next mirror same lines with ✅. "1 open/worker ✅", "compiled HERE ✅", "1 SQL/round ✅ (was N*M*P)".
4. delta table is the **diff index**. one axis per row. if grug cannot name axis in 3 words, axis not sharp enough.
5. files list must include **LOC estimate per file**. this is the size-of-refactor honesty check. user uses to calibrate commit scope.
6. invariants section exists because **refactor that changes behavior is not refactor**. force grug to enumerate what stays same. if grug cannot list invariants, grug does not understand the code yet.
7. NOT-changing section exists because **blast radius discipline**. stops grug from smuggling cleanup into a perf commit.

anti-patterns grug avoid:

- don't paint full code. paint structure. brackets + loops + key calls.
- don't skip N+1 annotations. whole point of painting is seeing the waste.
- don't skip invariants section because "obvious". invariants are never obvious mid-refactor.
- don't use prose paragraphs. cave painting is grid / columns / bullets / tables.
- don't editorialize. no "this elegant new design". facts only.
- don't compute exact LOC. ballpark. ~200, ~20, ~150. if grug tempted to say "237", grug over-counting.

when to invoke cave-jutsu:

- before any commit that touches >100 LOC of hot-path logic
- before any loop reshape (serial → parallel, nested → flat, sync → async)
- before any schema or storage layer change where rows shape differs
- before any boundary move (function split, crate split, trait introduction)

when NOT to invoke:

- typo fix
- rename
- single-callsite signature change
- any change <30 LOC with no control-flow restructure

output length: long is OK if content is dense. cave painting earns its tokens by replacing 3 rounds of "wait what about X" clarification. target: 1 screen of current block, 1 screen of next block, 1 screen of tables + invariants. ~150 lines.

after painting, stop. wait for user to ack or poke. do not start implementing. cave painting is alignment step, not execution step.
