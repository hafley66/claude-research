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

- GIVE flash: mechanical sweeps, renames, format-perfect doc/ledger entries,
  config edits — with receipts, file ownership, exact validation commands,
  and style laws stated inline so zero judgment calls remain.
- NEVER give flash: diagnosis, premise-doubting, wrong-layer risk. It fixed
  a non-bug and the wrong layer when the fed premise was wrong; opus lanes
  falsified 3 fed claims flash accepted. Diagnostic lanes go opus/codex.
- Tell it: "if reality deviates from this brief, STOP and report; do not
  improvise."

## Gotchas

Cold start ~0.2-0.5s/run. `opencode serve`/ACP/SDK only if you outgrow
`run`. opencode.json `skills.paths` exposes claude-research + sprefa skills
to workers.
