---
name: chris-js-style
description: Chris's personal JS/TS conventions -- numeric file prefixes for dependency-ordered reading, anti-Java state mgmt prefs, and testing rules. Load when editing TypeScript/JavaScript code in any of Chris's repos.
trigger: typescript, javascript, .ts, .tsx, .js, .jsx, vitest, jest, react, signal, frontend
dependencies: []
---

# Chris's JS/TS Style

Personal conventions for TypeScript and JavaScript codebases. Load on any `.ts`/`.tsx`/`.js`/`.jsx` edit.

## Filesystem Ordering Convention

Author-driven numeric prefixes are the file ordering scheme. Numbers encode three things at once:

1. **Dependency order** -- lower numbers are dependencies of higher numbers
2. **Reading order** -- a new developer reads `0_*` first, then `1_*`, then `2_*`...
3. **Logical layers** -- foundational types first, then implementations, then consumers

### Examples

```
0_types.ts           # foundational types, no deps
1_SignalCreator.ts   # uses types
2_Signal.ts          # uses SignalCreator
3_SignalMemo.ts      # uses Signal
4_FormSignal.ts      # uses everything above
```

```
00_Remark.ts         # double digits when more granularity is needed
01_Rehype.ts
02_RenderBase.ts
```

### Rules

- Start at `0`, not `1`.
- Use an underscore after the number: `0_Name.ts`, never `0Name.ts`.
- To insert between `1_` and `2_`, use `1a_` or renumber.
- Index files (`index.ts`) get no number; they re-export only.
- Test files mirror source: `0_types.test.ts`.

### When creating a new file

Ask: "what does this depend on, and what number are those files?" Then pick the next number up.

## State Management Preferences

- No `private` in classes. Encapsulation is not a goal in these codebases.
- Reactive / unidirectional dataflow is preferred.
- Over-leveraging type inference is fine while prototyping.
- Do not write one-line functions that wrap an array and call array methods on it. Use the array methods directly.
- Do not Google-style wrap state in N+1 getters and setters.
- Reference-counting a symbol should be cheap and broad. Indirection that obscures call sites is not welcome.

## Testing Rules

- Never use `toBeDefined`. AI assistants reach for it; do not.
- Prefer `toMatchInlineSnapshot` / `toMatchSnapshot` over granular per-field assertions. Snapshots should be maximal and deterministic.
- Do not denormalize shared setup across many tests. Hoist it.

## Anti-Java / Anti-Uncle-Bob

Avoid the patterns that come from Java + Google + Clean Code training corpus:

- Interfaces that exist only to make code testable.
- Dependency injection containers for application code that has no DI need.
- Wrapping primitives in classes for ceremony.
- Splitting a 30-line class into six files for "single responsibility".

When in doubt, fewer files, fewer abstractions, fewer indirections.

## Rule of Colocated Consistency

When editing inside a file, follow that file's existing style for state management and structure even when it diverges from these preferences. Local consistency beats global preference.
