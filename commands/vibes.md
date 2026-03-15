# /vibes

Quick status sketch of the current session's work. 30-second read max.

## Arguments
- (none) or `medium`: default zoom. Goal + structure + where we are now.
- `short`: just the goal and current position in 3-5 lines.
- `long`: full pseudo-code walkthrough of everything built/changed this session, halfway zoomed out.

## Instructions

Summarize what's been done and where we are **in this conversation only**. Do not read git diffs or file contents to generate this -- use conversation context.

### Format rules

1. Start with a plain-language **Goal:** line. If the goal has shifted or forked during the session, say so.
2. Use ASCII diagrams to show structure, data flow, or file relationships where they clarify. Do not force a diagram where a list suffices.
3. For code-heavy work, use **pseudo code** at a halfway zoom:
   - Not the actual implementation line-by-line
   - Not a vague hand-wave either
   - Show the shape: function signatures, key branching, what flows where
   - If rxjs or reactive patterns are involved, use marble-diagram-style or pipe notation
4. Mark status: ✓ done, ◀── current, ✗ abandoned/blocked
5. Keep `short` to 3-5 lines. Keep default to ~15 lines. `long` can stretch but stay under 40.
6. No filler. No "great progress!" No summaries of summaries.
7. Number sections if there were distinct phases of work.

### Conversation shape

Track **bifurcations** -- when the conversation forked from its original thread. If we started on topic A, detoured to B, then came back or didn't, show that:

```
A ──▶ A ──▶ B (detour) ──▶ A ──▶ C (new thread)
```

If we're off the rails from the original goal, flag it plainly:

```
⚠ drifted: started on X, currently deep in Y (unrelated)
```

This is not a judgment, just orientation. The user wants to know where their head is relative to where it started.

### Style guidance

- Vary the format to match the work. File migrations look different from algorithm design which looks different from config wiring. Do not reuse the same visual template every time.
- The pseudo code zoom level should scale with complexity. Simple CRUD does not need a flow diagram. A reactive pipeline does.
- When the session involved learning/exploration rather than building, reflect that -- what was discovered, what's still unknown.
