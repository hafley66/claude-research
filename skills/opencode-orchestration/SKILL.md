---
name: opencode-orchestration
description: Spawn opencode workers from a coordinator (Claude Code/Codex). Current doctrine = deepseek-v4-flash-0731 pinned to deepinfra for mechanical delegation lanes; glm z.ai plan for interactive default.
trigger: opencode run, deepseek flash, flash lane, spawn deepseek, opencode worker
---

# opencode orchestration (current prefs, 2026-08-02)

## The delegation model

`openrouter/deepseek/deepseek-v4-flash-0731`, pinned in
`~/.config/opencode/opencode.json`: provider order `["deepinfra"]`,
`allow_fallbacks: false`, `reasoning.effort: high`. Use the 0731 pin ONLY —
never the free route, never unpinned (other providers serve degraded quants).
Interactive default stays `zai-coding-plan/glm-4.6` (config `model`).

## Dispatch

```bash
cd /path/to/worktree && opencode run \
  -m openrouter/deepseek/deepseek-v4-flash-0731 --auto "$(cat brief.md)" &
```

- `--auto` is mandatory in pipes (approval prompt hangs with no TTY).
- One worktree per lane, no commits unless the brief says commit,
  REPORT.md at worktree root is the deliverable contract.
- `--format json` = NDJSON per line; `-s <sessionID>` resume, `--fork` branch.
- Usage/cost per lane: `~/.local/share/opencode/opencode.db` (message.data
  json: tokens.input/output/reasoning, cost). 5-lane night = ~$0.78.

## Flash doctrine (measured, plans/2026-08-02-flash-vs-opus-lane-report.md)

Flash = excellent brief-follower, weak skeptic. Brief quality is its ceiling.

- PREFER flash over claude subagents for any discretely-scoped medium task
  whose brief is well explained (user-set 2026-08-04, in service of shipping
  a performant well-dogfooded product, not of the agents themselves); reserve
  opus for diagnosis and mid-task trade-offs.
- GIVE flash: mechanical sweeps, renames, format-perfect doc/ledger entries,
  config edits — with receipts, file ownership, exact validation commands,
  and style laws stated inline so zero judgment calls remain.
- NEVER give flash: diagnosis, premise-doubting, wrong-layer risk. It fixed
  a non-bug and the wrong layer when the fed premise was wrong; opus lanes
  falsified 3 fed claims flash accepted. Diagnostic lanes go opus/codex.
- REVIEW law (user-set 2026-08-04, "really judge the work... be scrutinous
  on design dimensionality"): the coordinator's audit of a flash lane is a
  DESIGN review, never a gate echo. Green gates prove the brief was followed;
  they prove nothing about the brief. Re-derive at review: does the change
  sit at the right seam, does the contract stay coherent from the other
  side's view, what edge did the brief not enumerate, would a second caller
  of the touched surface agree with the shape. Read the diff hunk by hunk;
  own-run receipts; assume the lane did exactly what was asked and ask
  whether the ask was right.
- Tell it: "if reality deviates from this brief, STOP and report; do not
  improvise."

## Gotchas

Every brief NAMES the package manager. Flash defaults to `npm install`,
which in a pnpm/yarn repo rewrites the lockfile and un-dedupes types;
say the right tool inline and audit the typecheck even when the lane
REPORT claims green.

Cold start ~0.2-0.5s/run. `opencode serve`/ACP/SDK only if you outgrow
`run`. opencode.json `skills.paths` exposes claude-research + sprefa skills
to workers.
