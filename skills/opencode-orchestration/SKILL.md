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

Spawn through `bus` so the lane lands in the registry and stays hailable.

| verb | what it does |
| --- | --- |
| `bus lane` | register AND spawn. The first-contact verb. |
| `bus dispatch` | spawn a tmux session running `--cmd`. `--cmd` is mandatory, so it ALWAYS calls `tmux new-session` and dies with `duplicate session: <name>` if one is live. Never a message. |
| `bus hail --to <agent> --body <text>` | put a message in an agent's mailbox. |
| `bus adopt` | rewrite registry metadata for an already-running process. |
| `bus list` / `bus resolve` | read state. |

`opencode run` is ONE-SHOT: it finishes its turn and exits. A mailbox hail
reaches nothing after that. A second pass is a NEW spawn carrying the prior
session so context survives:

```bash
opencode run -s <sessionID> -m <model> --auto "$(cat FOLLOWUP.md)"
```

Session id for a worktree:

```bash
sqlite3 ~/.local/share/opencode/opencode.db \
  "SELECT id FROM session WHERE directory LIKE '%<lane>%' ORDER BY rowid DESC LIMIT 1;"
```

Wait for pass 1 to exit before spawning pass 2, or the tmux name collides:

```bash
until ! tmux list-panes -t <lane> -F '#{pane_current_command}' 2>/dev/null \
  | grep -q opencode; do sleep 15; done
```

```bash
bus lane --cwd /abs/path/to/worktree --name <lane-id> \
  --harness opencode --mode auto \
  --model openrouter/deepseek/deepseek-v4-flash-0731 \
  --brief /abs/path/to/worktree/BRIEF.md \
  --tmux <lane-id> --parent <coordinator-name>
```

- `--harness opencode` is MANDATORY. Omit it and the lane registers as
  `claude`, bus hunts for a claude session at that cwd, prints
  `unresolved <lane>: no claude session for <dir> yet`, and every later hail
  misses. Verify with `bus list | grep <lane-id>`: the harness column reads
  `opencode` or the lane is wrong.
- `--brief` takes an ABSOLUTE path. A relative one resolves against the
  coordinator's shell cwd, not the lane's, and the spawned body points at a
  file that does not exist.
- Repair a live lane's registration with `bus adopt --name <lane> --tmux
  <session> --harness opencode --cwd <abs dir> --model <id> --mode auto`.
  Adopt rewrites registry metadata only; re-running `bus lane` spawns a
  SECOND agent into the same tmux session.
- Raw spawn, only when the lane must stay out of the registry:

```bash
cd /path/to/worktree && opencode run \
  -m openrouter/deepseek/deepseek-v4-flash-0731 --auto "$(cat BRIEF.md)" &
```

- `--auto` is mandatory in pipes (approval prompt hangs with no TTY).
- One worktree per lane, no commits unless the brief says commit,
  REPORT.md at worktree root is the deliverable contract.
- `--format json` = NDJSON per line; `-s <sessionID>` resume, `--fork` branch.
- Usage/cost per lane: `~/.local/share/opencode/opencode.db` (message.data
  json: tokens.input/output/reasoning, cost). 5-lane night = ~$0.78.
- Read progress with `tmux capture-pane -t <lane-id> -p | tail -20`.

## Flash doctrine (measured, plans/2026-08-02-flash-vs-opus-lane-report.md)

Flash = excellent brief-follower, weak skeptic. Brief quality is its ceiling.

- TWO-PASS LAW (user-set 2026-08-07): no lane output lands off one shot.
  Coordinator plans the workflow, few coordinated lanes over many parallel
  one-shots; flash for discretely confident tasks, opus for anything with
  ambiguity that could punch us; every implementation pass is followed by a
  named second pass (flash debur for style/dead-code/receipt sweep, coordinator
  design-review before merge). Receipt for why: batchlab 2026-08-07, flash's
  E3 reintroduced a prefilter its own brief's REPORT.md had measured as a
  1.4x loss; an isolating control run by the coordinator saved the verdict.
  Tell every pass-1 lane it is pass 1 of 2 so it favors plain code.

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
