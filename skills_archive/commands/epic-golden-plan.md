---
description: Convert researched design work into recursively enumerated epics with contracts, implementation tasks, completion criteria, and golden tests.
argument-hint: <design, feature set, or plan document>
---

# /epic-golden-plan

Plan a feature set after enough local and external reconnaissance to name the actual code paths, compiler boundaries, runtime boundaries, and test harnesses involved.

## Procedure

1. Record recon facts before proposing tasks.
   - Existing symbols, source files, test fixtures, versions, compatibility limits, and relevant upstream APIs.
   - Separate observed facts from guessed implementation tasks.
2. Define the plan boundary and any lowering boundary.
   - State which syntax or behavior belongs to the authoring surface, generated canonical representation, runtime IR, and target runtimes.
3. Write each epic in dependency order. For every epic include:
   - **Goal**
   - **Contract**: type signatures and input/output shapes.
   - **Pseudocode**: TypeScript, Rust, or the implementation language, with comments describing the body.
   - **Instance timeline**: creation, evaluation, update, disposal, and error lifetimes.
   - **Storage and identity**: keys, reads, writes, ownership, uniqueness conditions, and source-map/provenance paths where applicable.
   - **Recursive tasks**: `1`, `1.1`, `1.1.1`, ordered by dependency and scoped to files or symbols where known.
   - **Lowering or compatibility path**: canonical output and ownership of diagnostics when an upstream compiler or runtime is involved.
   - **Done condition**: observable completion boundary.
   - **Epic golden test**: one end-to-end fixture or snapshot that proves the contract, including diagnostics and target-runtime timelines when relevant.
4. Keep an explicit frontier section listing decisions intentionally deferred and the evidence needed to resolve them.
5. Write the result into the existing design or plan Markdown file. Avoid scratch artifacts.

## Golden-test shape

Use the widest deterministic slice that fits the epic:

```text
authoring input
  -> canonical/lowered form
  -> source map or provenance record
  -> checked IR
  -> target output or marble timeline
  -> diagnostics snapshot
```

When a stage does not exist yet, state it as a task and snapshot the existing boundary without inventing output.

## Output rules

- Use recursive numbered tasks, not a flat feature list.
- Preserve exact paths, symbols, versions, and zero-count findings from recon.
- Put the golden test and done condition at the end of every epic.
- Do not claim a task is complete without its listed completion evidence.
